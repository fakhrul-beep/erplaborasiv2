import React from 'react';
import { DollarSign, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react';
import { useSettingsStore } from '../../store/settingsStore';

interface SummaryData {
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
  total_orders: number;
  total_purchase_orders: number;
  pending_orders: number;
  low_stock_count: number;
}

interface Props {
  data: SummaryData;
}

export const SummaryCards: React.FC<Props> = ({ data }) => {
  const { formatCurrency } = useSettingsStore();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Revenue Card */}
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
            <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(data.total_revenue)}</h3>
          </div>
          <div className="p-3 bg-green-100 rounded-full text-green-600">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* Expenses Card */}
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Total Expenses</p>
            <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(data.total_expenses)}</h3>
          </div>
          <div className="p-3 bg-red-100 rounded-full text-red-600">
            <TrendingUp size={24} className="transform rotate-180" />
          </div>
        </div>
      </div>

      {/* Net Profit Card */}
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Net Profit</p>
            <h3 className={`text-2xl font-bold ${data.net_profit >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
              {formatCurrency(data.net_profit)}
            </h3>
          </div>
          <div className="p-3 bg-blue-100 rounded-full text-blue-600">
            <TrendingUp size={24} />
          </div>
        </div>
      </div>

      {/* Operational Stats Card */}
      <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Pending Orders</p>
            <h3 className="text-2xl font-bold text-gray-800">{data.pending_orders}</h3>
            <p className="text-xs text-red-500 mt-1 flex items-center">
               {data.low_stock_count} Low Stock Items
            </p>
          </div>
          <div className="p-3 bg-yellow-100 rounded-full text-yellow-600">
            <AlertTriangle size={24} />
          </div>
        </div>
      </div>
    </div>
  );
};
