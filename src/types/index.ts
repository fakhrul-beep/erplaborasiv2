export interface User {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'finance' | 'sales' | 'purchasing';
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  unit_price: number;
  stock_quantity: number;
  category: string;
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
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: number;
  payment_status: 'unpaid' | 'paid' | 'partial';
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
  product?: Product;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  order_date: string;
  status: 'draft' | 'ordered' | 'received' | 'cancelled';
  total_amount: number;
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
  order_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  proof_url: string;
  status: 'pending' | 'verified' | 'rejected';
  verified_by: string;
  notes: string;
  created_at: string;
  order?: Order;
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
