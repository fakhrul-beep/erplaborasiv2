import { create } from 'zustand';
import { supabase, withRetry } from '../lib/supabase';

interface GeneralSettings {
  company_name: string;
  currency: 'USD' | 'IDR' | 'EUR';
  timezone: string;
}

interface NotificationSettings {
  order_updates: boolean;
  low_stock_alerts: boolean;
}

interface SettingsState {
  general: GeneralSettings;
  notifications: NotificationSettings;
  loading: boolean;
  initialized: boolean;
  fetchSettings: () => Promise<void>;
  updateGeneralSettings: (settings: Partial<GeneralSettings>) => Promise<void>;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => Promise<void>;
  formatCurrency: (amount: number) => string;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  general: {
    company_name: 'Ternakmart',
    currency: 'IDR', // Default to IDR as per requirements
    timezone: 'Asia/Jakarta'
  },
  notifications: {
    order_updates: true,
    low_stock_alerts: true
  },
  loading: false,
  initialized: false,

  fetchSettings: async () => {
    // Prevent redundant calls if already initialized or loading
    const state = get();
    if (state.loading || state.initialized) return;

    set({ loading: true });
    try {
      // Use withRetry to handle potential schema cache errors (PGRST205)
      const { data, error } = await withRetry(async () => {
        return await supabase
          .from('system_settings')
          .select('*');
      }, 3, 1000, 'system_settings'); // Retry 3 times, 1s initial delay, cache key 'system_settings'
      
      if (error) {
        // Specific handling for missing table error
        if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
          console.warn('System settings table not found. Using default settings.');
          // Don't throw, just mark as initialized with defaults
          set({ initialized: true });
          return;
        }
        throw error;
      }

      if (data) {
        const general = data.find(s => s.key === 'general')?.value;
        const notifications = data.find(s => s.key === 'notifications')?.value;

        set({
          general: general ? { ...get().general, ...general } : get().general,
          notifications: notifications ? { ...get().notifications, ...notifications } : get().notifications,
          initialized: true
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      set({ loading: false });
    }
  },

  updateGeneralSettings: async (newSettings) => {
    const updated = { ...get().general, ...newSettings };
    // Optimistic update
    set({ general: updated });

    try {
      const { error } = await withRetry(async () => {
        return await supabase
          .from('system_settings')
          .upsert({ 
            key: 'general', 
            value: updated,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating general settings:', error);
      // Revert? For now just log
    }
  },

  updateNotificationSettings: async (newSettings) => {
    const updated = { ...get().notifications, ...newSettings };
    set({ notifications: updated });

    try {
      const { error } = await withRetry(async () => {
        return await supabase
          .from('system_settings')
          .upsert({ 
            key: 'notifications', 
            value: updated,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating notification settings:', error);
    }
  },

  formatCurrency: (amount: number) => {
    const { currency } = get().general;
    
    // Configure locale based on currency to match standard formats
    // IDR: id-ID (1.234.567,00)
    // USD: en-US (1,234,567.00)
    // EUR: de-DE (1.234.567,00)
    let locale = 'en-US';
    if (currency === 'IDR') locale = 'id-ID';
    if (currency === 'EUR') locale = 'de-DE';

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0, // IDR usually doesn't show cents for large amounts, but let's stick to standard or 2 if needed. 
        // User requested: "Implementasikan pemisah ribuan (.) dan desimal (,) sesuai format IDR"
        // Standard id-ID currency often defaults to 0 or 2 fraction digits.
        // Let's use 0 for IDR as it's common practice unless cents are important.
        // But user mentioned "1.234,56" in prompt example implies 2 decimals? 
        // "Format IDR benar (Rp1.234.567) tanpa symbol $". This example shows 0 decimals.
        // Let's stick to 0 for IDR to be clean, or 2 if strict.
        // Let's use 0 decimals for IDR by default for cleaner UI, unless amount has decimal.
        // Actually, let's use default behavior but force IDR to 'id-ID'.
        maximumFractionDigits: currency === 'IDR' ? 0 : 2
      }).format(amount);
    } catch (error) {
      // Fallback
      return `${currency} ${amount}`;
    }
  }
}));
