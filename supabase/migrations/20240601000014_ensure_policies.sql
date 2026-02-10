
-- Enable RLS and add policies for Orders and Purchase Orders if not exists

-- Orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON orders;
CREATE POLICY "Enable all access for authenticated users" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Order Items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON order_items;
CREATE POLICY "Enable all access for authenticated users" ON order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Purchase Orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON purchase_orders;
CREATE POLICY "Enable all access for authenticated users" ON purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Purchase Order Items
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON purchase_order_items;
CREATE POLICY "Enable all access for authenticated users" ON purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
