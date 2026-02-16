-- Migration: Logistics System Enhancement
-- Description: Split logistics into "Pengiriman Perlengkapan" and "Pengiriman Bahan Baku".
-- This migration adds the logistics_type column to shipment_orders and
-- updates existing data to reflect the new split:
-- - Pengiriman Perlengkapan (Incoming Materials from Purchase)
-- - Pengiriman Bahan Baku (Outgoing Products from Sales)

-- We will add a new column 'logistics_type' to shipment_orders to clearly distinguish
ALTER TABLE public.shipment_orders ADD COLUMN IF NOT EXISTS logistics_type VARCHAR(50) 
CHECK (logistics_type IN ('penerimaan_bahan_baku', 'pengiriman_produk_jadi'));

-- Migrate existing data
UPDATE public.shipment_orders 
SET logistics_type = 'pengiriman_produk_jadi' 
WHERE type = 'sales';

UPDATE public.shipment_orders 
SET logistics_type = 'penerimaan_bahan_baku' 
WHERE type = 'purchase';

-- 2. Update the trigger to use the new logistics_type
CREATE OR REPLACE FUNCTION public.fn_create_shipment_on_transaction_confirm()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'orders' THEN
        -- Sales Order -> Pengiriman Bahan Baku
        IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
            -- Check if it's already created to avoid duplicates
            IF EXISTS (SELECT 1 FROM public.shipment_orders WHERE order_id = NEW.id) THEN
                RETURN NEW;
            END IF;

            INSERT INTO public.shipment_orders (order_id, type, category, status, logistics_type)
            VALUES (NEW.id, 'sales', NEW.type, 'pending', 'pengiriman_produk_jadi');
        END IF;
    ELSIF TG_TABLE_NAME = 'purchase_orders' THEN
        -- Purchase Order -> Pengiriman Perlengkapan
        IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
            INSERT INTO public.shipment_orders (purchase_order_id, type, category, status, logistics_type)
            VALUES (NEW.id, 'purchase', NEW.type, 'pending', 'penerimaan_bahan_baku');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Add a validation trigger to block "Pengiriman Pembelian"
CREATE OR REPLACE FUNCTION public.fn_block_invalid_shipment_type()
RETURNS TRIGGER AS $$
BEGIN
    -- Logic: If someone tries to manually insert/update a shipment with type='purchase' 
    -- and it's NOT labeled as 'penerimaan_bahan_baku', or if they explicitly try to use a "pengiriman" label for purchase.
    
    IF NEW.type = 'purchase' AND NEW.logistics_type != 'penerimaan_bahan_baku' THEN
        RAISE EXCEPTION 'Pembelian dicatat sebagai pengiriman perlengkapan, bukan pengiriman';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_block_invalid_shipment ON public.shipment_orders;
CREATE TRIGGER trg_block_invalid_shipment
BEFORE INSERT OR UPDATE ON public.shipment_orders
FOR EACH ROW
EXECUTE FUNCTION public.fn_block_invalid_shipment_type();

-- 4. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
