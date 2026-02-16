import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hrrwmuticuoqercfwzrb.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_7rbmyqIWBYAVdYl0aM7R5A_oNsxK4RV';

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

/**
 * Utility to refresh session and ensure JWT metadata is up to date.
 * Use this after role changes or when facing RLS issues.
 */
export const refreshUserSession = async () => {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    console.error('Error refreshing session:', error);
    return null;
  }
  return data.session;
};

/**
 * Simple in-memory cache for Supabase queries
 */
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Helper to handle schema cache errors by retrying the operation with exponential backoff.
 * PGRST205: Could not find the table in the schema cache.
 */
export const withRetry = async <T>(
  operation: () => PromiseLike<{ data: T | null; error: any }>,
  maxRetries = 3,
  initialDelay = 1000,
  cacheKey?: string,
  signal?: AbortSignal
): Promise<{ data: T | null; error: any }> => {
  // Check cache first if cacheKey is provided
  if (cacheKey) {
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return { data: cached.data as T, error: null };
    }
  }

  let lastError: any;
  
  for (let i = 0; i <= maxRetries; i++) {
    // Check if aborted before operation
    if (signal?.aborted) {
      return { data: null, error: new Error('Aborted') };
    }

    try {
      const result = await operation();
      
      // Check if aborted after operation
      if (signal?.aborted) {
        return { data: null, error: new Error('Aborted') };
      }

      if (!result.error) {
        // Update cache if successful and cacheKey is provided
        if (cacheKey) {
          queryCache.set(cacheKey, { data: result.data, timestamp: Date.now() });
        }
        return result;
      }
      
      lastError = result.error;
    } catch (err) {
      lastError = err;
    }

    const isSchemaError = 
      (lastError?.message && typeof lastError.message === 'string' && lastError.message.toLowerCase().includes('schema cache')) || 
      lastError?.code === 'PGRST205' ||
      (lastError?.details && typeof lastError.details === 'string' && lastError.details.toLowerCase().includes('schema cache'));
    
    if (isSchemaError && i < maxRetries) {
      // Check if aborted before waiting
      if (signal?.aborted) {
        return { data: null, error: new Error('Aborted') };
      }

      // Exponential backoff: delay * 2^attempt, capped at 10 seconds
      const backoffDelay = Math.min(initialDelay * Math.pow(2, i), 10000);
      const message = `Schema cache error (PGRST205) detected. Table might be new or cache is stale. Retrying (${i + 1}/${maxRetries}) in ${backoffDelay}ms...`;
      console.warn(message);
      
      // Notify user via toast on first retry if it's a schema error
      if (i === 0) {
        toast.error('Sinkronisasi database sedang berlangsung. Mohon tunggu sejenak...', {
          id: 'schema-retry-toast',
          duration: 4000
        });
      }

      // Wait with abort capability
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, backoffDelay);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            resolve(null); // Resolve immediately to hit the check at start of loop
          }, { once: true });
        }
      });
      continue;
    }
    
    break;
  }
  
  return { data: null, error: lastError };
};

/**
 * Clear the query cache
 */
export const clearQueryCache = () => {
  queryCache.clear();
};

