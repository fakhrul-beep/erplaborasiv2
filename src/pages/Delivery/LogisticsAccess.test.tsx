import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ShipmentList from './ShipmentList';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { useAuthStore } from '../../store/authStore';

// Mock withRetry
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
    withRetry: vi.fn().mockImplementation((operation) => operation()),
  };
});

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock authStore
vi.mock('../../store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

describe('Logistics Role Access Control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockShipments = [
    { id: '1', status: 'pending', type: 'sales', tracking_number: 'TRK001' }
  ];

  const setupMockSupabase = () => {
    (supabase.from as any).mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mockShipments, error: null }),
    }));
  };

  it('allows access for "logistik" role', async () => {
    (useAuthStore as any).mockReturnValue({
      profile: { role: 'logistik' },
      loading: false,
    });
    setupMockSupabase();

    render(
      <BrowserRouter>
        <ShipmentList type="sales" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pengiriman Bahan Baku')).toBeInTheDocument();
    });
    
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('allows access for "superadmin" role', async () => {
    (useAuthStore as any).mockReturnValue({
      profile: { role: 'superadmin' },
      loading: false,
    });
    setupMockSupabase();

    render(
      <BrowserRouter>
        <ShipmentList type="sales" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Pengiriman Bahan Baku')).toBeInTheDocument();
    });
  });

  it('denies access for unauthorized roles (e.g., "sales")', async () => {
    (useAuthStore as any).mockReturnValue({
      profile: { role: 'sales' },
      loading: false,
    });
    
    render(
      <BrowserRouter>
        <ShipmentList type="sales" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Anda tidak memiliki izin untuk melihat data ini');
    });
  });

  it('denies access if profile is missing', async () => {
    (useAuthStore as any).mockReturnValue({
      profile: null,
      loading: false,
    });
    
    render(
      <BrowserRouter>
        <ShipmentList type="sales" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Anda tidak memiliki izin untuk melihat data ini');
    });
  });
});
