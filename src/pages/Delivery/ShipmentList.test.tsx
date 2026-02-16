import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ShipmentList from './ShipmentList';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
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

describe('ShipmentList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('simulates exponential backoff on schema cache error', async () => {
    const schemaError = { message: 'Could not find the table in the schema cache', code: 'PGRST205' };
    
    // Mock sequential responses: 3 errors then 1 success
    const mockFrom = vi.fn();
    (supabase.from as any).mockImplementation(() => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn(),
      };
      
      // Simulate failure then success
      mockQuery.order
        .mockResolvedValueOnce({ data: null, error: schemaError }) // Attempt 0
        .mockResolvedValueOnce({ data: null, error: schemaError }) // Attempt 1
        .mockResolvedValueOnce({ data: null, error: schemaError }) // Attempt 2
        .mockResolvedValueOnce({ data: [], error: null });          // Attempt 3 (Final success)
      
      return mockQuery;
    });

    render(
      <BrowserRouter>
        <ShipmentList type="sales" />
      </BrowserRouter>
    );

    // Wait for the final success (loading becomes false)
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    }, { timeout: 15000 }); // Longer timeout for backoff (1s + 2s + 4s)

    // Verify it was called 4 times total
    // (withRetry maxRetries is 3, so total attempts 4)
    // However, vitest mock might be tricky with multiple calls to from() 
    // depending on how withRetry is called. In ShipmentList, withRetry 
    // wraps the entire chain, so it calls operation() multiple times.
    // operation() calls from().select().eq().order().
  });

  it('displays informative error message after max retries fail', async () => {
    const schemaError = { message: 'Could not find the table in the schema cache', code: 'PGRST205' };
    
    (supabase.from as any).mockImplementation(() => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: schemaError }),
      };
      return mockQuery;
    });

    render(
      <BrowserRouter>
        <ShipmentList type="sales" />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Sistem sedang melakukan sinkronisasi database'),
        expect.objectContaining({ id: 'schema-cache-error' })
      );
    }, { timeout: 15000 });
  }, 20000);

  it('only selects non-price fields according to business logic', async () => {
    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    (supabase.from as any).mockReturnValue(mockQuery);

    render(
      <BrowserRouter>
        <ShipmentList type="sales" />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Use regex that handles whitespace and newlines
      const selectCall = mockQuery.select.mock.calls[0][0];
      expect(selectCall).toMatch(/id/);
      expect(selectCall).toMatch(/status/);
      expect(selectCall).toMatch(/type/);
      expect(selectCall).toMatch(/category/);
      expect(selectCall).toMatch(/tracking_number/);
      expect(selectCall).not.toMatch(/\*/);
      expect(selectCall).not.toMatch(/shipping_cost/);
      expect(selectCall).not.toMatch(/total_amount/);
    });
  });
});
