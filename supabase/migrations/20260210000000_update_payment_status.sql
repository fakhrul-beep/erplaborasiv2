-- Drop existing constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

-- Update existing data to valid values BEFORE adding new constraint
-- Mapping strategy:
-- pending -> unpaid
-- partial -> unpaid
-- refunded -> unpaid
-- Any other invalid values -> unpaid
UPDATE orders 
SET payment_status = 'unpaid' 
WHERE payment_status NOT IN ('unpaid', 'unverified', 'paid');

-- Add new constraint
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
CHECK (payment_status IN ('unpaid', 'unverified', 'paid'));

-- Update default value
ALTER TABLE orders ALTER COLUMN payment_status SET DEFAULT 'unpaid';
