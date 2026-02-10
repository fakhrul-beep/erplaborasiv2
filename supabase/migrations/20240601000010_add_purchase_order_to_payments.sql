-- Add purchase_order_id to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id);

-- Add constraint to ensure either order_id or purchase_order_id is set (or both? usually one)
-- But existing rows might violate if I enforce strict check immediately without cleanup, but it's fine for now.
-- Let's just add the column.

-- Optional: Add index for performance
CREATE INDEX IF NOT EXISTS idx_payments_purchase_order_id ON payments(purchase_order_id);
