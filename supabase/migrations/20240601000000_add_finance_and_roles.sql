
-- Add role and approval status to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'sales' CHECK (role IN ('superadmin', 'finance', 'sales', 'purchasing')),
ADD COLUMN IF NOT EXISTS is_approved boolean DEFAULT false;

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    payment_date timestamptz DEFAULT now(),
    payment_method text,
    proof_url text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    verified_by uuid REFERENCES public.users(id),
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create transactions table for cashflow
CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    date timestamptz DEFAULT now(),
    description text NOT NULL,
    amount numeric NOT NULL,
    type text NOT NULL CHECK (type IN ('income', 'expense')),
    category text,
    reference_id uuid, -- Can be order_id or purchase_order_id
    reference_type text, -- 'order' or 'purchase_order'
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Trigger to automatically approve the specific superadmin email
CREATE OR REPLACE FUNCTION public.handle_new_user_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'fakhrul@ternakmart.com' THEN
    NEW.role := 'superadmin';
    NEW.is_approved := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created_approval ON public.users;
CREATE TRIGGER on_auth_user_created_approval
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_approval();

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Superadmin can view all profiles" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin')
  );

CREATE POLICY "Superadmin can update profiles" ON public.users
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin')
  );

-- Payments policies
CREATE POLICY "Finance and Superadmin can view/edit payments" ON public.payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('finance', 'superadmin'))
  );

CREATE POLICY "Sales can view payments" ON public.payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'sales')
  );

-- Transactions policies
CREATE POLICY "Finance and Superadmin can view/edit transactions" ON public.transactions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('finance', 'superadmin'))
  );
