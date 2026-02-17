
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

interface Props {
  type: 'equipment' | 'raw_material';
}

export default function StockOpnameForm({ type }: Props) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    scheduled_date: new Date().toISOString().split('T')[0],
    notes: '',
    warehouse_id: ''
  });
  const [warehouses, setWarehouses] = useState<any[]>([]);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    const { data } = await supabase.from('warehouses').select('*').eq('is_active', true);
    setWarehouses(data || []);
    if (data && data.length > 0) {
      setFormData(prev => ({ ...prev, warehouse_id: data[0].id }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Create Session
      const { data: session, error: sessionError } = await supabase
        .from('stock_opname_sessions')
        .insert([{
          type,
          scheduled_date: formData.scheduled_date,
          notes: formData.notes,
          warehouse_id: formData.warehouse_id || null, // Optional if no warehouse selected
          created_by: user?.id,
          status: 'draft'
        }])
        .select()
        .single();

      if (sessionError) throw sessionError;

      // 2. Snapshot Inventory (Fetch products and insert items)
      // Note: In a real large-scale app, this should be a backend function to ensure atomicity and speed.
      // Fetch products of this type
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id, stock_quantity')
        .eq('type', type)
        .eq('is_active', true);

      if (prodError) throw prodError;

      if (products && products.length > 0) {
        const opnameItems = products.map(p => ({
          session_id: session.id,
          product_id: p.id,
          system_stock: p.stock_quantity || 0,
          physical_stock: null, // To be filled by user
          // difference field is excluded because it's a generated column (GENERATED ALWAYS AS ... STORED)
        }));

        const { error: itemsError } = await supabase
          .from('stock_opname_items')
          .insert(opnameItems);

        if (itemsError) throw itemsError;
      }

      toast.success('Stock Opname Session Created');
      navigate(type === 'equipment' ? `/inventory/equipment/opname/${session.id}` : `/inventory/raw-materials/opname/${session.id}`);

    } catch (error: any) {
      console.error('Error creating session:', error);
      toast.error('Failed to create session: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-500 hover:text-gray-700"
          type="button"
          aria-label="Go back"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">New Stock Opname Session</h1>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="scheduled_date" className="block text-sm font-medium text-gray-700">Scheduled Date</label>
            <input
              id="scheduled_date"
              type="date"
              required
              value={formData.scheduled_date}
              onChange={e => setFormData({ ...formData, scheduled_date: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
            />
          </div>

          {warehouses.length > 0 && (
            <div>
              <label htmlFor="warehouse_id" className="block text-sm font-medium text-gray-700">Warehouse</label>
              <select
                id="warehouse_id"
                value={formData.warehouse_id}
                onChange={e => setFormData({ ...formData, warehouse_id: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              placeholder="e.g. Annual Audit, Spot Check Area A"
            />
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 mr-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-primary bg-accent hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
            >
              <Save className="-ml-1 mr-2 h-5 w-5" />
              Create Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
