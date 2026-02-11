import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Product } from '../../types';
import { Plus, Search, Edit, Trash2, Package, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductListProps {
  type?: 'equipment' | 'raw_material';
}

export default function ProductList({ type }: ProductListProps) {
  const [products, setProducts] = useState<any[]>([]); // Use any[] to avoid strict type crashes on partial data
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, [type]); // Re-fetch when type changes

  const fetchProducts = async () => {
    try {
      setLoading(true);
      // Fetch products with supplier details. 
      // Using 'suppliers (name)' without alias to rely on default Supabase behavior.
      let query = supabase
        .from('products')
        .select('*, suppliers (name)')
        .order('name');
      
      // Filter by type if provided
      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      console.log('Fetched products:', data);
      setProducts(data || []);
    } catch (error: any) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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
    try {
      // Handle both aliased 'supplier' (from previous code) and unaliased 'suppliers'
      const s = product.supplier || product.suppliers;
      
      if (!s) return 'Unknown Supplier';
      
      if (Array.isArray(s)) {
        return s.length > 0 ? s[0].name : 'Unknown Supplier';
      }
      
      return s.name || 'Unknown Supplier';
    } catch (e) {
      return 'Error';
    }
  };

  // Safe filtering
  const filteredProducts = products.filter(product => {
    if (!product) return false;
    const term = searchTerm.toLowerCase();
    const name = (product.name || '').toLowerCase();
    const sku = (product.sku || '').toLowerCase();
    return name.includes(term) || sku.includes(term);
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-gray-500">Loading inventory...</span>
      </div>
    );
  }

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">{getTitle()}</h1>
        <div className="flex space-x-2">
           <button
            onClick={fetchProducts}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => navigate(getAddUrl())}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Product
          </button>
        </div>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="mb-6 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
            placeholder="Search products by name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-col">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
              <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
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
                    {filteredProducts.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No products found.</td></tr>
                    ) : (
                      filteredProducts.map((product) => (
                        <tr key={product.id || Math.random()}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {product.image_url ? (
                                <img className="h-10 w-10 rounded-full object-cover" src={product.image_url} alt="" />
                              ) : (
                                <div className="flex-shrink-0 h-10 w-10 bg-primary-50 rounded-full flex items-center justify-center">
                                  <Package className="h-5 w-5 text-primary" />
                                </div>
                              )}
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{product.name || 'Unnamed Product'}</div>
                                <div className="text-sm text-gray-500">
                                  {getSupplierName(product)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.sku || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            ${typeof product.unit_price === 'number' ? product.unit_price.toFixed(2) : '0.00'}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${product.stock_quantity < 10 ? 'text-red-600' : 'text-gray-900'}`}>
                            {product.stock_quantity || 0}
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
