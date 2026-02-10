import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Product, Supplier } from '../../types';
import { Save, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface POItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: Product;
}

export default function PurchaseOrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<POItemInput[]>([]);
  
  // Totals
  const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    if (id) fetchOrder();
  }, [id]);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers(data || []);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
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
        setSupplierId(order.supplier_id);
        setItems(order.items.map((item: any) => ({
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
        item.unit_price = product.unit_price * 0.8; // Assume 20% margin for default fill
        item.product = product;
      }
    }
    
    newItems[index] = item;
    setItems(newItems);
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
            supplier_id: supplierId,
            total_amount: totalAmount
          })
          .eq('id', id);
        if (orderError) throw orderError;

        await supabase.from('purchase_order_items').delete().eq('purchase_order_id', id);
      } else {
        const { data: order, error: orderError } = await supabase
          .from('purchase_orders')
          .insert([{ 
            supplier_id: supplierId,
            total_amount: totalAmount,
            status: 'draft',
            order_date: new Date().toISOString()
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
    } catch (error) {
      console.error('Error saving PO:', error);
      toast.error('Failed to save purchase order');
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
              <select
                required
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              >
                <option value="">Select a supplier</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
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
              <div key={index} className="flex items-end gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
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
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 sm:text-sm">$</span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={item.unit_price}
                      onChange={e => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                      className="block w-full pl-7 border border-gray-300 rounded-md py-2 sm:text-sm"
                    />
                  </div>
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-gray-700">Total</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 sm:text-sm">$</span>
                    <input
                      type="text"
                      readOnly
                      value={(item.quantity * item.unit_price).toFixed(2)}
                      className="block w-full pl-7 border border-gray-300 rounded-md bg-gray-100 py-2 sm:text-sm font-medium"
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
                 <span className="ml-2 text-2xl font-bold text-gray-900">${totalAmount.toFixed(2)}</span>
               </div>
            </div>
          </div>
        </div>

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
