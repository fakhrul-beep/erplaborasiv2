-- Drop existing policies to be safe
DROP POLICY IF EXISTS "Finance and Superadmin can view/edit payments" ON public.payments;
DROP POLICY IF EXISTS "Sales can view payments" ON public.payments;
DROP POLICY IF EXISTS "Finance and Superadmin can view/edit transactions" ON public.transactions;
DROP POLICY IF EXISTS "Superadmin can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Superadmin can update profiles" ON public.users;

-- Create new policies with correct role checks (using text comparison to be safe)
-- Users policies
CREATE POLICY "Superadmin can view all profiles" ON public.users
  FOR SELECT USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'superadmin'
  );

CREATE POLICY "Superadmin can update profiles" ON public.users
  FOR UPDATE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'superadmin'
  );

-- Payments policies
CREATE POLICY "Finance and Superadmin can view/edit payments" ON public.payments
  FOR ALL USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('finance', 'superadmin')
  );

CREATE POLICY "Sales can view payments" ON public.payments
  FOR SELECT USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'sales'
  );
  
CREATE POLICY "Sales can insert payments" ON public.payments
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'sales'
  );

-- Transactions policies
CREATE POLICY "Finance and Superadmin can view/edit transactions" ON public.transactions
  FOR ALL USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('finance', 'superadmin')
  );
  
-- Grant necessary permissions
GRANT ALL ON public.payments TO authenticated;
GRANT ALL ON public.transactions TO authenticated;
