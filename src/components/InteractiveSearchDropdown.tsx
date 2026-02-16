import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Plus, Loader2, Check, Clock, User, Mail, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

interface SearchResult {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  phone_number?: string; // Some tables might use different naming
  created_at: string;
  updated_at?: string;
  is_active?: boolean;
  [key: string]: any;
}

interface InteractiveSearchDropdownProps {
  type: 'customers' | 'suppliers';
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export const InteractiveSearchDropdown: React.FC<InteractiveSearchDropdownProps> = ({
  type,
  value,
  onChange,
  placeholder = 'Cari...',
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentList, setRecentList] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch initial value label
  useEffect(() => {
    if (value) {
      const fetchSelected = async () => {
        const { data, error } = await supabase
          .from(type)
          .select('name')
          .eq('id', value)
          .single();
        if (data) setSelectedName(data.name);
      };
      fetchSelected();
    } else {
      setSelectedName('');
    }
  }, [value, type]);

  // Fetch recent 10 items
  const fetchRecentItems = useCallback(async () => {
    setLoadingRecent(true);
    try {
      let query = supabase
        .from(type)
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

      // Only add is_active filter for suppliers as customers table doesn't have it
      if (type === 'suppliers') {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecentList(data || []);
    } catch (error) {
      console.error('Error fetching recent items:', error);
    } finally {
      setLoadingRecent(false);
    }
  }, [type]);

  // Handle open dropdown
  useEffect(() => {
    if (isOpen && searchTerm === '') {
      fetchRecentItems();
    }
  }, [isOpen, searchTerm, fetchRecentItems]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        performSearch(searchTerm);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const performSearch = async (term: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(type)
        .select('*')
        .ilike('name', `%${term}%`)
        .order('name', { ascending: true })
        .limit(20);

      if (error) throw error;
      setResults(data || []);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Gagal memuat data pencarian');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (item: SearchResult) => {
    onChange(item.id);
    setSelectedName(item.name);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleQuickAdd = async () => {
    if (!searchTerm.trim()) return;
    
    setIsAdding(true);
    try {
      const { data: existing } = await supabase
        .from(type)
        .select('id')
        .ilike('name', searchTerm.trim())
        .maybeSingle();

      if (existing) {
        toast.error(`${type === 'customers' ? 'Customer' : 'Supplier'} sudah ada`);
        performSearch(searchTerm);
        return;
      }

      const { data, error } = await supabase
        .from(type)
        .insert([{ name: searchTerm.trim() }])
        .select()
        .single();

      if (error) throw error;

      toast.success(`${type === 'customers' ? 'Customer' : 'Supplier'} berhasil ditambahkan`);
      handleSelect(data);
      fetchRecentItems(); // Refresh recent list
    } catch (error: any) {
      console.error('Quick add error:', error);
      toast.error('Gagal menambahkan data baru');
    } finally {
      setIsAdding(false);
    }
  };

  const exactMatch = (searchTerm.trim() === '' ? [] : (searchTerm.trim() !== '' ? results : [])).find(r => r.name.toLowerCase() === searchTerm.toLowerCase());
  const showQuickAdd = searchTerm.trim() !== '' && !loading && !exactMatch;

  const renderItem = (item: SearchResult) => (
    <div
      key={item.id}
      className={cn(
        "cursor-pointer select-none relative py-2 px-4 hover:bg-accent/10 transition-colors border-b border-gray-50 last:border-0",
        value === item.id ? "bg-accent/5 text-primary font-semibold" : "text-gray-900"
      )}
      onClick={() => handleSelect(item)}
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <span className="block truncate font-medium">{item.name}</span>
          {value === item.id && <Check className="h-4 w-4 text-primary" />}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          {(item.email) && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {item.email}
            </span>
          )}
          {(item.phone || item.phone_number) && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {item.phone || item.phone_number}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("relative w-full", className)} ref={dropdownRef}>
      <div 
        className="mt-1 relative rounded-md shadow-sm cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm bg-white min-h-[38px] flex items-center justify-between transition-all hover:border-gray-400">
          <span className={cn(selectedName ? "text-gray-900" : "text-gray-400")}>
            {selectedName || placeholder}
          </span>
          <Search className="h-4 w-4 text-gray-400" />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white shadow-xl max-h-80 rounded-lg py-1 text-base ring-1 ring-black ring-opacity-5 overflow-hidden focus:outline-none sm:text-sm flex flex-col">
          <div className="p-2 border-b border-gray-100 bg-gray-50/50">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                autoFocus
                className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2 shadow-sm"
                placeholder={`Cari nama ${type === 'customers' ? 'customer' : 'supplier'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-[100px]">
            {searchTerm.trim() === '' ? (
              <div className="py-1">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50 flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  10 Data Terbaru
                </div>
                {loadingRecent ? (
                  <div className="px-4 py-8 text-gray-500 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                    <span className="text-sm">Memuat data terbaru...</span>
                  </div>
                ) : recentList.length > 0 ? (
                  recentList.map(renderItem)
                ) : (
                  <div className="px-4 py-8 text-center text-gray-400">
                    Belum ada data tersedia
                  </div>
                )}
              </div>
            ) : (
              <div className="py-1">
                {loading ? (
                  <div className="px-4 py-8 text-gray-500 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-accent" />
                    <span className="text-sm">Mencari...</span>
                  </div>
                ) : results.length > 0 ? (
                  <>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50/50">
                      Hasil Pencarian
                    </div>
                    {results.map(renderItem)}
                  </>
                ) : (
                  <div className="px-4 py-8 text-center text-gray-400 flex flex-col items-center gap-2">
                    <Search className="h-8 w-8 text-gray-200" />
                    <span>Tidak ditemukan hasil untuk "{searchTerm}"</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {showQuickAdd && (
            <div
              className="cursor-pointer select-none relative py-3 px-4 border-t border-gray-100 bg-primary/5 hover:bg-primary/10 text-primary font-semibold transition-colors mt-auto"
              onClick={(e) => {
                e.stopPropagation();
                handleQuickAdd();
              }}
            >
              <div className="flex items-center gap-2">
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                <span>Tambah baru: "{searchTerm}"</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
