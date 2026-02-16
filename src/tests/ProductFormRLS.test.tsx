
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProductForm from '../pages/Inventory/ProductForm';
import { supabase } from '../lib/supabase';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import toast from 'react-hot-toast';

const mockSupabaseChain = {
  select: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
  insert: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
  update: vi.fn().mockImplementation(() => Promise.resolve({ data: null, error: null })),
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => mockSupabaseChain),
  },
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProductForm RLS and Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseChain.select.mockReturnThis();
    mockSupabaseChain.order.mockReturnThis();
    mockSupabaseChain.eq.mockReturnThis();
    mockSupabaseChain.single.mockResolvedValue({ data: null, error: null });
    mockSupabaseChain.insert.mockResolvedValue({ data: null, error: null });
    mockSupabaseChain.update.mockResolvedValue({ data: null, error: null });
  });

  it('should handle RLS violation error gracefully', async () => {
    // Mock Supabase insert error
    const mockError = {
      code: '42501',
      message: 'new row violates row-level security policy',
    };
    
    mockSupabaseChain.insert.mockResolvedValue({ error: mockError });

    render(
      <MemoryRouter initialEntries={['/inventory/equipment/new']}>
        <Routes>
          <Route path="/inventory/equipment/new" element={<ProductForm type="equipment" />} />
        </Routes>
      </MemoryRouter>
    );

    // Fill in required fields
    fireEvent.change(screen.getByLabelText(/Product Name/i), { target: { value: 'Test Product' } });
    fireEvent.change(screen.getByLabelText(/SKU/i), { target: { value: 'TEST-SKU-123' } });
    
    const submitBtn = screen.getByText(/Save/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Izin Ditolak: Anda tidak memiliki wewenang'),
        expect.any(Object)
      );
    });
  });

  it('should clean up supplier_id to null if empty string', async () => {
    render(
      <MemoryRouter initialEntries={['/inventory/equipment/new']}>
        <Routes>
          <Route path="/inventory/equipment/new" element={<ProductForm type="equipment" />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/Product Name/i), { target: { value: 'Test Product' } });
    fireEvent.change(screen.getByLabelText(/SKU/i), { target: { value: 'TEST-SKU-123' } });
    
    // Leave supplier empty
    const submitBtn = screen.getByText(/Save/i);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSupabaseChain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          supplier_id: null,
        }),
      ]);
    });
  });
});
