import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, clearQueryCache } from '../supabase';

// Mock Supabase client if imported in supabase.ts (it is)
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }))
}));

// Mock toast
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn()
  }
}));

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearQueryCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return data immediately if operation succeeds', async () => {
    const mockOp = vi.fn().mockResolvedValue({ data: 'success', error: null });
    
    const result = await withRetry(mockOp);
    
    expect(result).toEqual({ data: 'success', error: null });
    expect(mockOp).toHaveBeenCalledTimes(1);
  });

  it('should retry on schema cache error (PGRST205)', async () => {
    const error = { code: 'PGRST205', message: 'Schema cache error' };
    const mockOp = vi.fn()
      .mockResolvedValueOnce({ data: null, error })
      .mockResolvedValueOnce({ data: 'success', error: null });

    const promise = withRetry(mockOp, 3, 100);
    
    // Fast-forward time for the backoff delay
    await vi.runAllTimersAsync();
    
    const result = await promise;

    expect(result).toEqual({ data: 'success', error: null });
    expect(mockOp).toHaveBeenCalledTimes(2);
  });

  it('should abort retries when signal is aborted', async () => {
    const controller = new AbortController();
    const error = { code: 'PGRST205', message: 'Schema cache error' };
    const mockOp = vi.fn().mockResolvedValue({ data: null, error });

    const promise = withRetry(mockOp, 5, 1000, undefined, controller.signal);
    
    // Allow first call to happen
    await vi.advanceTimersByTimeAsync(10);
    expect(mockOp).toHaveBeenCalledTimes(1);

    // Abort during the wait
    controller.abort();
    
    // Advance time to ensure we don't hang
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;

    expect(result.error).toBeDefined();
    expect(result.error.message).toBe('Aborted');
    // Should NOT have called it again (or maybe once more if race condition, but effectively stopped)
    // Actually, if aborted during wait, it resolves the wait immediately and checks signal at start of loop
    // So it might not call op again.
  });

  it('should use cache if available and fresh', async () => {
    const mockOp = vi.fn().mockResolvedValue({ data: 'fresh', error: null });
    
    // First call to populate cache
    await withRetry(mockOp, 3, 100, 'test-key');
    
    // Second call should use cache
    const result = await withRetry(mockOp, 3, 100, 'test-key');
    
    expect(result).toEqual({ data: 'fresh', error: null });
    expect(mockOp).toHaveBeenCalledTimes(1); // Only called once
  });
});
