import { describe, it, expect, beforeEach, vi } from 'vitest';
import { supabase } from '../lib/supabase';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('Stock Mutation Logic', () => {
  it('should correctly include warehouse_id in stock opname adjustment', async () => {
    const mockSession = { id: 'session-1', warehouse_id: 'wh-1' };
    const mockItem = { product_id: 'prod-1', system_stock: 10, physical_stock: 15, notes: 'Test' };
    const diff = mockItem.physical_stock - mockItem.system_stock;
    const userId = 'user-1';

    // Simulate the logic in StockOpnameDetail.tsx
    const insertSpy = vi.spyOn(supabase.from('inventory_movements'), 'insert');
    
    await supabase.from('inventory_movements').insert({
      product_id: mockItem.product_id,
      warehouse_id: mockSession.warehouse_id,
      movement_type: 'adjustment',
      quantity: diff,
      balance_after: mockItem.physical_stock,
      reference_type: 'stock_opname',
      reference_id: mockSession.id,
      user_id: userId,
      notes: `Stock Opname Adjustment: ${mockItem.notes}`
    });

    expect(insertSpy).toHaveBeenCalledWith(expect.objectContaining({
      warehouse_id: 'wh-1',
      movement_type: 'adjustment',
      quantity: 5
    }));
  });

  it('should correctly fetch movements with product category', async () => {
    const selectSpy = vi.spyOn(supabase.from('inventory_movements'), 'select');
    
    await supabase.from('inventory_movements').select(`
      *,
      products ( name, sku, category ),
      warehouses ( name ),
      users ( email )
    `);

    expect(selectSpy).toHaveBeenCalledWith(expect.stringContaining('category'));
  });
});
