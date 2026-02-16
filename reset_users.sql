
-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to clean up a user completely
CREATE OR REPLACE FUNCTION clean_user(target_email text)
RETURNS void AS $$
DECLARE
    target_uid uuid;
BEGIN
    -- Find user ID from auth.users
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;
    
    IF target_uid IS NOT NULL THEN
        -- Delete from public.users first (if exists)
        DELETE FROM public.users WHERE id = target_uid;
        -- Delete from auth.users
        DELETE FROM auth.users WHERE id = target_uid;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up existing users to avoid conflicts
SELECT clean_user('admin@ternakmart.id');
SELECT clean_user('admin@laborasi.id');
SELECT clean_user('user@ternakmart.id');

-- Create Superadmin (Ternakmart)
DO $$
DECLARE
    new_uid uuid := gen_random_uuid();
    user_email text := 'admin@ternakmart.id';
    user_password text := 'password123';
    hashed_password text;
BEGIN
    hashed_password := crypt(user_password, gen_salt('bf'));
    
    -- Insert into auth.users
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at, role, aud, is_super_admin
    )
    VALUES (
        new_uid, '00000000-0000-0000-0000-000000000000', user_email, hashed_password, now(), 
        '{"provider":"email","providers":["email"]}', 
        '{"name": "Super Admin Ternakmart", "role": "superadmin"}', 
        now(), now(), 'authenticated', 'authenticated', false
    );

    -- Insert into public.users (Upsert)
    INSERT INTO public.users (id, email, name, role, is_approved, is_active, password_hash)
    VALUES (new_uid, user_email, 'Super Admin Ternakmart', 'superadmin', true, true, hashed_password)
    ON CONFLICT (id) DO UPDATE SET 
        role = 'superadmin',
        is_approved = true,
        password_hash = hashed_password;
END $$;

-- Create Admin (Laborasi) - For backward compatibility/legacy access
DO $$
DECLARE
    new_uid uuid := gen_random_uuid();
    user_email text := 'admin@laborasi.id';
    user_password text := 'password123';
    hashed_password text;
BEGIN
    hashed_password := crypt(user_password, gen_salt('bf'));
    
    -- Insert into auth.users
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at, role, aud, is_super_admin
    )
    VALUES (
        new_uid, '00000000-0000-0000-0000-000000000000', user_email, hashed_password, now(), 
        '{"provider":"email","providers":["email"]}', 
        '{"name": "Admin Laborasi", "role": "superadmin"}', 
        now(), now(), 'authenticated', 'authenticated', false
    );

    -- Insert into public.users
    INSERT INTO public.users (id, email, name, role, is_approved, is_active, password_hash)
    VALUES (new_uid, user_email, 'Admin Laborasi', 'superadmin', true, true, hashed_password)
    ON CONFLICT (id) DO UPDATE SET 
        role = 'superadmin',
        is_approved = true,
        password_hash = hashed_password;
END $$;

-- Create Regular User (Manager)
DO $$
DECLARE
    new_uid uuid := gen_random_uuid();
    user_email text := 'manager@ternakmart.id';
    user_password text := 'password123';
    hashed_password text;
BEGIN
    hashed_password := crypt(user_password, gen_salt('bf'));
    
    -- Insert into auth.users
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at, 
        raw_app_meta_data, raw_user_meta_data, 
        created_at, updated_at, role, aud, is_super_admin
    )
    VALUES (
        new_uid, '00000000-0000-0000-0000-000000000000', user_email, hashed_password, now(), 
        '{"provider":"email","providers":["email"]}', 
        '{"name": "Manager Ternakmart", "role": "manager"}', 
        now(), now(), 'authenticated', 'authenticated', false
    );

    -- Insert into public.users
    INSERT INTO public.users (id, email, name, role, is_approved, is_active, password_hash)
    VALUES (new_uid, user_email, 'Manager Ternakmart', 'manager', true, true, hashed_password)
    ON CONFLICT (id) DO UPDATE SET 
        role = 'manager',
        is_approved = true,
        password_hash = hashed_password;
END $$;
