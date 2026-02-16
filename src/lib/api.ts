import { supabase } from './supabase';

export const getDashboardStats = async () => {
  try {
    // Parallel fetching for performance
    const [ordersResponse, productsResponse, customersResponse] = await Promise.all([
      supabase.from('orders').select('total_amount, status'),
      supabase.from('products').select('stock_quantity, price'),
      supabase.from('customers').select('id', { count: 'exact', head: true })
    ]);

    const orders = ordersResponse.data || [];
    const products = productsResponse.data || [];
    const totalCustomers = customersResponse.count || 0;

    // Calculate totals safely
    const totalSales = orders.reduce((acc, curr) => acc + (Number(curr.total_amount) || 0), 0);
    
    const activeOrders = orders.filter(o => 
      o.status !== 'delivered' && o.status !== 'cancelled'
    ).length;
    
    const totalInventoryValue = products.reduce((acc, curr) => 
      acc + ((Number(curr.stock_quantity) || 0) * (Number(curr.price) || 0)), 0
    );

    return {
      totalSales,
      activeOrders,
      totalInventoryValue,
      totalCustomers
    };
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    return {
      totalSales: 0,
      activeOrders: 0,
      totalInventoryValue: 0,
      totalCustomers: 0
    };
  }
};

export const getRecentOrders = async () => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*, customers (name)') // Removed alias to be safe, assuming FK is 'customer_id' -> 'customers'
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (error) throw error;
    
    // Map the result to ensure 'customer' property exists if UI expects it
    return (data || []).map(order => ({
      ...order,
      customer: order.customers || order.customer // Handle both cases
    }));
  } catch (error) {
    console.error('Error in getRecentOrders:', error);
    return [];
  }
};

export const logImportActivity = async (module: string, total: number, success: number, failed: number, userId?: string) => {
  try {
    const { error } = await supabase
      .from('import_logs')
      .insert({
        module,
        total_rows: total,
        success_rows: success,
        failed_rows: failed,
        created_by: userId,
        created_at: new Date().toISOString()
      });
    
    if (error) throw error;
  } catch (error) {
    console.error('Error logging import activity:', error);
  }
};
