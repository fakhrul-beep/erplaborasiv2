DO $$
DECLARE
  superadmin_id uuid;
BEGIN
  -- Find the user id from auth.users (if possible, but we can't access auth.users directly easily in DDL for RLS usually, 
  -- but we can update public.users based on email which is synced)
  
  -- Update public.users
  UPDATE public.users 
  SET role = 'superadmin', is_approved = true 
  WHERE email = 'fakhrul@dapurlaborasi.com';
  
END $$;
