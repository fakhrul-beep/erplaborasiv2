-- Function to update stock on Order status change
CREATE OR REPLACE FUNCTION update_stock_on_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    v_warehouse_id UUID;
BEGIN
    -- Get default warehouse (first one found)
    SELECT id INTO v_warehouse_id FROM warehouses LIMIT 1;

    -- If status changed to 'delivered' or 'completed', deduct stock
    IF (NEW.status IN ('delivered', 'completed')) AND (OLD.status NOT IN ('delivered', 'completed')) THEN
        FOR item IN SELECT product_id, quantity FROM order_items WHERE order_id = NEW.id LOOP
            -- Check if stock is sufficient
            IF (SELECT stock_quantity FROM products WHERE id = item.product_id) < item.quantity THEN
                RAISE EXCEPTION 'Insufficient stock for product % (ID: %). Order cannot be completed.', 
                    (SELECT name FROM products WHERE id = item.product_id), item.product_id;
            END IF;

            -- Update product stock
            UPDATE products 
            SET stock_quantity = stock_quantity - item.quantity,
                updated_at = NOW()
            WHERE id = item.product_id;

            -- Log movement
            INSERT INTO inventory_movements (
                product_id, 
                warehouse_id, 
                movement_type, 
                quantity, 
                balance_after, 
                reference_type, 
                reference_id, 
                user_id,
                notes
            )
            SELECT 
                item.product_id,
                v_warehouse_id,
                'out',
                item.quantity,
                stock_quantity,
                'order',
                NEW.id,
                NEW.user_id,
                'Pengurangan stok otomatis untuk Order #' || NEW.id || ' (Status: ' || NEW.status || ')'
            FROM products
            WHERE id = item.product_id;
        END LOOP;
    
    -- If status changed FROM 'delivered' or 'completed' TO something else (like 'cancelled'), add back stock
    ELSIF (OLD.status IN ('delivered', 'completed')) AND (NEW.status NOT IN ('delivered', 'completed')) THEN
        FOR item IN SELECT product_id, quantity FROM order_items WHERE order_id = NEW.id LOOP
            -- Update product stock
            UPDATE products 
            SET stock_quantity = stock_quantity + item.quantity,
                updated_at = NOW()
            WHERE id = item.product_id;

            -- Log movement
            INSERT INTO inventory_movements (
                product_id, 
                warehouse_id, 
                movement_type, 
                quantity, 
                balance_after, 
                reference_type, 
                reference_id, 
                user_id,
                notes
            )
            SELECT 
                item.product_id,
                v_warehouse_id,
                'in',
                item.quantity,
                stock_quantity,
                'order_reversal',
                NEW.id,
                NEW.user_id,
                'Penambahan kembali stok karena pembatalan/perubahan status Order #' || NEW.id || ' dari ' || OLD.status || ' ke ' || NEW.status
            FROM products
            WHERE id = item.product_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for orders
DROP TRIGGER IF EXISTS trg_update_stock_on_order_status_change ON orders;
CREATE TRIGGER trg_update_stock_on_order_status_change
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_order_status_change();


-- Function to update stock on Purchase Order status change
CREATE OR REPLACE FUNCTION update_stock_on_purchase_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    v_warehouse_id UUID;
BEGIN
    -- Get default warehouse
    SELECT id INTO v_warehouse_id FROM warehouses LIMIT 1;

    -- If status changed to 'received', add stock
    IF (NEW.status = 'received') AND (OLD.status != 'received') THEN
        FOR item IN SELECT product_id, quantity FROM purchase_order_items WHERE purchase_order_id = NEW.id LOOP
            -- Update product stock
            UPDATE products 
            SET stock_quantity = stock_quantity + item.quantity,
                updated_at = NOW()
            WHERE id = item.product_id;

            -- Log movement
            INSERT INTO inventory_movements (
                product_id, 
                warehouse_id, 
                movement_type, 
                quantity, 
                balance_after, 
                reference_type, 
                reference_id, 
                user_id,
                notes
            )
            SELECT 
                item.product_id,
                v_warehouse_id,
                'in',
                item.quantity,
                stock_quantity,
                'purchase_order',
                NEW.id,
                NEW.user_id,
                'Penambahan stok otomatis dari Purchase Order #' || NEW.id
            FROM products
            WHERE id = item.product_id;
        END LOOP;

    -- If status changed FROM 'received' TO something else, deduct stock
    ELSIF (OLD.status = 'received') AND (NEW.status != 'received') THEN
        FOR item IN SELECT product_id, quantity FROM purchase_order_items WHERE purchase_order_id = NEW.id LOOP
            -- Update product stock
            UPDATE products 
            SET stock_quantity = stock_quantity - item.quantity,
                updated_at = NOW()
            WHERE id = item.product_id;

            -- Log movement
            INSERT INTO inventory_movements (
                product_id, 
                warehouse_id, 
                movement_type, 
                quantity, 
                balance_after, 
                reference_type, 
                reference_id, 
                user_id,
                notes
            )
            SELECT 
                item.product_id,
                v_warehouse_id,
                'out',
                item.quantity,
                stock_quantity,
                'purchase_order_reversal',
                NEW.id,
                NEW.user_id,
                'Pengurangan kembali stok karena pembatalan/perubahan status Purchase Order #' || NEW.id || ' dari ' || OLD.status || ' ke ' || NEW.status
            FROM products
            WHERE id = item.product_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for purchase_orders
DROP TRIGGER IF EXISTS trg_update_stock_on_purchase_order_status_change ON purchase_orders;
CREATE TRIGGER trg_update_stock_on_purchase_order_status_change
AFTER UPDATE ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION update_stock_on_purchase_order_status_change();
