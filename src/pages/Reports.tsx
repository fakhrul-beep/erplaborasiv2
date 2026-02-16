import React from 'react';
import { BarChart3, PieChart, TrendingUp, Download } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';

export default function Reports() {
  const { formatCurrency } = useSettingsStore();
  
  // Dummy data for now, ideally this comes from API
  const monthlySales = 24500000;
  const inventoryValue = 45200000;
  const totalExpenses = 12800000;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Reports & Analytics</h1>
        <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent">
          <Download className="-ml-1 mr-2 h-5 w-5" />
          Export Data
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {/* Sales Report Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BarChart3 className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Monthly Sales</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(monthlySales)}</dd>
                  <dd className="text-sm text-green-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" /> +12.5% from last month
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <a href="#" className="font-medium text-primary hover:text-primary-hover">View full report</a>
            </div>
          </div>
        </div>

        {/* Inventory Report Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PieChart className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Inventory Value</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(inventoryValue)}</dd>
                  <dd className="text-sm text-gray-500 mt-1">
                    1,234 items in stock
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <a href="#" className="font-medium text-primary hover:text-primary-hover">View inventory analysis</a>
            </div>
          </div>
        </div>

        {/* Expenses Report Card */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Expenses</dt>
                  <dd className="text-lg font-medium text-gray-900">{formatCurrency(totalExpenses)}</dd>
                  <dd className="text-sm text-red-600 flex items-center mt-1">
                    <TrendingUp className="h-3 w-3 mr-1" /> +5.2% from last month
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <a href="#" className="font-medium text-primary hover:text-primary-hover">View expense report</a>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Placeholder */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Sales Overview</h3>
        <div className="h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400">
          Chart Visualization Component (Coming Soon)
        </div>
      </div>
    </div>
  );
}
