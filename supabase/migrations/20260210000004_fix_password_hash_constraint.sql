-- Fix password_hash constraint and update admin_create_user to populate it
-- First, make it nullable to be safe for existing flows
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- Update the admin_create_user function to populate password_hash
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
  -- Check if executor is superadmin
  SELECT role INTO check_role FROM public.users WHERE id = auth.uid();
  IF check_role != 'superadmin' THEN
    RAISE EXCEPTION 'Only superadmin can create users';
  END IF;

  new_id := gen_random_uuid();
  hashed_password := crypt(new_password, gen_salt('bf'));
  
  -- Insert into auth.users
  INSERT INTO auth.users (
    id, 
    instance_id, 
    email, 
    encrypted_password, 
    email_confirmed_at, 
    raw_app_meta_data, 
    raw_user_meta_data, 
    created_at, 
    updated_at, 
    role, 
    aud, 
    is_super_admin
  )
  VALUES (
    new_id, 
    '00000000-0000-0000-0000-000000000000', 
    new_email, 
    hashed_password, 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    jsonb_build_object('name', new_name, 'role', new_role), 
    now(), 
    now(), 
    'authenticated', 
    'authenticated', 
    false
  );
  
  -- Insert into public.users
  -- Explicitly populate password_hash with the same hash
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
