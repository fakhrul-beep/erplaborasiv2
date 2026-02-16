import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DeliveryReports from './DeliveryReports';
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

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => <div />,
  Cell: () => <div />,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
}));

describe('DeliveryReports Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles schema cache error and shows single toast with specific ID', async () => {
    const schemaError = { message: 'Could not find the table in the schema cache', code: 'PGRST205' };
    
    (supabase.from as any).mockImplementation((table: string) => {
      const chain: any = {
        select: vi.fn().mockImplementation(() => chain),
        eq: vi.fn().mockImplementation(() => chain),
        gte: vi.fn().mockImplementation(() => chain),
        lte: vi.fn().mockImplementation(() => chain),
        order: vi.fn().mockImplementation(() => {
          return Promise.resolve({ data: [], error: schemaError });
        }),
      };
      
      return chain;
    });

    render(<DeliveryReports />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Sistem sedang melakukan sinkronisasi database'),
        expect.objectContaining({ id: 'schema-cache-error' })
      );
    }, { timeout: 15000 });
  }, 20000);

  it('handles vendor fetch failure', async () => {
    const error = { message: 'Fetch failed' };
    (supabase.from as any).mockImplementation((table: string) => {
      const chain: any = {
        select: vi.fn().mockImplementation(() => chain),
        eq: vi.fn().mockImplementation(() => chain),
        gte: vi.fn().mockImplementation(() => chain),
        lte: vi.fn().mockImplementation(() => chain),
        order: vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
      };
      
      if (table === 'shipping_vendors') {
        chain.order = vi.fn().mockResolvedValue({ data: null, error });
      }

      return chain;
    });

    render(<DeliveryReports />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});
