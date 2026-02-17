import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, X, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, Pause, Play, Ban, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface ImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
  type?: 'equipment' | 'raw_material';
}

interface ImportData {
  sku: string;
  name: string;
  category: string;
  stock_quantity: number;
  price: number;
  cost_price?: number;
  unit?: string;
  supplier_name?: string;
  location?: string;
  expiry_date?: string;
  status?: 'valid' | 'error' | 'duplicate' | 'pending' | 'processing' | 'completed' | 'failed';
  errorMsg?: string;
  rowNumber?: number;
}

interface ImportLog {
  row: number;
  sku: string;
  status: 'success' | 'failed';
  message: string;
  timestamp: string;
}

export default function ImportModal({ onClose, onSuccess, type }: ImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'processing'>('upload');
  const [data, setData] = useState<ImportData[]>([]);
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

  const CHUNK_SIZE = 50;
  const MAX_RETRIES = 3;
  const INITIAL_BACKOFF = 1000;

  // Persistence: Save state for resume capability
  useEffect(() => {
    const savedState = localStorage.getItem(`import_resume_${type || 'inventory'}`);
    if (savedState) {
      const { index, data: savedData, logs: savedLogs } = JSON.parse(savedState);
      if (index > -1) {
        setData(savedData);
        setLogs(savedLogs);
        setLastProcessedIndex(index);
        setStep('preview');
        toast.success('Ditemukan proses import yang terhenti. Anda dapat melanjutkannya.');
      }
    }
  }, [type]);

  const saveResumeState = (index: number, currentData: ImportData[], currentLogs: ImportLog[]) => {
    localStorage.setItem(`import_resume_${type || 'inventory'}`, JSON.stringify({
      index,
      data: currentData,
      logs: currentLogs,
      timestamp: Date.now()
    }));
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const downloadLogs = () => {
    const headers = [['Baris', 'SKU', 'Status', 'Pesan', 'Waktu']];
    const logData = logs.map(l => [l.row, l.sku, l.status, l.message, l.timestamp]);
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...logData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Logs');
    XLSX.writeFile(wb, `Import_Log_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const upsertWithRetry = async (payload: Record<string, unknown>, retries = 0): Promise<{ error: Error | null }> => {
    try {
      const { error } = await supabase
        .from('products')
        .upsert(payload, { onConflict: 'sku' });
      
      if (error) throw error;
      return { error: null };
    } catch (error: unknown) {
      const err = error as Error;
      if (retries < MAX_RETRIES && !isCancelled) {
        const backoff = INITIAL_BACKOFF * Math.pow(2, retries);
        await wait(backoff);
        return upsertWithRetry(payload, retries + 1);
      }
      return { error: err };
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
      const { data: suppliers } = await supabase.from('suppliers').select('id, name');
      
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

        const supplier = suppliers?.find(s => s.name.toLowerCase() === item.supplier_name?.toLowerCase());
        const payload = {
          sku: item.sku,
          name: item.name,
          category: item.category,
          stock_quantity: item.stock_quantity,
          price: item.price,
          cost_price: item.cost_price,
          type: type || 'equipment',
          supplier_id: supplier?.id || null,
        };

        const { error } = await upsertWithRetry(payload);

        const newLog: ImportLog = {
          row: item.rowNumber || i + 2,
          sku: item.sku,
          status: error ? 'failed' : 'success',
          message: error ? error.message : 'Berhasil',
          timestamp: new Date().toLocaleTimeString()
        };

        const updatedLogs = [...logs, newLog];
        setLogs(updatedLogs);
        
        if (error) {
          setErrorCount(prev => prev + 1);
        } else {
          setProcessedCount(prev => prev + 1);
        }

        setLastProcessedIndex(i);
        const currentProgress = Math.round(((i + 1) / validData.length) * 100);
        setProgress(currentProgress);

        // Calculate ETA
        if (startTime && i > startIndex) {
          const elapsed = Date.now() - startTime;
          const rate = elapsed / (i - startIndex + 1);
          const remaining = (validData.length - (i + 1)) * rate;
          setEstimatedTimeRemaining(remaining);
        }

        // Save state every 10 records for resume
        if (i % 10 === 0) {
          saveResumeState(i, data, updatedLogs);
        }

        // Small delay to keep UI responsive
        if (i % CHUNK_SIZE === 0) {
          await wait(10);
        }
      }

      if (isCancelled) {
        toast.error('Import dibatalkan.');
      } else {
        toast.success(`Proses selesai. ${processedCount} berhasil, ${errorCount} gagal.`);
        // Cleanup resume state on success
        localStorage.removeItem(`import_resume_${type || 'inventory'}`);
      }
      
      if (errorCount > 0) {
        toast.error(`${errorCount} baris gagal diimport. Silakan unduh log untuk detailnya.`);
      }

      onSuccess();
    } catch (err: unknown) {
      const error = err as Error;
      toast.error('Gagal import: ' + error.message);
    } finally {
      setLoading(false);
      setEstimatedTimeRemaining(null);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      ['Kode Produk (SKU)', 'Nama Produk', 'Kategori', 'Jumlah Stok', 'Satuan', 'Harga Beli', 'Harga Jual', 'Supplier', 'Lokasi', 'Tanggal Kadaluarsa (YYYY-MM-DD)'],
      ['PROD-001', 'Contoh Produk', 'Kategori A', 100, 'pcs', 5000, 7500, 'Supplier Utama', 'Gudang A', '2026-12-31']
    ];
    const ws = XLSX.utils.aoa_to_sheet(headers);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Import');
    XLSX.writeFile(wb, `Template_Import_Stok_${type || 'Inventory'}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];

        // Skip header row
        const rows = rawData.slice(1);
        const processedData: ImportData[] = rows.map((row) => ({
          sku: String(row[0] || ''),
          name: String(row[1] || ''),
          category: String(row[2] || ''),
          stock_quantity: Number(row[3] || 0),
          unit: String(row[4] || ''),
          cost_price: Number(row[5] || 0),
          price: Number(row[6] || 0),
          supplier_name: String(row[7] || ''),
          location: String(row[8] || ''),
          expiry_date: String(row[9] || ''),
          status: 'valid' as const
        })).filter(r => r.sku && r.name);

        // Basic Validation
        const validatedData = processedData.map(item => {
          let errorMsg = '';
          if (isNaN(item.stock_quantity)) errorMsg += 'Stok harus angka. ';
          if (isNaN(item.price)) errorMsg += 'Harga harus angka. ';
          if (item.expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(item.expiry_date)) errorMsg += 'Format tanggal YYYY-MM-DD. ';

          return {
            ...item,
            status: (errorMsg ? 'error' : 'valid') as 'valid' | 'error',
            errorMsg: errorMsg.trim()
          };
        });

        setData(validatedData);
        setStep('preview');
        setLastProcessedIndex(-1);
        setProcessedCount(0);
        setErrorCount(0);
        setProgress(0);
        setLogs([]);
      } catch {
        toast.error('Gagal membaca file. Pastikan format benar.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <FileSpreadsheet className="mr-2 h-6 w-6 text-green-600" />
            Import Stok {type === 'equipment' ? 'Perlengkapan' : 'Bahan Baku'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close" type="button">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' ? (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                <p className="font-semibold mb-1">Petunjuk Import:</p>
                <ul className="list-disc ml-5 space-y-1">
                  <li>Gunakan template Excel yang disediakan untuk menghindari kesalahan format.</li>
                  <li>Kolom SKU dan Nama Produk wajib diisi.</li>
                  <li>Jika SKU sudah ada, data produk tersebut akan diperbarui (Update).</li>
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
                    <p className="text-xs text-gray-500 mt-1">Excel atau CSV (Maks. 5MB)</p>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".xlsx, .xls, .csv"
                    aria-label="Upload Excel or CSV file"
                  />
                </div>

                <div className="border border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center space-y-4 bg-gray-50">
                  <div className="bg-green-100 p-4 rounded-full">
                    <Download className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">Belum punya template?</p>
                    <button
                      onClick={downloadTemplate}
                      className="mt-2 text-primary hover:underline text-sm font-semibold"
                      type="button"
                    >
                      Download Template Excel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : step === 'preview' ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Preview: <span className="font-bold text-gray-900">{data.length} baris ditemukan</span>
                </p>
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
                      <th className="px-4 py-2 text-left font-medium text-gray-500">SKU</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Nama</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Stok</th>
                      <th className="px-4 py-2 text-right font-medium text-gray-500">Harga</th>
                      <th className="px-4 py-2 text-left font-medium text-gray-500">Error</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((item, idx) => (
                      <tr key={idx} className={item.status === 'error' ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2">
                          {item.status === 'valid' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </td>
                        <td className="px-4 py-2 font-mono">{item.sku}</td>
                        <td className="px-4 py-2">{item.name}</td>
                        <td className="px-4 py-2 text-right">{item.stock_quantity}</td>
                        <td className="px-4 py-2 text-right">{item.price.toLocaleString('id-ID')}</td>
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
                    <div>
                      <p className="text-2xl font-bold text-green-700">{processedCount}</p>
                      <p className="text-xs text-green-600 font-medium">Berhasil</p>
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center space-x-3">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                    <div>
                      <p className="text-2xl font-bold text-red-700">{errorCount}</p>
                      <p className="text-xs text-red-600 font-medium">Gagal</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 flex items-center"><Clock className="h-4 w-4 mr-1" /> Estimasi Sisa:</span>
                    <span className="font-bold text-gray-800">{estimatedTimeRemaining ? formatTime(estimatedTimeRemaining) : '--'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Data:</span>
                    <span className="font-bold text-gray-800">{data.length} baris</span>
                  </div>
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className="flex items-center px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-semibold shadow-md"
                    type="button"
                  >
                    {isPaused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                    {isPaused ? 'Lanjutkan' : 'Pause'}
                  </button>
                  <button
                    onClick={() => setIsCancelled(true)}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold shadow-md"
                    type="button"
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Batal
                  </button>
                </div>
              </div>

              <div className="w-full max-w-2xl border rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="bg-gray-800 px-4 py-2 flex justify-between items-center">
                  <span className="text-xs font-mono text-gray-300">Activity Logs</span>
                  <button onClick={downloadLogs} className="text-xs text-blue-400 hover:text-blue-300 flex items-center" type="button">
                    <Download className="h-3 w-3 mr-1" /> Download Log
                  </button>
                </div>
                <div className="h-32 overflow-y-auto p-2 font-mono text-[10px] space-y-1 bg-gray-900">
                  {logs.slice().reverse().map((log, i) => (
                    <div key={i} className={log.status === 'failed' ? 'text-red-400' : 'text-green-400'}>
                      [{log.timestamp}] Row {log.row} (SKU: {log.sku}): {log.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end items-center gap-3">
          {step === 'upload' ? (
            <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50" type="button">Tutup</button>
          ) : step === 'preview' ? (
            <>
              <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900" type="button">Kembali ke Upload</button>
              <button onClick={confirmImport} className="px-6 py-2 bg-primary text-white rounded-md text-sm font-bold hover:bg-primary-hover shadow-lg" type="button">Konfirmasi Import</button>
            </>
          ) : (
            <button
              onClick={errorCount > 0 ? downloadLogs : onClose}
              disabled={loading && !isPaused && !isCancelled}
              className={`px-6 py-2 rounded-md text-sm font-bold shadow-lg flex items-center ${loading && !isPaused && !isCancelled ? 'bg-gray-300 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary-hover'}`}
              type="button"
            >
              {loading && !isPaused && !isCancelled ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {loading ? 'Sedang Memproses...' : errorCount > 0 ? 'Download Error Log & Tutup' : 'Selesai & Tutup'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
