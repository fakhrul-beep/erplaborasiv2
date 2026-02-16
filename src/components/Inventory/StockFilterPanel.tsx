import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Package, 
  Truck, 
  ArrowUpDown,
  Tag,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface StockFilterState {
  search: string;
  category: string;
  supplier: string;
  status: string;
  minStock: string;
  maxStock: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface StockFilterPanelProps {
  categories: string[];
  suppliers: { id: string; name: string }[];
  onFilterChange: (filters: StockFilterState) => void;
  totalCount: number;
  className?: string;
  placeholder?: string;
}

const DEFAULT_FILTERS: StockFilterState = {
  search: '',
  category: '',
  supplier: '',
  status: '',
  minStock: '',
  maxStock: '',
  sortBy: 'name',
  sortOrder: 'asc',
};

const StockFilterPanel: React.FC<StockFilterPanelProps> = ({
  categories,
  suppliers,
  onFilterChange,
  totalCount,
  className,
  placeholder = "Search by name or SKU..."
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  const statusOptions = [
    { label: 'Tersedia', value: 'available' },
    { label: 'Stok Menipis (<10)', value: 'low' },
    { label: 'Habis', value: 'out' },
  ];

  const sortOptions = [
    { label: 'Nama', value: 'name', icon: <Package className="h-3 w-3" /> },
    { label: 'SKU', value: 'sku', icon: <Tag className="h-3 w-3" /> },
    { label: 'Kategori', value: 'category', icon: <Filter className="h-3 w-3" /> },
    { label: 'Harga', value: 'price', icon: <ArrowUpDown className="h-3 w-3" /> },
    { label: 'Stok', value: 'stock_quantity', icon: <AlertTriangle className="h-3 w-3" /> },
  ];

  const [filters, setFilters] = useState<StockFilterState>(() => {
    const params: Partial<StockFilterState> = {};
    searchParams.forEach((value, key) => {
      if (key in DEFAULT_FILTERS) {
        (params as any)[key] = value;
      }
    });
    return { ...DEFAULT_FILTERS, ...params };
  });

  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  const applyFilters = useCallback((newFilters: StockFilterState) => {
    // Basic validation
    if (newFilters.minStock && newFilters.maxStock && parseInt(newFilters.minStock) > parseInt(newFilters.maxStock)) {
      return;
    }

    const params: Record<string, string> = {};
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== (DEFAULT_FILTERS as any)[key]) {
        params[key] = value;
      }
    });
    setSearchParams(params);
    onFilterChange(newFilters);
  }, [onFilterChange, setSearchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (debouncedSearch !== filters.search) {
        const newFilters = { ...filters, search: debouncedSearch };
        setFilters(newFilters);
        applyFilters(newFilters);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [debouncedSearch, filters, applyFilters]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    setFilters(newFilters);
    
    if (name !== 'search') {
      applyFilters(newFilters);
    } else {
      setDebouncedSearch(value);
    }
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDebouncedSearch('');
    applyFilters(DEFAULT_FILTERS);
  };

  const toggleSort = (field: string) => {
    const isSameField = filters.sortBy === field;
    const newOrder = isSameField && filters.sortOrder === 'asc' ? 'desc' : 'asc';
    const newFilters = { ...filters, sortBy: field, sortOrder: newOrder as 'asc' | 'desc' };
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === 'sortBy' || key === 'sortOrder') return false;
    return value !== (DEFAULT_FILTERS as any)[key];
  });

  return (
    <div className={cn("bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden mb-6", className)}>
      <div className="p-4 flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            name="search"
            value={debouncedSearch}
            onChange={(e) => setDebouncedSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
            placeholder={placeholder}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
              "flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all",
              isOpen || hasActiveFilters 
                ? "bg-accent/10 text-primary border border-accent/20" 
                : "bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100"
            )}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 px-1.5 py-0.5 bg-accent text-primary-900 text-[10px] font-bold rounded-full">!</span>
            )}
            {isOpen ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
          </button>

          <div className="h-8 w-px bg-gray-200 hidden sm:block" />

          <div className="flex-1 sm:flex-none text-xs text-gray-500 whitespace-nowrap">
            Results: <span className="font-semibold text-gray-900">{totalCount}</span>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 flex items-center">
                <Tag className="h-3 w-3 mr-1" /> Kategori & Supplier
              </label>
              <div className="flex gap-2">
                <select
                  name="category"
                  value={filters.category}
                  onChange={handleChange}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none appearance-none"
                >
                  <option value="">Semua Kategori</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  name="supplier"
                  value={filters.supplier}
                  onChange={handleChange}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none appearance-none"
                >
                  <option value="">Semua Supplier</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 flex items-center">
                <AlertTriangle className="h-3 w-3 mr-1" /> Status Stok
              </label>
              <select
                name="status"
                value={filters.status}
                onChange={handleChange}
                className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none appearance-none"
              >
                <option value="">Semua Status</option>
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 flex items-center">
                <Package className="h-3 w-3 mr-1" /> Rentang Stok
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="minStock"
                  placeholder="Min"
                  value={filters.minStock}
                  onChange={handleChange}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  name="maxStock"
                  placeholder="Max"
                  value={filters.maxStock}
                  onChange={handleChange}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 flex items-center">
                <ArrowUpDown className="h-3 w-3 mr-1" /> Quick Sort
              </label>
              <div className="flex flex-wrap gap-2">
                {sortOptions.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => toggleSort(opt.value)}
                    className={cn(
                      "text-[10px] px-2 py-1.5 rounded-md border transition-all flex items-center gap-1",
                      filters.sortBy === opt.value
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-600 border-gray-200 hover:border-accent hover:text-accent"
                    )}
                  >
                    {opt.icon || <ArrowUpDown className="h-3 w-3" />}
                    {opt.label}
                    {filters.sortBy === opt.value && (filters.sortOrder === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-50">
            <button
              onClick={resetFilters}
              className="text-xs font-medium text-gray-500 hover:text-red-500 flex items-center transition-colors"
            >
              <X className="h-3 w-3 mr-1" /> Reset All
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-6 py-2 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover transition-colors shadow-sm"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockFilterPanel;
