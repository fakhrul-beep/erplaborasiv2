import { describe, it, expect } from 'vitest';

// 1. Logika Filter & Sort
export const applyFilters = (products: any[], filters: any) => {
  return products.filter(p => {
    if (filters.category && p.category !== filters.category) return false;
    if (filters.status === 'low' && (p.stock_quantity >= 10 || p.stock_quantity <= 0)) return false;
    if (filters.status === 'out' && p.stock_quantity > 0) return false;
    if (filters.minStock && p.stock_quantity < filters.minStock) return false;
    if (filters.maxStock && p.stock_quantity > filters.maxStock) return false;
    return true;
  });
};

export const applySort = (products: any[], sort: { field: string, direction: 'asc' | 'desc' }) => {
  return [...products].sort((a, b) => {
    let valA = a[sort.field];
    let valB = b[sort.field];
    
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    
    if (valA < valB) return sort.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sort.direction === 'asc' ? 1 : -1;
    return 0;
  });
};

// 2. Logika Validasi Import
export const validateImportData = (row: any) => {
  const errors = [];
  if (!row.sku) errors.push('SKU wajib diisi');
  if (!row.name) errors.push('Nama wajib diisi');
  if (isNaN(Number(row.stock_quantity))) errors.push('Stok harus angka');
  if (isNaN(Number(row.price))) errors.push('Harga harus angka');
  if (row.expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(row.expiry_date)) {
    errors.push('Format tanggal salah (YYYY-MM-DD)');
  }
  return {
    isValid: errors.length === 0,
    errors
  };
};

describe('Sistem Manajemen Stok - Logika Filter, Sort, & Import', () => {
  const sampleProducts = [
    { id: '1', name: 'Produk B', sku: 'B1', category: 'Alat', stock_quantity: 5, price: 20000 },
    { id: '2', name: 'Produk A', sku: 'A1', category: 'Bahan', stock_quantity: 15, price: 10000 },
    { id: '3', name: 'Produk C', sku: 'C1', category: 'Alat', stock_quantity: 0, price: 5000 },
  ];

  describe('Filter Logic', () => {
    it('should filter by category', () => {
      const filtered = applyFilters(sampleProducts, { category: 'Alat' });
      expect(filtered).toHaveLength(2);
      expect(filtered.every(p => p.category === 'Alat')).toBe(true);
    });

    it('should filter by "low stock" status (< 10)', () => {
      const filtered = applyFilters(sampleProducts, { status: 'low' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].sku).toBe('B1');
    });

    it('should filter by "out of stock" status (0)', () => {
      const filtered = applyFilters(sampleProducts, { status: 'out' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].sku).toBe('C1');
    });
  });

  describe('Sort Logic', () => {
    it('should sort by name A-Z', () => {
      const sorted = applySort(sampleProducts, { field: 'name', direction: 'asc' });
      expect(sorted[0].name).toBe('Produk A');
      expect(sorted[2].name).toBe('Produk C');
    });

    it('should sort by stock quantity descending', () => {
      const sorted = applySort(sampleProducts, { field: 'stock_quantity', direction: 'desc' });
      expect(sorted[0].stock_quantity).toBe(15);
      expect(sorted[2].stock_quantity).toBe(0);
    });
  });

  describe('Import Validation Logic', () => {
    it('should validate correct data', () => {
      const data = { sku: 'SKU1', name: 'Item 1', stock_quantity: '10', price: '5000' };
      const result = validateImportData(data);
      expect(result.isValid).toBe(true);
    });

    it('should catch missing required fields', () => {
      const data = { sku: '', name: '', stock_quantity: '10' };
      const result = validateImportData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('SKU wajib diisi');
    });

    it('should catch invalid number formats', () => {
      const data = { sku: 'S1', name: 'N1', stock_quantity: 'abc', price: 'def' };
      const result = validateImportData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Stok harus angka');
    });

    it('should catch invalid date formats', () => {
      const data = { sku: 'S1', name: 'N1', stock_quantity: '10', price: '5000', expiry_date: '31-12-2025' };
      const result = validateImportData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Format tanggal salah (YYYY-MM-DD)');
    });
  });
});
