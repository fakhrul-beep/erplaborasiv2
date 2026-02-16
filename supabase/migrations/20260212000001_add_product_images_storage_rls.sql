-- Create product-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Function to check if user is admin, warehouse, purchasing, or superadmin
CREATE OR REPLACE FUNCTION public.can_manage_product_images()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('superadmin', 'admin', 'warehouse', 'purchasing')
    AND is_approved = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Policy for authorized roles to SELECT (Read) metadata
-- Needed for the upload process to check for existing files
DROP POLICY IF EXISTS "Authorized roles can select product images" ON storage.objects;
CREATE POLICY "Authorized roles can select product images"
ON storage.objects FOR SELECT
TO authenticated
USING ( 
  bucket_id = 'product-images' 
  AND public.can_manage_product_images()
);

-- 2. Policy for authorized roles to upload (INSERT) images
DROP POLICY IF EXISTS "Authorized roles can upload product images" ON storage.objects;
CREATE POLICY "Authorized roles can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( 
  bucket_id = 'product-images' 
  AND public.can_manage_product_images()
);

-- 3. Policy for authorized roles to update images (UPDATE)
DROP POLICY IF EXISTS "Authorized roles can update product images" ON storage.objects;
CREATE POLICY "Authorized roles can update product images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( 
  bucket_id = 'product-images' 
  AND public.can_manage_product_images()
)
WITH CHECK ( 
  bucket_id = 'product-images' 
  AND public.can_manage_product_images()
);

-- 4. Policy for authorized roles to delete images (DELETE)
DROP POLICY IF EXISTS "Authorized roles can delete product images" ON storage.objects;
CREATE POLICY "Authorized roles can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING ( 
  bucket_id = 'product-images' 
  AND public.can_manage_product_images()
);

-- 5. Policy for Public (including anon) to view images (SELECT)
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'product-images' );
