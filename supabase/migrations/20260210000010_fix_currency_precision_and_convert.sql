
-- Increase precision for monetary columns to support large IDR values
ALTER TABLE products ALTER COLUMN price TYPE numeric(20, 2);
ALTER TABLE products ALTER COLUMN cost_price TYPE numeric(20, 2);

ALTER TABLE orders ALTER COLUMN total_amount TYPE numeric(20, 2);
ALTER TABLE orders ALTER COLUMN discount TYPE numeric(20, 2);

ALTER TABLE order_items ALTER COLUMN unit_price TYPE numeric(20, 2);
ALTER TABLE order_items ALTER COLUMN total_price TYPE numeric(20, 2);
ALTER TABLE order_items ALTER COLUMN original_unit_price TYPE numeric(20, 2);

ALTER TABLE purchase_orders ALTER COLUMN total_amount TYPE numeric(20, 2);

ALTER TABLE purchase_order_items ALTER COLUMN unit_price TYPE numeric(20, 2);
ALTER TABLE purchase_order_items ALTER COLUMN total_price TYPE numeric(20, 2);

ALTER TABLE transactions ALTER COLUMN amount TYPE numeric(20, 2);

ALTER TABLE payments ALTER COLUMN amount TYPE numeric(20, 2);

ALTER TABLE customers ALTER COLUMN credit_limit TYPE numeric(20, 2);

-- Now perform the conversion
DO $$
DECLARE
    rate numeric := 16000;
BEGIN
    -- Products
    UPDATE products 
    SET price = price * rate, 
        cost_price = cost_price * rate 
    WHERE price < 5000 OR cost_price < 5000;
    
    -- Orders
    UPDATE orders 
    SET total_amount = total_amount * rate 
    WHERE total_amount < 5000;
    
    UPDATE order_items 
    SET unit_price = unit_price * rate, 
        total_price = total_price * rate, 
        original_unit_price = original_unit_price * rate 
    WHERE unit_price < 5000;
    
    -- Purchase Orders
    UPDATE purchase_orders 
    SET total_amount = total_amount * rate 
    WHERE total_amount < 5000;
    
    UPDATE purchase_order_items 
    SET unit_price = unit_price * rate, 
        total_price = total_price * rate 
    WHERE unit_price < 5000;
    
    -- Transactions
    UPDATE transactions 
    SET amount = amount * rate 
    WHERE amount < 5000;
    
    -- Payments
    UPDATE payments 
    SET amount = amount * rate 
    WHERE amount < 5000;
    
    -- Customers (Credit Limit)
    UPDATE customers 
    SET credit_limit = credit_limit * rate 
    WHERE credit_limit < 5000;
    
END $$;
