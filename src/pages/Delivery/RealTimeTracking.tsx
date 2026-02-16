import React from 'react';
import { MapPin, Package, Truck, CheckCircle } from 'lucide-react';

export default function RealTimeTracking() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Tracking Real-time</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white shadow rounded-lg overflow-hidden h-[600px] flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300">
          <div className="text-center">
            <MapPin className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Peta Tracking</h3>
            <p className="mt-1 text-sm text-gray-500">Integrasi peta (Google Maps/Leaflet) akan tampil di sini.</p>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6 overflow-y-auto">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Timeline Pengiriman</h2>
          
          <div className="flow-root">
            <ul className="-mb-8">
              <li className="relative pb-8 text-gray-400 italic text-sm">
                Pilih nomor resi untuk melihat detail tracking...
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
