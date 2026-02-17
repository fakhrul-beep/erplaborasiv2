import React, { useState, useEffect } from 'react';
import { Truck, Search, Filter, ChevronLeft, ChevronRight, Eye, Package, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase, withRetry } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';

interface ShipmentListProps {
  type: 'sales' | 'purchase';
}

export default function ShipmentList({ type }: ShipmentListProps) {
  const { profile } = useAuthStore();
  const allowedRoles = ['superadmin', 'admin', 'manager', 'logistik'];
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const title = type === 'sales' ? 'Pengiriman Bahan Baku' : 'Pengiriman Perlengkapan';
  const transactionHeader = type === 'sales' ? 'Customer' : 'Supplier';
  const emptyMessage = type === 'sales' ? 'Belum ada data pengiriman bahan baku.' : 'Belum ada data pengiriman perlengkapan.';

  // Refetch data when window gains focus
  useRefetchOnFocus(() => {
    // Only fetch if we already have a profile and permission
    if (profile && allowedRoles.includes(profile.role)) {
      const controller = new AbortController();
      fetchShipments(controller.signal);
      return () => controller.abort();
    }
  }); // Refetch only on focus/visibility

  useEffect(() => {
    const controller = new AbortController();
    fetchShipments(controller.signal);
    fetchVendors();

    // Set up real-time subscription for shipments
    const channel = supabase
      .channel(`shipments-${type}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipment_orders',
          filter: `type=eq.${type}`
        },
        () => {
          fetchShipments(controller.signal); // Refresh on any change
        }
      )
      .subscribe();

    return () => {
      controller.abort();
      supabase.removeChannel(channel);
    };
  }, [type]);

  async function fetchVendors() {
    try {
      const { data, error } = await supabase.from('shipping_vendors').select('id, name');
      if (!error && data) {
        setVendors(data);
      }
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  }

  async function fetchShipments(signal?: AbortSignal) {
    try {
      if (!profile || !allowedRoles.includes(profile.role)) {
        // Only show toast if it's a manual action, not during mount
        // toast.error('Anda tidak memiliki izin untuk melihat data ini');
        if (!signal?.aborted) setLoading(false);
        return;
      }
      if (!signal?.aborted) setLoading(true);
      const { data, error } = await withRetry(() => 
        supabase
          .from('shipment_orders')
          .select(`
            id,
            status,
            type,
            category,
            tracking_number,
            created_at,
            vendor_id,
            order_id,
            purchase_order_id
          `)
          .eq('type', type)
          .order('created_at', { ascending: false }),
        5, // Reduced retries from 10 to 5
        1000, // Reduced initial delay
        `shipments-${type}`,
        signal
      );

      if (signal?.aborted) return;

      if (error) throw error;

      let enrichedData = data || [];

      // Fetch related Orders and Customers
      const orderIds = Array.from(new Set(enrichedData.map((s: any) => s.order_id).filter(Boolean)));
      if (orderIds.length > 0) {
        const { data: orders } = await supabase.from('orders').select('id, customer_id').in('id', orderIds);
        const customerIds = Array.from(new Set(orders?.map((o: any) => o.customer_id).filter(Boolean)));
        
        let customersMap: any = {};
        if (customerIds.length > 0) {
            const { data: customers } = await supabase.from('customers').select('id, name').in('id', customerIds);
            customers?.forEach((c: any) => customersMap[c.id] = c);
        }
        
        const ordersMap = orders?.reduce((acc: any, o: any) => {
            acc[o.id] = { ...o, customer: customersMap[o.customer_id] };
            return acc;
        }, {}) || {};
        
        enrichedData = enrichedData.map((s: any) => ({
            ...s,
            order: ordersMap[s.order_id]
        }));
      }

      // Fetch related Purchase Orders and Suppliers
      const poIds = Array.from(new Set(enrichedData.map((s: any) => s.purchase_order_id).filter(Boolean)));
      if (poIds.length > 0) {
        const { data: pos } = await supabase.from('purchase_orders').select('id, supplier_id').in('id', poIds);
        const supplierIds = Array.from(new Set(pos?.map((p: any) => p.supplier_id).filter(Boolean)));
        
        let suppliersMap: any = {};
        if (supplierIds.length > 0) {
            const { data: suppliers } = await supabase.from('suppliers').select('id, name').in('id', supplierIds);
            suppliers?.forEach((s: any) => suppliersMap[s.id] = s);
        }
        
        const posMap = pos?.reduce((acc: any, p: any) => {
            acc[p.id] = { ...p, supplier: suppliersMap[p.supplier_id] };
            return acc;
        }, {}) || {};
        
        enrichedData = enrichedData.map((s: any) => ({
            ...s,
            purchase_order: posMap[s.purchase_order_id]
        }));
      }

      setShipments(enrichedData);
    } catch (error: any) {
      if (signal?.aborted || error.message === 'Aborted') return;
      
      console.error('Error fetching shipments:', error);
      if (error.message?.includes('schema cache') || error.code === 'PGRST205') {
        toast.error('Sistem sedang melakukan sinkronisasi database untuk memastikan data terbaru. Kami sedang mencoba memuat ulang secara otomatis. Jika tetap gagal, silakan refresh halaman dalam beberapa saat.', { 
          id: 'schema-cache-error',
          duration: 5000 
        });
      } else {
        toast.error('Gagal memuat daftar pengiriman: ' + error.message);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  const filteredShipments = shipments.filter(s => 
    s.tracking_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.order?.customer?.name || s.purchase_order?.supplier?.name)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800',
      confirmed: 'bg-blue-100 text-blue-800',
      in_transit: 'bg-yellow-100 text-yellow-800',
      delivered: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
              placeholder="Cari berdasarkan No. Resi atau ID Transaksi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <Filter className="mr-2 h-4 w-4" />
            Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{transactionHeader}</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No. Resi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estimasi</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent"></div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-gray-700 animate-pulse">Memuat data pengiriman...</p>
                        <p className="text-xs text-gray-400">Sistem sedang melakukan sinkronisasi dengan database</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : filteredShipments.length > 0 ? (
                filteredShipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {type === 'sales' ? shipment.order?.customer?.name : shipment.purchase_order?.supplier?.name}
                      </div>
                      <div className="text-xs text-gray-500">{shipment.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Truck className="mr-2 h-4 w-4 text-gray-400" />
                        {vendors.find(v => v.id === shipment.vendor_id)?.name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Package className="mr-2 h-4 w-4 text-gray-400" />
                        {shipment.tracking_number || 'Belum tersedia'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(shipment.status)}`}>
                        {shipment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <MapPin className="mr-1 h-3 w-3" />
                        3-5 hari
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link to={`/delivery/${shipment.id}`} className="text-primary hover:text-primary-hover inline-flex items-center">
                        <Eye className="mr-1 h-4 w-4" /> Detail
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500 italic">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
