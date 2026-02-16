import React, { useState, useEffect } from 'react';
import { BarChart3, Download, Calendar, Filter, PieChart, TrendingUp, Truck, DollarSign, Package, AlertCircle } from 'lucide-react';
import { supabase, withRetry } from '../../lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

export default function DeliveryReports() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({
    totalCount: 0,
    totalCost: 0,
    avgWeight: 0,
    pendingCount: 0,
    statusData: [],
    monthlyTrend: [],
    vendorData: []
  });

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    category: 'all',
    vendorId: 'all',
    logisticsType: 'all'
  });

  const [vendors, setVendors] = useState<any[]>([]);

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [filters]);

  const fetchVendors = async () => {
    try {
      console.log('Fetching vendors for reports...');
      const { data, error } = await withRetry(
        () => supabase.from('shipping_vendors').select('id, name').order('name'),
        5,
        1000,
        'vendors-reports'
      );
      if (error) throw error;
      setVendors(data || []);
    } catch (error: any) {
      console.error('Error fetching vendors for reports:', error);
      if (error.message?.includes('schema cache') || error.code === 'PGRST205') {
        toast.error('Sistem sedang melakukan sinkronisasi database untuk memastikan data terbaru. Kami sedang mencoba memuat ulang secara otomatis. Jika tetap gagal, silakan refresh halaman dalam beberapa saat.', { 
          id: 'schema-cache-error',
          duration: 5000 
        });
      } else {
        toast.error('Gagal memuat daftar vendor untuk laporan: ' + (error.message || 'Unknown error'));
      }
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      console.log('Fetching shipment report data with filters:', filters);
      
      const cacheKey = `reports-${JSON.stringify(filters)}`;

      const { data, error } = await withRetry(() => {
        let query = supabase.from('shipment_orders').select('*, vendor:shipping_vendors(name)');

        if (filters.category !== 'all') {
          query = query.eq('category', filters.category);
        }
        if (filters.vendorId !== 'all') {
          query = query.eq('vendor_id', filters.vendorId);
        }
        if (filters.logisticsType !== 'all') {
          query = query.eq('type', filters.logisticsType);
        }
        if (filters.startDate) {
          query = query.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('created_at', filters.endDate);
        }
        
        return query.order('created_at', { ascending: false });
      }, 5, 1000, cacheKey);

      if (error) throw error;
      console.log(`Fetched ${data?.length || 0} shipment orders for report`);

      // Process Stats
      const totalCount = data?.length || 0;
      const totalCost = (data || []).reduce((sum: number, s: any) => sum + (Number(s.shipping_cost) || 0), 0);
      const avgWeight = totalCount > 0 ? (data || []).reduce((sum: number, s: any) => sum + (Number(s.total_weight) || 0), 0) / totalCount : 0;
      const pendingCount = (data || []).filter((s: any) => s.status === 'pending').length;

      // Status Distribution
      const statusCounts = (data || []).reduce((acc: any, s: any) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {});
      const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

      // Monthly Trend (Last 6 months)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const trendData = data.reduce((acc: any, s) => {
        const date = new Date(s.created_at);
        const month = months[date.getMonth()];
        acc[month] = (acc[month] || 0) + 1;
        return acc;
      }, {});
      const monthlyTrend = months.map(m => ({ name: m, count: trendData[m] || 0 }));

      // Vendor Performance
      const vendorPerf = data.reduce((acc: any, s) => {
        const vName = s.vendor?.name || 'Unknown';
        if (!acc[vName]) acc[vName] = { name: vName, count: 0, totalCost: 0 };
        acc[vName].count += 1;
        acc[vName].totalCost += (Number(s.shipping_cost) || 0);
        return acc;
      }, {});
      const vendorData = Object.values(vendorPerf);

      setStats({
        totalCount,
        totalCost,
        avgWeight,
        pendingCount,
        statusData,
        monthlyTrend,
        vendorData
      });

    } catch (error: any) {
      console.error('Error fetching shipment report data:', error);
      if (error.message?.includes('schema cache') || error.code === 'PGRST205') {
        toast.error('Sistem sedang melakukan sinkronisasi database untuk memastikan data terbaru. Kami sedang mencoba memuat ulang secara otomatis. Jika tetap gagal, silakan refresh halaman dalam beberapa saat.', { 
          id: 'schema-cache-error',
          duration: 5000 
        });
      } else {
        toast.error('Gagal memuat data laporan: ' + (error.message || 'Unknown error'));
      }
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(stats.vendorData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendor Performance");
    XLSX.writeFile(wb, "Laporan_Pengiriman.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Laporan Ringkasan Pengiriman", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Vendor', 'Jumlah Pengiriman', 'Total Biaya']],
      body: stats.vendorData.map((v: any) => [v.name, v.count, `Rp ${v.totalCost.toLocaleString()}`]),
    });
    doc.save("Laporan_Pengiriman.pdf");
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Laporan & Analitik Logistik</h1>
          <p className="text-sm text-gray-500">Pantau performa pengiriman perlengkapan dan bahan baku secara real-time.</p>
        </div>
        <div className="flex space-x-3">
          <button onClick={exportToExcel} className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <Download className="mr-2 h-4 w-4" /> Export Excel
          </button>
          <button onClick={exportToPDF} className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover">
            <Download className="mr-2 h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase">Tipe Logistik</label>
            <select 
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm"
              value={filters.logisticsType}
              onChange={(e) => setFilters({...filters, logisticsType: e.target.value})}
            >
              <option value="all">Semua Tipe</option>
              <option value="penerimaan_bahan_baku">Pengiriman Perlengkapan</option>
              <option value="pengiriman_produk_jadi">Pengiriman Bahan Baku</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase">Dari Tanggal</label>
            <input 
              type="date" 
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm"
              value={filters.startDate}
              onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase">Sampai Tanggal</label>
            <input 
              type="date" 
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm"
              value={filters.endDate}
              onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase">Kategori</label>
            <select 
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm"
              value={filters.category}
              onChange={(e) => setFilters({...filters, category: e.target.value})}
            >
              <option value="all">Semua Kategori</option>
              <option value="equipment">Perlengkapan (Equipment)</option>
              <option value="raw_material">Bahan Baku (Raw Material)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase">Vendor</label>
            <select 
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-accent focus:border-accent sm:text-sm"
              value={filters.vendorId}
              onChange={(e) => setFilters({...filters, vendorId: e.target.value})}
            >
              <option value="all">Semua Vendor</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-lg shadow space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
          <div className="text-center space-y-1">
            <p className="text-gray-700 font-medium animate-pulse">Menghitung statistik laporan...</p>
            <p className="text-xs text-gray-400">Sistem sedang melakukan sinkronisasi dengan database</p>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full text-blue-600 mr-4">
              <Truck size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Pengiriman</p>
              <p className="text-2xl font-bold">{stats.totalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full text-green-600 mr-4">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Biaya Kirim</p>
              <p className="text-2xl font-bold">Rp {stats.totalCost.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full text-yellow-600 mr-4">
              <Package size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Rata-rata Berat</p>
              <p className="text-2xl font-bold">{stats.avgWeight.toFixed(2)} kg</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-full text-red-600 mr-4">
              <AlertCircle size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold">{stats.pendingCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <TrendingUp className="mr-2 h-5 w-5 text-primary" /> Tren Pengiriman Bulanan
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#4F46E5" fill="#EEF2FF" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <PieChart className="mr-2 h-5 w-5 text-primary" /> Distribusi Status
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={stats.statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.statusData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Vendor Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Performa Vendor</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Pengiriman</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Biaya</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rata-rata Biaya</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stats.vendorData.map((v: any, idx: number) => (
              <tr key={idx}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{v.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{v.count}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Rp {v.totalCost.toLocaleString()}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  Rp {(v.totalCost / v.count).toLocaleString()}
                </td>
              </tr>
            ))}
            {stats.vendorData.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 italic">Data tidak tersedia</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
    )}
  </div>
  );
}
