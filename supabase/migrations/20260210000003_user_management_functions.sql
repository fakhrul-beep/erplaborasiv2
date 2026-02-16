-- Create Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id),
    action text NOT NULL, -- 'create', 'update', 'delete'
    entity text NOT NULL, -- 'user', 'order', etc.
    entity_id text,
    details jsonb,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only superadmin can view audit logs (or maybe all admins)
CREATE POLICY "Superadmin can view audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (
        exists (
            select 1 from public.users
            where users.id = auth.uid()
            and users.role = 'superadmin'
        )
    );

-- Policy: Authenticated users can insert audit logs (for their actions)
CREATE POLICY "Users can insert audit logs" ON public.audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);


-- Function to Create User (Admin Only)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION admin_create_user(
    new_email text,
    new_password text,
    new_role text,
    new_name text
) RETURNS uuid AS $$
DECLARE
  new_id uuid;
  check_role text;
BEGIN
  -- Check if executor is superadmin
  SELECT role INTO check_role FROM public.users WHERE id = auth.uid();
  IF check_role != 'superadmin' THEN
    RAISE EXCEPTION 'Only superadmin can create users';
  END IF;

  new_id := gen_random_uuid();
  
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
    crypt(new_password, gen_salt('bf')), 
    now(), 
    '{"provider":"email","providers":["email"]}', 
    jsonb_build_object('name', new_name, 'role', new_role), 
    now(), 
    now(), 
    'authenticated', 
    'authenticated', 
    false
  );
  
  -- Insert into public.users (Handling potential trigger duplication with ON CONFLICT)
  INSERT INTO public.users (id, email, name, role, is_approved, is_active)
  VALUES (new_id, new_email, new_name, new_role, true, true)
  ON CONFLICT (id) DO UPDATE SET 
    name = excluded.name,
    role = excluded.role,
    is_approved = true,
    is_active = true;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to Delete User (Admin Only)
CREATE OR REPLACE FUNCTION admin_delete_user(
    target_user_id uuid
) RETURNS void AS $$
DECLARE
  check_role text;
BEGIN
  -- Check if executor is superadmin
  SELECT role INTO check_role FROM public.users WHERE id = auth.uid();
  IF check_role != 'superadmin' THEN
    RAISE EXCEPTION 'Only superadmin can delete users';
  END IF;

  -- Delete from public.users first (if foreign keys allow, or cascade)
  -- Usually we delete from auth.users and let cascade handle it, but sometimes we need manual.
  -- We'll try deleting from auth.users which should cascade to public.users if set up correctly,
  -- OR we delete from public.users then auth.users.
  
  -- Delete from public.users
  DELETE FROM public.users WHERE id = target_user_id;
  
  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to Update User (Admin Only - for Password/Profile)
CREATE OR REPLACE FUNCTION admin_update_user(
    target_user_id uuid,
    new_email text DEFAULT NULL,
    new_password text DEFAULT NULL,
    new_name text DEFAULT NULL,
    new_role text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  check_role text;
BEGIN
  -- Check if executor is superadmin
  SELECT role INTO check_role FROM public.users WHERE id = auth.uid();
  IF check_role != 'superadmin' THEN
    RAISE EXCEPTION 'Only superadmin can update users';
  END IF;

  -- Update auth.users if email/password provided
  IF new_email IS NOT NULL OR new_password IS NOT NULL THEN
    UPDATE auth.users
    SET
        email = COALESCE(new_email, email),
        encrypted_password = CASE WHEN new_password IS NOT NULL THEN crypt(new_password, gen_salt('bf')) ELSE encrypted_password END,
        updated_at = now()
    WHERE id = target_user_id;
  END IF;

  -- Update public.users
  UPDATE public.users
  SET
    email = COALESCE(new_email, email),
    name = COALESCE(new_name, name),
    role = COALESCE(new_role, role),
    updated_at = now()
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
