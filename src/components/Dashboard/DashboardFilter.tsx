import React from 'react';
import { Calendar } from 'lucide-react';

interface FilterProps {
  startDate: string;
  endDate: string;
  onDateChange: (start: string, end: string) => void;
  interval: 'day' | 'week' | 'month';
  onIntervalChange: (interval: 'day' | 'week' | 'month') => void;
}

export const DashboardFilter: React.FC<FilterProps> = ({
  startDate,
  endDate,
  onDateChange,
  interval,
  onIntervalChange
}) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-end md:items-center justify-between">
      <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 mb-1">From Date</label>
          <div className="relative">
            <input
              type="date"
              value={startDate}
              onChange={(e) => onDateChange(e.target.value, endDate)}
              className="pl-3 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary focus:border-primary w-full md:w-40"
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 mb-1">To Date</label>
          <div className="relative">
            <input
              type="date"
              value={endDate}
              onChange={(e) => onDateChange(startDate, e.target.value)}
              className="pl-3 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary focus:border-primary w-full md:w-40"
            />
          </div>
        </div>

        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-500 mb-1">Interval</label>
          <select
            value={interval}
            onChange={(e) => onIntervalChange(e.target.value as any)}
            className="pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary focus:border-primary"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </div>
      </div>

      <div className="text-sm text-gray-500 flex items-center">
        <Calendar size={16} className="mr-2" />
        Displaying data from {startDate} to {endDate}
      </div>
    </div>
  );
};
