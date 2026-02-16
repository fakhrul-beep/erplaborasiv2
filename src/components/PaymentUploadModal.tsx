import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Order } from '../types';
import { Upload, X, Check, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal';

interface PaymentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess: () => void;
}

export default function PaymentUploadModal({ isOpen, onClose, order, onSuccess }: PaymentUploadModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Set initial amount when order changes
  React.useEffect(() => {
    if (order) {
      setAmount(order.total_amount.toString());
    }
  }, [order]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Validation
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error('Invalid file type. Please upload JPG, PNG, or PDF.');
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) { // 5MB
        toast.error('File size exceeds 5MB limit.');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !file) {
        toast.error('Please fill in all required fields and upload a proof.');
        return;
    }

    try {
      setUploading(true);

      // 1. Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${order.id}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
        .getPublicUrl(filePath);

      const { data: { user } } = await supabase.auth.getUser();

      // 2. Insert into payments table
      const { error: paymentError } = await supabase.from('payments').insert({
        order_id: order.id,
        amount: parseFloat(amount),
        payment_method: paymentMethod,
        proof_url: publicUrl,
        notes: notes,
        status: 'unverified', // Initial status
        created_by: user?.id
      });

      if (paymentError) throw paymentError;

      // 3. Update orders table status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ payment_status: 'unverified' })
        .eq('id', order.id);

      if (orderError) throw orderError;

      toast.success('Payment proof uploaded successfully!');
      onSuccess();
      onClose();
      
      // Reset form
      setFile(null);
      setNotes('');
      // Amount stays for convenience or reset? Let's keep it based on order.
      
    } catch (error: any) {
      console.error('Error uploading payment:', error);
      toast.error('Failed to upload payment: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (!order) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Upload Payment for Order #${order.id.slice(0, 8)}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Amount</label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">$</span>
            </div>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="focus:ring-primary focus:border-primary block w-full pl-7 sm:text-sm border-gray-300 rounded-md"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Payment Method</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
          >
            <option>Bank Transfer</option>
            <option>Cash</option>
            <option>Credit Card</option>
            <option>Check</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Payment Proof (Max 5MB)</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              {file ? (
                <div className="flex flex-col items-center">
                  <Check className="mx-auto h-12 w-12 text-green-500" />
                  <p className="text-sm text-gray-600">{file.name}</p>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="flex text-sm text-gray-600">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary-hover focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary"
                    >
                      <span>Upload a file</span>
                      <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".jpg,.jpeg,.png,.pdf" />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-500">PNG, JPG, PDF up to 5MB</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="shadow-sm focus:ring-primary focus:border-primary block w-full sm:text-sm border-gray-300 rounded-md"
            placeholder="Add any additional details..."
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            disabled={uploading || !file}
          >
            {uploading ? 'Uploading...' : 'Submit Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
