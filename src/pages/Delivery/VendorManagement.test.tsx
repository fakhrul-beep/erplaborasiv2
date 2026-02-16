import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VendorManagement from './VendorManagement';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import '@testing-library/jest-dom';

// Mock withRetry to use smaller delay for testing
vi.mock('../../lib/supabase', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    supabase: {
      from: vi.fn(),
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
      })),
    },
    withRetry: async (operation: any, maxRetries = 5, initialDelay = 10, cacheKey?: string) => {
      let lastError: any;
      // Force small delay for tests regardless of what the caller passed
      const testDelay = 10;
      for (let i = 0; i <= maxRetries; i++) {
        const result = await operation();
        if (!result.error) return result;
        lastError = result.error;
        const isSchemaError = 
          (lastError.message && typeof lastError.message === 'string' && lastError.message.toLowerCase().includes('schema cache')) || 
          lastError.code === 'PGRST205';
        if (isSchemaError && i < maxRetries) {
          const backoffDelay = testDelay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue;
        }
        break;
      }
      return { data: null, error: lastError };
    }
  };
});

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('VendorManagement Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for fetchVendors
    (supabase.from as any).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
  });

  it('renders vendor management title', async () => {
    render(<VendorManagement />);
    expect(screen.getByText(/Manajemen Vendor Ekspedisi/i)).toBeInTheDocument();
  });

  it('validates required fields before saving', async () => {
    render(<VendorManagement />);
    
    // Wait for initial load
    await waitFor(() => {
      expect(screen.queryByText(/Memuat/i)).not.toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /Tambah Vendor/i }));
    
    // Click simpan without filling anything
    const saveBtn = screen.getByRole('button', { name: /^Simpan$/i });
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Nama vendor harus diisi');
    });
  });

  it('handles successful vendor creation', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    (supabase.from as any).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: mockInsert,
    }));

    render(<VendorManagement />);
    
    await waitFor(() => {
      expect(screen.queryByText(/Memuat/i)).not.toBeInTheDocument();
    });

    // Open modal
    fireEvent.click(screen.getByRole('button', { name: /Tambah Vendor/i }));
    
    // Fill form
    fireEvent.change(screen.getByLabelText(/Nama Vendor/i), { target: { value: 'JNE Express' } });
    fireEvent.change(screen.getByLabelText(/Area Cakupan/i), { target: { value: 'Nasional' } });
    fireEvent.change(screen.getByLabelText(/Tarif\/kg/i), { target: { value: '10000' } });
    fireEvent.change(screen.getByLabelText(/Estimasi \(Hari\)/i), { target: { value: '3' } });
    
    // Click simpan
    fireEvent.click(screen.getByRole('button', { name: /^Simpan$/i }));
    
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({
        name: 'JNE Express',
        coverage_area: 'Nasional',
        rate_per_kg: 10000,
        estimated_days: 3
      })]);
      expect(toast.success).toHaveBeenCalledWith('Vendor ditambahkan');
    });
  });

  it('handles schema cache error during save with retry', async () => {
    const schemaError = { message: 'Could not find the table in the schema cache', code: 'PGRST205' };
    const mockInsert = vi.fn()
      .mockResolvedValueOnce({ data: null, error: schemaError })
      .mockResolvedValueOnce({ data: null, error: null });

    (supabase.from as any).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: mockInsert,
    }));

    render(<VendorManagement />);
    
    await waitFor(() => {
      expect(screen.queryByText(/Memuat/i)).not.toBeInTheDocument();
    });

    // Open modal and fill form
    fireEvent.click(screen.getByRole('button', { name: /Tambah Vendor/i }));
    fireEvent.change(screen.getByLabelText(/Nama Vendor/i), { target: { value: 'JNT' } });
    fireEvent.change(screen.getByLabelText(/Area Cakupan/i), { target: { value: 'Nasional' } });
    fireEvent.change(screen.getByLabelText(/Tarif\/kg/i), { target: { value: '9000' } });
    fireEvent.change(screen.getByLabelText(/Estimasi \(Hari\)/i), { target: { value: '2' } });
    
    fireEvent.click(screen.getByRole('button', { name: /^Simpan$/i }));
    
    await waitFor(() => {
      expect(mockInsert).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenCalledWith('Vendor ditambahkan');
    }, { timeout: 5000 });
  });

  it('shows informative error after max retries fail during save', async () => {
    const schemaError = { message: 'Could not find the table in the schema cache', code: 'PGRST205' };
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: schemaError });

    (supabase.from as any).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
      insert: mockInsert,
    }));

    render(<VendorManagement />);
    
    await waitFor(() => {
      expect(screen.queryByText(/Memuat/i)).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Tambah Vendor/i }));
    fireEvent.change(screen.getByLabelText(/Nama Vendor/i), { target: { value: 'SiCepat' } });
    fireEvent.change(screen.getByLabelText(/Area Cakupan/i), { target: { value: 'Nasional' } });
    fireEvent.change(screen.getByLabelText(/Tarif\/kg/i), { target: { value: '8000' } });
    fireEvent.change(screen.getByLabelText(/Estimasi \(Hari\)/i), { target: { value: '2' } });
    
    fireEvent.click(screen.getByRole('button', { name: /^Simpan$/i }));
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Sistem sedang melakukan sinkronisasi database'),
        expect.objectContaining({ id: 'schema-cache-error' })
      );
    }, { timeout: 5000 });
  });
});
