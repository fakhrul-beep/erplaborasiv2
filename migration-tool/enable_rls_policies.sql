-- Script to Enable Full Access for Migration (Temporary)
-- Run this in Supabase SQL Editor to allow the migration tool to insert/read data.
-- AFTER MIGRATION: You should remove these policies and set up proper security!

-- 1. users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_users" ON public.users;
CREATE POLICY "allow_migration_users" ON public.users FOR ALL USING (true) WITH CHECK (true);

-- 2. products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_products" ON public.products;
CREATE POLICY "allow_migration_products" ON public.products FOR ALL USING (true) WITH CHECK (true);

-- 3. customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_customers" ON public.customers;
CREATE POLICY "allow_migration_customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

-- 4. suppliers
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_suppliers" ON public.suppliers;
CREATE POLICY "allow_migration_suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

-- 5. warehouses
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_warehouses" ON public.warehouses;
CREATE POLICY "allow_migration_warehouses" ON public.warehouses FOR ALL USING (true) WITH CHECK (true);

-- 6. orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_orders" ON public.orders;
CREATE POLICY "allow_migration_orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- 7. order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_order_items" ON public.order_items;
CREATE POLICY "allow_migration_order_items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);

-- 8. inventory_movements
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_inventory_movements" ON public.inventory_movements;
CREATE POLICY "allow_migration_inventory_movements" ON public.inventory_movements FOR ALL USING (true) WITH CHECK (true);

-- 9. payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_payments" ON public.payments;
CREATE POLICY "allow_migration_payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);

-- 10. audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_audit_logs" ON public.audit_logs;
CREATE POLICY "allow_migration_audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- 11. purchase_order_items
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_purchase_order_items" ON public.purchase_order_items;
CREATE POLICY "allow_migration_purchase_order_items" ON public.purchase_order_items FOR ALL USING (true) WITH CHECK (true);

-- 12. purchase_orders
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_purchase_orders" ON public.purchase_orders;
CREATE POLICY "allow_migration_purchase_orders" ON public.purchase_orders FOR ALL USING (true) WITH CHECK (true);

-- 13. shipment_audit_logs
ALTER TABLE public.shipment_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_shipment_audit_logs" ON public.shipment_audit_logs;
CREATE POLICY "allow_migration_shipment_audit_logs" ON public.shipment_audit_logs FOR ALL USING (true) WITH CHECK (true);

-- 14. shipment_orders
ALTER TABLE public.shipment_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_shipment_orders" ON public.shipment_orders;
CREATE POLICY "allow_migration_shipment_orders" ON public.shipment_orders FOR ALL USING (true) WITH CHECK (true);

-- 15. shipping_vendors
ALTER TABLE public.shipping_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_shipping_vendors" ON public.shipping_vendors;
CREATE POLICY "allow_migration_shipping_vendors" ON public.shipping_vendors FOR ALL USING (true) WITH CHECK (true);

-- 16. stock_opname_approvals
ALTER TABLE public.stock_opname_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_stock_opname_approvals" ON public.stock_opname_approvals;
CREATE POLICY "allow_migration_stock_opname_approvals" ON public.stock_opname_approvals FOR ALL USING (true) WITH CHECK (true);

-- 17. stock_opname_items
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_stock_opname_items" ON public.stock_opname_items;
CREATE POLICY "allow_migration_stock_opname_items" ON public.stock_opname_items FOR ALL USING (true) WITH CHECK (true);

-- 18. stock_opname_sessions
ALTER TABLE public.stock_opname_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_stock_opname_sessions" ON public.stock_opname_sessions;
CREATE POLICY "allow_migration_stock_opname_sessions" ON public.stock_opname_sessions FOR ALL USING (true) WITH CHECK (true);

-- 19. system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_system_settings" ON public.system_settings;
CREATE POLICY "allow_migration_system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

-- 20. transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_migration_transactions" ON public.transactions;
CREATE POLICY "allow_migration_transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
