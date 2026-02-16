-- Generated Schema Migration Script
-- Run this in the Destination Supabase SQL Editor to create tables.

-- Table: payments
CREATE TABLE IF NOT EXISTS public.payments (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" UUID,
  "amount" NUMERIC,
  "payment_date" TEXT,
  "payment_method" TEXT,
  "proof_url" TEXT,
  "status" TEXT,
  "verified_by" UUID,
  "notes" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT,
  "purchase_order_id" UUID,
  "created_by" UUID
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Table: purchase_order_items
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "purchase_order_id" UUID,
  "product_id" UUID,
  "quantity" INTEGER,
  "unit_price" NUMERIC,
  "total_price" NUMERIC
);

ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- Table: shipment_orders
CREATE TABLE IF NOT EXISTS public.shipment_orders (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" UUID,
  "purchase_order_id" UUID,
  "vendor_id" UUID,
  "status" TEXT,
  "type" TEXT,
  "category" TEXT,
  "tracking_number" TEXT,
  "shipping_cost" NUMERIC,
  "actual_weight" NUMERIC,
  "volumetric_weight" NUMERIC,
  "total_weight" NUMERIC,
  "dimension_p" NUMERIC,
  "dimension_l" NUMERIC,
  "dimension_t" NUMERIC,
  "volume" NUMERIC,
  "fragility_level" TEXT,
  "requires_crane" BOOLEAN,
  "storage_temp" NUMERIC,
  "storage_humidity" NUMERIC,
  "shelf_life_days" INTEGER,
  "delivery_proof_url" TEXT,
  "driver_signature" TEXT,
  "gps_coordinates" TEXT,
  "approval_status" TEXT,
  "approved_by" UUID,
  "notes" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

ALTER TABLE public.shipment_orders ENABLE ROW LEVEL SECURITY;

-- Table: orders
CREATE TABLE IF NOT EXISTS public.orders (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" UUID,
  "user_id" UUID,
  "status" TEXT,
  "total_amount" NUMERIC,
  "discount" NUMERIC,
  "payment_method" TEXT,
  "payment_status" TEXT,
  "order_date" TEXT,
  "delivery_date" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT,
  "type" TEXT,
  "payment_proof_url" TEXT,
  "notes" TEXT
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Table: customers
CREATE TABLE IF NOT EXISTS public.customers (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "credit_limit" NUMERIC,
  "payment_terms" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Table: transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" TEXT,
  "description" TEXT,
  "amount" NUMERIC,
  "type" TEXT,
  "category" TEXT,
  "reference_id" UUID,
  "reference_type" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Table: inventory_movements
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "product_id" UUID,
  "warehouse_id" UUID,
  "movement_type" TEXT,
  "quantity" INTEGER,
  "balance_after" INTEGER,
  "reference_type" TEXT,
  "reference_id" UUID,
  "user_id" UUID,
  "notes" TEXT,
  "created_at" TEXT
);

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

-- Table: stock_opname_items
CREATE TABLE IF NOT EXISTS public.stock_opname_items (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" UUID,
  "product_id" UUID,
  "system_stock" NUMERIC,
  "physical_stock" NUMERIC,
  "difference" NUMERIC,
  "notes" TEXT,
  "condition" TEXT,
  "created_at" TEXT
);

ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;

-- Table: products
CREATE TABLE IF NOT EXISTS public.products (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sku" TEXT,
  "name" TEXT,
  "description" TEXT,
  "category" TEXT,
  "price" NUMERIC,
  "stock_quantity" INTEGER,
  "min_stock_level" INTEGER,
  "supplier_id" UUID,
  "is_active" BOOLEAN,
  "created_at" TEXT,
  "updated_at" TEXT,
  "type" TEXT,
  "image_url" TEXT,
  "cost_price" NUMERIC
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Table: suppliers
CREATE TABLE IF NOT EXISTS public.suppliers (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "address" TEXT,
  "rating" NUMERIC,
  "is_active" BOOLEAN,
  "created_at" TEXT,
  "updated_at" TEXT
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Table: warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT,
  "location" TEXT,
  "type" TEXT,
  "is_active" BOOLEAN,
  "created_at" TEXT
);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

-- Table: order_items
CREATE TABLE IF NOT EXISTS public.order_items (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" UUID,
  "product_id" UUID,
  "quantity" INTEGER,
  "unit_price" NUMERIC,
  "discount" NUMERIC,
  "total_price" NUMERIC,
  "original_unit_price" NUMERIC,
  "price_change_reason" TEXT,
  "price_change_by" UUID,
  "price_change_at" TEXT
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Table: system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT,
  "value" JSONB,
  "created_at" TEXT,
  "updated_at" TEXT
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Table: stock_opname_sessions
CREATE TABLE IF NOT EXISTS public.stock_opname_sessions (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" TEXT,
  "status" TEXT,
  "scheduled_date" TEXT,
  "notes" TEXT,
  "warehouse_id" UUID,
  "created_by" UUID,
  "created_at" TEXT,
  "updated_at" TEXT
);

ALTER TABLE public.stock_opname_sessions ENABLE ROW LEVEL SECURITY;

-- Table: stock_opname_approvals
CREATE TABLE IF NOT EXISTS public.stock_opname_approvals (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" UUID,
  "approver_id" UUID,
  "role" TEXT,
  "status" TEXT,
  "comments" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT
);

ALTER TABLE public.stock_opname_approvals ENABLE ROW LEVEL SECURITY;

-- Table: shipping_vendors
CREATE TABLE IF NOT EXISTS public.shipping_vendors (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT,
  "coverage_area" TEXT,
  "service_type" TEXT,
  "rate_per_kg" NUMERIC,
  "estimated_days" INTEGER,
  "rating_on_time" NUMERIC,
  "rating_damage" NUMERIC,
  "rating_service" NUMERIC,
  "is_active" BOOLEAN,
  "created_at" TEXT,
  "updated_at" TEXT
);

ALTER TABLE public.shipping_vendors ENABLE ROW LEVEL SECURITY;

-- Table: users
CREATE TABLE IF NOT EXISTS public.users (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT,
  "password_hash" TEXT,
  "name" TEXT,
  "role" TEXT,
  "is_active" BOOLEAN,
  "created_at" TEXT,
  "updated_at" TEXT,
  "is_approved" BOOLEAN
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Table: shipment_audit_logs
CREATE TABLE IF NOT EXISTS public.shipment_audit_logs (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "shipment_id" UUID,
  "user_id" UUID,
  "action" TEXT,
  "old_values" JSONB,
  "new_values" JSONB,
  "timestamp" TEXT
);

ALTER TABLE public.shipment_audit_logs ENABLE ROW LEVEL SECURITY;

-- Table: purchase_orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "supplier_id" UUID,
  "user_id" UUID,
  "status" TEXT,
  "total_amount" NUMERIC,
  "order_date" TEXT,
  "expected_date" TEXT,
  "created_at" TEXT,
  "updated_at" TEXT,
  "type" TEXT,
  "payment_proof_url" TEXT,
  "notes" TEXT
);

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "action" TEXT,
  "entity" TEXT,
  "entity_id" TEXT,
  "details" JSONB,
  "created_at" TEXT
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

