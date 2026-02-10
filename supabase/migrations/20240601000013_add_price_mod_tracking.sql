-- Add cost_price to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;

-- Add price modification tracking columns to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS original_unit_price NUMERIC;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_change_reason TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_change_by UUID REFERENCES public.users(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price_change_at TIMESTAMP WITH TIME ZONE;
