
-- Reload schema cache first to ensure we have the latest state
NOTIFY pgrst, 'reload schema';

-- Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    key text NOT NULL UNIQUE,
    value jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid duplication errors
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.system_settings;
DROP POLICY IF EXISTS "Allow update access to superadmin only" ON public.system_settings;
DROP POLICY IF EXISTS "Allow insert access to superadmin only" ON public.system_settings;

-- Create policies
CREATE POLICY "Allow read access to authenticated users"
    ON public.system_settings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow update access to superadmin only"
    ON public.system_settings FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'superadmin'
        )
    );

CREATE POLICY "Allow insert access to superadmin only"
    ON public.system_settings FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role = 'superadmin'
        )
    );

-- Insert default settings
INSERT INTO public.system_settings (key, value)
VALUES 
    ('general', '{"company_name": "Ternakmart", "currency": "IDR", "timezone": "Asia/Jakarta"}'::jsonb),
    ('notifications', '{"order_updates": true, "low_stock_alerts": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Reload schema cache again to ensure the new table is picked up
NOTIFY pgrst, 'reload schema';
