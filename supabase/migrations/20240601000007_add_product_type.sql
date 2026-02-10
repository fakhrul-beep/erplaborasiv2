-- Add type column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'equipment';

-- Update existing products to have a default type (optional, but good for consistency)
UPDATE products SET type = 'equipment' WHERE type IS NULL;

-- Add check constraint to ensure type is either 'equipment' or 'raw_material'
ALTER TABLE products ADD CONSTRAINT check_product_type CHECK (type IN ('equipment', 'raw_material'));
