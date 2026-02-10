import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Payment } from '../../types';
import { Check, X, Search, FileText, ExternalLink, Filter, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Modal from '../../components/Modal';

export default function PaymentVerification() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'purchase'>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'equipment' | 'raw_material'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending');
  const [dateFilter, setDateFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          order:orders(id, total_amount, type, customer:customers(name)),
          purchase_order:purchase_orders(id, total_amount, type, supplier:suppliers(name))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (paymentId: string, status: 'verified' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ 
          status,
          verified_by: (await supabase.auth.getUser()).data.user?.id 
        })
        .eq('id', paymentId);

      if (error) throw error;

      // Logic to update parent order/PO status if fully paid? 
      // For now, let's just mark the payment status.
      // Ideally we check if total verified payments >= order total.
      
      // We can do a simple check here if status is verified
      if (status === 'verified') {
        const payment = payments.find(p => p.id === paymentId);
        if (payment) {
           const amount = payment.amount;
           const refType = payment.order_id ? 'order' : 'purchase_order';
           const refId = payment.order_id || payment.purchase_order_id;
           const category = payment.order?.type || payment.purchase_order?.type || 'General';

           // Add to cashflow
           await supabase.from('transactions').insert({
               date: new Date().toISOString(),
               description: `${refType === 'order' ? 'Sales' : 'Purchase'} Payment - Ref #${refId?.slice(0, 8)}`,
               amount: amount,
               type: refType === 'order' ? 'income' : 'expense',
               category: category === 'equipment' ? 'Equipment' : 'Raw Material',
               reference_id: refId,
               reference_type: refType
           });

           // Optional: Update parent status if fully paid. 
           // For simplicity, we just mark parent as 'paid' or 'partial' could be complex without fetching all payments.
           // We'll skip complex parent status update for now to avoid bugs, focusing on payment verification itself.
        }
      }

      setPayments(payments.map(p => 
        p.id === paymentId ? { ...p, status } : p
      ));
      toast.success(`Payment ${status} successfully`);
      setIsModalOpen(false);
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
        <button onClick={fetchPayments} className="p-2 text-gray-500 hover:text-gray-700">
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
            />
          </div>

           {/* Type Filter */}
           <select
             value={typeFilter}
             onChange={e => setTypeFilter(e.target.value as any)}
             className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm py-2"
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
           >
             <option value="all">All Statuses</option>
             <option value="pending">Pending</option>
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
           />
           <select
             value={monthFilter}
             onChange={e => setMonthFilter(e.target.value)}
             className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm py-2"
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
                              ${payment.amount.toFixed(2)}
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
        onClose={() => setIsModalOpen(false)}
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
                          <p className="text-sm font-medium">${(info.total || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Payment Amount</h4>
                      <p className="mt-1 text-lg font-bold text-gray-900">${selectedPayment.amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Date</h4>
                      <p className="mt-1 text-sm text-gray-900">{format(new Date(selectedPayment.payment_date), 'PPP')}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Method</h4>
                      <p className="mt-1 text-sm text-gray-900 capitalize">{selectedPayment.payment_method.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-500">Status</h4>
                      <p className={`mt-1 text-sm font-medium ${
                        selectedPayment.status === 'verified' ? 'text-green-600' : 
                        selectedPayment.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
                      }`}>
                        {selectedPayment.status.toUpperCase()}
                      </p>
                    </div>
                    
                    {selectedPayment.notes && (
                      <div className="col-span-2">
                         <h4 className="text-sm font-medium text-gray-500">Notes</h4>
                         <p className="mt-1 text-sm text-gray-700 bg-gray-50 p-2 rounded">{selectedPayment.notes}</p>
                      </div>
                    )}
                  </div>
                );
             })()}

            {selectedPayment.proof_url ? (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Payment Proof</h4>
                <div className="border rounded-lg p-3 bg-gray-50 flex items-center justify-between">
                   <div className="flex items-center text-gray-700 truncate mr-2">
                      <FileText className="h-5 w-5 mr-2 text-gray-400" />
                      <span className="text-sm truncate">{selectedPayment.proof_url}</span>
                   </div>
                   <a 
                     href={selectedPayment.proof_url} 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="flex-shrink-0 inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                   >
                      <ExternalLink className="h-3 w-3 mr-1" /> Open
                   </a>
                </div>
              </div>
            ) : (
               <div className="text-sm text-gray-500 italic">No proof document provided.</div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                className="bg-white rounded-md border border-gray-300 shadow-sm px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
                onClick={() => setIsModalOpen(false)}
              >
                Close
              </button>
              {selectedPayment.status === 'pending' && (
                <>
                  <button
                    type="button"
                    className="bg-red-600 rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:text-sm"
                    onClick={() => handleVerify(selectedPayment.id, 'rejected')}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="bg-green-600 rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:text-sm"
                    onClick={() => handleVerify(selectedPayment.id, 'verified')}
                  >
                    Verify Payment
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
