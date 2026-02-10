-- Add payment_proof_url to orders and purchase_orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
