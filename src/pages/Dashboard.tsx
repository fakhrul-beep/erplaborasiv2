import React, { useEffect, useState } from 'react';
import { getDashboardStats, getRecentOrders } from '../lib/api';
import { BarChart3, Package, ShoppingCart, Users } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
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

  if (loading) return <div>Loading dashboard...</div>;

  const cards = [
    { name: 'Total Sales', value: `$${stats.totalSales.toFixed(2)}`, icon: BarChart3, color: 'bg-primary' },
    { name: 'Active Orders', value: stats.activeOrders, icon: ShoppingCart, color: 'bg-accent' },
    { name: 'Inventory Value', value: `$${stats.totalInventoryValue.toFixed(2)}`, icon: Package, color: 'bg-purple-500' }, // Keeping purple for variety or change to primary-light
    { name: 'Total Customers', value: stats.totalCustomers, icon: Users, color: 'bg-orange-500' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
      
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <card.icon 
                    className={`h-6 w-6 p-1 rounded-md ${card.color} ${
                      card.color === 'bg-accent' ? 'text-primary' : 'text-white'
                    }`} 
                  />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">{card.name}</dt>
                    <dd className="text-lg font-medium text-gray-900">{card.value}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Orders</h3>
        </div>
        <div className="border-t border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-primary">#{order.id.slice(0, 8)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{order.customer?.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(new Date(order.created_at), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${order.total_amount}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${order.status === 'delivered' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
