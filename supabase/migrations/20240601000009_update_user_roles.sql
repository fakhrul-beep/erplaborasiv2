-- Update role check constraint to include new sales roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('superadmin', 'admin', 'manager', 'sales', 'sales_equipment', 'sales_raw_material', 'purchasing', 'finance', 'warehouse'));

-- Migrate existing 'sales' users to 'sales_equipment' (optional, or just leave them as 'sales' if that's a general role)
-- For now, we will just allow the new roles.
