import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Supplier } from '../../types';
import { Save, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import ImageUpload from '../../components/Inventory/ImageUpload';
import { InteractiveSearchDropdown } from '../../components/InteractiveSearchDropdown';

interface ProductFormProps {
  type?: 'equipment' | 'raw_material';
}

export default function ProductForm({ type }: ProductFormProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    // Update form data type if prop changes and we are creating new
    if (!id && type) {
      setFormData(prev => ({ ...prev, type }));
    }
  }, [type, id]);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    description: '',
    image_url: '',
    price: 0,
    stock_quantity: 0,
    category: '',
    type: type || 'equipment',
    supplier_id: ''
  });

  useEffect(() => {
    if (id) fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      if (data) {
        setFormData({
          name: data.name || '',
          sku: data.sku || '',
          description: data.description || '',
          image_url: data.image_url || '',
          price: data.price || 0,
          stock_quantity: data.stock_quantity || 0,
          category: data.category || '',
          type: data.type || 'equipment',
          supplier_id: data.supplier_id || ''
        });
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Failed to load product');
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value ?? (field === 'price' || field === 'stock_quantity' ? 0 : '')
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Manual validation for supplier_id since InteractiveSearchDropdown doesn't use standard 'required' attribute
    if (!formData.supplier_id) {
      toast.error('Supplier harus dipilih');
      return;
    }

    setLoading(true);

    try {
      // Clean up data before sending to Supabase
      const dataToSubmit = {
        ...formData,
        supplier_id: formData.supplier_id === '' ? null : formData.supplier_id,
        // Ensure numbers are numbers and not NaN
        price: isNaN(Number(formData.price)) ? 0 : Number(formData.price),
        stock_quantity: isNaN(Number(formData.stock_quantity)) ? 0 : Number(formData.stock_quantity)
      };

      console.group('Product Save Debug');
      console.log('Action:', id ? 'Update' : 'Insert');
      console.log('Data to submit:', dataToSubmit);

      if (id) {
        const { error } = await supabase
          .from('products')
          .update(dataToSubmit)
          .eq('id', id);
        
        if (error) {
          console.error('Supabase Update Error:', error);
          throw error;
        }
        toast.success('Product updated successfully');
      } else {
        const { error } = await supabase
          .from('products')
          .insert([dataToSubmit]);
        
        if (error) {
          console.error('Supabase Insert Error:', error);
          throw error;
        }
        toast.success('Product created successfully');
      }
      console.groupEnd();
      
      // Navigate back to correct list
      if (formData.type === 'raw_material') {
        navigate('/inventory/raw-materials');
      } else {
        navigate('/inventory/equipment');
      }
    } catch (error: any) {
      console.groupEnd();
      console.error('Error saving product:', error);
      
      let errorMessage = 'Gagal menyimpan produk';
      
      // Detailed error handling for RLS and other common issues
      if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('permission denied')) {
        errorMessage = 'Izin Ditolak: Anda tidak memiliki wewenang untuk menyimpan produk ini. Pastikan Anda sudah login dengan akun yang memiliki hak akses yang sesuai (admin/warehouse).';
      } else if (error.code === '23505') {
        errorMessage = `Duplikasi Data: SKU "${formData.sku}" sudah terdaftar untuk produk lain.`;
      } else if (error.code === '23503') {
        errorMessage = 'Referensi Tidak Valid: Supplier yang dipilih tidak ditemukan.';
      } else if (error.message) {
        errorMessage = `Error: ${error.message}`;
      }
      
      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    if (id) return 'Edit Product';
    if (type === 'raw_material') return 'New Raw Material';
    if (type === 'equipment') return 'New Equipment';
    return 'New Product';
  };

  const handleCancel = () => {
    if (formData.type === 'raw_material') {
      navigate('/inventory/raw-materials');
    } else {
      navigate('/inventory/equipment');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={handleCancel} className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-semibold text-gray-900">{getTitle()}</h1>
        </div>
      </div>

      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-4">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Product Name</label>
              <input
                id="name"
                type="text"
                required
                value={formData.name}
                onChange={e => handleInputChange('name', e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="sku" className="block text-sm font-medium text-gray-700">SKU</label>
              <input
                id="sku"
                type="text"
                required
                value={formData.sku}
                onChange={e => handleInputChange('sku', e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
            </div>

            <div className="sm:col-span-6">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                id="description"
                rows={3}
                value={formData.description}
                onChange={e => handleInputChange('description', e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
            </div>

            <div className="sm:col-span-6">
              <label className="block text-sm font-medium text-gray-700">Product Image</label>
              <div className="mt-2 space-y-4">
                <ImageUpload 
                  value={formData.image_url} 
                  onChange={(url) => handleInputChange('image_url', url)}
                  folder={type === 'raw_material' ? 'raw-materials' : 'equipment'}
                />
                
                <div>
                  <label htmlFor="image_url" className="block text-xs font-medium text-gray-500 mb-1">Atau masukkan URL Gambar</label>
                  <input
                    id="image_url"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={formData.image_url}
                    onChange={e => handleInputChange('image_url', e.target.value)}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-400">Provide a direct link to the product image if not uploading.</p>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="price" className="block text-sm font-medium text-gray-700">Unit Price</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">Rp</span>
                </div>
                <input
                  id="price"
                  type="number"
                  step="1"
                  required
                  value={formData.price}
                  onChange={e => handleInputChange('price', parseFloat(e.target.value))}
                  className="focus:ring-accent focus:border-accent block w-full pl-10 sm:text-sm border-gray-300 rounded-md py-2"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="stock_quantity" className="block text-sm font-medium text-gray-700">Stock Quantity</label>
              <input
                id="stock_quantity"
                type="number"
                required
                value={formData.stock_quantity}
                onChange={e => handleInputChange('stock_quantity', parseInt(e.target.value))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
              <input
                id="category"
                type="text"
                required
                value={formData.category}
                onChange={e => handleInputChange('category', e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
              />
            </div>

            {/* Hidden Type Field or Selector if not provided via props */}
            {!type && (
               <div className="sm:col-span-3">
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  id="type"
                  required
                  value={formData.type}
                  onChange={e => handleInputChange('type', e.target.value as any)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm"
                >
                  <option value="equipment">Equipment (Perlengkapan)</option>
                  <option value="raw_material">Raw Material (Bahan Baku)</option>
                </select>
              </div>
            )}

            <div className="sm:col-span-3">
              <label htmlFor="supplier_id" className="block text-sm font-medium text-gray-700">Supplier</label>
              <InteractiveSearchDropdown
                type="suppliers"
                value={formData.supplier_id}
                onChange={(id) => handleInputChange('supplier_id', id)}
                placeholder="Pilih supplier"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCancel}
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
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
