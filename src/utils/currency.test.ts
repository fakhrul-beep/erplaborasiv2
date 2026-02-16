
import { describe, it, expect } from 'vitest';

// Simplified formatCurrency for testing logic
const formatCurrency = (amount: number, currency: string) => {
  let locale = 'en-US';
  if (currency === 'IDR') locale = 'id-ID';
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: currency === 'IDR' ? 0 : 2
    }).format(amount);
  } catch (error) {
    return `${currency} ${amount}`;
  }
};

describe('Currency Formatting', () => {
  it('should format USD with en-US locale', () => {
    const result = formatCurrency(1234.56, 'USD');
    expect(result).toBe('$1,234.56');
  });

  it('should format IDR with id-ID locale (thousands dot, no decimal by default)', () => {
    const result = formatCurrency(150000, 'IDR');
    // Expecting Rp150.000 (standard IDR format in id-ID locale)
    // Note: Node's Intl might use "Rp" prefix.
    expect(result).toContain('150.000');
    expect(result).toContain('Rp'); 
    expect(result).not.toContain('$');
  });

  it('should handle large IDR values correctly', () => {
    const result = formatCurrency(1000000000, 'IDR');
    expect(result).toContain('1.000.000.000');
  });
});
