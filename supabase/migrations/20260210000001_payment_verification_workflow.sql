-- Update orders status check constraint
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
    CHECK (status::text = ANY (ARRAY['newly_created'::text, 'pending'::text, 'confirmed'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text, 'completed'::text]));

-- Update orders payment_status check constraint to include 'rejected'
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check 
    CHECK (payment_status::text = ANY (ARRAY['unpaid'::text, 'unverified'::text, 'paid'::text, 'rejected'::text]));

-- Update payments status check constraint to use 'unverified' instead of 'pending'
-- CRITICAL: Drop the old constraint FIRST because it doesn't allow 'unverified'
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;

-- Now update the data
UPDATE public.payments SET status = 'unverified' WHERE status = 'pending';

-- Now add the new constraint
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check 
    CHECK (status = ANY (ARRAY['unverified'::text, 'verified'::text, 'rejected'::text]));

-- Enable RLS on storage.objects if not already enabled
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for Sales to upload (insert)
DROP POLICY IF EXISTS "Sales can upload payment proofs" ON storage.objects;
CREATE POLICY "Sales can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'payment-proofs' );

-- Policy for everyone to view
DROP POLICY IF EXISTS "Authenticated users can view payment proofs" ON storage.objects;
CREATE POLICY "Authenticated users can view payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'payment-proofs' );

-- Create an index on payment_status for performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
