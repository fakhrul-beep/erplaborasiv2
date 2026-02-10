-- Enable RLS on all tables (just in case, though they seem enabled)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- Create generic "Authenticated users can do everything" policies for these business tables
-- We can refine these later based on roles (sales vs purchasing), but for now, unblock the app.

-- Products
CREATE POLICY "Enable all access for authenticated users" ON public.products
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Customers
CREATE POLICY "Enable all access for authenticated users" ON public.customers
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Suppliers
CREATE POLICY "Enable all access for authenticated users" ON public.suppliers
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Orders
CREATE POLICY "Enable all access for authenticated users" ON public.orders
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Order Items
CREATE POLICY "Enable all access for authenticated users" ON public.order_items
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Purchase Orders
CREATE POLICY "Enable all access for authenticated users" ON public.purchase_orders
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Purchase Order Items
CREATE POLICY "Enable all access for authenticated users" ON public.purchase_order_items
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Inventory Movements
CREATE POLICY "Enable all access for authenticated users" ON public.inventory_movements
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Warehouses
CREATE POLICY "Enable all access for authenticated users" ON public.warehouses
FOR ALL TO authenticated USING (true) WITH CHECK (true);
