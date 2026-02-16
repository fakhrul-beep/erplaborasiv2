import { describe, it, expect, vi } from 'vitest';

// Mock the trigger logic to verify the expected behavior
const simulateOrderStockUpdate = (
    oldStatus: string, 
    newStatus: string, 
    items: { product_id: string, quantity: number }[],
    stock: Record<string, number>
) => {
    const updatedStock = { ...stock };
    
    // Logic from the trigger:
    // If status changed to 'delivered' or 'completed', deduct stock
    if ((['delivered', 'completed'].includes(newStatus)) && (!['delivered', 'completed'].includes(oldStatus))) {
        items.forEach(item => {
            if (updatedStock[item.product_id] < item.quantity) {
                throw new Error(`Insufficient stock for product ${item.product_id}`);
            }
            updatedStock[item.product_id] -= item.quantity;
        });
    }
    // If status changed FROM 'delivered' or 'completed' TO something else (like 'cancelled'), add back stock
    else if ((['delivered', 'completed'].includes(oldStatus)) && (!['delivered', 'completed'].includes(newStatus))) {
        items.forEach(item => {
            updatedStock[item.product_id] += item.quantity;
        });
    }
    
    return updatedStock;
};

const simulatePurchaseOrderStockUpdate = (
    oldStatus: string, 
    newStatus: string, 
    items: { product_id: string, quantity: number }[],
    stock: Record<string, number>
) => {
    const updatedStock = { ...stock };
    
    // Logic from the trigger:
    // If status changed to 'received', add stock
    if (newStatus === 'received' && oldStatus !== 'received') {
        items.forEach(item => {
            updatedStock[item.product_id] += item.quantity;
        });
    }
    // If status changed FROM 'received' TO something else, deduct stock
    else if (oldStatus === 'received' && newStatus !== 'received') {
        items.forEach(item => {
            updatedStock[item.product_id] -= item.quantity;
        });
    }
    
    return updatedStock;
};

describe('Inventory Stock Update Logic (Database Trigger Simulation)', () => {
    const initialStock = {
        'prod-1': 100,
        'prod-2': 50
    };
    
    const orderItems = [
        { product_id: 'prod-1', quantity: 10 },
        { product_id: 'prod-2', quantity: 5 }
    ];

    describe('Sales Orders', () => {
        it('should deduct stock when order is delivered', () => {
            const result = simulateOrderStockUpdate('pending', 'delivered', orderItems, initialStock);
            expect(result['prod-1']).toBe(90);
            expect(result['prod-2']).toBe(45);
        });

        it('should deduct stock when order is completed', () => {
            const result = simulateOrderStockUpdate('shipped', 'completed', orderItems, initialStock);
            expect(result['prod-1']).toBe(90);
            expect(result['prod-2']).toBe(45);
        });

        it('should add back stock when delivered order is cancelled', () => {
            const currentStock = { 'prod-1': 90, 'prod-2': 45 };
            const result = simulateOrderStockUpdate('delivered', 'cancelled', orderItems, currentStock);
            expect(result['prod-1']).toBe(100);
            expect(result['prod-2']).toBe(50);
        });

        it('should not change stock when moving between delivered and completed', () => {
            const currentStock = { 'prod-1': 90, 'prod-2': 45 };
            const result = simulateOrderStockUpdate('delivered', 'completed', orderItems, currentStock);
            expect(result['prod-1']).toBe(90);
            expect(result['prod-2']).toBe(45);
        });

        it('should throw error if stock is insufficient', () => {
            const lowStock = { 'prod-1': 5, 'prod-2': 50 };
            expect(() => simulateOrderStockUpdate('pending', 'delivered', orderItems, lowStock)).toThrow('Insufficient stock');
        });
    });

    describe('Purchase Orders', () => {
        it('should add stock when purchase order is received', () => {
            const result = simulatePurchaseOrderStockUpdate('ordered', 'received', orderItems, initialStock);
            expect(result['prod-1']).toBe(110);
            expect(result['prod-2']).toBe(55);
        });

        it('should deduct stock when received purchase order is cancelled/reverted', () => {
            const currentStock = { 'prod-1': 110, 'prod-2': 55 };
            const result = simulatePurchaseOrderStockUpdate('received', 'cancelled', orderItems, currentStock);
            expect(result['prod-1']).toBe(100);
            expect(result['prod-2']).toBe(50);
        });

        it('should keep stock unchanged when status changes within non-received active states', () => {
            const currentStock = { ...initialStock };
            const result = simulatePurchaseOrderStockUpdate('draft', 'ordered', orderItems, currentStock);
            expect(result['prod-1']).toBe(initialStock['prod-1']);
            expect(result['prod-2']).toBe(initialStock['prod-2']);
        });
    });
});
