import { useEffect, useRef } from 'react';

/**
 * Hook to refetch data when the window regains focus or visibility.
 * Useful for keeping data fresh after the user has been idle or switched tabs.
 * 
 * @param refetch Function to call when focus is regained
 * @param interval Optional interval in ms to force refresh while active (default: 0 = disabled)
 */
export function useRefetchOnFocus(
  refetch: () => void | Promise<void>, 
  interval: number = 0
) {
  const refetchRef = useRef(refetch);
  
  // Keep ref up to date to avoid stale closures in listeners
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  useEffect(() => {
    // Store cleanup function from the last execution
    let cleanup: (() => void) | void;

    const executeRefetch = () => {
      // Cancel previous execution if it exists
      if (typeof cleanup === 'function') {
        cleanup();
      }
      // Execute new refetch and store its cleanup (if any)
      cleanup = refetchRef.current();
    };

    const onFocus = () => {
      console.log('Window focused, refreshing data...');
      executeRefetch();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Tab visible, refreshing data...');
        executeRefetch();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Optional: Periodic refresh
    let intervalId: NodeJS.Timeout | null = null;
    if (interval > 0) {
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          executeRefetch();
        }
      }, interval);
    }

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (intervalId) clearInterval(intervalId);
      // Clean up any pending request on unmount
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [interval]);
}
