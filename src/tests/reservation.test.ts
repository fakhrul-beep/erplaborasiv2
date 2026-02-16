import { describe, it, expect } from 'vitest';

// --- SIMULATION ENGINE ---
// This mocks the PostgreSQL Trigger Logic defined in 20260210000013_stock_reservation_system.sql

interface DBState {
    products: Record<string, number>;
    orders: Record<string, { status: string }>;
    orderItems: { orderId: string; productId: string; quantity: number }[];
    purchaseOrders: Record<string, { status: string }>;
    poItems: { poId: string; productId: string; quantity: number }[];
}

class InventorySimulator {
    state: DBState;

    constructor(initialStock: Record<string, number>) {
        this.state = {
            products: { ...initialStock },
            orders: {},
            orderItems: [],
            purchaseOrders: {},
            poItems: []
        };
    }

    // Helper: is_order_active
    isOrderActive(status: string) {
        return !['cancelled', 'expired'].includes(status);
    }

    // --- SALES ORDER ACTIONS ---

    createOrder(id: string, status: string = 'draft') {
        this.state.orders[id] = { status };
    }

    addOrderItem(orderId: string, productId: string, quantity: number) {
        const status = this.state.orders[orderId]?.status;
        
        // Trigger Logic: INSERT ON order_items
        if (this.isOrderActive(status)) {
            // Check Availability
            if (this.state.products[productId] < quantity) {
                throw new Error(`Insufficient stock for product ${productId}`);
            }
            // Deduct
            this.state.products[productId] -= quantity;
        }

        this.state.orderItems.push({ orderId, productId, quantity });
    }

    updateOrderStatus(orderId: string, newStatus: string) {
        const oldStatus = this.state.orders[orderId].status;
        this.state.orders[orderId].status = newStatus;

        // Trigger Logic: UPDATE STATUS ON orders
        const items = this.state.orderItems.filter(i => i.orderId === orderId);

        // Case 1: Active -> Inactive (Revert)
        if (this.isOrderActive(oldStatus) && !this.isOrderActive(newStatus)) {
            items.forEach(item => {
                this.state.products[item.productId] += item.quantity;
            });
        }
        // Case 2: Inactive -> Active (Re-Reserve)
        else if (!this.isOrderActive(oldStatus) && this.isOrderActive(newStatus)) {
            items.forEach(item => {
                if (this.state.products[item.productId] < item.quantity) {
                    throw new Error('Insufficient stock to re-activate order');
                }
                this.state.products[item.productId] -= item.quantity;
            });
        }
    }

    // --- PURCHASE ORDER ACTIONS ---

    createPO(id: string, status: string = 'draft') {
        this.state.purchaseOrders[id] = { status };
    }

    addPOItem(poId: string, productId: string, quantity: number) {
        const status = this.state.purchaseOrders[poId]?.status;
        
        // Trigger Logic: INSERT ON purchase_order_items
        if (this.isOrderActive(status)) {
            // Add Stock (Immediate)
            this.state.products[productId] += quantity;
        }

        this.state.poItems.push({ poId, productId, quantity });
    }

    updatePOStatus(poId: string, newStatus: string) {
        const oldStatus = this.state.purchaseOrders[poId].status;
        this.state.purchaseOrders[poId].status = newStatus;

        // Trigger Logic: UPDATE STATUS ON purchase_orders
        const items = this.state.poItems.filter(i => i.poId === poId);

        // Case 1: Active -> Inactive (Revert/Deduct)
        if (this.isOrderActive(oldStatus) && !this.isOrderActive(newStatus)) {
            items.forEach(item => {
                this.state.products[item.productId] -= item.quantity;
            });
        }
        // Case 2: Inactive -> Active (Re-Add)
        else if (!this.isOrderActive(oldStatus) && this.isOrderActive(newStatus)) {
            items.forEach(item => {
                this.state.products[item.productId] += item.quantity;
            });
        }
    }

    // --- EXPIRATION SIMULATION ---
    runExpirationCheck(daysPassed: number) {
        // Mock: If daysPassed > 7, expire all 'draft' orders
        if (daysPassed > 7) {
            Object.keys(this.state.orders).forEach(id => {
                if (this.state.orders[id].status === 'draft') {
                    this.updateOrderStatus(id, 'expired');
                }
            });
        }
    }
}


// --- TESTS ---

describe('Immediate Stock Reservation System', () => {
    
    it('should deduct stock immediately when item is added to Draft Order', () => {
        const sim = new InventorySimulator({ 'p1': 100 });
        sim.createOrder('o1', 'draft');
        sim.addOrderItem('o1', 'p1', 10);
        
        expect(sim.state.products['p1']).toBe(90);
    });

    it('should prevent negative stock (Insufficient Stock Error)', () => {
        const sim = new InventorySimulator({ 'p1': 5 });
        sim.createOrder('o1', 'draft');
        
        expect(() => {
            sim.addOrderItem('o1', 'p1', 10);
        }).toThrow('Insufficient stock');
    });

    it('should revert stock when Order is Cancelled', () => {
        const sim = new InventorySimulator({ 'p1': 100 });
        sim.createOrder('o1', 'draft');
        sim.addOrderItem('o1', 'p1', 20); // Stock 80
        
        sim.updateOrderStatus('o1', 'cancelled');
        expect(sim.state.products['p1']).toBe(100);
    });

    it('should revert stock when Order Expires (Auto-Reversal)', () => {
        const sim = new InventorySimulator({ 'p1': 100 });
        sim.createOrder('o1', 'draft');
        sim.addOrderItem('o1', 'p1', 20); // Stock 80
        
        // Simulate 8 days passing
        sim.runExpirationCheck(8);
        
        expect(sim.state.orders['o1'].status).toBe('expired');
        expect(sim.state.products['p1']).toBe(100);
    });

    it('should increase stock immediately when PO item is added', () => {
        const sim = new InventorySimulator({ 'p1': 100 });
        sim.createPO('po1', 'draft');
        sim.addPOItem('po1', 'p1', 50);
        
        expect(sim.state.products['p1']).toBe(150);
    });

    it('should revert (deduct) stock when PO is Cancelled', () => {
        const sim = new InventorySimulator({ 'p1': 100 });
        sim.createPO('po1', 'draft');
        sim.addPOItem('po1', 'p1', 50); // Stock 150
        
        sim.updatePOStatus('po1', 'cancelled');
        expect(sim.state.products['p1']).toBe(100);
    });

    it('should handle complex scenario: SO Reserve -> PO Add -> SO Cancel', () => {
        const sim = new InventorySimulator({ 'p1': 100 });
        
        // 1. SO Reserves 100 (Stock 0)
        sim.createOrder('o1', 'draft');
        sim.addOrderItem('o1', 'p1', 100);
        expect(sim.state.products['p1']).toBe(0);

        // 2. PO Adds 50 (Stock 50)
        sim.createPO('po1', 'draft');
        sim.addPOItem('po1', 'p1', 50);
        expect(sim.state.products['p1']).toBe(50);

        // 3. SO Cancelled (Stock 50 + 100 = 150)
        sim.updateOrderStatus('o1', 'cancelled');
        expect(sim.state.products['p1']).toBe(150);
    });

    it('should not change stock when non-active status transitions keep order active', () => {
        const sim = new InventorySimulator({ 'p1': 100 });
        sim.createOrder('o1', 'draft');
        sim.addOrderItem('o1', 'p1', 10);
        expect(sim.state.products['p1']).toBe(90);

        sim.updateOrderStatus('o1', 'pending');
        expect(sim.state.products['p1']).toBe(90);
    });
});
