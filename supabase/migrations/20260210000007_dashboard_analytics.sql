-- Dashboard Analytics Functions

-- 1. Get Sales vs Purchases by Category
CREATE OR REPLACE FUNCTION get_sales_vs_purchases_by_category(
  start_date timestamptz,
  end_date timestamptz
)
RETURNS TABLE (
  category text,
  sales_amount numeric,
  purchase_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH sales_data AS (
    SELECT 
      p.category,
      SUM(oi.total_price) as total
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN products p ON oi.product_id = p.id
    WHERE o.created_at BETWEEN start_date AND end_date
    AND o.status NOT IN ('cancelled', 'rejected')
    GROUP BY p.category
  ),
  purchase_data AS (
    SELECT 
      p.category,
      SUM(poi.total_price) as total
    FROM purchase_order_items poi
    JOIN purchase_orders po ON poi.purchase_order_id = po.id
    JOIN products p ON poi.product_id = p.id
    WHERE po.created_at BETWEEN start_date AND end_date
    AND po.status NOT IN ('cancelled', 'rejected')
    GROUP BY p.category
  )
  SELECT 
    COALESCE(s.category, pu.category) as category,
    COALESCE(s.total, 0) as sales_amount,
    COALESCE(pu.total, 0) as purchase_amount
  FROM sales_data s
  FULL OUTER JOIN purchase_data pu ON s.category = pu.category;
END;
$$;

-- 2. Get Cashflow Timeline (Income vs Outcome)
CREATE OR REPLACE FUNCTION get_cashflow_timeline(
  start_date timestamptz,
  end_date timestamptz,
  interval_type text DEFAULT 'day' -- 'day', 'week', 'month'
)
RETURNS TABLE (
  date text,
  income numeric,
  outcome numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH income_data AS (
    SELECT 
      DATE_TRUNC(interval_type, o.created_at)::date as period,
      SUM(o.total_amount) as total
    FROM orders o
    WHERE o.created_at BETWEEN start_date AND end_date
    AND o.status NOT IN ('cancelled', 'rejected')
    GROUP BY 1
  ),
  outcome_data AS (
    SELECT 
      DATE_TRUNC(interval_type, po.created_at)::date as period,
      SUM(po.total_amount) as total
    FROM purchase_orders po
    WHERE po.created_at BETWEEN start_date AND end_date
    AND po.status NOT IN ('cancelled', 'rejected')
    GROUP BY 1
  )
  SELECT 
    TO_CHAR(COALESCE(i.period, o.period), 'YYYY-MM-DD') as date,
    COALESCE(i.total, 0) as income,
    COALESCE(o.total, 0) as outcome
  FROM income_data i
  FULL OUTER JOIN outcome_data o ON i.period = o.period
  ORDER BY 1;
END;
$$;

-- 3. Get Top Products
CREATE OR REPLACE FUNCTION get_top_products(
  start_date timestamptz,
  end_date timestamptz,
  limit_count int DEFAULT 10
)
RETURNS TABLE (
  product_name text,
  quantity_sold numeric, -- Changed to numeric to handle potential big sums safely
  revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name as product_name,
    SUM(oi.quantity)::numeric as quantity_sold,
    SUM(oi.total_price) as revenue
  FROM order_items oi
  JOIN orders o ON oi.order_id = o.id
  JOIN products p ON oi.product_id = p.id
  WHERE o.created_at BETWEEN start_date AND end_date
  AND o.status NOT IN ('cancelled', 'rejected')
  GROUP BY p.id, p.name
  ORDER BY revenue DESC
  LIMIT limit_count;
END;
$$;

-- 4. Get Dashboard Summary Cards
CREATE OR REPLACE FUNCTION get_dashboard_summary(
  start_date timestamptz,
  end_date timestamptz
)
RETURNS TABLE (
  total_revenue numeric,
  total_expenses numeric,
  net_profit numeric,
  total_orders bigint,
  total_purchase_orders bigint,
  pending_orders bigint,
  low_stock_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_revenue numeric;
  v_expenses numeric;
  v_orders bigint;
  v_pos bigint;
  v_pending bigint;
  v_low_stock bigint;
BEGIN
  -- Revenue
  SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
  INTO v_revenue, v_orders
  FROM orders
  WHERE created_at BETWEEN start_date AND end_date
  AND status NOT IN ('cancelled', 'rejected');

  -- Pending Orders (Operational Metric)
  SELECT COUNT(*)
  INTO v_pending
  FROM orders
  WHERE status = 'pending';

  -- Expenses
  SELECT COALESCE(SUM(total_amount), 0), COUNT(*)
  INTO v_expenses, v_pos
  FROM purchase_orders
  WHERE created_at BETWEEN start_date AND end_date
  AND status NOT IN ('cancelled', 'rejected');

  -- Low Stock
  SELECT COUNT(*)
  INTO v_low_stock
  FROM products
  WHERE stock_quantity <= min_stock_level;

  RETURN QUERY
  SELECT 
    v_revenue,
    v_expenses,
    (v_revenue - v_expenses),
    v_orders,
    v_pos,
    v_pending,
    v_low_stock;
END;
$$;
