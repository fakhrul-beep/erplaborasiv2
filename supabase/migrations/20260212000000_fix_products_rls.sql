
-- Fix RLS Policies for products table
-- This migration ensures that authenticated users can perform all operations on products,
-- while anonymous users can only read them.

-- 1. Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.products;
DROP POLICY IF EXISTS "Enable read for anon on products" ON public.products;
DROP POLICY IF EXISTS "Enable all for authenticated users on products" ON public.products;

-- 3. Create fresh policies
-- Permissive policy for authenticated users (Allows INSERT, UPDATE, DELETE, SELECT)
CREATE POLICY "authenticated_full_access" 
ON public.products 
FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Read-only policy for anonymous users
CREATE POLICY "anon_read_only" 
ON public.products 
FOR SELECT 
TO anon 
USING (true);

-- 4. Ensure permissions are granted
GRANT ALL ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;

-- 5. Explicitly handle the 'new row violates row-level security policy' error case
-- by ensuring the 'authenticated' role actually has the right to insert.
-- Sometimes 'GRANT ALL' is not enough if RLS is enabled and policies are missing.
-- Here we've added 'authenticated_full_access'.
