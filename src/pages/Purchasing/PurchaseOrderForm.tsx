import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Product, Supplier } from '../../types';
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { InteractiveSearchDropdown } from '../../components/InteractiveSearchDropdown';

interface POItemInput {
  id?: string;
  tempId?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: Product;
}

import PaymentSubmission from '../../components/PaymentSubmission';

interface PurchaseOrderFormProps {
  type?: 'equipment' | 'raw_material';
}

interface POFormData {
  supplier_id: string;
  status: string;
  expected_date: string;
  payment_proof_url: string;
  notes: string;
  type: 'equipment' | 'raw_material';
}

export default function PurchaseOrderForm({ type }: PurchaseOrderFormProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { formatCurrency } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [formData, setFormData] = useState<POFormData>({
    supplier_id: '',
    status: 'draft',
    expected_date: '',
    payment_proof_url: '',
    notes: '',
    type: type || 'equipment'
  });
  const [items, setItems] = useState<POItemInput[]>([]);
  
  // Totals
  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  useEffect(() => {
    fetchSuppliers();
    if (id) fetchOrder();
  }, [id, type]);

  useEffect(() => {
    fetchProducts();
  }, [formData.type]);

  useEffect(() => {
    if (!id && type) {
       setFormData(prev => ({ ...prev, type }));
    }
  }, [type, id]);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers(data || []);
  };

  const fetchProducts = async () => {
    let query = supabase.from('products').select('*').order('name');
    if (formData.type) {
      query = query.eq('type', formData.type);
    }
    const { data } = await query;
    setProducts(data || []);
  };

  const fetchOrder = async () => {
    try {
      const { data: order, error } = await supabase
        .from('purchase_orders')
        .select('*, items:purchase_order_items(*, product:products(*))')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      if (order) {
        setFormData({
          supplier_id: order.supplier_id,
          status: order.status,
          expected_date: order.expected_date ? order.expected_date.split('T')[0] : '',
          payment_proof_url: order.payment_proof_url || '',
          notes: order.notes || '',
          type: order.type || 'equipment'
        });
        setItems(order.items.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          product: item.product
        })));
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Failed to load order');
    }
  };

  const handleAddItem = () => {
    setItems([...items, { product_id: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof POItemInput, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    
    // Auto-fill price from product reference if product selected (optional, usually cost price might differ)
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        // Here we might want to use a cost price, but for now we default to current selling price or 0
        // Ideally products table should have cost_price
        item.unit_price = product.price * 0.8; // Assume 20% margin for default fill
        item.product = product;
      }
    }
    
    newItems[index] = item;
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    setLoading(true);

    try {
      let orderId = id;

      if (id) {
        const { error: orderError } = await supabase
          .from('purchase_orders')
          .update({ 
            supplier_id: formData.supplier_id,
            total_amount: totalAmount,
            payment_proof_url: formData.payment_proof_url,
            notes: formData.notes
          })
          .eq('id', id);
        if (orderError) throw orderError;

        await supabase.from('purchase_order_items').delete().eq('purchase_order_id', id);
      } else {
        const { data: order, error: orderError } = await supabase
          .from('purchase_orders')
          .insert([{ 
            supplier_id: formData.supplier_id,
            total_amount: totalAmount,
            status: 'draft',
            order_date: new Date().toISOString(),
            payment_proof_url: formData.payment_proof_url,
            notes: formData.notes,
            type: formData.type,
            user_id: user?.id
          }])
          .select()
          .single();
        
        if (orderError) throw orderError;
        orderId = order.id;
      }

      const orderItems = items.map(item => ({
        purchase_order_id: orderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(orderItems);
      
      if (itemsError) throw itemsError;

      toast.success(id ? 'PO updated successfully' : 'PO created successfully');
      navigate('/purchasing');
    } catch (error: any) {
      console.error('Error saving purchase order:', error);
      toast.error(`Failed to save purchase order: ${error.message || error.error_description || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/purchasing')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">{id ? 'Edit Purchase Order' : 'New Purchase Order'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Supplier</label>
              <InteractiveSearchDropdown
                type="suppliers"
                value={formData.supplier_id}
                onChange={id => setFormData({ ...formData, supplier_id: id })}
                placeholder="Pilih supplier"
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                 type="text"
                 disabled
                 value={new Date().toLocaleDateString()}
                 className="mt-1 block w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Payment Proof URL (Main Transaction)</label>
              <input
                type="url"
                placeholder="https://example.com/receipt.jpg"
                value={formData.payment_proof_url}
                onChange={e => setFormData({ ...formData, payment_proof_url: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Direct link to the main payment receipt.
              </p>
            </div>

            {!type && (
               <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Order Type</label>
                <select
                  required
                  value={formData.type}
                  onChange={e => {
                     setFormData({ ...formData, type: e.target.value as any });
                     setItems([]);
                  }}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                >
                  <option value="equipment">Equipment (Perlengkapan)</option>
                  <option value="raw_material">Raw Material (Bahan Baku)</option>
                </select>
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Order Items</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </button>
          </div>

          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.id || item.tempId || index} className="flex items-end gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700">Product</label>
                  <select
                    required
                    value={item.product_id}
                    onChange={e => handleItemChange(index, 'product_id', e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm"
                  >
                    <option value="">Select Product</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-700">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={item.quantity}
                    onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 sm:text-sm"
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-700">Unit Cost</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 sm:text-sm">Rp</span>
                    <input
                      type="number"
                      step="1"
                      required
                      value={item.unit_price}
                      onChange={e => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                      className="block w-full pl-10 border border-gray-300 rounded-md py-2 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-700">Total</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 sm:text-sm">Rp</span>
                    <input
                      type="text"
                      readOnly
                      value={formatCurrency(item.quantity * item.unit_price).replace('Rp', '').trim()}
                      className="block w-full pl-10 border border-gray-300 rounded-md bg-gray-100 py-2 sm:text-sm font-medium"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="p-2 text-red-600 hover:text-red-900"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))}
            
            {items.length === 0 && (
              <p className="text-center text-gray-500 py-4">No items added yet.</p>
            )}

            <div className="flex justify-end pt-4 border-t border-gray-200">
               <div className="text-right">
                 <span className="text-sm font-medium text-gray-500">Grand Total:</span>
                 <span className="ml-2 text-2xl font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
               </div>
            </div>
          </div>
        </div>

        {/* Payment Submission Section - Only visible in Edit Mode */}
        {id && (
          <PaymentSubmission 
            purchaseOrderId={id} 
            totalAmount={totalAmount} 
          />
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/purchasing')}
            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent mr-3"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-primary bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
          >
            <Save className="-ml-1 mr-2 h-5 w-5" />
            Save PO
          </button>
        </div>
      </form>
    </div>
  );
}
