import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRefetchOnFocus } from '../useRefetchOnFocus';

describe('useRefetchOnFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should call refetch when window is focused', () => {
    const refetch = vi.fn();
    renderHook(() => useRefetchOnFocus(refetch));
    window.dispatchEvent(new Event('focus'));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('should clean up previous fetch on new focus', () => {
    const cleanup = vi.fn();
    const refetch = vi.fn().mockReturnValue(cleanup);
    
    renderHook(() => useRefetchOnFocus(refetch));

    // First focus
    window.dispatchEvent(new Event('focus'));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(cleanup).not.toHaveBeenCalled();

    // Second focus (should cleanup first)
    window.dispatchEvent(new Event('focus'));
    expect(refetch).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('should clean up on unmount', () => {
    const cleanup = vi.fn();
    const refetch = vi.fn().mockReturnValue(cleanup);
    
    const { unmount } = renderHook(() => useRefetchOnFocus(refetch));

    // Trigger fetch
    window.dispatchEvent(new Event('focus'));
    expect(refetch).toHaveBeenCalledTimes(1);

    // Unmount
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
