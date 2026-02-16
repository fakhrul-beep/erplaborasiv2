
-- Run this script AFTER you have signed up manually via the login page
-- It will promote your user to 'superadmin' role

DO $$
DECLARE
    target_email text := 'admin@ternakmart.id'; -- Change this if you signed up with a different email
    target_uid uuid;
BEGIN
    -- 1. Find user ID from auth.users (Supabase Auth)
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;
    
    IF target_uid IS NOT NULL THEN
        -- 2. Update public.users (Application Data)
        UPDATE public.users 
        SET 
            role = 'superadmin',
            is_approved = true,
            is_active = true
        WHERE id = target_uid;

        -- 3. Update auth.users metadata (for JWT claims and RLS)
        UPDATE auth.users
        SET raw_user_meta_data = jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{role}',
            '"superadmin"'
        )
        WHERE id = target_uid;
        
        RAISE NOTICE 'SUCCESS: User % promoted to Superadmin.', target_email;
    ELSE
        RAISE NOTICE 'ERROR: User % not found. Please create an account via the Sign Up page first.', target_email;
    END IF;
END $$;
