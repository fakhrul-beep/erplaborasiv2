import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Payment } from '../../types';
import { Search, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Modal from '../../components/Modal';
import { useSettingsStore } from '../../store/settingsStore';

export default function PaymentVerification() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { formatCurrency } = useSettingsStore();

  // Rejection state
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'purchase'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'equipment' | 'raw_material'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unverified' | 'verified' | 'rejected'>('unverified');
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch reference data
      const [ordersRes, customersRes, poRes, suppliersRes] = await Promise.all([
        supabase.from('orders').select('id, total_amount, type, customer_id'),
        supabase.from('customers').select('id, name'),
        supabase.from('purchase_orders').select('id, total_amount, type, supplier_id'),
        supabase.from('suppliers').select('id, name')
      ]);

      const ordersData = ordersRes.data || [];
      const customersData = customersRes.data || [];
      const poData = poRes.data || [];
      const suppliersData = suppliersRes.data || [];

      // Fetch payments
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mapped = (data || []).map((p: any) => {
        const order = ordersData.find((o: any) => o.id === p.order_id);
        const purchaseOrder = poData.find((po: any) => po.id === p.purchase_order_id);
        
        // Enhance with related data
        let enhancedOrder = null;
        if (order) {
          const customer = customersData.find((c: any) => c.id === order.customer_id);
          enhancedOrder = { ...order, customer: customer || { name: 'Unknown' } };
        }

        let enhancedPO = null;
        if (purchaseOrder) {
          const supplier = suppliersData.find((s: any) => s.id === purchaseOrder.supplier_id);
          enhancedPO = { ...purchaseOrder, supplier: supplier || { name: 'Unknown' } };
        }

        return {
          ...p,
          order: enhancedOrder,
          purchase_order: enhancedPO
        };
      });

      setPayments(mapped);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleVerify = async (paymentId: string, status: 'verified' | 'rejected', notes?: string) => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      
      // 1. Update Payment Status
      const { error: paymentError } = await supabase
        .from('payments')
        .update({ 
          status,
          verified_by: user?.id,
          notes: notes || selectedPayment?.notes // Append or replace notes? Let's replace or keep existing if no new note.
        })
        .eq('id', paymentId);

      if (paymentError) throw paymentError;

      const payment = payments.find(p => p.id === paymentId);
      
      if (payment) {
          const isOrder = !!payment.order_id;
          
          if (isOrder && payment.order_id) {
             if (status === 'verified') {
                 // 2. Update Order Status (Paid & Completed)
                 const { error: orderError } = await supabase
                    .from('orders')
                    .update({ 
                        payment_status: 'paid',
                        status: 'completed' // As per requirement: "Automatically change SO status to 'completed'"
                    })
                    .eq('id', payment.order_id);
                 
                 if (orderError) throw orderError;

                 // 3. Add to Cashflow (Transactions)
                 await supabase.from('transactions').insert({
                    date: new Date().toISOString(),
                    description: `Sales Payment - Order #${payment.order_id.slice(0, 8)}`,
                    amount: payment.amount,
                    type: 'income',
                    category: payment.order?.type === 'equipment' ? 'Equipment Sales' : 'Raw Material Sales',
                    reference_id: payment.order_id,
                    reference_type: 'order'
                });

             } else if (status === 'rejected') {
                 // 2. Update Order Status (Rejected)
                 const { error: orderError } = await supabase
                    .from('orders')
                    .update({ 
                        payment_status: 'rejected'
                    })
                    .eq('id', payment.order_id);
                 
                 if (orderError) throw orderError;
             }
          }
          // Handle Purchase Order logic similarly if needed (skipping for now as focus is Sales)
      }

      setPayments(payments.map(p => 
        p.id === paymentId ? { ...p, status, notes: notes || p.notes } : p
      ));
      
      toast.success(`Payment ${status} successfully`);
      setIsModalOpen(false);
      setIsRejecting(false);
      setRejectionReason('');
      
    } catch (error) {
      console.error('Error updating payment:', error);
      toast.error('Failed to update payment status');
    }
  };

  const filteredPayments = payments.filter(payment => {
    // Search
    const searchString = searchTerm.toLowerCase();
    const orderRef = payment.order_id ? `Order #${payment.order_id}` : '';
    const poRef = payment.purchase_order_id ? `PO #${payment.purchase_order_id}` : '';
    const customerName = payment.order?.customer?.name || '';
    const supplierName = payment.purchase_order?.supplier?.name || '';
    
    const matchesSearch = 
      payment.id.toLowerCase().includes(searchString) ||
      orderRef.toLowerCase().includes(searchString) ||
      poRef.toLowerCase().includes(searchString) ||
      customerName.toLowerCase().includes(searchString) ||
      supplierName.toLowerCase().includes(searchString);

    if (!matchesSearch) return false;

    // Type Filter (Sale vs Purchase)
    const isSale = !!payment.order_id;
    const isPurchase = !!payment.purchase_order_id;
    if (typeFilter === 'sale' && !isSale) return false;
    if (typeFilter === 'purchase' && !isPurchase) return false;

    // Category Filter (Equipment vs Raw Material)
    const category = payment.order?.type || payment.purchase_order?.type;
    if (categoryFilter !== 'all' && category !== categoryFilter) return false;

    // Status Filter
    if (statusFilter !== 'all' && payment.status !== statusFilter) return false;

    // Date Filters
    const paymentDate = new Date(payment.payment_date);
    if (dateFilter && format(paymentDate, 'yyyy-MM-dd') !== dateFilter) return false;
    if (monthFilter && (paymentDate.getMonth() + 1).toString() !== monthFilter) return false;
    if (yearFilter && paymentDate.getFullYear().toString() !== yearFilter) return false;

    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'unverified': return 'bg-orange-100 text-orange-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getReferenceInfo = (payment: Payment) => {
    if (payment.order_id) {
      return {
        type: 'Sale',
        refId: payment.order_id,
        partyName: payment.order?.customer?.name,
        category: payment.order?.type,
        total: payment.order?.total_amount
      };
    } else if (payment.purchase_order_id) {
      return {
        type: 'Purchase',
        refId: payment.purchase_order_id,
        partyName: payment.purchase_order?.supplier?.name,
        category: payment.purchase_order?.type,
        total: payment.purchase_order?.total_amount
      };
    }
    return { type: 'Unknown', refId: '?', partyName: '?', category: '?', total: 0 };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Payment Verification</h1>
        <button onClick={fetchPayments} className="p-2 text-gray-500 hover:text-gray-700" type="button" aria-label="Refresh payments">
           <RefreshCw className="h-5 w-5" />
        </button>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
           {/* Search */}
           <div className="relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search payments"
            />
          </div>

           {/* Type Filter */}
           <select
             value={typeFilter}
             onChange={e => setTypeFilter(e.target.value as any)}
             className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm py-2"
             aria-label="Filter by type"
           >
             <option value="all">All Types (Sales & Purchase)</option>
             <option value="sale">Sales Only</option>
             <option value="purchase">Purchase Only</option>
           </select>

           {/* Category Filter */}
           <select
             value={categoryFilter}
             onChange={e => setCategoryFilter(e.target.value as any)}
             className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm py-2"
             aria-label="Filter by category"
           >
             <option value="all">All Categories</option>
             <option value="equipment">Equipment (Perlengkapan)</option>
             <option value="raw_material">Raw Material (Bahan Baku)</option>
           </select>

           {/* Status Filter */}
           <select
             value={statusFilter}
             onChange={e => setStatusFilter(e.target.value as any)}
             className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm py-2"
             aria-label="Filter by status"
           >
             <option value="all">All Statuses</option>
             <option value="unverified">Unverified</option>
             <option value="verified">Verified</option>
             <option value="rejected">Rejected</option>
           </select>
        </div>
        
        {/* Date Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
           <input
             type="date"
             value={dateFilter}
             onChange={e => setDateFilter(e.target.value)}
             className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm py-2"
             aria-label="Filter by date"
           />
           <select
             value={monthFilter}
             onChange={e => setMonthFilter(e.target.value)}
             className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm py-2"
             aria-label="Filter by month"
           >
             <option value="">All Months</option>
             {Array.from({ length: 12 }, (_, i) => (
               <option key={i + 1} value={i + 1}>{format(new Date(2000, i, 1), 'MMMM')}</option>
             ))}
           </select>
           <select
             value={yearFilter}
             onChange={e => setYearFilter(e.target.value)}
             className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm py-2"
             aria-label="Filter by year"
           >
             <option value="">All Years</option>
             <option value="2024">2024</option>
             <option value="2025">2025</option>
             <option value="2026">2026</option>
           </select>
           
           <button
             onClick={() => {
               setSearchTerm('');
               setTypeFilter('all');
               setCategoryFilter('all');
               setStatusFilter('all');
               setDateFilter('');
               setMonthFilter('');
               setYearFilter('');
             }}
             className="flex justify-center items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
             type="button"
           >
             Clear Filters
           </button>
        </div>

        <div className="flex flex-col">
          <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
              <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type/Category</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">Loading payments...</td></tr>
                    ) : filteredPayments.length === 0 ? (
                      <tr><td colSpan={7} className="px-6 py-4 text-center text-gray-500">No payments found.</td></tr>
                    ) : (
                      filteredPayments.map((payment) => {
                        const info = getReferenceInfo(payment);
                        return (
                          <tr key={payment.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              <div>{info.type === 'Sale' ? 'Order' : 'PO'} #{info.refId?.slice(0, 8)}</div>
                              <div className="text-xs text-gray-500">{info.partyName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div>{info.type}</div>
                              <div className="text-xs text-gray-400 capitalize">{info.category?.replace('_', ' ')}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatCurrency(payment.amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {payment.payment_method}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                                {payment.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setIsModalOpen(true);
                                }}
                                className="text-primary hover:text-primary-900"
                                type="button"
                              >
                                View & Verify
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setIsRejecting(false); }}
        title="Payment Verification Details"
      >
        {selectedPayment && (
           <div className="space-y-6">
             {(() => {
                const info = getReferenceInfo(selectedPayment);
                return (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <h4 className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2">Transaction Info</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-gray-500">Reference Type</p>
                          <p className="text-sm font-medium">{info.type} ({info.category?.replace('_', ' ')})</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Reference ID</p>
                          <p className="text-sm font-medium">#{info.refId?.slice(0, 8)}</p>
                        </div>
                         <div>
                          <p className="text-xs text-gray-500">Party Name</p>
                          <p className="text-sm font-medium">{info.partyName}</p>
                        </div>
                         <div>
                          <p className="text-xs text-gray-500">Total Transaction Value</p>
                          <p className="text-sm font-medium">{formatCurrency(info.total || 0)}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Payment Amount</h4>
                      <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(selectedPayment.amount)}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Payment Method</h4>
                      <p className="mt-1 text-sm text-gray-900 capitalize">{selectedPayment.payment_method}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Date</h4>
                      <p className="mt-1 text-sm text-gray-900">{format(new Date(selectedPayment.payment_date), 'PPP')}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Status</h4>
                      <span className={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedPayment.status)}`}>
                        {selectedPayment.status}
                      </span>
                    </div>
                    {selectedPayment.proof_url && (
                        <div className="col-span-2">
                            <h4 className="text-sm font-medium text-gray-500 mb-2">Payment Proof</h4>
                            <div className="border rounded-lg p-2 bg-gray-50 flex justify-center">
                                <a href={selectedPayment.proof_url} target="_blank" rel="noopener noreferrer">
                                    <img src={selectedPayment.proof_url} alt="Payment Proof" className="max-h-64 object-contain rounded" />
                                </a>
                            </div>
                            <div className="mt-1 text-center">
                                <a href={selectedPayment.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center justify-center">
                                    <ExternalLink className="h-3 w-3 mr-1" /> View Full Size
                                </a>
                            </div>
                        </div>
                    )}
                    
                    {selectedPayment.notes && (
                         <div className="col-span-2">
                          <h4 className="text-sm font-medium text-gray-500">Notes</h4>
                          <p className="mt-1 text-sm text-gray-900 bg-yellow-50 p-2 rounded border border-yellow-100">{selectedPayment.notes}</p>
                        </div>
                    )}
                  </div>
                );
             })()}

             <div className="flex justify-end space-x-3 pt-4 border-t">
                {selectedPayment.status === 'unverified' && !isRejecting ? (
                    <>
                        <button
                            onClick={() => setIsRejecting(true)}
                            className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                            type="button"
                        >
                            Reject
                        </button>
                        <button
                            onClick={() => handleVerify(selectedPayment.id, 'verified')}
                            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                            type="button"
                        >
                            Verify Payment
                        </button>
                    </>
                ) : isRejecting ? (
                    <div className="w-full space-y-3">
                        <div className="bg-red-50 p-3 rounded-md border border-red-100 flex items-start">
                            <AlertTriangle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
                            <div className="text-sm text-red-700">
                                <p className="font-medium">Rejecting Payment</p>
                                <p>Please provide a reason for rejection. This will be visible to the user.</p>
                            </div>
                        </div>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Reason for rejection..."
                            className="w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                            rows={3}
                        />
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setIsRejecting(false)}
                                className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
                                type="button"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleVerify(selectedPayment.id, 'rejected', rejectionReason)}
                                disabled={!rejectionReason.trim()}
                                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                                type="button"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => { setIsModalOpen(false); setIsRejecting(false); }}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200"
                        type="button"
                    >
                        Close
                    </button>
                )}
             </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
