import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Save, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupplierForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    rating: 5,
    is_active: true
  });

  useEffect(() => {
    if (id) fetchSupplier();
  }, [id]);

  const fetchSupplier = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      if (data) {
        setFormData({
          name: data.name,
          email: data.email,
          phone: data.phone,
          address: data.address,
          rating: data.rating,
          is_active: data.is_active
        });
      }
    } catch (error) {
      console.error('Error fetching supplier:', error);
      toast.error('Failed to load supplier');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (id) {
        const { error } = await supabase
          .from('suppliers')
          .update(formData)
          .eq('id', id);
        if (error) throw error;
        toast.success('Supplier updated successfully');
      } else {
        const { error } = await supabase
          .from('suppliers')
          .insert([formData]);
        if (error) throw error;
        toast.success('Supplier created successfully');
      }
      navigate('/suppliers');
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error('Failed to save supplier');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/suppliers')} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">{id ? 'Edit Supplier' : 'New Supplier'}</h1>
        </div>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-sm font-medium text-gray-700">Rating (1-5)</label>
              <input
                type="number"
                min="1"
                max="5"
                required
                value={formData.rating}
                onChange={e => setFormData({ ...formData, rating: parseInt(e.target.value) })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <textarea
                rows={3}
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
            </div>
            
             <div className="sm:col-span-6">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="is_active"
                    name="is_active"
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="focus:ring-accent h-4 w-4 text-primary border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="is_active" className="font-medium text-gray-700">Active Supplier</label>
                  <p className="text-gray-500">Uncheck to disable this supplier in dropdowns.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/suppliers')}
              className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent mr-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50"
            >
              <Save className="-ml-1 mr-2 h-5 w-5" />
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
