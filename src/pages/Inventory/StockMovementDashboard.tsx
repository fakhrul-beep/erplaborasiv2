import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { RefreshCw, Search, Clock, User, Package } from 'lucide-react';
import toast from 'react-hot-toast';

interface StockMovement {
  id: string;
  product_id: string;
  warehouse_id: string;
  movement_type: string;
  quantity: number;
  balance_after: number;
  reference_type?: string;
  reference_id?: string;
  user_id: string;
  notes?: string;
  created_at: string;
  product_name?: string;
  product_sku?: string;
  product_category?: string;
  warehouse_name?: string;
  user_email?: string;
}

export default function StockMovementDashboard() {
  const { user, profile, loading: authLoading } = useAuthStore();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'equipment' | 'raw_material'>('all');

  useEffect(() => {
    const isAuthorized = 
      (profile && ['superadmin', 'admin', 'manager'].includes(profile.role)) ||
      (user?.email === 'fakhrul@ternakmart.com');

    if (isAuthorized) {
      loadDashboardData();
    }
  }, [profile, user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch reference data
      const [productsRes, warehousesRes, profilesRes] = await Promise.all([
        supabase.from('products').select('id, name, sku, category'),
        supabase.from('warehouses').select('id, name'),
        supabase.from('profiles').select('id, email, full_name')
      ]);

      const productsData = productsRes.data || [];
      const warehousesData = warehousesRes.data || [];
      const profilesData = profilesRes.data || [];

      setProducts(productsData);
      setWarehouses(warehousesData);
      setProfiles(profilesData);

      // Fetch movements
      const { data: movementsData, error } = await supabase
        .from('inventory_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const mapped = (movementsData || []).map((row: any) => {
        const product = productsData.find((p: any) => p.id === row.product_id);
        const warehouse = warehousesData.find((w: any) => w.id === row.warehouse_id);
        const userProfile = profilesData.find((p: any) => p.id === row.user_id);
        
        return {
          id: row.id,
          product_id: row.product_id,
          warehouse_id: row.warehouse_id,
          movement_type: row.movement_type,
          quantity: row.quantity,
          balance_after: row.balance_after,
          reference_type: row.reference_type,
          reference_id: row.reference_id,
          user_id: row.user_id,
          notes: row.notes,
          created_at: row.created_at,
          product_name: product?.name,
          product_sku: product?.sku,
          product_category: product?.category,
          warehouse_name: warehouse?.name,
          user_email: userProfile?.email || 'Unknown User',
        };
      });

      setMovements(mapped);
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      toast.error('Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  const isAuthorized = 
    (profile && ['superadmin', 'admin', 'manager'].includes(profile.role)) ||
    (user?.email === 'fakhrul@ternakmart.com');

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="mt-2 text-gray-600">Anda tidak memiliki izin untuk mengakses halaman ini.</p>
      </div>
    );
  }

  const filteredMovements = movements.filter((m) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (m.product_name || '').toLowerCase().includes(term) ||
      (m.product_sku || '').toLowerCase().includes(term) ||
      (m.movement_type || '').toLowerCase().includes(term) ||
      (m.reference_type || '').toLowerCase().includes(term) ||
      (m.user_email || '').toLowerCase().includes(term);
    
    const matchesCategory = categoryFilter === 'all' || m.product_category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const getMovementTypeBadge = (type: string) => {
    switch (type) {
      case 'in':
        return 'bg-green-100 text-green-800';
      case 'out':
        return 'bg-red-100 text-red-800';
      case 'adjustment':
        return 'bg-blue-100 text-blue-800';
      case 'transfer':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Monitoring Perubahan Stok</h1>
          <p className="text-sm text-gray-500 mt-1">
            Audit trail real-time untuk setiap pergerakan stok beserta timestamp dan user.
          </p>
        </div>
        <div className="flex space-x-2 w-full sm:w-auto">
          <button
            onClick={fetchMovements}
            className="flex-1 sm:flex-none inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex p-1 bg-gray-100 rounded-lg w-fit">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                categoryFilter === 'all'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setCategoryFilter('equipment')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                categoryFilter === 'equipment'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Perlengkapan
            </button>
            <button
              onClick={() => setCategoryFilter('raw_material')}
              className={`px-4 py-2 text-sm font-medium rounded-md ${
                categoryFilter === 'raw_material'
                  ? 'bg-white text-gray-900 shadow'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Bahan Baku
            </button>
          </div>

          <div className="relative rounded-md shadow-sm flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
              placeholder="Cari produk, SKU, movement..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
            <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Waktu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Produk
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kategori
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Movement
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Saldo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Catatan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                        Tidak ada data pergerakan stok.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((m) => (
                      <tr key={m.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2 text-gray-400" />
                            {new Date(m.created_at).toLocaleString('id-ID')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <Package className="h-4 w-4 mr-2 text-gray-400" />
                            <div>
                              <div className="font-medium">{m.product_name || m.product_id}</div>
                              <div className="text-xs text-gray-500">{m.product_sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="px-2 py-1 text-xs rounded bg-gray-100">
                            {m.product_category === 'equipment' ? 'Perlengkapan' : 'Bahan Baku'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getMovementTypeBadge(m.movement_type)}`}
                          >
                            {m.movement_type.toUpperCase()}
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {m.reference_type || '-'}
                          </div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                          m.quantity > 0 ? 'text-green-600' : m.quantity < 0 ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold">
                          {m.balance_after}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {m.notes || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1 text-gray-400" />
                            {m.user_email || 'System'}
                          </div>
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
  );
}

