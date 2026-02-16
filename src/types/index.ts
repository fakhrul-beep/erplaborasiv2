export interface User {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'finance' | 'sales' | 'sales_equipment' | 'sales_raw_material' | 'purchasing' | 'warehouse' | 'delivery';
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  price: number;
  stock_quantity: number;
  category: string;
  image_url?: string;
  cost_price?: number;
  type: 'equipment' | 'raw_material';
  supplier_id: string;
  created_at: string;
  supplier?: Supplier;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  credit_limit: number;
  payment_terms: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  rating: number;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  order_date: string;
  status: 'newly_created' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'completed';
  total_amount: number;
  payment_status: 'unpaid' | 'unverified' | 'paid' | 'rejected';
  payment_proof_url?: string;
  type: 'equipment' | 'raw_material';
  customer?: Customer;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  original_unit_price?: number;
  price_change_reason?: string;
  price_change_by?: string;
  price_change_at?: string;
  product?: Product;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  order_date: string;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  total_amount: number;
  payment_proof_url?: string;
  type: 'equipment' | 'raw_material';
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product?: Product;
}

export interface Payment {
  id: string;
  order_id?: string;
  purchase_order_id?: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  proof_url: string;
  status: 'unverified' | 'verified' | 'rejected';
  verified_by: string;
  notes: string;
  created_at: string;
  order?: Order;
  purchase_order?: PurchaseOrder;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  reference_id?: string;
  reference_type?: string;
  created_at: string;
}

export interface StockOpnameSession {
  id: string;
  type: 'equipment' | 'raw_material';
  status: 'draft' | 'in_progress' | 'review' | 'finalized' | 'cancelled';
  scheduled_date: string;
  notes?: string;
  warehouse_id?: string;
  created_by: string;
  created_at: string;
  items?: StockOpnameItem[];
  approvals?: StockOpnameApproval[];
}

export interface StockOpnameItem {
  id: string;
  session_id: string;
  product_id: string;
  system_stock: number;
  physical_stock?: number;
  difference?: number;
  notes?: string;
  condition?: string;
  product?: Product;
}

export interface StockOpnameApproval {
  id: string;
  session_id: string;
  approver_id: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected';
  comments?: string;
  created_at: string;
  approver?: User;
}
