import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Clock, Info, Loader2, ChevronDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip as RechartsTooltip } from 'recharts';
import { useSettingsStore } from '../../store/settingsStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility to merge tailwind classes safely
 */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ProfitTrend {
  date: string;
  value: number;
}

interface ProfitData {
  totalProfit: number;
  percentageChange: number;
  isUp: boolean;
  trend: ProfitTrend[];
}

type Period = 'hari' | 'minggu' | 'bulan' | 'tahun';

const PERIOD_LABELS: Record<Period, string> = {
  hari: '24 Jam Terakhir',
  minggu: '7 Hari Terakhir',
  bulan: '30 Hari Terakhir',
  tahun: '1 Tahun Terakhir',
};

export const ProfitCard: React.FC = () => {
  const { formatCurrency } = useSettingsStore();
  const [period, setPeriod] = useState<Period>('minggu');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ProfitData | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showFilter, setShowFilter] = useState(false);

  // Mock data generator for demo purposes
  const fetchProfitData = useCallback(async (selectedPeriod: Period) => {
    setLoading(true);
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Generate mock data based on period
    const trendCount = selectedPeriod === 'hari' ? 24 : selectedPeriod === 'minggu' ? 7 : selectedPeriod === 'bulan' ? 30 : 12;
    const mockTrend: ProfitTrend[] = Array.from({ length: trendCount }).map((_, i) => ({
      date: `Day ${i + 1}`,
      value: Math.floor(Math.random() * 5000000) + 1000000,
    }));

    const totalProfit = mockTrend.reduce((acc, curr) => acc + curr.value, 0);
    const percentageChange = (Math.random() * 15).toFixed(1);
    const isUp = Math.random() > 0.3;

    setData({
      totalProfit,
      percentageChange: parseFloat(percentageChange),
      isUp,
      trend: mockTrend,
    });
    setLoading(false);
  }, []);

  // Initial fetch and auto-refresh every 5 minutes
  useEffect(() => {
    fetchProfitData(period);

    const interval = setInterval(() => {
      fetchProfitData(period);
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [period, fetchProfitData]);

  const handlePeriodChange = (p: Period) => {
    setPeriod(p);
    setShowFilter(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 group">
      <div className="p-5 flex flex-col h-full">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary group-hover:scale-110 transition-transform duration-300">
              <DollarSign size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Total Profit</h3>
              <div className="flex items-center mt-0.5 relative">
                <span className="text-xs text-gray-400 font-medium">{PERIOD_LABELS[period]}</span>
                <button 
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="ml-1.5 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  <Info size={14} />
                </button>
                
                {/* Custom Tooltip */}
                {showTooltip && (
                  <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-gray-800 text-white text-[10px] rounded shadow-lg z-20 animate-in fade-in slide-in-from-bottom-1">
                    Total keuntungan bersih setelah dikurangi biaya operasional dan pembelian pada periode yang dipilih.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Period Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 border border-gray-100 transition-colors"
            >
              <Clock size={14} />
              <span className="capitalize">{period}</span>
              <ChevronDown size={14} className={cn("transition-transform duration-200", showFilter && "rotate-180")} />
            </button>

            {showFilter && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowFilter(false)} 
                />
                <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20 animate-in zoom-in-95 duration-200 origin-top-right">
                  {(['hari', 'minggu', 'bulan', 'tahun'] as Period[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePeriodChange(p)}
                      className={cn(
                        "w-full text-left px-4 py-2 text-xs font-medium hover:bg-primary/5 transition-colors",
                        period === p ? "text-primary bg-primary/5" : "text-gray-600"
                      )}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Value & Trend Section */}
        <div className="flex items-end justify-between mb-6">
          <div className="space-y-1">
            {loading ? (
              <div className="flex items-center space-x-2 py-1">
                <Loader2 size={24} className="animate-spin text-primary/40" />
                <div className="h-8 w-32 bg-gray-100 animate-pulse rounded-lg" />
              </div>
            ) : (
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                {formatCurrency(data?.totalProfit || 0)}
              </h2>
            )}
            
            <div className="flex items-center space-x-2">
              <div className={cn(
                "flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                data?.isUp ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              )}>
                {data?.isUp ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
                {data?.percentageChange}%
              </div>
              <span className="text-[10px] font-medium text-gray-400">vs periode sebelumnya</span>
            </div>
          </div>
        </div>

        {/* Mini Chart Section */}
        <div className="flex-1 min-h-[80px] -mx-1 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
              <div className="w-full h-1 bg-gray-50 overflow-hidden rounded-full">
                <div className="h-full bg-primary/20 animate-shimmer" style={{ width: '40%' }} />
              </div>
            </div>
          )}
          
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.trend || []}>
              <RechartsTooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow-lg border-none">
                        {formatCurrency(payload[0].value as number)}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <YAxis hide domain={['dataMin - 100000', 'dataMax + 100000']} />
              <Line
                type="monotone"
                dataKey="value"
                stroke={data?.isUp ? "#10b981" : "#ef4444"}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: data?.isUp ? "#10b981" : "#ef4444", strokeWidth: 0 }}
                animationDuration={1500}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Decorative background element */}
      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />
    </div>
  );
};
