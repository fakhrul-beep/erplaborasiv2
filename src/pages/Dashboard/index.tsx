import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DashboardFilter } from '../../components/Dashboard/DashboardFilter';
import { SummaryCards } from '../../components/Dashboard/SummaryCards';
import { SalesVsPurchasesChart } from '../../components/Dashboard/SalesVsPurchasesChart';
import { CashflowChart } from '../../components/Dashboard/CashflowChart';
import { TopProductsChart } from '../../components/Dashboard/TopProductsChart';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');

  // Data States
  const [summaryData, setSummaryData] = useState<any>(null);
  const [salesVsPurchaseData, setSalesVsPurchaseData] = useState<any[]>([]);
  const [cashflowData, setCashflowData] = useState<any[]>([]);
  const [topProductsData, setTopProductsData] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [startDate, endDate, interval]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Summary
      const { data: summary, error: summaryError } = await supabase
        .rpc('get_dashboard_summary', {
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString()
        })
        .single();
      
      if (summaryError) throw summaryError;
      setSummaryData(summary);

      // 2. Fetch Sales vs Purchases
      const { data: categoryData, error: catError } = await supabase
        .rpc('get_sales_vs_purchases_by_category', {
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString()
        });

      if (catError) throw catError;
      setSalesVsPurchaseData(categoryData || []);

      // 3. Fetch Cashflow
      const { data: cashflow, error: cfError } = await supabase
        .rpc('get_cashflow_timeline', {
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          interval_type: interval
        });

      if (cfError) throw cfError;
      setCashflowData(cashflow || []);

      // 4. Fetch Top Products
      const { data: products, error: prodError } = await supabase
        .rpc('get_top_products', {
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
          limit_count: 10
        });

      if (prodError) throw prodError;
      setTopProductsData(products || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  if (loading && !summaryData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
      
      <DashboardFilter 
        startDate={startDate} 
        endDate={endDate} 
        onDateChange={handleDateChange}
        interval={interval}
        onIntervalChange={setInterval}
      />

      {summaryData && <SummaryCards data={summaryData} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesVsPurchasesChart data={salesVsPurchaseData} />
        <CashflowChart data={cashflowData} />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <TopProductsChart data={topProductsData} />
      </div>
    </div>
  );
}
