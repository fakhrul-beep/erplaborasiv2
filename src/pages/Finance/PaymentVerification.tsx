import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Payment } from '../../types';
import { Check, X, Search, FileText, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import Modal from '../../components/Modal';

export default function PaymentVerification() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          order:orders(id, total_amount, customer:customers(name))
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

      // If verified, update order payment status (optional logic depending on business rule)
      if (status === 'verified') {
        const payment = payments.find(p => p.id === paymentId);
        if (payment && payment.order_id) {
            // Simplified logic: mark order as paid if verified
             await supabase.from('orders').update({ payment_status: 'paid' }).eq('id', payment.order_id);

             // Add to cashflow
             await supabase.from('transactions').insert({
                 date: new Date().toISOString(),
                 description: `Order #${payment.order_id.slice(0, 8)} Payment`,
                 amount: payment.amount,
                 type: 'income',
                 category: 'Sales',
                 reference_id: payment.order_id,
                 reference_type: 'order'
             });
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

  const filteredPayments = payments.filter(payment => 
    payment.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.order?.customer?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ('Order #' + payment.order_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Payment Verification</h1>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="mb-6 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
            placeholder="Search payments..."
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
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order Ref
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          Loading payments...
                        </td>
                      </tr>
                    ) : filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                          No pending payments found.
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <div>Order #{payment.order_id?.slice(0, 8)}</div>
                            <div className="text-xs text-gray-500">{payment.order?.customer?.name}</div>
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
                      ))
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
        title="Payment Details"
      >
        {selectedPayment ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Order Reference</h4>
                <p className="mt-1 text-sm text-gray-900">#{selectedPayment.order_id}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Customer</h4>
                <p className="mt-1 text-sm text-gray-900">{selectedPayment.order?.customer?.name}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Amount</h4>
                <p className="mt-1 text-lg font-bold text-gray-900">${selectedPayment.amount.toFixed(2)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Date</h4>
                <p className="mt-1 text-sm text-gray-900">{format(new Date(selectedPayment.payment_date), 'PPP')}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Payment Method</h4>
                <p className="mt-1 text-sm text-gray-900">{selectedPayment.payment_method}</p>
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
            </div>

            {selectedPayment.proof_url && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Payment Proof</h4>
                <div className="border rounded-lg p-2 bg-gray-50">
                   <a href={selectedPayment.proof_url} target="_blank" rel="noopener noreferrer" className="flex items-center text-primary hover:underline">
                      <FileText className="h-4 w-4 mr-2" />
                      View Proof Document <ExternalLink className="h-3 w-3 ml-1" />
                   </a>
                </div>
              </div>
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
        ) : (
          <div className="text-center py-4">Loading details...</div>
        )}
      </Modal>
    </div>
  );
}
