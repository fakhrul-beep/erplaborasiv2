import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Order } from '../../types';
import { Plus, Search, Eye, FileText, Calendar, DollarSign, X, Edit, Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Modal from '../../components/Modal';

interface OrderListProps {
  type?: 'equipment' | 'raw_material';
}

export default function OrderList({ type }: OrderListProps) {
  const [orders, setOrders] = useState<any[]>([]); // Relaxed type
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<any>(null);

  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_method: 'Bank Transfer',
    proof_url: '',
    notes: ''
  });

  const navigate = useNavigate();

  useEffect(() => {
    fetchOrders();
  }, [type]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('orders')
        .select('*, customers(*), order_items(*, products(*))')
        .order('created_at', { ascending: false });

      if (type) {
        query = query.eq('type', type);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Map data to match expected structure
      const mappedOrders = (data || []).map(order => ({
        ...order,
        customer: order.customers || order.customer, // Handle both
        items: (order.order_items || []).map((item: any) => ({
          ...item,
          product: item.products || item.product
        }))
      }));

      setOrders(mappedOrders);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerClick = async (e: React.MouseEvent, customerId: string) => {
    e.stopPropagation();
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (error) throw error;
      setSelectedCustomer(data);
      setEditedCustomer(data);
      setIsEditingCustomer(false);
      setIsCustomerModalOpen(true);
    } catch (error) {
      console.error('Error fetching customer details:', error);
      toast.error('Failed to load customer details');
    }
  };

  const handleUpdateCustomer = async () => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({
          name: editedCustomer.name,
          email: editedCustomer.email,
          phone: editedCustomer.phone,
          address: editedCustomer.address,
          credit_limit: editedCustomer.credit_limit,
          payment_terms: editedCustomer.payment_terms
        })
        .eq('id', selectedCustomer.id);

      if (error) throw error;

      setSelectedCustomer(editedCustomer);
      setIsEditingCustomer(false);
      toast.success('Customer updated successfully');
      
      // Update local state
      setOrders(orders.map(o => 
        o.customer?.id === selectedCustomer.id 
          ? { ...o, customer: { ...o.customer, ...editedCustomer } } 
          : o
      ));
      
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error('Failed to update customer');
    }
  };

  const handleAddPayment = async () => {
    if (!selectedOrder) return;
    try {
      const { error } = await supabase.from('payments').insert({
        order_id: selectedOrder.id,
        amount: parseFloat(paymentData.amount),
        payment_method: paymentData.payment_method,
        proof_url: paymentData.proof_url,
        notes: paymentData.notes,
        status: 'pending'
      });

      if (error) throw error;
      toast.success('Payment recorded successfully');
      setIsAddingPayment(false);
      setPaymentData({
        amount: '',
        payment_method: 'Bank Transfer',
        proof_url: '',
        notes: ''
      });
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const filteredOrders = orders.filter(order => {
    const term = searchTerm.toLowerCase();
    const customerName = order.customer?.name?.toLowerCase() || '';
    const orderId = (order.id || '').toLowerCase();
    return customerName.includes(term) || orderId.includes(term);
  });

  const getTitle = () => {
    if (type === 'equipment') return 'Sales Orders (Perlengkapan)';
    if (type === 'raw_material') return 'Sales Orders (Bahan Baku)';
    return 'Sales Orders';
  };

  const getAddUrl = () => {
    if (type === 'equipment') return '/sales/equipment/new';
    if (type === 'raw_material') return '/sales/raw-materials/new';
    return '/sales/new';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">{getTitle()}</h1>
        <div className="flex space-x-2">
            <button
            onClick={fetchOrders}
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
            New Order
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
            placeholder="Search orders by ID or customer name..."
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                      <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr><td colSpan={7} className="px-6 py-4 text-center">Loading...</td></tr>
                    ) : filteredOrders.length === 0 ? (
                        <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">No orders found.</td></tr>
                    ) : filteredOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">#{order.id.slice(0, 8)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button onClick={(e) => handleCustomerClick(e, order.customer_id)} className="text-primary hover:text-primary-hover hover:underline">
                            {order.customer?.name || 'Unknown'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy') : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(order.total_amount || 0).toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {order.payment_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-primary hover:text-primary-hover flex items-center ml-auto">
                            <Eye className="h-4 w-4 mr-1" /> View
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
      </div>

      {/* Order Details Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Order Details">
        {selectedOrder ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div><h4 className="text-sm font-medium text-gray-500">Customer</h4><p className="mt-1 text-sm text-gray-900">{selectedOrder.customer?.name || 'Unknown'}</p></div>
              <div><h4 className="text-sm font-medium text-gray-500">Date</h4><p className="mt-1 text-sm text-gray-900">{selectedOrder.created_at ? format(new Date(selectedOrder.created_at), 'PPP') : '-'}</p></div>
              <div><h4 className="text-sm font-medium text-gray-500">Status</h4><p className="mt-1 text-sm text-gray-900 capitalize">{selectedOrder.status}</p></div>
              <div><h4 className="text-sm font-medium text-gray-500">Payment</h4><p className="mt-1 text-sm text-gray-900 capitalize">{selectedOrder.payment_status}</p></div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-500 mb-2">Items</h4>
              <table className="min-w-full divide-y divide-gray-200">
                <thead><tr><th className="text-left text-xs font-medium text-gray-500 uppercase">Product</th><th className="text-right text-xs font-medium text-gray-500 uppercase">Qty</th><th className="text-right text-xs font-medium text-gray-500 uppercase">Price</th><th className="text-right text-xs font-medium text-gray-500 uppercase">Total</th></tr></thead>
                <tbody>
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2 text-sm text-gray-900">{item.product?.name || 'Unknown Product'}</td>
                      <td className="py-2 text-sm text-gray-900 text-right">{item.quantity}</td>
                      <td className="py-2 text-sm text-gray-900 text-right">${item.unit_price}</td>
                      <td className="py-2 text-sm text-gray-900 text-right">${(item.quantity * item.unit_price).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-200"><td colSpan={3} className="py-2 text-sm font-bold text-gray-900 text-right">Total</td><td className="py-2 text-sm font-bold text-gray-900 text-right">${(selectedOrder.total_amount || 0).toFixed(2)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-4 border-t space-x-2">
               {!isAddingPayment ? (
                 <button type="button" className="bg-primary rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white hover:bg-primary-hover focus:outline-none sm:text-sm" onClick={() => { setPaymentData({ ...paymentData, amount: selectedOrder.total_amount.toString() }); setIsAddingPayment(true); }}>
                    <DollarSign className="h-4 w-4 inline mr-1" /> Record Payment
                  </button>
               ) : null}
               <button type="button" className="bg-white rounded-md border border-gray-300 shadow-sm px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent sm:text-sm" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
            
            {isAddingPayment && (
              <div className="bg-gray-50 p-4 rounded-md border border-gray-200 mt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Record Payment</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="block text-xs font-medium text-gray-500">Amount</label><input type="number" step="0.01" value={paymentData.amount} onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm" /></div>
                  <div><label className="block text-xs font-medium text-gray-500">Method</label><select value={paymentData.payment_method} onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm"><option>Bank Transfer</option><option>Cash</option><option>Credit Card</option></select></div>
                  <div className="col-span-2"><label className="block text-xs font-medium text-gray-500">Proof URL</label><input type="text" value={paymentData.proof_url} onChange={(e) => setPaymentData({ ...paymentData, proof_url: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm" /></div>
                  <div className="col-span-2"><label className="block text-xs font-medium text-gray-500">Notes</label><textarea rows={2} value={paymentData.notes} onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1.5 px-2 text-sm" /></div>
                </div>
                <div className="flex justify-end mt-3 space-x-2">
                  <button onClick={() => setIsAddingPayment(false)} className="px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                  <button onClick={handleAddPayment} className="px-3 py-1.5 border border-transparent rounded-md text-xs font-medium text-white bg-green-600 hover:bg-green-700">Submit Payment</button>
                </div>
              </div>
            )}
          </div>
        ) : <div className="text-center py-4">Loading...</div>}
      </Modal>

      {/* Customer Edit Modal */}
      <Modal isOpen={isCustomerModalOpen} onClose={() => setIsCustomerModalOpen(false)} title="Customer Details">
        {selectedCustomer ? (
          <div className="space-y-6">
            <div className="flex justify-end">
              {!isEditingCustomer ? (
                <button onClick={() => setIsEditingCustomer(true)} className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                  <Edit className="h-4 w-4 mr-2" /> Edit
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button onClick={() => { setIsEditingCustomer(false); setEditedCustomer(selectedCustomer); }} className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                  <button onClick={handleUpdateCustomer} className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover"><Save className="h-4 w-4 mr-2" /> Save</button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><h4 className="text-sm font-medium text-gray-500">Name</h4>{isEditingCustomer ? <input type="text" value={editedCustomer.name} onChange={(e) => setEditedCustomer({ ...editedCustomer, name: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /> : <p className="mt-1 text-sm text-gray-900">{selectedCustomer.name}</p>}</div>
              <div><h4 className="text-sm font-medium text-gray-500">Email</h4>{isEditingCustomer ? <input type="email" value={editedCustomer.email} onChange={(e) => setEditedCustomer({ ...editedCustomer, email: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /> : <p className="mt-1 text-sm text-gray-900">{selectedCustomer.email}</p>}</div>
              <div><h4 className="text-sm font-medium text-gray-500">Phone</h4>{isEditingCustomer ? <input type="text" value={editedCustomer.phone} onChange={(e) => setEditedCustomer({ ...editedCustomer, phone: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /> : <p className="mt-1 text-sm text-gray-900">{selectedCustomer.phone}</p>}</div>
              <div className="col-span-2"><h4 className="text-sm font-medium text-gray-500">Address</h4>{isEditingCustomer ? <textarea rows={3} value={editedCustomer.address} onChange={(e) => setEditedCustomer({ ...editedCustomer, address: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /> : <p className="mt-1 text-sm text-gray-900">{selectedCustomer.address}</p>}</div>
            </div>
            <div className="flex justify-end pt-4 border-t"><button type="button" className="bg-white rounded-md border border-gray-300 shadow-sm px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 sm:text-sm" onClick={() => setIsCustomerModalOpen(false)}>Close</button></div>
          </div>
        ) : <div className="text-center py-4">Loading...</div>}
      </Modal>
    </div>
  );
}
