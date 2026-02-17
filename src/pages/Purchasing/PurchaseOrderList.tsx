import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Plus, Edit, Save, RefreshCw, Download } from 'lucide-react';
import { generatePurchaseOrderPDF } from '../../utils/pdfGenerator';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Modal from '../../components/Modal';
import { MobileCard } from '../../components/MobileCard';
import { useSettingsStore } from '../../store/settingsStore';
import OrderFilterPanel, { FilterState } from '../../components/Inventory/OrderFilterPanel';

interface PurchaseOrderListProps {
  type?: 'equipment' | 'raw_material';
}

export default function PurchaseOrderList({ type }: PurchaseOrderListProps) {
  const [orders, setOrders] = useState<any[]>([]); // Relaxed type for safety
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredCount, setFilteredCount] = useState(0);
  const [filters, setFilters] = useState<FilterState | null>(null);
  
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  const [editedSupplier, setEditedSupplier] = useState<any>(null);

  const { formatCurrency } = useSettingsStore();

  const navigate = useNavigate();

  useEffect(() => {
    fetchSuppliers();
    fetchOrders();
  }, [type, filters]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase.from('suppliers').select('*');
      if (!error && data) setSuppliers(data);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Fetch with standard relationship format
      let query = supabase
        .from('purchase_orders')
        .select('*');

      if (type) {
        query = query.eq('type', type);
      }

      // Apply Filters
      if (filters) {
        if (filters.search) {
          // Only search by ID, remove supplier name search here, will do client side
          query = query.ilike('id', `%${filters.search}%`);
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.startDate) {
          query = query.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('created_at', filters.endDate);
        }
        if (filters.minAmount) {
          query = query.gte('total_amount', parseFloat(filters.minAmount));
        }
        if (filters.maxAmount) {
          query = query.lte('total_amount', parseFloat(filters.maxAmount));
        }

        // Apply Sorting
        if (filters.sortBy) {
          const ascending = filters.sortOrder === 'asc';
          
          switch (filters.sortBy) {
            case 'customer':
              // query = query.order('name', { foreignTable: 'suppliers', ascending });
              // Cannot sort by foreign table without join. Fallback to created_at
              query = query.order('created_at', { ascending });
              break;
            case 'amount':
              query = query.order('total_amount', { ascending });
              break;
            case 'date':
              query = query.order('created_at', { ascending });
              break;
            case 'id':
              query = query.order('id', { ascending });
              break;
            default:
              query = query.order('created_at', { ascending: false });
          }
        } else {
          query = query.order('created_at', { ascending: false });
        }
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Map data to ensure 'supplier' property is populated
      let mappedOrders = (data || []).map(order => ({
        ...order,
        supplier: suppliers.find(s => s.id === order.supplier_id) || { name: 'Unknown' }
      }));

      // Client-side filtering for supplier name
      if (filters && filters.search) {
        const searchLower = filters.search.toLowerCase();
        mappedOrders = mappedOrders.filter((order: any) => 
          order.id.toLowerCase().includes(searchLower) ||
          order.supplier.name.toLowerCase().includes(searchLower)
        );
      }

      // Client-side sorting for supplier name
      if (filters && filters.sortBy === 'customer') {
        const ascending = filters.sortOrder === 'asc';
        mappedOrders.sort((a: any, b: any) => {
          const nameA = a.supplier.name.toLowerCase();
          const nameB = b.supplier.name.toLowerCase();
          if (nameA < nameB) return ascending ? -1 : 1;
          if (nameA > nameB) return ascending ? 1 : -1;
          return 0;
        });
      }

      setOrders(mappedOrders);
      setFilteredCount(mappedOrders.length);
    } catch (error: any) {
      console.error('Error fetching purchase orders:', error);
      let errorMessage = 'Failed to load purchase orders';
      
      if (error.message?.includes('failed to parse order')) {
        errorMessage = 'Filter sorting error: Invalid sort column structure.';
      } else if (error.code === 'PGRST116') {
        errorMessage = 'Order not found.';
      } else if (error.message) {
        errorMessage += ': ' + error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      
      if (newStatus === 'received') {
        const order = orders.find(o => o.id === orderId);
        if (order) {
             await supabase.from('transactions').insert({
                 date: new Date().toISOString(),
                 description: `Purchase Order #${order.id.slice(0, 8)} Payment`,
                 amount: order.total_amount,
                 type: 'expense',
                 category: 'Purchasing',
                 reference_id: order.id,
                 reference_type: 'purchase_order'
             });
        }
      }

      setOrders(orders.map(o => 
        o.id === orderId ? { ...o, status: newStatus as any } : o
      ));
      toast.success('Order status updated');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleViewSupplier = async (supplierId: string) => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', supplierId)
        .single();

      if (error) throw error;
      setSelectedSupplier(data);
      setEditedSupplier(data);
      setIsEditingSupplier(false);
      setIsSupplierModalOpen(true);
    } catch (error) {
      console.error('Error fetching supplier details:', error);
      toast.error('Failed to load supplier details');
    }
  };

  const handleUpdateSupplier = async () => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          name: editedSupplier.name,
          email: editedSupplier.email,
          phone: editedSupplier.phone,
          address: editedSupplier.address,
          rating: editedSupplier.rating
        })
        .eq('id', selectedSupplier.id);

      if (error) throw error;

      setSelectedSupplier(editedSupplier);
      setIsEditingSupplier(false);
      toast.success('Supplier updated successfully');
      
      setOrders(orders.map(o => 
        o.supplier?.id === selectedSupplier.id 
          ? { ...o, supplier: { ...o.supplier, ...editedSupplier } } 
          : o
      ));
      
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast.error('Failed to update supplier');
    }
  };

  const handleDownloadPO = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    try {
        // Fetch items if not present
        if (!order.items) {
             const { data: items } = await supabase
                .from('purchase_order_items')
                .select('*, products(*)')
                .eq('purchase_order_id', order.id);
             order.items = items?.map((i:any) => ({...i, product: i.products}));
        }

        await generatePurchaseOrderPDF(order);
        
        // Audit Log
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('audit_logs').insert({
                user_id: user.id,
                action: 'download_po',
                entity: 'purchase_order',
                entity_id: order.id,
                details: { po_number: order.id }
            });
        }
        toast.success('PO downloaded successfully');
    } catch (error) {
        console.error('Error generating PDF:', error);
        toast.error('Failed to generate PO');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Purchase Orders</h1>
        <div className="flex space-x-2 w-full sm:w-auto">
            <button
            onClick={fetchOrders}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none min-h-[44px]"
            type="button"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
          <button
            onClick={() => navigate('/purchasing/new')}
            className="flex-1 sm:flex-none justify-center inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-900 bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent min-h-[44px]"
            type="button"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            New Purchase Order
          </button>
        </div>
      </div>

      <OrderFilterPanel 
        onFilterChange={handleFilterChange}
        totalCount={filteredCount}
        type="purchasing"
      />

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        {/* Desktop View (Table) */}
        <div className="hidden md:block flex flex-col">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
              <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr><td colSpan={5} className="px-6 py-4 text-center">Loading...</td></tr>
                    ) : orders.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No orders found.</td></tr>
                    ) : orders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">#{order.id.slice(0, 8)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button onClick={() => handleViewSupplier(order.supplier_id)} className="text-primary hover:text-primary-hover hover:underline" type="button" aria-label="View supplier details">
                            {order.supplier?.name || 'Unknown'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy') : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(order.total_amount || 0)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md"
                            aria-label="Change order status"
                          >
                            <option value="draft">Draft</option>
                            <option value="ordered">Ordered</option>
                            <option value="received">Received</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button 
                             onClick={(e) => handleDownloadPO(e, order)}
                             className="text-gray-500 hover:text-gray-700"
                             title="Download PO"
                             type="button"
                             aria-label="Download Purchase Order"
                          >
                             <Download className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile View (Cards) */}
        <div className="md:hidden">
          {orders.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No orders found.</div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="relative">
                <MobileCard
                  id={order.id}
                  title={`PO #${order.id.slice(0, 8)}`}
                  subtitle={order.supplier?.name || 'Unknown Supplier'}
                  status={{
                    label: order.status,
                    color: order.status === 'received' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }}
                  details={[
                    { label: 'Date', value: order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy') : '-' },
                    { label: 'Total', value: formatCurrency(order.total_amount || 0) }
                  ]}
                  actions={[
                    {
                      icon: Download,
                      label: 'Download PO',
                      onClick: () => handleDownloadPO({ stopPropagation: () => {} } as any, order),
                      variant: 'default'
                    }
                  ]}
                />
                {/* Mobile Status Changer */}
                <div className="absolute top-[60px] right-4 z-10">
                   {/* Simplified status for mobile, or could be part of details. 
                       For now, let's just keep the select inside the card flow or separate.
                       Actually, putting it absolutely positioned might overlap. 
                       Let's add it below the card content or inside details?
                       The MobileCard doesn't support custom children yet.
                       I will stick to read-only status on mobile card for now to avoid clutter, 
                       as requested "reducing visual clutter". 
                       If editing is needed, maybe a details view is better. 
                   */}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} title="Supplier Details">
        {selectedSupplier ? (
          <div className="space-y-6">
            <div className="flex justify-end">
              {!isEditingSupplier ? (
                <button onClick={() => setIsEditingSupplier(true)} className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50" type="button" aria-label="Edit supplier">
                  <Edit className="h-4 w-4 mr-2" /> Edit
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button onClick={() => { setIsEditingSupplier(false); setEditedSupplier(selectedSupplier); }} className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50" type="button" aria-label="Cancel editing">Cancel</button>
                  <button onClick={handleUpdateSupplier} className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover" type="button" aria-label="Save supplier changes"><Save className="h-4 w-4 mr-2" /> Save</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><h4 className="text-sm font-medium text-gray-500">Name</h4>{isEditingSupplier ? <input type="text" value={editedSupplier.name} onChange={(e) => setEditedSupplier({ ...editedSupplier, name: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" aria-label="Supplier name" /> : <p className="mt-1 text-sm text-gray-900">{selectedSupplier.name}</p>}</div>
              <div><h4 className="text-sm font-medium text-gray-500">Email</h4>{isEditingSupplier ? <input type="email" value={editedSupplier.email} onChange={(e) => setEditedSupplier({ ...editedSupplier, email: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" aria-label="Supplier email" /> : <p className="mt-1 text-sm text-gray-900">{selectedSupplier.email}</p>}</div>
              <div><h4 className="text-sm font-medium text-gray-500">Phone</h4>{isEditingSupplier ? <input type="text" value={editedSupplier.phone} onChange={(e) => setEditedSupplier({ ...editedSupplier, phone: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" aria-label="Supplier phone" /> : <p className="mt-1 text-sm text-gray-900">{selectedSupplier.phone}</p>}</div>
              <div className="sm:col-span-2"><h4 className="text-sm font-medium text-gray-500">Address</h4>{isEditingSupplier ? <textarea rows={3} value={editedSupplier.address} onChange={(e) => setEditedSupplier({ ...editedSupplier, address: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" aria-label="Supplier address" /> : <p className="mt-1 text-sm text-gray-900">{selectedSupplier.address}</p>}</div>
            </div>
            <div className="flex justify-end pt-4 border-t"><button type="button" className="bg-white rounded-md border border-gray-300 shadow-sm px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 sm:text-sm min-h-[44px]" onClick={() => setIsSupplierModalOpen(false)}>Close</button></div>
          </div>
        ) : <div className="text-center py-4">Loading...</div>}
      </Modal>
    </div>
  );
}
