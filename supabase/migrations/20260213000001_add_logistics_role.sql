-- Migration to add 'logistik' role to users table constraint
DO $$ 
BEGIN
    -- Update role check constraint to include 'logistik'
    ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('superadmin', 'admin', 'manager', 'sales', 'sales_equipment', 'sales_raw_material', 'purchasing', 'finance', 'warehouse', 'delivery', 'logistik'));
END $$;
