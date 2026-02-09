-- Create a secure function to check user role that bypasses RLS
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Finance and Superadmin can view/edit payments" ON public.payments;
DROP POLICY IF EXISTS "Sales can view payments" ON public.payments;
DROP POLICY IF EXISTS "Sales can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Finance and Superadmin can view/edit transactions" ON public.transactions;
DROP POLICY IF EXISTS "Superadmin can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Superadmin can update profiles" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;

-- Re-create Users policies (Avoiding recursion)
-- 1. Everyone can read their own profile (Base rule)
CREATE POLICY "Read own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- 2. Superadmin can read all profiles (Using security definer function to avoid recursion)
CREATE POLICY "Superadmin read all" ON public.users
  FOR SELECT USING (
    public.get_my_role() = 'superadmin'
  );

-- 3. Superadmin can update all profiles
CREATE POLICY "Superadmin update all" ON public.users
  FOR UPDATE USING (
    public.get_my_role() = 'superadmin'
  );

-- Re-create Payments policies
CREATE POLICY "Finance and Superadmin manage payments" ON public.payments
  FOR ALL USING (
    public.get_my_role() IN ('finance', 'superadmin')
  );

CREATE POLICY "Sales view payments" ON public.payments
  FOR SELECT USING (
    public.get_my_role() = 'sales'
  );

CREATE POLICY "Sales insert payments" ON public.payments
  FOR INSERT WITH CHECK (
    public.get_my_role() = 'sales'
  );

-- Re-create Transactions policies
CREATE POLICY "Finance and Superadmin manage transactions" ON public.transactions
  FOR ALL USING (
    public.get_my_role() IN ('finance', 'superadmin')
  );
