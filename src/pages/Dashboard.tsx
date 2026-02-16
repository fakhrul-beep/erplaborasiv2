import React, { useEffect, useState } from 'react';
import { getDashboardStats, getRecentOrders } from '../lib/api';
import { BarChart3, Package, ShoppingCart, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useSettingsStore } from '../store/settingsStore';
import { ProfitCard } from '../components/Dashboard/ProfitCard';

export default function Dashboard() {
  const { formatCurrency } = useSettingsStore();
  const [stats, setStats] = useState({
    totalSales: 0,
    activeOrders: 0,
    totalInventoryValue: 0,
    totalCustomers: 0
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [statsData, ordersData] = await Promise.all([
          getDashboardStats(),
          getRecentOrders()
        ]);
        setStats(statsData);
        setRecentOrders(ordersData || []);
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-gray-500 font-medium">Memuat Dashboard...</p>
      </div>
    </div>
  );

  const cards = [
    { name: 'Total Sales', value: formatCurrency(stats.totalSales), icon: BarChart3, color: 'bg-primary' },
    { name: 'Active Orders', value: stats.activeOrders, icon: ShoppingCart, color: 'bg-accent' },
    { name: 'Inventory Value', value: formatCurrency(stats.totalInventoryValue), icon: Package, color: 'bg-purple-500' }, // Keeping purple for variety or change to primary-light
    { name: 'Total Customers', value: stats.totalCustomers, icon: Users, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard Overview</h1>
        <div className="text-sm text-gray-500">
          Last updated: {format(new Date(), 'HH:mm:ss')}
        </div>
      </div>

      {/* Primary Metrics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Interactive Card */}
        <div className="lg:col-span-1">
          <ProfitCard />
        </div>

        {/* Other Metric Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {cards.map((card) => (
            <div key={card.name} className="bg-white overflow-hidden shadow-sm rounded-xl border border-gray-100 hover:shadow-md transition-shadow duration-300">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <card.icon 
                      className={`h-10 w-10 p-2 rounded-xl ${card.color} ${
                        card.color === 'bg-accent' ? 'text-primary-900' : 'text-white'
                      }`} 
                    />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wider truncate">{card.name}</dt>
                      <dd className="text-xl font-bold text-gray-900 mt-1">{card.value}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Recent Orders Table */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Pesanan Terbaru</h3>
          <button className="text-primary text-sm font-semibold hover:underline">Lihat Semua</button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID Pesanan</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Pelanggan</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary">#{order.id.slice(0, 8)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">{order.customer?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(order.created_at), 'dd MMM yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{formatCurrency(order.total_amount)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-full 
                      ${order.status === 'delivered' ? 'bg-green-100 text-green-700' : 
                        order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {order.status === 'delivered' ? 'Selesai' : 
                       order.status === 'cancelled' ? 'Batal' : 'Proses'}
                    </span>
                  </td>
                </tr>
              ))}
              {recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 font-medium">
                    Belum ada pesanan terbaru.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
