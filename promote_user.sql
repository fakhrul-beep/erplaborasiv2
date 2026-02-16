
-- Script to promote a registered user to Superadmin
-- Step 1: Replace 'your_email@example.com' with the email you just registered
DO $$
DECLARE
    target_email text := 'admin@ternakmart.id'; -- CHANGE THIS to your registered email
    target_uid uuid;
BEGIN
    -- Find user ID from auth.users
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;
    
    IF target_uid IS NOT NULL THEN
        -- Update public.users
        UPDATE public.users 
        SET 
            role = 'superadmin',
            is_approved = true,
            is_active = true
        WHERE id = target_uid;

        -- Also update metadata in auth.users just in case
        UPDATE auth.users
        SET raw_user_meta_data = jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{role}',
            '"superadmin"'
        )
        WHERE id = target_uid;
        
        RAISE NOTICE 'User % promoted to Superadmin successfully', target_email;
    ELSE
        RAISE NOTICE 'User % not found. Please Sign Up first via the Login page.', target_email;
    END IF;
END $$;
