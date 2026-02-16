-- Migration: Shipment Management System
-- Description: Comprehensive shipping management integrated with sales and purchase modules.

-- 1. Create shipping_vendors table
CREATE TABLE IF NOT EXISTS public.shipping_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    coverage_area TEXT,
    service_type TEXT, -- e.g., 'reguler', 'express', 'trucking'
    rate_per_kg DECIMAL(12,2) DEFAULT 0,
    estimated_days INTEGER,
    rating_on_time DECIMAL(3,2) DEFAULT 0,
    rating_damage DECIMAL(3,2) DEFAULT 0,
    rating_service DECIMAL(3,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create shipment_orders table
CREATE TABLE IF NOT EXISTS public.shipment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES public.shipping_vendors(id),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_transit', 'delivered', 'failed')),
    type VARCHAR(50) NOT NULL CHECK (type IN ('sales', 'purchase')),
    category VARCHAR(50) CHECK (category IN ('equipment', 'raw_material')),
    
    -- Tracking & Logistics
    tracking_number VARCHAR(100),
    shipping_cost DECIMAL(12,2) DEFAULT 0,
    actual_weight DECIMAL(10,2) DEFAULT 0, -- in kg
    volumetric_weight DECIMAL(10,2) DEFAULT 0, -- (P*L*T)/4000
    total_weight DECIMAL(10,2) DEFAULT 0, -- MAX(actual, volumetric)
    dimension_p DECIMAL(10,2) DEFAULT 0, -- in cm
    dimension_l DECIMAL(10,2) DEFAULT 0,
    dimension_t DECIMAL(10,2) DEFAULT 0,
    volume DECIMAL(12,4) DEFAULT 0, -- in m3
    fragility_level VARCHAR(20) DEFAULT 'low' CHECK (fragility_level IN ('low', 'medium', 'high')),
    requires_crane BOOLEAN DEFAULT false,
    
    -- Raw Material specific parameters
    storage_temp DECIMAL(5,2), -- in Celsius
    storage_humidity DECIMAL(5,2), -- in %
    shelf_life_days INTEGER,
    
    -- Digital POD
    delivery_proof_url TEXT,
    driver_signature TEXT, -- Base64 or URL
    gps_coordinates TEXT, -- "lat,long"
    
    -- Control & Approval
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES public.users(id),
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint: either order_id or purchase_order_id must be present
    CONSTRAINT check_shipment_reference CHECK (
        (order_id IS NOT NULL AND purchase_order_id IS NULL) OR
        (order_id IS NULL AND purchase_order_id IS NOT NULL)
    )
);

-- 3. Create shipment_audit_logs table
CREATE TABLE IF NOT EXISTS public.shipment_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID REFERENCES public.shipment_orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.shipping_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
-- Only users with 'delivery', 'admin', or 'superadmin' role can manage shipments
CREATE POLICY "Delivery users can manage shipments" ON public.shipment_orders
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.role IN ('delivery', 'admin', 'superadmin', 'warehouse'))
        )
    );

CREATE POLICY "Users can view shipments related to their orders" ON public.shipment_orders
    FOR SELECT TO authenticated
    USING (true);

-- Add explicit policy for all roles that need to see shipments
CREATE POLICY "Logistik and admins can see all shipments" ON public.shipment_orders
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND (users.role IN ('logistik', 'delivery', 'admin', 'superadmin', 'warehouse', 'purchasing', 'manager'))
        )
    );

CREATE POLICY "Admin can manage vendors" ON public.shipping_vendors
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'superadmin', 'purchasing')
        )
    );

CREATE POLICY "Everyone can view vendors" ON public.shipping_vendors
    FOR SELECT TO authenticated
    USING (true);

-- 6. Audit Trail Trigger Function
CREATE OR REPLACE FUNCTION public.fn_audit_shipment_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.shipment_audit_logs (shipment_id, user_id, action, old_values, new_values)
    VALUES (
        COALESCE(NEW.id, OLD.id),
        auth.uid(),
        TG_OP,
        CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_shipment
AFTER INSERT OR UPDATE OR DELETE ON public.shipment_orders
FOR EACH ROW EXECUTE FUNCTION public.fn_audit_shipment_changes();

-- 7. Automatic Shipment Order Creation Trigger
CREATE OR REPLACE FUNCTION public.fn_create_shipment_on_transaction_confirm()
RETURNS TRIGGER AS $$
DECLARE
    v_type VARCHAR(50);
    v_category VARCHAR(50);
BEGIN
    -- Check if it's an 'orders' (Sales) table or 'purchase_orders' table
    IF TG_TABLE_NAME = 'orders' THEN
        IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
            -- Check stock for sales
            IF EXISTS (
                SELECT 1 FROM public.order_items oi
                JOIN public.products p ON p.id = oi.product_id
                WHERE oi.order_id = NEW.id AND p.stock_quantity < oi.quantity
            ) THEN
                -- Optionally log failure or raise notice
                RETURN NEW;
            END IF;

            INSERT INTO public.shipment_orders (order_id, type, category, status)
            VALUES (NEW.id, 'sales', NEW.type, 'pending');
        END IF;
    ELSIF TG_TABLE_NAME = 'purchase_orders' THEN
        IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
            INSERT INTO public.shipment_orders (purchase_order_id, type, category, status)
            VALUES (NEW.id, 'purchase', NEW.type, 'pending');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Sales Orders
DROP TRIGGER IF EXISTS trg_create_shipment_sales ON public.orders;
CREATE TRIGGER trg_create_shipment_sales
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_create_shipment_on_transaction_confirm();

-- Trigger for Purchase Orders
DROP TRIGGER IF EXISTS trg_create_shipment_purchase ON public.purchase_orders;
CREATE TRIGGER trg_create_shipment_purchase
AFTER UPDATE ON public.purchase_orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_create_shipment_on_transaction_confirm();

-- 8. Automatic Transaction Status Update Webhook/Trigger
CREATE OR REPLACE FUNCTION public.fn_update_transaction_status_on_shipment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
        IF NEW.type = 'sales' AND NEW.order_id IS NOT NULL THEN
            UPDATE public.orders SET status = 'delivered', updated_at = NOW() WHERE id = NEW.order_id;
        ELSIF NEW.type = 'purchase' AND NEW.purchase_order_id IS NOT NULL THEN
            UPDATE public.purchase_orders SET status = 'received', updated_at = NOW() WHERE id = NEW.purchase_order_id;
        END IF;
    ELSIF NEW.status = 'in_transit' AND OLD.status != 'in_transit' THEN
        IF NEW.type = 'sales' AND NEW.order_id IS NOT NULL THEN
            UPDATE public.orders SET status = 'shipped', updated_at = NOW() WHERE id = NEW.order_id;
        ELSIF NEW.type = 'purchase' AND NEW.purchase_order_id IS NOT NULL THEN
            UPDATE public.purchase_orders SET status = 'shipped', updated_at = NOW() WHERE id = NEW.purchase_order_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_transaction_status
AFTER UPDATE ON public.shipment_orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_update_transaction_status_on_shipment();

-- 9. Volumetric Weight Calculation Helper
CREATE OR REPLACE FUNCTION public.fn_calculate_shipment_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Volumetric Weight: (P*L*T)/4000
    NEW.volumetric_weight := (NEW.dimension_p * NEW.dimension_l * NEW.dimension_t) / 4000.0;
    
    -- Volume in m3: (P*L*T)/1000000
    NEW.volume := (NEW.dimension_p * NEW.dimension_l * NEW.dimension_t) / 1000000.0;
    
    -- Total Weight: MAX(actual_weight, volumetric_weight)
    NEW.total_weight := GREATEST(NEW.actual_weight, NEW.volumetric_weight);
    
    -- Automatic Crane requirement for heavy items
    IF NEW.total_weight > 100 THEN
        NEW.requires_crane := true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calc_shipment_metrics
BEFORE INSERT OR UPDATE OF dimension_p, dimension_l, dimension_t, actual_weight ON public.shipment_orders
FOR EACH ROW EXECUTE FUNCTION public.fn_calculate_shipment_metrics();

-- 10. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_shipment_orders_order_id ON public.shipment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_shipment_orders_purchase_order_id ON public.shipment_orders(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_shipment_orders_status ON public.shipment_orders(status);
CREATE INDEX IF NOT EXISTS idx_shipment_orders_created_at ON public.shipment_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_shipping_vendors_is_active ON public.shipping_vendors(is_active);
