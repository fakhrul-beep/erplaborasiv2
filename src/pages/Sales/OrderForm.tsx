import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Product, Customer } from '../../types';
import { Save, ArrowLeft, Plus, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import PaymentSubmission from '../../components/PaymentSubmission';
import { useAuthStore } from '../../store/authStore';
import { useSettingsStore } from '../../store/settingsStore';
import { InteractiveSearchDropdown } from '../../components/InteractiveSearchDropdown';

interface OrderItemInput {
  id?: string; // for existing items
  tempId?: string; // for new items
  product_id: string;
  quantity: number;
  unit_price: number;
  original_unit_price?: number;
  price_change_reason?: string;
  cost_price?: number;
  product?: Product;
}

interface OrderFormProps {
  type?: 'equipment' | 'raw_material';
product?: Product;
}

interface OrderFormData {
  customer_id: string;
  status: string;
  payment_status: string;
  payment_proof_url: string;
  notes: string;
  type: 'equipment' | 'raw_material';
}

export default function OrderForm({ type }: OrderFormProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, user } = useAuthStore();
  const { formatCurrency } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [formData, setFormData] = useState<OrderFormData>({
    customer_id: '',
    status: 'newly_created',
    payment_status: 'unpaid',
    payment_proof_url: '',
    notes: '',
    type: type || 'equipment'
  });
  const [items, setItems] = useState<OrderItemInput[]>([]);
  
  // Totals
  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const canModifyPrice = ['superadmin', 'sales', 'sales_equipment', 'sales_raw_material'].includes(profile?.role || '');
  const MAX_MARKUP_PERCENTAGE = 0.5; // 50% max markup above base price for safety check (optional)

  useEffect(() => {
    fetchCustomers();
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

  const fetchCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').order('name');
    setCustomers(data || []);
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
        .from('orders')
        .select('*, items:order_items(*, product:products(*))')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      if (order) {
        setFormData({
          customer_id: order.customer_id,
          status: order.status,
          payment_status: order.payment_status,
          payment_proof_url: order.payment_proof_url || '',
          notes: order.notes || '',
          type: order.type || 'equipment'
        });
        setItems(order.items.map((item: any) => ({
          id: item.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          original_unit_price: item.original_unit_price || item.unit_price, // Fallback if old data
          price_change_reason: item.price_change_reason || '',
          cost_price: item.product?.cost_price || 0,
          product: item.product
        })));
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      toast.error('Failed to load order');
    }
  };

  const handleAddItem = () => {
    setItems([...items, { tempId: Math.random().toString(), product_id: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const handleItemChange = (index: number, field: keyof OrderItemInput, value: any) => {
    const newItems = [...items];
    const item = { ...newItems[index], [field]: value };
    
    if (field === 'product_id') {
      const product = products.find(p => p.id === value);
      if (product) {
        item.unit_price = product.price; // Base selling price
        item.original_unit_price = product.price;
        item.cost_price = product.cost_price || 0;
        item.product = product;
        item.price_change_reason = '';
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

    // Validate Price Changes
    const modifiedItems = items.filter(item => 
      item.original_unit_price !== undefined && item.unit_price !== item.original_unit_price
    );

    if (modifiedItems.length > 0) {
      // Check for missing reasons
      const missingReasons = modifiedItems.some(item => !item.price_change_reason || item.price_change_reason.trim() === '');
      if (missingReasons) {
        toast.error('Please provide a reason for all price modifications');
        return;
      }

      // Explicit Confirmation
      const confirmed = window.confirm(
        `You have modified prices for ${modifiedItems.length} item(s). \n\n` +
        `This will be logged for audit purposes. \n\n` +
        `Are you sure you want to proceed?`
      );
      if (!confirmed) return;
    }

    setLoading(true);

    try {
      let orderId = id;

      if (id) {
        // Update existing order (simplified: update header, recreate items)
        const { error: orderError } = await supabase
          .from('orders')
          .update({ 
            customer_id: formData.customer_id,
            total_amount: totalAmount,
            payment_proof_url: formData.payment_proof_url,
            notes: formData.notes
          })
          .eq('id', id);
        if (orderError) throw orderError;

        // Delete old items
        await supabase.from('order_items').delete().eq('order_id', id);
      } else {
        // Create new order
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert([{ 
            ...formData, 
            total_amount: calculateTotal(),
            user_id: user?.id 
          }])
          .select()
          .single();

        if (orderError) throw orderError;
        orderId = order.id;
      }

      // Insert items
      const orderItems = items.map(item => ({
        order_id: orderId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
        // Price Modification Tracking
        original_unit_price: item.original_unit_price,
        price_change_reason: item.unit_price !== item.original_unit_price ? item.price_change_reason : null,
        price_change_by: item.unit_price !== item.original_unit_price ? user?.id : null,
        price_change_at: item.unit_price !== item.original_unit_price ? new Date().toISOString() : null
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);
      
      if (itemsError) throw itemsError;

      toast.success(id ? 'Order updated successfully' : 'Order created successfully');
      navigate('/sales');
    } catch (error: any) {
      console.error('Error saving order:', error);
      toast.error(`Failed to save order: ${error.message || error.error_description || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/sales')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">{id ? 'Edit Order' : 'New Order'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer</label>
              <InteractiveSearchDropdown
                type="customers"
                value={formData.customer_id}
                onChange={id => setFormData({ ...formData, customer_id: id })}
                placeholder="Pilih customer"
                className="mt-1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Order Date</label>
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
                Optional: Direct link to the main payment receipt. For partial payments, use the section below after saving.
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
                     setItems([]); // Clear items when type changes to avoid mixing
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

        {/* Order Items */}
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
                      <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.price)})</option>
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
                  <label className="block text-xs font-medium text-gray-700">Price</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 sm:text-sm">Rp</span>
                    <input
                      type="number"
                      readOnly={!canModifyPrice}
                      value={item.unit_price}
                      onChange={e => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                      className={`block w-full pl-7 border rounded-md py-2 sm:text-sm ${
                        canModifyPrice ? 'border-gray-300 focus:ring-accent focus:border-accent' : 'border-gray-300 bg-gray-100'
                      }`}
                    />
                  </div>
                  {/* Price Warnings */}
                  {item.product && (
                    <div className="mt-1 space-y-1">
                      {item.unit_price < (item.cost_price || 0) && (
                        <p className="text-xs text-red-600 flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" /> Below Cost
                        </p>
                      )}
                      {item.original_unit_price && item.unit_price > item.original_unit_price * (1 + MAX_MARKUP_PERCENTAGE) && (
                        <p className="text-xs text-orange-600 flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" /> High Markup
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {/* Price Change Reason */}
                {item.original_unit_price !== undefined && item.unit_price !== item.original_unit_price && (
                  <div className="w-48">
                    <label className="block text-xs font-medium text-gray-700 text-red-600">Change Reason *</label>
                    <input
                      type="text"
                      required
                      placeholder="Why changed?"
                      value={item.price_change_reason || ''}
                      onChange={e => handleItemChange(index, 'price_change_reason', e.target.value)}
                      className="mt-1 block w-full border border-red-300 rounded-md shadow-sm py-2 px-3 sm:text-sm focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                )}
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-700">Total</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 sm:text-sm">Rp</span>
                    <input
                      type="text"
                      readOnly
                      value={formatCurrency(item.quantity * item.unit_price).replace('Rp', '').trim()} // Simplified for input, but better to just use formatCurrency in a span or plain text, but here it's an input
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
            orderId={id} 
            totalAmount={totalAmount} 
          />
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (formData.type === 'raw_material') navigate('/sales/raw-materials');
              else navigate('/sales/equipment');
            }}
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
            Save Order
          </button>
        </div>
      </form>
    </div>
  );
}
