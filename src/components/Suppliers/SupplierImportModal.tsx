import React, { useState, useRef } from 'react';
import { Upload, Download, X, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, Pause, Play, Ban, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { logImportActivity } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

interface SupplierImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface SupplierImportData {
  name: string;
  email: string;
  phone: string;
  address: string;
  rating: number;
  status?: 'valid' | 'error' | 'duplicate' | 'pending' | 'processing' | 'completed' | 'failed';
  errorMsg?: string;
  rowNumber?: number;
}

interface ImportLog {
  row: number;
  name: string;
  status: 'success' | 'failed';
  message: string;
  timestamp: string;
}

export default function SupplierImportModal({ onClose, onSuccess }: SupplierImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'processing'>('upload');
  const [data, setData] = useState<SupplierImportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [lastProcessedIndex, setLastProcessedIndex] = useState(-1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { profile } = useAuthStore();

  const CHUNK_SIZE = 50;
  const MAX_RETRIES = 3;
  const INITIAL_BACKOFF = 1000;

  const downloadLogs = () => {
    const headers = [['Baris', 'Nama Supplier', 'Status', 'Pesan', 'Waktu']];
    const logData = logs.map(l => [l.row, l.name, l.status, l.message, l.timestamp]);
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...logData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Logs');
    XLSX.writeFile(wb, `Import_Log_Supplier_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const upsertWithRetry = async (payload: Record<string, unknown>, retries = 0): Promise<{ error: any }> => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .upsert(payload, { onConflict: 'id' });
      
      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      if (retries < MAX_RETRIES && !isCancelled) {
        const backoff = INITIAL_BACKOFF * Math.pow(2, retries);
        await wait(backoff);
        return upsertWithRetry(payload, retries + 1);
      }
      return { error };
    }
  };

  const confirmImport = async () => {
    if (step === 'processing' && !isPaused) return;

    setStep('processing');
    setIsPaused(false);
    setIsCancelled(false);
    setLoading(true);
    setStartTime(Date.now());
    
    const validData = data.map((d, i) => ({ ...d, rowNumber: i + 2 }));
    const startIndex = lastProcessedIndex + 1;

    try {
      for (let i = startIndex; i < validData.length; i++) {
        if (isCancelled) break;
        while (isPaused) {
          await wait(500);
          if (isCancelled) break;
        }
        if (isCancelled) break;

        const item = validData[i];
        if (item.status !== 'valid' && item.status !== 'processing' && item.status !== 'pending') {
          continue;
        }

        const payload = {
          name: item.name,
          email: item.email,
          phone: item.phone,
          address: item.address,
          rating: item.rating,
          is_active: true
        };

        const { error } = await upsertWithRetry(payload);

        const newLog: ImportLog = {
          row: item.rowNumber || i + 2,
          name: item.name,
          status: error ? 'failed' : 'success',
          message: error ? error.message : 'Berhasil',
          timestamp: new Date().toLocaleTimeString()
        };

        setLogs(prev => [newLog, ...prev]);
        
        if (error) {
          setErrorCount(prev => prev + 1);
        } else {
          setProcessedCount(prev => prev + 1);
        }

        setLastProcessedIndex(i);
        const currentProgress = Math.round(((i + 1) / validData.length) * 100);
        setProgress(currentProgress);

        if (startTime && i > startIndex) {
          const elapsed = Date.now() - startTime;
          const rate = elapsed / (i - startIndex + 1);
          const remaining = (validData.length - (i + 1)) * rate;
          setEstimatedTimeRemaining(remaining);
        }

        if (i % CHUNK_SIZE === 0) {
          await wait(10);
        }
      }

      await logImportActivity('suppliers', validData.length, processedCount, errorCount, profile?.id);

      if (isCancelled) {
        toast.error('Import dibatalkan.');
      } else {
        toast.success(`Proses selesai. ${processedCount} berhasil, ${errorCount} gagal.`);
      }
      
      onSuccess();
    } catch (err: any) {
      toast.error('Gagal import: ' + err.message);
    } finally {
      setLoading(false);
      setEstimatedTimeRemaining(null);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      ['Nama Supplier', 'Email', 'Telepon', 'Alamat', 'Rating (1-5)'],
      ['CV Pemasok Maju', 'pemasok@maju.com', '08122334455', 'Jl. Industri No. 5', 5]
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Import');
    XLSX.writeFile(wb, 'Template_Import_Supplier.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        const rows = rawData.slice(1);
        const processedData: SupplierImportData[] = rows.map((row) => ({
          name: String(row[0] || ''),
          email: String(row[1] || ''),
          phone: String(row[2] || ''),
          address: String(row[3] || ''),
          rating: Number(row[4] || 0),
          status: 'valid' as const
        })).filter(r => r.name);

        const validatedData = processedData.map(item => {
          let errorMsg = '';
          if (!item.name) errorMsg += 'Nama wajib diisi. ';
          if (item.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)) errorMsg += 'Format email tidak valid. ';
          if (isNaN(item.rating) || item.rating < 1 || item.rating > 5) errorMsg += 'Rating harus angka 1-5. ';

          return {
            ...item,
            status: (errorMsg ? 'error' : 'valid') as any,
            errorMsg: errorMsg.trim()
          };
        });

        setData(validatedData);
        setStep('preview');
      } catch {
        toast.error('Gagal membaca file. Pastikan format benar.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <FileSpreadsheet className="mr-2 h-6 w-6 text-green-600" />
            Import Data Supplier
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <p className="font-semibold mb-1">Petunjuk Import:</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Gunakan template Excel yang disediakan.</li>
                  <li>Kolom Nama Supplier wajib diisi.</li>
                  <li>Jika Email sudah ada, data supplier akan diperbarui.</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center space-y-4 hover:border-accent transition-colors cursor-pointer"
                     onClick={() => fileInputRef.current?.click()}>
                  <div className="bg-accent bg-opacity-10 p-4 rounded-full">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">Klik untuk upload atau drag & drop</p>
                    <p className="text-xs text-gray-500 mt-1">Excel (Maks. 5MB)</p>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx, .xls" />
                </div>

                <div className="border border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center space-y-4 bg-gray-50">
                  <div className="bg-green-100 p-4 rounded-full">
                    <Download className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">Belum punya template?</p>
                    <button onClick={downloadTemplate} className="mt-2 text-primary hover:underline text-sm font-semibold">
                      Download Template Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : step === 'preview' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">Preview: <span className="font-bold text-gray-900">{data.length} baris</span></p>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" /> Valid: {data.filter(d => d.status === 'valid').length}</span>
                  <span className="flex items-center text-red-600"><AlertCircle className="h-3 w-3 mr-1" /> Error: {data.filter(d => d.status === 'error').length}</span>
                </div>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Status</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Nama</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Email</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Telepon</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Error</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((item, idx) => (
                      <tr key={idx} className={item.status === 'error' ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2">
                          {item.status === 'valid' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                        </td>
                        <td className="px-4 py-2">{item.name}</td>
                        <td className="px-4 py-2">{item.email}</td>
                        <td className="px-4 py-2">{item.phone}</td>
                        <td className="px-4 py-2 text-red-600 italic">{item.errorMsg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 space-y-8">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle className="text-gray-200 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                  <circle className="text-primary stroke-current transition-all duration-500 ease-out" strokeWidth="8" strokeLinecap="round" cx="50" cy="50" r="40" fill="transparent"
                          strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * progress) / 100}></circle>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-gray-800">{progress}%</span>
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Progress</span>
                </div>
              </div>

              <div className="w-full max-w-md space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center space-x-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                    <div><p className="text-2xl font-bold text-green-700">{processedCount}</p><p className="text-xs text-green-600 font-medium">Berhasil</p></div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center space-x-3">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                    <div><p className="text-2xl font-bold text-red-700">{errorCount}</p><p className="text-xs text-red-600 font-medium">Gagal</p></div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center"><Clock className="h-4 w-4 mr-1" /> Estimasi Sisa:</span>
                    <span className="font-bold text-gray-800">{estimatedTimeRemaining ? formatTime(estimatedTimeRemaining) : '--'}</span>
                  </div>
                </div>

                <div className="flex justify-center gap-3">
                  <button onClick={() => setIsPaused(!isPaused)} className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-semibold shadow-md">
                    {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />} {isPaused ? 'Lanjutkan' : 'Pause'}
                  </button>
                  <button onClick={() => setIsCancelled(true)} className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold shadow-md">
                    <Ban className="h-4 w-4 mr-2" /> Batal
                  </button>
                </div>
              </div>

              <div className="w-full max-w-2xl border rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="bg-gray-800 px-4 py-2 flex justify-between items-center">
                  <span className="text-xs font-mono text-gray-300">Activity Logs</span>
                  <button onClick={downloadLogs} className="text-xs text-blue-400 hover:text-blue-300 flex items-center">
                    <Download className="h-3 w-3 mr-1" /> Download Log
                  </button>
                </div>
                <div className="h-32 overflow-y-auto p-2 font-mono text-[10px] space-y-1 bg-gray-900">
                  {logs.map((log, i) => (
                    <div key={i} className={log.status === 'failed' ? 'text-red-400' : 'text-green-400'}>
                      [{log.timestamp}] Row {log.row} ({log.name}): {log.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end items-center gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
            {step === 'processing' ? 'Tutup' : 'Batal'}
          </button>
          {step === 'preview' && (
            <button onClick={confirmImport} className="px-6 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary-hover shadow-lg transition-all transform active:scale-95 flex items-center">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />} Konfirmasi Import
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
