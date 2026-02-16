-- Migration: Sync User Role to Auth Metadata and Fix RLS Session issues
-- This migration ensures that the 'role' and 'is_approved' status from public.users
-- are synchronized to auth.users (app_metadata), making them available in the JWT.

-- 1. Function to sync public.users data to auth.users metadata
CREATE OR REPLACE FUNCTION public.sync_user_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Update auth.users raw_app_meta_data with the role and approval status
  -- This makes these fields accessible via auth.jwt() -> 'app_metadata'
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object('role', NEW.role, 'is_approved', NEW.is_approved)
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger to keep auth metadata in sync
DROP TRIGGER IF EXISTS on_public_user_update_sync_auth ON public.users;
CREATE TRIGGER on_public_user_update_sync_auth
  AFTER INSERT OR UPDATE OF role, is_approved ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_to_auth();

-- 3. Backfill existing users' metadata
-- This is critical for users like fakhrul@ternakmart.com who are already in the system
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT id, role, is_approved FROM public.users LOOP
    UPDATE auth.users
    SET raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('role', u.role, 'is_approved', u.is_approved)
    WHERE id = u.id;
  END LOOP;
END $$;

-- 4. Optimized RLS for storage.objects using metadata from JWT
-- Using auth.jwt() is much faster and more reliable than subqueries in RLS
CREATE OR REPLACE FUNCTION public.can_manage_product_images_v2()
RETURNS boolean AS $$
DECLARE
  jwt_role text;
  jwt_is_approved boolean;
BEGIN
  -- Extract values from JWT with explicit case-insensitive check if needed
  -- But usually we store them lowercase
  jwt_role := LOWER(auth.jwt() -> 'app_metadata' ->> 'role');
  jwt_is_approved := (auth.jwt() -> 'app_metadata' ->> 'is_approved')::boolean;

  -- Check role from JWT app_metadata first (fastest)
  IF jwt_role IN ('superadmin', 'admin', 'warehouse', 'purchasing') AND jwt_is_approved = true THEN
    RETURN true;
  END IF;

  -- Fallback to database query if metadata is missing or doesn't match
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND LOWER(role) IN ('superadmin', 'admin', 'warehouse', 'purchasing')
    AND is_approved = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update Storage Policies to use the optimized function
DROP POLICY IF EXISTS "Authorized roles can upload product images" ON storage.objects;
CREATE POLICY "Authorized roles can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( 
  bucket_id = 'product-images' 
  AND public.can_manage_product_images_v2()
);

DROP POLICY IF EXISTS "Authorized roles can select product images" ON storage.objects;
CREATE POLICY "Authorized roles can select product images"
ON storage.objects FOR SELECT
TO authenticated
USING ( 
  bucket_id = 'product-images' 
  AND public.can_manage_product_images_v2()
);

DROP POLICY IF EXISTS "Authorized roles can update product images" ON storage.objects;
CREATE POLICY "Authorized roles can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( 
  bucket_id = 'product-images' 
  AND public.can_manage_product_images_v2()
)
WITH CHECK ( 
  bucket_id = 'product-images' 
  AND public.can_manage_product_images_v2()
);
