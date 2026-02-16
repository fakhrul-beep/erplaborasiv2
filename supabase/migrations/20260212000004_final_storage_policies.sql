-- Migration: Final Storage Policy Fix & Best Practices (S3-Style Security)
-- This migration ensures consistency across all storage operations and implements 
-- security best practices similar to AWS S3 Bucket Policies.

-- 1. Ensure SELECT permission on storage.buckets
-- Best practice: Allow authenticated users to see bucket metadata to prevent "Bucket not found" errors in clients.
DROP POLICY IF EXISTS "Authenticated users can view buckets" ON storage.buckets;
CREATE POLICY "Authenticated users can view buckets"
ON storage.buckets FOR SELECT
TO authenticated
USING ( true );

-- 2. Update DELETE policy to use the optimized v2 function
-- This ensures that the superadmin and other roles have consistent delete permissions.
DROP POLICY IF EXISTS "Authorized roles can delete product images" ON storage.objects;
CREATE POLICY "Authorized roles can delete product images"
ON storage.objects FOR DELETE
TO authenticated
USING ( 
  bucket_id = 'product-images' 
  AND public.can_manage_product_images_v2()
);

-- 3. Consolidate SELECT policies for clarity
-- We keep public read access for the 'product-images' bucket (for public URLs).
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
TO public
USING ( bucket_id = 'product-images' );

-- 4. Audit & Fix Potential "Syntax Errors" in RLS
-- Ensure that INSERT and UPDATE use WITH CHECK correctly for resource validation.
-- (This was already largely correct, but we re-apply for absolute consistency).

DROP POLICY IF EXISTS "Authorized roles can upload product images" ON storage.objects;
CREATE POLICY "Authorized roles can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( 
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

-- 5. Documentation of "Bucket Policy" Logic (S3 Equivalent)
-- Principal: authenticated / public
-- Resource: storage.objects WHERE bucket_id = 'product-images'
-- Actions: s3:PutObject (INSERT), s3:GetObject (SELECT), s3:DeleteObject (DELETE), s3:UpdateObject (UPDATE)
-- Condition: public.can_manage_product_images_v2() (Role-based check via JWT metadata)
