-- Fix role check constraint
DO $$ 
BEGIN 
    -- Drop the constraint if it exists (handling potentially different auto-generated names if needed, but standard is users_role_check)
    -- We can try to drop users_role_check. 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
        ALTER TABLE public.users DROP CONSTRAINT users_role_check;
    END IF;
END $$;

-- Update any legacy roles to fit new schema
UPDATE public.users SET role = 'superadmin' WHERE role = 'admin';
UPDATE public.users SET role = 'sales' WHERE role = 'manager'; 
UPDATE public.users SET role = 'purchasing' WHERE role = 'warehouse';
-- Ensure all roles are valid
UPDATE public.users SET role = 'sales' WHERE role NOT IN ('superadmin', 'finance', 'sales', 'purchasing');

-- Add the new constraint
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('superadmin', 'finance', 'sales', 'purchasing'));
