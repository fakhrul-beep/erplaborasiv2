-- Fix user creation flow to prevent schema errors and race conditions

-- 1. Refine the handle_new_user trigger
-- We want this trigger to handle the public.users creation for ALL users (auth.signUp AND admin_create_user)
-- to ensure consistency. However, for admin_create_user, we might want to pass more details.
-- The trigger uses `raw_user_meta_data`, which we are correctly passing in admin_create_user.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, password_hash, is_approved, is_active)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'New User'),
    COALESCE(new.raw_user_meta_data->>'role', 'sales'),
    'managed_by_supabase', -- Will be updated if created by admin
    true, -- Default to active
    true  -- Default to approved (or false if we want strict approval)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = excluded.email,
    role = excluded.role,
    name = excluded.name;
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 2. Refine admin_create_user to ONLY insert into auth.users and let the trigger handle public.users
-- BUT, we need to update the password_hash and specific fields that the trigger might set to defaults.
-- So we insert into auth.users, let the trigger fire, and THEN update public.users with the specific hash/status.

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
  
  -- Insert into auth.users. This WILL trigger handle_new_user.
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
  
  -- The trigger has now run and created the public.users record.
  -- We now update it with the correct password hash and ensure approval status.
  -- We use UPDATE instead of INSERT ... ON CONFLICT to avoid race condition ambiguity.
  
  UPDATE public.users 
  SET 
    password_hash = hashed_password,
    is_approved = true,
    is_active = true,
    role = new_role, -- Ensure role is correct
    name = new_name
  WHERE id = new_id;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions;

-- 3. Ensure public schema usage is granted (Redundant but safe)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;

-- 4. Fix potential RLS recursion by using a simpler get_my_role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  -- Direct query with SECURITY DEFINER to bypass RLS
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();
  
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
