-- Fix permissions and search_path to prevent "Database error querying schema"

-- 1. Grant explicit usage on public schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Grant access to all tables (ensure no permission denied errors)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon; -- Be careful with this, usually limited by RLS
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- 3. Fix get_my_role to be robust and prevent recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  -- Select role from public.users
  -- SECURITY DEFINER ensures this bypasses RLS
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 4. Fix handle_new_user trigger function to be robust
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, password_hash)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'role', 'sales'), -- Use role from metadata if available
    'managed_by_supabase'
  )
  ON CONFLICT (id) DO UPDATE SET
    -- If user exists (e.g. created by admin_create_user), ensure fields are sync
    email = excluded.email,
    role = excluded.role;
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 5. Update admin functions to set search_path
CREATE OR REPLACE FUNCTION admin_create_user(
    new_email text,
    new_password text,
    new_role text,
    new_name text
) RETURNS uuid AS $$
DECLARE
  new_id uuid;
  check_role text;
  hashed_password text;
BEGIN
  SELECT role INTO check_role FROM public.users WHERE id = auth.uid();
  IF check_role != 'superadmin' THEN
    RAISE EXCEPTION 'Only superadmin can create users';
  END IF;

  new_id := gen_random_uuid();
  hashed_password := crypt(new_password, gen_salt('bf'));
  
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, role, aud, is_super_admin
  )
  VALUES (
    new_id, '00000000-0000-0000-0000-000000000000', new_email, hashed_password, now(), 
    '{"provider":"email","providers":["email"]}', 
    jsonb_build_object('name', new_name, 'role', new_role), 
    now(), now(), 'authenticated', 'authenticated', false
  );
  
  -- Insert into public.users
  INSERT INTO public.users (id, email, name, role, is_approved, is_active, password_hash)
  VALUES (new_id, new_email, new_name, new_role, true, true, hashed_password)
  ON CONFLICT (id) DO UPDATE SET 
    name = excluded.name,
    role = excluded.role,
    is_approved = true,
    is_active = true,
    password_hash = excluded.password_hash;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;

-- 6. Ensure RLS policies are clean (Re-apply correct ones)
-- Users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own profile" ON public.users;
CREATE POLICY "Read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Superadmin read all" ON public.users;
CREATE POLICY "Superadmin read all" ON public.users
  FOR SELECT USING (public.get_my_role() = 'superadmin');

DROP POLICY IF EXISTS "Superadmin update all" ON public.users;
CREATE POLICY "Superadmin update all" ON public.users
  FOR UPDATE USING (public.get_my_role() = 'superadmin');

-- 7. Ensure pgcrypto is available for admin_create_user
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
