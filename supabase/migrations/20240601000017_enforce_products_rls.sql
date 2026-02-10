
-- Enable RLS on products if not already enabled
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Re-create the policy to be absolutely sure
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON products;
CREATE POLICY "Enable all access for authenticated users" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
