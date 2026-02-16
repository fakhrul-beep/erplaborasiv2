import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, withRetry } from '../../lib/supabase';
import { Product } from '../../types';
import { Plus, Search, Edit, Trash2, Package, RefreshCw, Upload, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { MobileCard } from '../../components/MobileCard';
import { useSettingsStore } from '../../store/settingsStore';
import StockFilterPanel, { StockFilterState } from '../../components/Inventory/StockFilterPanel';
import ImportModal from '../../components/Inventory/ImportModal';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';

interface ProductListProps {
  type?: 'equipment' | 'raw_material';
}

export default function ProductList({ type }: ProductListProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Filter & Sort state (managed by StockFilterPanel)
  const [filters, setFilters] = useState<StockFilterState>({
    search: '',
    category: '',
    supplier: '',
    status: '',
    minStock: '',
    maxStock: '',
    sortBy: 'name',
    sortOrder: 'asc',
  });
  
  const navigate = useNavigate();
  const { formatCurrency } = useSettingsStore();

  const fetchProducts = async (signal?: AbortSignal) => {
    try {
      if (!signal?.aborted) setLoading(true);
      
      const { data, error } = await withRetry(async () => {
        let query = supabase
          .from('products')
          .select('*, suppliers (id, name)');
        
        if (type) {
          query = query.eq('type', type);
        }

        // Apply Search
        if (filters.search) {
          query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
        }

        // Apply Filters
        if (filters.category) query = query.eq('category', filters.category);
        if (filters.supplier) query = query.eq('supplier_id', filters.supplier);
        if (filters.status === 'low') query = query.lt('stock_quantity', 10).gt('stock_quantity', 0);
        if (filters.status === 'out') query = query.eq('stock_quantity', 0);
        if (filters.status === 'available') query = query.gt('stock_quantity', 0);
        if (filters.minStock) query = query.gte('stock_quantity', filters.minStock);
        if (filters.maxStock) query = query.lte('stock_quantity', filters.maxStock);

        // Apply Sort
        if (filters.sortBy) {
          query = query.order(filters.sortBy, { ascending: filters.sortOrder === 'asc' });
        }
        
        return query;
      }, 3, 1000, undefined, signal);
      
      if (signal?.aborted) return;
      
      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      if (signal?.aborted || error.message === 'Aborted') return;
      console.error('Error fetching products:', error);
      toast.error('Failed to load products: ' + error.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  // Refetch data when window gains focus
  useRefetchOnFocus(() => {
    const controller = new AbortController();
    fetchProducts(controller.signal);
    return () => controller.abort();
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts(controller.signal);
    return () => controller.abort();
  }, [type, filters]);

  // Pagination Logic
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const paginatedProducts = products.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts(products.filter(p => p.id !== id));
      toast.success('Product deleted successfully');
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product: ' + error.message);
    }
  };

  const getSupplierName = (product: any) => {
    const s = product.suppliers;
    if (!s) return 'Unknown Supplier';
    return Array.isArray(s) ? (s[0]?.name || 'Unknown') : (s.name || 'Unknown');
  };

  const getTitle = () => {
    if (type === 'equipment') return 'Inventory Perlengkapan';
    if (type === 'raw_material') return 'Inventory Bahan Baku';
    return 'Inventory';
  };

  const getAddUrl = () => {
    if (type === 'equipment') return '/inventory/equipment/new';
    if (type === 'raw_material') return '/inventory/raw-materials/new';
    return '/inventory/new';
  };
  
  const getEditUrl = (id: string) => {
    if (type === 'equipment') return `/inventory/equipment/${id}/edit`;
    if (type === 'raw_material') return `/inventory/raw-materials/${id}/edit`;
    return `/inventory/${id}/edit`;
  };

  // Categories & Suppliers for filter
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
  const suppliers = Array.from(new Set(products.map(p => p.suppliers).filter(Boolean)))
    .map((s: any) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">{getTitle()}</h1>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
           <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none min-h-[44px]"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Stok
          </button>
           <button
            onClick={fetchProducts}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none min-h-[44px]"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => navigate(getAddUrl())}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-900 bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent min-h-[44px]"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Product
          </button>
        </div>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6 space-y-4">
        <StockFilterPanel 
          categories={categories}
          suppliers={suppliers}
          onFilterChange={setFilters}
          totalCount={products.length}
        />

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedProducts.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No products found.</td></tr>
                  ) : (
                    paginatedProducts.map((product) => (
                      <tr key={product.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-primary-50 rounded-full flex items-center justify-center overflow-hidden">
                              {product.image_url ? (
                                <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <Package className="h-5 w-5 text-primary" />
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-500">{getSupplierName(product)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.sku}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                          {formatCurrency(product.price)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-bold ${product.stock_quantity < 10 ? 'text-red-600' : 'text-gray-900'}`}>
                          {product.stock_quantity.toLocaleString('id-ID')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => navigate(getEditUrl(product.id))} className="text-primary hover:text-primary-hover mr-4">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(product.id)} className="text-red-600 hover:text-red-900">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {paginatedProducts.map((product) => (
                <MobileCard
                  key={product.id}
                  id={product.id}
                  title={product.name}
                  subtitle={getSupplierName(product)}
                  image={product.image_url}
                  status={{
                    label: product.stock_quantity < 10 ? 'Low Stock' : 'In Stock',
                    color: product.stock_quantity < 10 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                  }}
                  details={[
                    { label: 'SKU', value: product.sku },
                    { label: 'Stock', value: product.stock_quantity.toLocaleString('id-ID') },
                    { label: 'Price', value: formatCurrency(product.price) }
                  ]}
                  actions={[
                    { icon: Edit, label: 'Edit', onClick: () => navigate(getEditUrl(product.id)), variant: 'default' },
                    { icon: Trash2, label: 'Delete', onClick: () => handleDelete(product.id), variant: 'danger' }
                  ]}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {products.length > 0 && (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t">
                <div className="flex items-center text-sm text-gray-500">
                  Tampilkan
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="mx-2 border-gray-300 rounded-md text-sm focus:ring-accent"
                  >
                    {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  dari {products.length} produk
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="p-2 border rounded-md disabled:opacity-30 hover:bg-gray-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex gap-1">
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`px-3 py-1 text-sm rounded-md border ${
                          currentPage === i + 1 ? 'bg-primary text-white border-primary' : 'hover:bg-gray-50'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="p-2 border rounded-md disabled:opacity-30 hover:bg-gray-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {isImportModalOpen && (
        <ImportModal 
          type={type}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={fetchProducts}
        />
      )}
    </div>
  );
}

