import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Order } from '../../types';
import { Plus, Search, Eye, FileText, Calendar, DollarSign, X, Edit, Save, RefreshCw, Upload, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Modal from '../../components/Modal';
import PaymentUploadModal from '../../components/PaymentUploadModal';
import { generateInvoicePDF } from '../../utils/pdfGenerator';
import { MobileCard } from '../../components/MobileCard';
import { useSettingsStore } from '../../store/settingsStore';
import OrderFilterPanel, { FilterState } from '../../components/Inventory/OrderFilterPanel';

interface OrderListProps {
  type?: 'equipment' | 'raw_material';
}

export default function OrderList({ type }: OrderListProps) {
  const [orders, setOrders] = useState<any[]>([]); // Relaxed type
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filteredCount, setFilteredCount] = useState(0);
  const [filters, setFilters] = useState<FilterState | null>(null);
  
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { formatCurrency } = useSettingsStore();
  
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<any>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [orderForPayment, setOrderForPayment] = useState<any | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, [type, filters]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Fetch Customers
      const { data: customersData, error: customersError } = await supabase.from('customers').select('*');
      const customersList = customersData || [];
      if (!customersError) setCustomers(customersList);

      // Fetch Orders
      let query = supabase
        .from('orders')
        .select('*, order_items(*, products(*))');

      if (type) {
        query = query.eq('type', type);
      }

      // Apply Filters
      if (filters) {
        if (filters.search) {
          query = query.ilike('id', `%${filters.search}%`);
        }
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.paymentMethod) {
          query = query.eq('payment_method', filters.paymentMethod);
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
      
      // Map data using LOCAL customersList
      let mappedOrders = (data || []).map(order => ({
        ...order,
        customer: customersList.find((c: any) => c.id === order.customer_id) || { name: 'Unknown' },
        items: (order.order_items || []).map((item: any) => ({
          ...item,
          product: item.products || item.product
        }))
      }));

      // Client-side filtering for customer name
      if (filters && filters.search) {
        const searchLower = filters.search.toLowerCase();
        mappedOrders = mappedOrders.filter((order: any) => 
          order.id.toLowerCase().includes(searchLower) ||
          order.customer.name.toLowerCase().includes(searchLower)
        );
      }

      // Client-side sorting for customer name
      if (filters && filters.sortBy === 'customer') {
        const ascending = filters.sortOrder === 'asc';
        mappedOrders.sort((a: any, b: any) => {
          const nameA = a.customer.name.toLowerCase();
          const nameB = b.customer.name.toLowerCase();
          if (nameA < nameB) return ascending ? -1 : 1;
          if (nameA > nameB) return ascending ? 1 : -1;
          return 0;
        });
      }

      setOrders(mappedOrders);
      setFilteredCount(mappedOrders.length);
    } catch (error: any) {
      console.error('Error loading orders:', error);
      let errorMessage = 'Failed to load orders';
      
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

  const handleDownloadInvoice = async (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    try {
        await generateInvoicePDF(order);
        
        // Audit Log
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('audit_logs').insert({
                user_id: user.id,
                action: 'download_invoice',
                entity: 'order',
                entity_id: order.id,
                details: { order_number: order.id }
            });
        }
        toast.success('Invoice downloaded successfully');
    } catch (error) {
        console.error('Error generating PDF:', error);
        toast.error('Failed to generate invoice');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'newly_created': return 'bg-blue-50 text-blue-600';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'unpaid': return 'bg-red-100 text-red-800';
      case 'unverified': return 'bg-orange-100 text-orange-800';
      case 'rejected': return 'bg-red-200 text-red-900';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAddUrl = () => {
    if (type === 'equipment') return '/sales/equipment/new';
    if (type === 'raw_material') return '/sales/raw-materials/new';
    return '/sales/new';
  };

  const getTitle = () => {
    if (type === 'equipment') return 'Sales Orders (Perlengkapan)';
    if (type === 'raw_material') return 'Sales Orders (Bahan Baku)';
    return 'Sales Orders';
  };

  const handleUploadPayment = (e: React.MouseEvent, order: any) => {
    e.stopPropagation();
    setOrderForPayment(order);
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">{getTitle()}</h1>
        <div className="flex space-x-2 w-full sm:w-auto">
            <button
            onClick={fetchOrders}
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
            New Order
            </button>
        </div>
      </div>

      <OrderFilterPanel 
        onFilterChange={handleFilterChange}
        totalCount={filteredCount}
        type="sales"
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
                    ) : orders.length === 0 ? (
                        <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">No orders found.</td></tr>
                    ) : orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">#{order.id.slice(0, 8)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <button onClick={(e) => handleCustomerClick(e, order.customer_id)} className="text-primary hover:text-primary-hover hover:underline">
                            {order.customer?.name || 'Unknown'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy') : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(order.total_amount || 0)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPaymentStatusColor(order.payment_status)}`}>
                            {order.payment_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end space-x-2">
                          <button 
                             onClick={(e) => handleDownloadInvoice(e, order)}
                             className="text-gray-500 hover:text-gray-700"
                             title="Download Invoice"
                          >
                             <Download className="h-4 w-4" />
                          </button>
                          {(order.payment_status === 'unpaid' || order.payment_status === 'rejected') && (
                            <button 
                              onClick={(e) => handleUploadPayment(e, order)}
                              className="text-accent-700 hover:text-accent-800 flex items-center"
                              title="Upload Payment Proof"
                            >
                              <Upload className="h-4 w-4" />
                            </button>
                          )}
                          <button className="text-primary hover:text-primary-hover flex items-center">
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

        {/* Mobile View (Cards) */}
        <div className="md:hidden">
          {orders.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No orders found.</div>
          ) : (
            orders.map((order) => (
              <MobileCard
                key={order.id}
                id={order.id}
                title={`Order #${order.id.slice(0, 8)}`}
                subtitle={order.customer?.name || 'Unknown Customer'}
                status={{
                  label: order.status,
                  color: getStatusColor(order.status)
                }}
                details={[
                  { label: 'Date', value: order.created_at ? format(new Date(order.created_at), 'MMM d, yyyy') : '-' },
                  { label: 'Total', value: formatCurrency(order.total_amount || 0) },
                  { 
                    label: 'Payment', 
                    value: (
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPaymentStatusColor(order.payment_status)}`}>
                        {order.payment_status}
                      </span>
                    ) 
                  }
                ]}
                onClick={() => { setSelectedOrder(order); setIsModalOpen(true); }}
                actions={[
                  {
                    icon: Download,
                    label: 'Invoice',
                    onClick: (id) => handleDownloadInvoice({ stopPropagation: () => {} } as any, order),
                    variant: 'default'
                  },
                  ...((order.payment_status === 'unpaid' || order.payment_status === 'rejected') ? [{
                    icon: Upload,
                    label: 'Pay',
                    onClick: (id: string) => handleUploadPayment({ stopPropagation: () => {} } as any, order),
                    variant: 'primary' as const
                  }] : [])
                ]}
              />
            ))
          )}
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
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead><tr><th className="text-left text-xs font-medium text-gray-500 uppercase">Product</th><th className="text-right text-xs font-medium text-gray-500 uppercase">Qty</th><th className="text-right text-xs font-medium text-gray-500 uppercase">Price</th><th className="text-right text-xs font-medium text-gray-500 uppercase">Total</th></tr></thead>
                  <tbody>
                    {selectedOrder.items?.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-2 text-sm text-gray-900">{item.product?.name || 'Unknown Product'}</td>
                        <td className="py-2 text-sm text-gray-900 text-right">{item.quantity}</td>
                        <td className="py-2 text-sm text-gray-900 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="py-2 text-sm text-gray-900 text-right">{formatCurrency(item.quantity * item.unit_price)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-200"><td colSpan={3} className="py-2 text-sm font-bold text-gray-900 text-right">Total</td><td className="py-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(selectedOrder.total_amount || 0)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end pt-4 border-t gap-2">
               <button 
                  type="button" 
                  className="bg-white rounded-md border border-gray-300 shadow-sm px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm w-full sm:w-auto min-h-[44px]"
                  onClick={(e) => handleDownloadInvoice(e, selectedOrder)}
               >
                  <Download className="h-4 w-4 inline mr-1" /> Invoice
               </button>
               {(selectedOrder.payment_status === 'unpaid' || selectedOrder.payment_status === 'rejected') && (
                 <button 
                    type="button" 
                    className="bg-primary rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white hover:bg-primary-hover focus:outline-none sm:text-sm w-full sm:w-auto min-h-[44px]" 
                    onClick={() => { setOrderForPayment(selectedOrder); setIsPaymentModalOpen(true); }}
                 >
                    <Upload className="h-4 w-4 inline mr-1" /> Upload Payment Proof
                  </button>
               )}
               <button type="button" className="bg-white rounded-md border border-gray-300 shadow-sm px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent sm:text-sm w-full sm:w-auto min-h-[44px]" onClick={() => setIsModalOpen(false)}>Close</button>
            </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><h4 className="text-sm font-medium text-gray-500">Name</h4>{isEditingCustomer ? <input type="text" value={editedCustomer.name} onChange={(e) => setEditedCustomer({ ...editedCustomer, name: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /> : <p className="mt-1 text-sm text-gray-900">{selectedCustomer.name}</p>}</div>
              <div><h4 className="text-sm font-medium text-gray-500">Email</h4>{isEditingCustomer ? <input type="email" value={editedCustomer.email} onChange={(e) => setEditedCustomer({ ...editedCustomer, email: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /> : <p className="mt-1 text-sm text-gray-900">{selectedCustomer.email}</p>}</div>
              <div><h4 className="text-sm font-medium text-gray-500">Phone</h4>{isEditingCustomer ? <input type="text" value={editedCustomer.phone} onChange={(e) => setEditedCustomer({ ...editedCustomer, phone: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /> : <p className="mt-1 text-sm text-gray-900">{selectedCustomer.phone}</p>}</div>
              <div className="sm:col-span-2"><h4 className="text-sm font-medium text-gray-500">Address</h4>{isEditingCustomer ? <textarea rows={3} value={editedCustomer.address} onChange={(e) => setEditedCustomer({ ...editedCustomer, address: e.target.value })} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm" /> : <p className="mt-1 text-sm text-gray-900">{selectedCustomer.address}</p>}</div>
            </div>
            <div className="flex justify-end pt-4 border-t"><button type="button" className="bg-white rounded-md border border-gray-300 shadow-sm px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 sm:text-sm min-h-[44px]" onClick={() => setIsCustomerModalOpen(false)}>Close</button></div>
          </div>
        ) : <div className="text-center py-4">Loading...</div>}
      </Modal>

      <PaymentUploadModal 
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        order={orderForPayment}
        onSuccess={() => {
          fetchOrders();
          if (isModalOpen) setIsModalOpen(false); // Close details modal if open
        }}
      />
    </div>
  );
}
