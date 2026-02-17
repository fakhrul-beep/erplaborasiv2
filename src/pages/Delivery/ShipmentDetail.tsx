import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, withRetry } from '../../lib/supabase';
import { Truck, Package, MapPin, CheckCircle, AlertTriangle, Save, ArrowLeft, Camera, Edit3, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';

export default function ShipmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [shipment, setShipment] = useState<any>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    vendor_id: '',
    tracking_number: '',
    actual_weight: 0,
    dimension_p: 0,
    dimension_l: 0,
    dimension_t: 0,
    fragility_level: 'low',
    notes: ''
  });

  const signatureRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = signatureRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = signatureRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'black';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearSignature = () => {
    const canvas = signatureRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const captureGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const coords = `${position.coords.latitude},${position.coords.longitude}`;
        toast.success(`Lokasi ditangkap: ${coords}`);
        handlePODSave(null, null, coords);
      });
    } else {
      toast.error('Geolocation tidak didukung browser ini');
    }
  };

  const handlePODSave = async (imgUrl: string | null, signature: string | null, gps: string | null) => {
    try {
      const updates: any = {};
      if (imgUrl) updates.delivery_proof_url = imgUrl;
      if (signature) updates.driver_signature = signature;
      if (gps) updates.gps_coordinates = gps;
      
      const { error } = await withRetry(() => 
        supabase
          .from('shipment_orders')
          .update(updates)
          .eq('id', id)
      );

      if (error) throw error;
      toast.success('POD diperbarui');
      fetchShipment();
    } catch (error: any) {
      toast.error('Gagal simpan POD: ' + error.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 2MB');
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `pod-${id}-${Math.random()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('shipment-proofs')
        .upload(fileName, file);

      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('shipment-proofs').getPublicUrl(fileName);
      handlePODSave(publicUrl, null, null);
    } catch (error: any) {
      toast.error('Upload gagal: ' + error.message);
    }
  };

  const saveSignature = () => {
    const canvas = signatureRef.current;
    if (canvas) {
      const signature = canvas.toDataURL('image/png');
      handlePODSave(null, signature, null);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchShipment();
      fetchVendors();
      fetchAuditLogs();
    }
  }, [id, profile]);

  async function fetchAuditLogs() {
    const { data } = await withRetry(() => 
      supabase
        .from('shipment_audit_logs')
        .select('*, user:users(full_name)')
        .eq('shipment_id', id)
        .order('timestamp', { ascending: false })
    );
    if (data) setAuditLogs(data);
  }

  async function fetchShipment() {
    try {
      const { data: shipmentData, error } = await withRetry(() => 
        supabase
          .from('shipment_orders')
          .select('*')
          .eq('id', id)
          .single(),
        10,
        2000
      );

      if (error) throw error;

      let vendor = null;
      let order = null;
      let purchaseOrder = null;

      if (shipmentData.vendor_id) {
        const { data } = await supabase.from('shipping_vendors').select('*').eq('id', shipmentData.vendor_id).single();
        vendor = data;
      }

      if (shipmentData.order_id) {
        const { data: orderData } = await supabase
          .from('orders')
          .select('id, status, order_date, customer_id')
          .eq('id', shipmentData.order_id)
          .single();
        
        if (orderData) {
          let customer = null;
          if (orderData.customer_id) {
            const { data: customerData } = await supabase
              .from('customers')
              .select('name, email, phone, address')
              .eq('id', orderData.customer_id)
              .single();
            customer = customerData;
          }
          order = { ...orderData, customer };
        }
      }

      if (shipmentData.purchase_order_id) {
        const { data: poData } = await supabase
          .from('purchase_orders')
          .select('id, status, order_date, supplier_id')
          .eq('id', shipmentData.purchase_order_id)
          .single();
        
        if (poData) {
          let supplier = null;
          if (poData.supplier_id) {
            const { data: supplierData } = await supabase
              .from('suppliers')
              .select('name, email, phone, address')
              .eq('id', poData.supplier_id)
              .single();
            supplier = supplierData;
          }
          purchaseOrder = { ...poData, supplier };
        }
      }

      setShipment({ ...shipmentData, vendor, order, purchase_order: purchaseOrder });

      setFormData({
        vendor_id: shipmentData.vendor_id || '',
        tracking_number: shipmentData.tracking_number || '',
        actual_weight: shipmentData.actual_weight || 0,
        dimension_p: shipmentData.dimension_p || 0,
        dimension_l: shipmentData.dimension_l || 0,
        dimension_t: shipmentData.dimension_t || 0,
        fragility_level: shipmentData.fragility_level || 'low',
        notes: shipmentData.notes || ''
      });
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching shipment:', error);
      toast.error('Gagal memuat detail pengiriman');
      setLoading(false);
    }
  }

  async function fetchVendors() {
    try {
      const { data, error } = await withRetry(() => 
        supabase.from('shipping_vendors').select('*').eq('is_active', true)
      );
      if (error) throw error;
      setVendors(data || []);
    } catch (error: any) {
      console.error('Error fetching vendors:', error);
      if (!error.message?.includes('schema cache')) {
        toast.error('Gagal memuat daftar vendor: ' + (error.message || 'Unknown error'));
      }
    }
  }

  const calculateMetrics = () => {
    const volumetricWeight = (formData.dimension_p * formData.dimension_l * formData.dimension_t) / 4000;
    const totalWeight = Math.max(formData.actual_weight, volumetricWeight);
    const selectedVendor = vendors.find(v => v.id === formData.vendor_id);
    const shippingCost = selectedVendor ? totalWeight * selectedVendor.rate_per_kg : 0;

    return { volumetricWeight, totalWeight, shippingCost };
  };

  const handleSave = async () => {
    try {
      setLoading(true);

      // Waybill validation (regex)
      const waybillRegex = /^[A-Z0-9]{8,20}$/; // Example: JNE/J&T style
      if (formData.tracking_number && !waybillRegex.test(formData.tracking_number)) {
        toast.error('Format nomor resi tidak valid (8-20 karakter alfanumerik)');
        setLoading(false);
        return;
      }

      const { volumetricWeight, totalWeight, shippingCost } = calculateMetrics();
      
      const { error } = await withRetry(() => 
        supabase
          .from('shipment_orders')
          .update({
            ...formData,
            volumetric_weight: volumetricWeight,
            total_weight: totalWeight,
            shipping_cost: shippingCost,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
      );

      if (error) throw error;
      toast.success('Pengiriman berhasil diperbarui');
      setIsEditing(false);
      fetchShipment();
    } catch (error: any) {
      toast.error('Gagal menyimpan: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      // Approval check for high cost shipments
      const { shippingCost } = calculateMetrics();
      if (shippingCost > 10000000 && shipment.approval_status !== 'approved' && ['in_transit', 'delivered'].includes(newStatus)) {
        toast.error('Pengiriman biaya > 10jt memerlukan persetujuan Superadmin sebelum dikirim.');
        return;
      }

      const { error } = await withRetry(() => 
        supabase
          .from('shipment_orders')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', id)
      );

      if (error) {
        if (error.message.includes('Pembelian dicatat sebagai pengiriman perlengkapan')) {
          toast.error('Gagal: ' + error.message);
          return;
        }
        throw error;
      }
      toast.success(`Status diperbarui menjadi ${newStatus}`);
      fetchShipment();
    } catch (error: any) {
      toast.error('Gagal memperbarui status: ' + error.message);
    }
  };

  const handleApproval = async (status: 'approved' | 'rejected') => {
    try {
      const { error } = await withRetry(() => 
        supabase
          .from('shipment_orders')
          .update({ 
            approval_status: status, 
            approved_by: profile?.id,
            updated_at: new Date().toISOString() 
          })
          .eq('id', id)
      );

      if (error) throw error;
      toast.success(`Pengiriman ${status === 'approved' ? 'disetujui' : 'ditolak'}`);
      fetchShipment();
    } catch (error: any) {
      toast.error('Gagal memproses approval: ' + error.message);
    }
  };

  if (loading) return <div className="p-8 text-center">Memuat...</div>;
  if (!shipment) return <div className="p-8 text-center">Pengiriman tidak ditemukan.</div>;

  const { volumetricWeight, totalWeight, shippingCost } = calculateMetrics();
  const requiresApproval = shippingCost > 10000000;
  const isPerlengkapan = shipment.type === 'purchase';
  const pageTitle = isPerlengkapan ? 'Pengiriman Perlengkapan' : 'Pengiriman Bahan Baku';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="mr-2 h-4 w-4" /> Kembali
        </button>
        <h2 className="text-lg font-semibold text-gray-900">{pageTitle}</h2>
        <div className="flex space-x-3">
          {profile?.role === 'superadmin' && requiresApproval && shipment.approval_status === 'pending' && (
            <>
              <button onClick={() => handleApproval('rejected')} className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200">Tolak</button>
              <button onClick={() => handleApproval('approved')} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Setujui</button>
            </>
          )}
          <button onClick={() => setIsEditing(!isEditing)} className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
            {isEditing ? 'Batal' : 'Edit Pengiriman'}
          </button>
          {isEditing && (
            <button onClick={handleSave} className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-hover flex items-center">
              <Save className="mr-2 h-4 w-4" /> Simpan
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Main Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Detail {isPerlengkapan ? 'Pengiriman Perlengkapan' : 'Pengiriman Bahan Baku'} #{shipment.tracking_number || 'N/A'}</h2>
                <p className="text-sm text-gray-500">Dibuat pada {new Date(shipment.created_at).toLocaleString()}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                shipment.status === 'delivered' ? 'bg-green-100 text-green-800' : 
                shipment.status === 'in_transit' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {shipment.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">Vendor Ekspedisi</label>
                {isEditing ? (
                  <select 
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm"
                    value={formData.vendor_id}
                    onChange={(e) => setFormData({...formData, vendor_id: e.target.value})}
                  >
                    <option value="">Pilih Vendor</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                ) : (
                  <p className="mt-1 text-sm font-medium">{shipment.vendor?.name || '-'}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase">Nomor Resi</label>
                {isEditing ? (
                  <input 
                    type="text" 
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm"
                    value={formData.tracking_number}
                    onChange={(e) => setFormData({...formData, tracking_number: e.target.value})}
                  />
                ) : (
                  <p className="mt-1 text-sm font-medium">{shipment.tracking_number || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Logistics Data */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
              <Package className="mr-2 h-4 w-4" /> Data Logistik & Dimensi
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-500">Berat Aktual (kg)</label>
                {isEditing ? (
                  <input type="number" className="w-full border-gray-300 rounded-md sm:text-sm" value={formData.actual_weight} onChange={(e) => setFormData({...formData, actual_weight: parseFloat(e.target.value)})} />
                ) : <p className="text-sm">{shipment.actual_weight} kg</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500">Dimensi (P×L×T)</label>
                {isEditing ? (
                  <div className="flex space-x-1">
                    <input type="number" className="w-1/3 border-gray-300 rounded-md sm:text-sm" value={formData.dimension_p} onChange={(e) => setFormData({...formData, dimension_p: parseFloat(e.target.value)})} />
                    <input type="number" className="w-1/3 border-gray-300 rounded-md sm:text-sm" value={formData.dimension_l} onChange={(e) => setFormData({...formData, dimension_l: parseFloat(e.target.value)})} />
                    <input type="number" className="w-1/3 border-gray-300 rounded-md sm:text-sm" value={formData.dimension_t} onChange={(e) => setFormData({...formData, dimension_t: parseFloat(e.target.value)})} />
                  </div>
                ) : <p className="text-sm">{shipment.dimension_p}×{shipment.dimension_l}×{shipment.dimension_t} cm</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500">Berat Volumetrik</label>
                <p className="text-sm font-medium">{volumetricWeight.toFixed(2)} kg</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Total Biaya Kirim</label>
                <p className="text-sm font-bold text-primary">Rp {shippingCost.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Digital POD */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
              <Camera className="mr-2 h-4 w-4" /> Bukti Pengiriman Digital (POD)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Foto Bukti</label>
                {shipment.delivery_proof_url ? (
                  <img src={shipment.delivery_proof_url} alt="POD" className="w-full h-48 object-cover rounded-lg border" />
                ) : (
                  <div className="w-full h-48 bg-gray-50 border-2 border-dashed rounded-lg flex items-center justify-center">
                    <input type="file" id="pod-upload" className="hidden" accept="image/*" onChange={handleFileUpload} />
                    <label htmlFor="pod-upload" className="cursor-pointer text-sm text-primary hover:underline">Upload Foto</label>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">Tanda Tangan Digital</label>
                {shipment.driver_signature ? (
                  <img src={shipment.driver_signature} alt="Signature" className="w-full h-48 object-contain rounded-lg border bg-white" />
                ) : (
                  <div className="relative">
                    <canvas 
                      ref={signatureRef}
                      width={400}
                      height={192}
                      className="w-full h-48 bg-white border-2 rounded-lg touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    <div className="absolute bottom-2 right-2 space-x-2">
                      <button onClick={clearSignature} className="px-2 py-1 text-xs bg-gray-200 rounded">Reset</button>
                      <button onClick={saveSignature} className="px-2 py-1 text-xs bg-primary text-white rounded">Simpan TTD</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
               <button onClick={captureGPS} className="flex items-center text-sm text-primary hover:underline">
                 <MapPin className="mr-2 h-4 w-4" /> {shipment.gps_coordinates ? `Lokasi: ${shipment.gps_coordinates}` : 'Tangkap Lokasi GPS'}
               </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Status Actions */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Update Status</h3>
            <div className="space-y-2">
              {['pending', 'confirmed', 'in_transit', 'delivered', 'failed'].map(s => (
                <button 
                  key={s} 
                  onClick={() => handleStatusChange(s)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm capitalize ${shipment.status === s ? 'bg-primary text-white' : 'hover:bg-gray-100'}`}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Security & Approval */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
              <Shield className="mr-2 h-4 w-4" /> Approval & Keamanan
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Status Approval</span>
                <span className={`text-xs font-bold uppercase ${
                  shipment.approval_status === 'approved' ? 'text-green-600' : 
                  shipment.approval_status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
                }`}>
                  {shipment.approval_status}
                </span>
              </div>
              {requiresApproval && (
                <div className="p-2 bg-yellow-50 rounded text-[10px] text-yellow-700">
                  <AlertTriangle className="inline h-3 w-3 mr-1" /> Biaya &gt; Rp 10jt memerlukan persetujuan Superadmin.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Audit Trail */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
          <Shield className="mr-2 h-4 w-4" /> Riwayat Perubahan (Audit Trail)
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Waktu</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Perubahan</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {auditLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-900">
                    {log.user?.full_name || 'System'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-[10px] rounded-full uppercase font-bold ${
                      log.action === 'INSERT' ? 'bg-green-100 text-green-700' :
                      log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {log.action === 'UPDATE' ? (
                      <div className="max-w-xs overflow-hidden text-ellipsis">
                        {Object.keys(log.new_values || {}).filter(key => 
                          JSON.stringify(log.old_values?.[key]) !== JSON.stringify(log.new_values?.[key])
                        ).map(key => (
                          <div key={key}>
                            <span className="font-semibold">{key}:</span> {String(log.old_values?.[key])} → {String(log.new_values?.[key])}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="italic">Data baru dibuat</span>
                    )}
                  </td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-xs text-gray-500 italic">Belum ada riwayat perubahan</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
