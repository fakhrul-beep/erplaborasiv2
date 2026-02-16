import React from 'react';
import { LayoutDashboard, Truck, Package, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export default function DeliveryDashboard() {
  const stats = [
    { name: 'Total Pengiriman', value: '128', icon: Truck, color: 'bg-blue-500' },
    { name: 'Sedang Dikirim', value: '12', icon: Clock, color: 'bg-yellow-500' },
    { name: 'Selesai', value: '114', icon: CheckCircle, color: 'bg-green-500' },
    { name: 'Gagal/Terlambat', value: '2', icon: AlertTriangle, color: 'bg-red-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard Pengiriman</h1>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.name} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 rounded-md p-3 ${item.color}`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">{item.name}</dt>
                    <dd className="text-lg font-medium text-gray-900">{item.value}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Pengiriman Terbaru</h2>
          <div className="text-gray-500 text-sm italic">Memuat data pengiriman...</div>
        </div>
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Status Vendor Ekspedisi</h2>
          <div className="text-gray-500 text-sm italic">Memuat data vendor...</div>
        </div>
      </div>
    </div>
  );
}
