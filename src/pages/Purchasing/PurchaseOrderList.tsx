import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { PurchaseOrder } from '../../types';
import { Plus, Search, Eye, Calendar, X, Edit, Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Modal from '../../components/Modal';

interface PurchaseOrderListProps {
  type?: 'equipment' | 'raw_material';
}

export default function PurchaseOrderList({ type }: PurchaseOrderListProps) {
  const [orders, setOrders] = useState<any[]>([]); // Relaxed type for safety
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isEditingSupplier, setIsEditingSupplier] = useState(false);
  const [editedSupplier, setEditedSupplier] = useState<any>(null);

  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, [type]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Fetch with standard relationship format
      let query = supabase
        .from('purchase_orders')
        .select('*, suppliers(*)')
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Map data to ensure 'supplier' property is populated
      const mappedOrders = (data || []).map(order => ({
        ...order,
        supplier: order.suppliers || order.supplier // Handle both cases
      }));

      setOrders(mappedOrders);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

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

  const filteredOrders = orders.filter(order => {
    const term = searchTerm.toLowerCase();
    const supplierName = order.supplier?.name?.toLowerCase() || '';
    const orderId = (order.id || '').toLowerCase();
    return supplierName.includes(term) || orderId.includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Purchase Orders</h1>
        <div className="flex space-x-2">
            <button
            onClick={fetchOrders}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
            >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
            </button>
            <button
            onClick={() => navigate('/purchasing/new')}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent"
            >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            New Purchase Order
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
            placeholder="Search orders by ID or supplier name..."
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
                    ) : filteredOrders.length === 0 ? (
                        <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No orders found.</td></tr>
                    ) : filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">#{order.id.slice(0, 8)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button onClick={() => handleViewSupplier(order.supplier_id)} className="text-primary hover:text-primary-hover hover:underline">
                            {order.supplier?.name || 'Unknown'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy') : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(order.total_amount || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={order.status}
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md"
                          >
                            <option value="draft">Draft</option>
                            <option value="ordered">Ordered</option>
                            <option value="received">Received</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={isSupplierModalOpen} onClose={() => setIsSupplierModalOpen(false)} title="Supplier Details">
        {selectedSupplier ? (
          <div className="space-y-6">
            <div className="flex justify-end">
              {!isEditingSupplier ? (
                <button onClick={() => setIsEditingSupplier(true)} className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  <Edit className="h-4 w-4 mr-2" /> Edit
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button onClick={() => { setIsEditingSupplier(false); setEditedSupplier(selectedSupplier); }} className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                  <button onClick={handleUpdateSupplier} className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover"><Save className="h-4 w-4 mr-2" /> Save</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><h4 className="text-sm font-medium text-gray-500">Name</h4>{isEditingSupplier ? <input type="text" value={editedSupplier.name} onChange={(e) => setEditedSupplier({ ...editedSupplier, name: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /> : <p className="mt-1 text-sm text-gray-900">{selectedSupplier.name}</p>}</div>
              <div><h4 className="text-sm font-medium text-gray-500">Email</h4>{isEditingSupplier ? <input type="email" value={editedSupplier.email} onChange={(e) => setEditedSupplier({ ...editedSupplier, email: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /> : <p className="mt-1 text-sm text-gray-900">{selectedSupplier.email}</p>}</div>
              <div><h4 className="text-sm font-medium text-gray-500">Phone</h4>{isEditingSupplier ? <input type="text" value={editedSupplier.phone} onChange={(e) => setEditedSupplier({ ...editedSupplier, phone: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /> : <p className="mt-1 text-sm text-gray-900">{selectedSupplier.phone}</p>}</div>
              <div className="col-span-2"><h4 className="text-sm font-medium text-gray-500">Address</h4>{isEditingSupplier ? <textarea rows={3} value={editedSupplier.address} onChange={(e) => setEditedSupplier({ ...editedSupplier, address: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /> : <p className="mt-1 text-sm text-gray-900">{selectedSupplier.address}</p>}</div>
            </div>
            <div className="flex justify-end pt-4 border-t"><button type="button" className="bg-white rounded-md border border-gray-300 shadow-sm px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 sm:text-sm" onClick={() => setIsSupplierModalOpen(false)}>Close</button></div>
          </div>
        ) : <div className="text-center py-4">Loading...</div>}
      </Modal>
    </div>
  );
}
