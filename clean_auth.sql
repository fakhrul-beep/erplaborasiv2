
-- Clean up script to remove users causing login issues
-- Run this script to delete the users so you can Sign Up again cleanly

-- 1. Delete from public.users first to avoid Foreign Key constraint issues (if any)
DELETE FROM public.users WHERE email IN ('admin@ternakmart.id', 'admin@laborasi.id', 'manager@ternakmart.id');

-- 2. Delete from auth.users
DELETE FROM auth.users WHERE email IN ('admin@ternakmart.id', 'admin@laborasi.id', 'manager@ternakmart.id');

-- 3. Verify deletion
DO $$
DECLARE
    user_count integer;
BEGIN
    SELECT count(*) INTO user_count FROM auth.users WHERE email IN ('admin@ternakmart.id', 'admin@laborasi.id', 'manager@ternakmart.id');
    
    IF user_count = 0 THEN
        RAISE NOTICE 'Users successfully deleted. You can now Sign Up manually.';
    ELSE
        RAISE NOTICE 'Warning: Some users still exist.';
    END IF;
END $$;
