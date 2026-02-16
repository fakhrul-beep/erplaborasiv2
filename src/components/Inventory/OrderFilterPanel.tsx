import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Calendar, 
  DollarSign, 
  ArrowUpDown,
  Hash,
  User,
  Truck
} from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FilterState {
  search: string;
  startDate: string;
  endDate: string;
  status: string;
  minAmount: string;
  maxAmount: string;
  paymentMethod: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface OrderFilterPanelProps {
  onFilterChange: (filters: FilterState) => void;
  totalCount: number;
  type: 'sales' | 'purchasing';
  className?: string;
  placeholder?: string;
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  startDate: '',
  endDate: '',
  status: '',
  minAmount: '',
  maxAmount: '',
  paymentMethod: '',
  sortBy: 'date',
  sortOrder: 'desc',
};

const OrderFilterPanel: React.FC<OrderFilterPanelProps> = ({
  onFilterChange,
  totalCount,
  type,
  className,
  placeholder = "Search by ID or name..."
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  const statusOptions = type === 'sales' 
    ? [
        { label: 'Completed', value: 'completed' },
        { label: 'Processing', value: 'processing' },
        { label: 'Pending', value: 'pending' },
        { label: 'Cancelled', value: 'cancelled' },
      ]
    : [
        { label: 'Draft', value: 'draft' },
        { label: 'Ordered', value: 'ordered' },
        { label: 'Received', value: 'received' },
        { label: 'Cancelled', value: 'cancelled' },
      ];

  const paymentOptions = [
    { label: 'Cash', value: 'cash' },
    { label: 'Transfer', value: 'transfer' },
    { label: 'Credit', value: 'credit' },
  ];

  const sortOptions = [
    { label: 'Date', value: 'date', icon: <Calendar className="h-3 w-3" /> },
    { label: 'Amount', value: 'amount', icon: <DollarSign className="h-3 w-3" /> },
    { label: type === 'sales' ? 'Customer' : 'Supplier', value: 'customer', icon: <User className="h-3 w-3" /> },
    { label: 'ID', value: 'id', icon: <Hash className="h-3 w-3" /> },
  ];

  const [filters, setFilters] = useState<FilterState>(() => {
    const params: Partial<FilterState> = {};
    searchParams.forEach((value, key) => {
      if (key in DEFAULT_FILTERS) {
        (params as any)[key] = value;
      }
    });
    return { ...DEFAULT_FILTERS, ...params };
  });

  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  const applyFilters = useCallback((newFilters: FilterState) => {
    // Basic validation
    if (newFilters.startDate && newFilters.endDate && newFilters.startDate > newFilters.endDate) {
      return; // Or show a small inline error
    }
    
    if (newFilters.minAmount && newFilters.maxAmount && parseFloat(newFilters.minAmount) > parseFloat(newFilters.maxAmount)) {
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
    const newOrder = isSameField && filters.sortOrder === 'desc' ? 'asc' : 'desc';
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
                <Calendar className="h-3 w-3 mr-1" /> Period
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  name="startDate"
                  aria-label="Start Date"
                  value={filters.startDate}
                  onChange={handleChange}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="date"
                  name="endDate"
                  aria-label="End Date"
                  value={filters.endDate}
                  onChange={handleChange}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 flex items-center">
                <Truck className="h-3 w-3 mr-1" /> Status & Payment
              </label>
              <div className="flex gap-2">
                <select
                  name="status"
                  aria-label="Status"
                  value={filters.status}
                  onChange={handleChange}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none appearance-none"
                >
                  <option value="">All Status</option>
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  name="paymentMethod"
                  aria-label="Payment Method"
                  value={filters.paymentMethod}
                  onChange={handleChange}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none appearance-none"
                >
                  <option value="">All Payments</option>
                  {paymentOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 flex items-center">
                <DollarSign className="h-3 w-3 mr-1" /> Amount Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  name="minAmount"
                  aria-label="Min Amount"
                  placeholder="Min"
                  value={filters.minAmount}
                  onChange={handleChange}
                  className="w-full text-xs p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-accent outline-none"
                />
                <span className="text-gray-400">-</span>
                <input
                  type="number"
                  name="maxAmount"
                  aria-label="Max Amount"
                  placeholder="Max"
                  value={filters.maxAmount}
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

export default OrderFilterPanel;