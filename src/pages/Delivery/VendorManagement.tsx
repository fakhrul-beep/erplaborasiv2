import React, { useState, useEffect } from 'react';
import { supabase, withRetry, clearQueryCache } from '../../lib/supabase';
import { Plus, Search, Edit, Trash2, Star, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import { useAuthStore } from '../../store/authStore';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';

export default function VendorManagement() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    coverage_area: '',
    service_type: 'reguler',
    rate_per_kg: 0,
    estimated_days: 1
  });

  const { profile } = useAuthStore();
  const allowedRoles = ['superadmin', 'admin', 'manager', 'logistik'];

  // Refetch data when window gains focus
  useRefetchOnFocus(() => {
    const controller = new AbortController();
    fetchVendors(controller.signal);
    return () => controller.abort();
  });

  useEffect(() => {
    const controller = new AbortController();
    fetchVendors(controller.signal);

    // Set up real-time subscription
    const channel = supabase
      .channel('shipping_vendors_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipping_vendors'
        },
        (payload) => {
          console.log('Real-time update received:', payload);
          // Only update state if component is still mounted (signal not aborted)
          // Note: The controller.signal here refers to the initial effect's controller.
          // Since the subscription is tied to the effect lifecycle, it's safe.
          
          if (payload.eventType === 'INSERT') {
            setVendors((prev) => {
              // Avoid duplicate if the same user who added it also receives the event
              if (prev.some(v => v.id === payload.new.id)) return prev;
              return [...prev, payload.new].sort((a, b) => a.name.localeCompare(b.name));
            });
            toast.success(`Vendor ${payload.new.name} baru saja ditambahkan!`, { id: 'realtime-insert' });
          } else if (payload.eventType === 'UPDATE') {
            setVendors((prev) => 
              prev.map((v) => v.id === payload.new.id ? payload.new : v)
                .sort((a, b) => a.name.localeCompare(b.name))
            );
          } else if (payload.eventType === 'DELETE') {
            setVendors((prev) => prev.filter((v) => v.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      controller.abort();
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchVendors(signal?: AbortSignal) {
    try {
      const { data, error } = await withRetry(
        () => supabase.from('shipping_vendors').select('*').order('name'),
        5, // Reduced from 10
        1000, // Reduced from 2000
        'vendors-list',
        signal
      );
      
      if (signal?.aborted) return;

      if (error) throw error;
      setVendors(data || []);
    } catch (error: any) {
      if (signal?.aborted || error.message === 'Aborted') return;

      console.error('Error fetching vendors:', error);
      if (error.message?.includes('schema cache') || error.code === 'PGRST205') {
        toast.error('Sistem sedang melakukan sinkronisasi database untuk memastikan data terbaru. Kami sedang mencoba memuat ulang secara otomatis. Jika tetap gagal, silakan refresh halaman dalam beberapa saat.', { 
          id: 'schema-cache-error',
          duration: 5000 
        });
      } else {
        toast.error('Gagal memuat vendor: ' + error.message);
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  const handleSave = async () => {
    // Check role before saving
    if (!profile || !allowedRoles.includes(profile.role)) {
      toast.error('Anda tidak memiliki izin untuk melakukan aksi ini');
      return;
    }

    // Validasi data
    if (!formData.name.trim()) {
      toast.error('Nama vendor harus diisi');
      return;
    }
    if (!formData.coverage_area.trim()) {
      toast.error('Area cakupan harus diisi');
      return;
    }
    if (formData.rate_per_kg <= 0) {
      toast.error('Tarif harus lebih besar dari 0');
      return;
    }
    if (formData.estimated_days <= 0) {
      toast.error('Estimasi hari harus minimal 1 hari');
      return;
    }

    const saveToast = toast.loading(selectedVendor ? 'Memperbarui vendor...' : 'Menambahkan vendor...');

    try {
      setLoading(true);
      if (selectedVendor) {
        const { error } = await withRetry(
          () => supabase.from('shipping_vendors').update(formData).eq('id', selectedVendor.id),
          5,
          1000
        );
        if (error) throw error;
        toast.success('Vendor berhasil diperbarui', { id: saveToast });
      } else {
        const { error } = await withRetry(
          () => supabase.from('shipping_vendors').insert([formData]),
          5,
          1000
        );
        if (error) throw error;
        toast.success('Vendor berhasil ditambahkan', { id: saveToast });
      }
      setIsModalOpen(false);
      // We don't strictly need fetchVendors() here because real-time will handle it,
      // but keeping a manual fetch as fallback or to ensure cache consistency is fine.
      // However, to make it feel "real-time" and instant, we can skip the manual fetch 
      // if we trust the subscription.
      clearQueryCache(); 
    } catch (error: any) {
      console.error('Error saving vendor:', error);
      if (error.message?.includes('schema cache') || error.code === 'PGRST205') {
        toast.error('Sistem sedang melakukan sinkronisasi database. Kami mencoba menyimpan ulang secara otomatis. Jika tetap gagal, silakan coba lagi dalam beberapa saat.', { 
          id: saveToast,
          duration: 5000 
        });
      } else {
        toast.error('Gagal menyimpan: ' + (error.message || 'Terjadi kesalahan internal'), { id: saveToast });
      }
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (vendor: any) => {
    setSelectedVendor(vendor);
    setFormData({
      name: vendor.name,
      coverage_area: vendor.coverage_area,
      service_type: vendor.service_type,
      rate_per_kg: vendor.rate_per_kg,
      estimated_days: vendor.estimated_days
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Manajemen Vendor Ekspedisi</h1>
        <button 
          onClick={() => { setSelectedVendor(null); setFormData({ name: '', coverage_area: '', service_type: 'reguler', rate_per_kg: 0, estimated_days: 1 }); setIsModalOpen(true); }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover"
        >
          <Plus className="mr-2 h-4 w-4" /> Tambah Vendor
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {vendors.map((vendor) => (
            <li key={vendor.id}>
              <div className="px-4 py-4 flex items-center justify-between sm:px-6">
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-primary truncate">{vendor.name}</h3>
                  <div className="mt-2 flex items-center text-xs text-gray-500">
                    <span className="mr-3">Area: {vendor.coverage_area}</span>
                    <span className="mr-3">Tarif: Rp {vendor.rate_per_kg}/kg</span>
                    <span>Estimasi: {vendor.estimated_days} hari</span>
                  </div>
                  <div className="mt-1 flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`h-3 w-3 ${star <= (vendor.rating_on_time + vendor.rating_damage + vendor.rating_service)/3 ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                    ))}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => openEdit(vendor)} className="p-2 text-gray-400 hover:text-primary"><Edit className="h-4 w-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedVendor ? 'Edit Vendor' : 'Tambah Vendor'}>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nama Vendor</label>
            <input 
              id="name"
              type="text" 
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm" 
              value={formData.name} 
              onChange={(e) => setFormData({...formData, name: e.target.value})} 
            />
          </div>
          <div>
            <label htmlFor="coverage_area" className="block text-sm font-medium text-gray-700">Area Cakupan</label>
            <input 
              id="coverage_area"
              type="text" 
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm" 
              value={formData.coverage_area} 
              onChange={(e) => setFormData({...formData, coverage_area: e.target.value})} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="rate_per_kg" className="block text-sm font-medium text-gray-700">Tarif/kg</label>
              <input 
                id="rate_per_kg"
                type="number" 
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm" 
                value={formData.rate_per_kg} 
                onChange={(e) => setFormData({...formData, rate_per_kg: parseFloat(e.target.value)})} 
              />
            </div>
            <div>
              <label htmlFor="estimated_days" className="block text-sm font-medium text-gray-700">Estimasi (Hari)</label>
              <input 
                id="estimated_days"
                type="number" 
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm" 
                value={formData.estimated_days} 
                onChange={(e) => setFormData({...formData, estimated_days: parseInt(e.target.value)})} 
              />
            </div>
          </div>
          <div className="mt-5 flex justify-end space-x-3">
            <button 
              onClick={() => setIsModalOpen(false)} 
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button 
              onClick={handleSave} 
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-hover disabled:opacity-50 flex items-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Menyimpan...
                </>
              ) : 'Simpan'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
