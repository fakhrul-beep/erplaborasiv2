import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Payment } from '../types';
import { Plus, Trash2, ExternalLink, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface PaymentSubmissionProps {
  orderId?: string;
  purchaseOrderId?: string;
  totalAmount: number;
  onPaymentUpdate?: () => void;
}

export default function PaymentSubmission({ orderId, purchaseOrderId, totalAmount, onPaymentUpdate }: PaymentSubmissionProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: totalAmount,
    payment_method: 'bank_transfer',
    proof_url: '',
    notes: ''
  });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (orderId || purchaseOrderId) {
      fetchPayments();
    }
  }, [orderId, purchaseOrderId]);

  const fetchPayments = async () => {
    try {
      let query = supabase.from('payments').select('*').order('created_at', { ascending: false });
      
      if (orderId) {
        query = query.eq('order_id', orderId);
      } else if (purchaseOrderId) {
        query = query.eq('purchase_order_id', purchaseOrderId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPayments(data || []);
    } catch (error) {
      console.error('Error fetching payments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId && !purchaseOrderId) return;
    
    setLoading(true);
    try {
      const payload: any = {
        amount: newPayment.amount,
        payment_method: newPayment.payment_method,
        proof_url: newPayment.proof_url,
        notes: newPayment.notes,
        status: 'pending'
      };

      if (orderId) payload.order_id = orderId;
      if (purchaseOrderId) payload.purchase_order_id = purchaseOrderId;

      const { error } = await supabase.from('payments').insert([payload]);
      
      if (error) throw error;
      
      toast.success('Payment proof submitted successfully');
      setNewPayment({
        amount: 0,
        payment_method: 'bank_transfer',
        proof_url: '',
        notes: ''
      });
      setShowForm(false);
      fetchPayments();
      if (onPaymentUpdate) onPaymentUpdate();
    } catch (error: any) {
      console.error('Error submitting payment:', error);
      toast.error('Failed to submit payment: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this payment submission?')) return;
    try {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
      toast.success('Payment deleted');
      fetchPayments();
      if (onPaymentUpdate) onPaymentUpdate();
    } catch (error) {
      toast.error('Failed to delete payment');
    }
  };

  const totalPaid = payments
    .filter(p => p.status === 'verified')
    .reduce((sum, p) => sum + p.amount, 0);
  
  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Payment & Proof of Transfer</h3>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setNewPayment(prev => ({ ...prev, amount: totalAmount - totalPaid }));
              setShowForm(true);
            }}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Payment Proof
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <div className="bg-gray-50 p-3 rounded-md">
           <p className="text-xs text-gray-500">Total Amount</p>
           <p className="text-lg font-bold">${totalAmount.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 p-3 rounded-md">
           <p className="text-xs text-green-700">Verified Paid</p>
           <p className="text-lg font-bold text-green-700">${totalPaid.toFixed(2)}</p>
        </div>
        <div className="bg-yellow-50 p-3 rounded-md">
           <p className="text-xs text-yellow-700">Pending Verification</p>
           <p className="text-lg font-bold text-yellow-700">${totalPending.toFixed(2)}</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 bg-gray-50 p-4 rounded-md border border-gray-200">
          <div className="grid grid-cols-1 gap-y-4 gap-x-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newPayment.amount}
                  onChange={e => setNewPayment({ ...newPayment, amount: parseFloat(e.target.value) })}
                  className="focus:ring-accent focus:border-accent block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Payment Method</label>
              <select
                value={newPayment.payment_method}
                onChange={e => setNewPayment({ ...newPayment, payment_method: e.target.value })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="credit_card">Credit Card</option>
                <option value="check">Check</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Proof URL (Image/Doc Link)</label>
              <input
                type="url"
                required
                placeholder="https://..."
                value={newPayment.proof_url}
                onChange={e => setNewPayment({ ...newPayment, proof_url: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Paste a link to the payment proof (e.g. Google Drive, Dropbox, or Image URL)</p>
            </div>

            <div className="sm:col-span-2">
               <label className="block text-sm font-medium text-gray-700">Notes</label>
               <input
                type="text"
                value={newPayment.notes}
                onChange={e => setNewPayment({ ...newPayment, notes: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
            </div>
          </div>
          
          <div className="mt-4 flex justify-end space-x-3">
             <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none disabled:opacity-50"
            >
              Submit Payment
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Proof</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-500">No payments submitted yet.</td></tr>
            ) : (
              payments.map(payment => (
                <tr key={payment.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(payment.created_at), 'MMM d, yyyy HH:mm')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${payment.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {payment.payment_method}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">
                    {payment.proof_url ? (
                      <a href={payment.proof_url} target="_blank" rel="noopener noreferrer" className="flex items-center hover:underline">
                        <FileText className="h-4 w-4 mr-1" /> View
                      </a>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      payment.status === 'verified' ? 'bg-green-100 text-green-800' :
                      payment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {payment.status === 'pending' && (
                      <button onClick={() => handleDelete(payment.id)} className="text-red-600 hover:text-red-900">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
