-- Add type column to orders and purchase_orders tables
ALTER TABLE orders ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'equipment';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'equipment';

-- Add constraints
ALTER TABLE orders ADD CONSTRAINT check_order_type CHECK (type IN ('equipment', 'raw_material'));
ALTER TABLE purchase_orders ADD CONSTRAINT check_purchase_order_type CHECK (type IN ('equipment', 'raw_material'));
