import React, { useState, useRef } from 'react';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  bucketName?: string;
  folder?: string;
}

export default function ImageUpload({ value, onChange, bucketName = 'product-images', folder = 'products' }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format gambar tidak didukung. Gunakan JPG, PNG, atau WebP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 5MB.');
      return;
    }

    try {
      setUploading(true);
      setProgress(10);
      console.group('Image Upload Debug');
      console.log('File details:', { name: file.name, size: file.size, type: file.type });
      console.log('Target bucket:', bucketName);
      console.log('Target folder:', folder);

      // Create folder path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = folder ? `${folder}/${fileName}` : fileName;
      console.log('Generated file path:', filePath);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Supabase Storage Error:', error);
        
        // Handle specific error: Bucket not found
        if (error.message.includes('bucket not found') || (error as any).status === 404) {
          throw new Error(`Storage bucket "${bucketName}" tidak ditemukan. Pastikan bucket telah dibuat di Supabase Dashboard dan memiliki akses publik.`);
        }
        
        // Handle specific error: Unauthorized/Permission denied (RLS)
        if ((error as any).status === 403 || error.message.includes('permission denied') || error.message.includes('row-level security')) {
          throw new Error(`Izin Ditolak (RLS): Anda tidak memiliki wewenang untuk mengupload file ke bucket "${bucketName}". Hanya admin, warehouse, purchasing, atau superadmin yang diizinkan.`);
        }

        throw error;
      }

      console.log('Upload success:', data);
      setProgress(90);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);
      
      console.log('Generated public URL:', publicUrl);

      onChange(publicUrl);
      setProgress(100);
      toast.success('Gambar berhasil diupload');
    } catch (error: any) {
      console.error('Final Error Catch:', error);
      toast.error(error.message || 'Gagal mengupload gambar. Silakan cek konsol untuk detailnya.');
    } finally {
      console.groupEnd();
      setUploading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <div className="relative h-32 w-32 border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center group">
          {value ? (
            <>
              <img
                src={value}
                alt="Preview"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={handleRemove}
                aria-label="Hapus gambar"
                className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="text-gray-400 flex flex-col items-center">
              <ImageIcon className="h-8 w-8 mb-1" />
              <span className="text-[10px] uppercase font-semibold">No Image</span>
            </div>
          )}
          
          {uploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center text-white p-2">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <div className="w-full bg-gray-200 rounded-full h-1.5 max-w-[80%]">
                <div 
                  className="bg-accent h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {value ? 'Ganti Gambar' : 'Upload Gambar'}
          </button>
          <p className="text-xs text-gray-500">
            JPG, PNG atau WebP. Maksimal 5MB.
          </p>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
          />
        </div>
      </div>
    </div>
  );
}
