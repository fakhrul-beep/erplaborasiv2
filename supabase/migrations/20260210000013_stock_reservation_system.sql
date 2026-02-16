-- Migration: 20260210000013_stock_reservation_system.sql
-- Description: Implements immediate stock reservation for SO and immediate stock addition for PO.
--              Includes auto-reversal for Cancelled/Expired orders.

-- 1. Update Status Constraints to include 'expired'
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
    CHECK (status IN ('newly_created', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'completed', 'draft', 'expired'));

ALTER TABLE purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_status_check 
    CHECK (status IN ('draft', 'ordered', 'received', 'cancelled', 'expired'));

-- 2. Drop old triggers/functions
DROP TRIGGER IF EXISTS trg_update_stock_on_order_status_change ON orders;
DROP FUNCTION IF EXISTS update_stock_on_order_status_change();
DROP TRIGGER IF EXISTS trg_update_stock_on_purchase_order_status_change ON purchase_orders;
DROP FUNCTION IF EXISTS update_stock_on_purchase_order_status_change();

-- 3. Helper Function to check if Order is Active (Holding Stock)
CREATE OR REPLACE FUNCTION is_order_active(p_status VARCHAR) RETURNS BOOLEAN AS $$
BEGIN
    RETURN p_status NOT IN ('cancelled', 'expired');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Sales Order Items Trigger (Immediate Reservation)
CREATE OR REPLACE FUNCTION manage_stock_on_order_items()
RETURNS TRIGGER AS $$
DECLARE
    v_order_status VARCHAR;
    v_warehouse_id UUID;
    v_current_stock INTEGER;
BEGIN
    -- Get default warehouse
    SELECT id INTO v_warehouse_id FROM warehouses LIMIT 1;

    -- Get Order Status
    IF (TG_OP = 'DELETE') THEN
        SELECT status INTO v_order_status FROM orders WHERE id = OLD.order_id;
    ELSE
        SELECT status INTO v_order_status FROM orders WHERE id = NEW.order_id;
    END IF;

    -- Only affect stock if Order is Active
    IF is_order_active(v_order_status) THEN
        IF (TG_OP = 'INSERT') THEN
            -- Check stock availability
            SELECT stock_quantity INTO v_current_stock FROM products WHERE id = NEW.product_id;
            IF v_current_stock < NEW.quantity THEN
                RAISE EXCEPTION 'Insufficient stock for product % (Current: %, Requested: %)', NEW.product_id, v_current_stock, NEW.quantity;
            END IF;

            -- Deduct Stock
            UPDATE products SET stock_quantity = stock_quantity - NEW.quantity, updated_at = NOW() WHERE id = NEW.product_id;
            
            -- Log
            INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, balance_after, reference_type, reference_id, user_id, notes)
            VALUES (NEW.product_id, v_warehouse_id, 'out', NEW.quantity, v_current_stock - NEW.quantity, 'order_reservation', NEW.order_id, auth.uid(), 'Reservation for Order Item');

        ELSIF (TG_OP = 'DELETE') THEN
            -- Add Stock Back
            UPDATE products SET stock_quantity = stock_quantity + OLD.quantity, updated_at = NOW() WHERE id = OLD.product_id;
            
            -- Log
            INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, balance_after, reference_type, reference_id, user_id, notes)
            SELECT OLD.product_id, v_warehouse_id, 'in', OLD.quantity, stock_quantity, 'order_item_removed', OLD.order_id, auth.uid(), 'Item removed from Order' FROM products WHERE id = OLD.product_id;

        ELSIF (TG_OP = 'UPDATE') THEN
            -- Adjust Stock
            DECLARE
                v_diff INTEGER := NEW.quantity - OLD.quantity;
            BEGIN
                IF v_diff > 0 THEN
                     -- Check availability for increase
                    SELECT stock_quantity INTO v_current_stock FROM products WHERE id = NEW.product_id;
                    IF v_current_stock < v_diff THEN
                        RAISE EXCEPTION 'Insufficient stock for increase';
                    END IF;
                    UPDATE products SET stock_quantity = stock_quantity - v_diff WHERE id = NEW.product_id;
                ELSE
                    UPDATE products SET stock_quantity = stock_quantity - v_diff WHERE id = NEW.product_id; -- v_diff is negative, so it adds
                END IF;
            END;
        END IF;
    END IF;
    
    RETURN NULL; -- After trigger, return value ignored
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_reservation_items
AFTER INSERT OR UPDATE OR DELETE ON order_items
FOR EACH ROW EXECUTE FUNCTION manage_stock_on_order_items();


-- 5. Sales Order Status Trigger (Reversal/Re-Reservation)
CREATE OR REPLACE FUNCTION manage_stock_on_order_status()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    v_warehouse_id UUID;
BEGIN
    SELECT id INTO v_warehouse_id FROM warehouses LIMIT 1;

    -- Case 1: Active -> Inactive (Cancelled/Expired) : REVERT STOCK (Add back)
    IF is_order_active(OLD.status) AND NOT is_order_active(NEW.status) THEN
        FOR item IN SELECT product_id, quantity FROM order_items WHERE order_id = NEW.id LOOP
            UPDATE products SET stock_quantity = stock_quantity + item.quantity WHERE id = item.product_id;
            
            INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, balance_after, reference_type, reference_id, user_id, notes)
            SELECT item.product_id, v_warehouse_id, 'in', item.quantity, stock_quantity, 'order_reversal', NEW.id, NEW.user_id, 'Order ' || NEW.status || ' - Stock Reverted'
            FROM products WHERE id = item.product_id;
        END LOOP;

    -- Case 2: Inactive -> Active (Re-opened?) : RESERVE STOCK (Deduct)
    ELSIF NOT is_order_active(OLD.status) AND is_order_active(NEW.status) THEN
        FOR item IN SELECT product_id, quantity FROM order_items WHERE order_id = NEW.id LOOP
            -- Check stock
            IF (SELECT stock_quantity FROM products WHERE id = item.product_id) < item.quantity THEN
                RAISE EXCEPTION 'Insufficient stock to re-activate order';
            END IF;

            UPDATE products SET stock_quantity = stock_quantity - item.quantity, updated_at = NOW() WHERE id = item.product_id;

            INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, balance_after, reference_type, reference_id, user_id, notes)
            SELECT item.product_id, v_warehouse_id, 'out', item.quantity, stock_quantity, 'order_reactivation', NEW.id, NEW.user_id, 'Order Re-activated - Stock Reserved'
            FROM products WHERE id = item.product_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_reservation_status
AFTER UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION manage_stock_on_order_status();


-- 6. Purchase Order Items Trigger (Immediate Addition)
-- NOTE: Assuming PO Increases Stock immediately (Expected Stock). 
-- If user meant "PO Reduces Stock", this logic would need inversion.
CREATE OR REPLACE FUNCTION manage_stock_on_po_items()
RETURNS TRIGGER AS $$
DECLARE
    v_po_status VARCHAR;
    v_warehouse_id UUID;
BEGIN
    SELECT id INTO v_warehouse_id FROM warehouses LIMIT 1;

    IF (TG_OP = 'DELETE') THEN
        SELECT status INTO v_po_status FROM purchase_orders WHERE id = OLD.purchase_order_id;
    ELSE
        SELECT status INTO v_po_status FROM purchase_orders WHERE id = NEW.purchase_order_id;
    END IF;

    -- Only affect stock if PO is Active (Not Cancelled/Expired)
    IF is_order_active(v_po_status) THEN
        IF (TG_OP = 'INSERT') THEN
            UPDATE products SET stock_quantity = stock_quantity + NEW.quantity WHERE id = NEW.product_id;
            -- Log (In)
             INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, balance_after, reference_type, reference_id, user_id, notes)
             SELECT NEW.product_id, v_warehouse_id, 'in', NEW.quantity, stock_quantity, 'po_creation', NEW.purchase_order_id, auth.uid(), 'PO Created - Stock Added' FROM products WHERE id = NEW.product_id;

        ELSIF (TG_OP = 'DELETE') THEN
            UPDATE products SET stock_quantity = stock_quantity - OLD.quantity WHERE id = OLD.product_id;
             -- Log (Out)
             INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, balance_after, reference_type, reference_id, user_id, notes)
             SELECT OLD.product_id, v_warehouse_id, 'out', OLD.quantity, stock_quantity, 'po_item_removed', OLD.purchase_order_id, auth.uid(), 'PO Item Removed - Stock Deducted' FROM products WHERE id = OLD.product_id;

        ELSIF (TG_OP = 'UPDATE') THEN
            UPDATE products SET stock_quantity = stock_quantity + (NEW.quantity - OLD.quantity) WHERE id = NEW.product_id;
        END IF;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_po_items
AFTER INSERT OR UPDATE OR DELETE ON purchase_order_items
FOR EACH ROW EXECUTE FUNCTION manage_stock_on_po_items();


-- 7. Purchase Order Status Trigger
CREATE OR REPLACE FUNCTION manage_stock_on_po_status()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
    v_warehouse_id UUID;
BEGIN
    SELECT id INTO v_warehouse_id FROM warehouses LIMIT 1;

    -- Active -> Inactive : Revert (Deduct)
    IF is_order_active(OLD.status) AND NOT is_order_active(NEW.status) THEN
        FOR item IN SELECT product_id, quantity FROM purchase_order_items WHERE purchase_order_id = NEW.id LOOP
            UPDATE products SET stock_quantity = stock_quantity - item.quantity, updated_at = NOW() WHERE id = item.product_id;
             -- Log
             INSERT INTO inventory_movements (product_id, warehouse_id, movement_type, quantity, balance_after, reference_type, reference_id, user_id, notes)
             SELECT item.product_id, v_warehouse_id, 'out', item.quantity, stock_quantity, 'po_reversal', NEW.id, NEW.user_id, 'PO Cancelled/Expired - Stock Reverted' FROM products WHERE id = item.product_id;
        END LOOP;

    -- Inactive -> Active : Revert (Add)
    ELSIF NOT is_order_active(OLD.status) AND is_order_active(NEW.status) THEN
        FOR item IN SELECT product_id, quantity FROM purchase_order_items WHERE purchase_order_id = NEW.id LOOP
            UPDATE products SET stock_quantity = stock_quantity + item.quantity, updated_at = NOW() WHERE id = item.product_id;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stock_po_status
AFTER UPDATE OF status ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION manage_stock_on_po_status();


-- 8. Stored Procedure for Expiration
CREATE OR REPLACE FUNCTION check_and_expire_orders()
RETURNS void AS $$
DECLARE
    r_order RECORD;
    r_po RECORD;
BEGIN
    -- Expire Sales Orders > 7 days old AND status is draft/pending
    -- Assuming 'created_at' is the timestamp
    FOR r_order IN SELECT id FROM orders 
                   WHERE status IN ('draft', 'pending', 'newly_created') 
                   AND created_at < NOW() - INTERVAL '7 days' 
    LOOP
        UPDATE orders SET status = 'expired', updated_at = NOW() WHERE id = r_order.id;
        -- Trigger will handle stock reversal
    END LOOP;

    -- Expire Purchase Orders > 7 days old AND status is draft
    FOR r_po IN SELECT id FROM purchase_orders 
                WHERE status IN ('draft') 
                AND created_at < NOW() - INTERVAL '7 days' 
    LOOP
        UPDATE purchase_orders SET status = 'expired', updated_at = NOW() WHERE id = r_po.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
