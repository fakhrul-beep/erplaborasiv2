
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
