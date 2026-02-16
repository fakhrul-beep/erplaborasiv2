
-- Create Stock Opname Sessions Table
CREATE TABLE stock_opname_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR NOT NULL CHECK (type IN ('equipment', 'raw_material')),
  status VARCHAR NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'review', 'finalized', 'cancelled')),
  scheduled_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  warehouse_id UUID REFERENCES warehouses(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create Stock Opname Items Table
CREATE TABLE stock_opname_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES stock_opname_sessions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  system_stock NUMERIC NOT NULL DEFAULT 0,
  physical_stock NUMERIC,
  difference NUMERIC GENERATED ALWAYS AS (physical_stock - system_stock) STORED,
  notes TEXT,
  condition VARCHAR,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Stock Opname Approvals Table
CREATE TABLE stock_opname_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES stock_opname_sessions(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES users(id),
  role VARCHAR NOT NULL, -- 'supervisor', 'manager', 'auditor'
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE stock_opname_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_opname_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_opname_approvals ENABLE ROW LEVEL SECURITY;

-- Create Policies (Simplified for now, can be granularized later based on requirements)
-- Allow authenticated users to view
CREATE POLICY "Enable read access for authenticated users" ON stock_opname_sessions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON stock_opname_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Enable read access for authenticated users" ON stock_opname_approvals FOR SELECT USING (auth.role() = 'authenticated');

-- Allow create/update for authenticated users (Roles will be handled in frontend/business logic or specific policies if needed)
CREATE POLICY "Enable insert access for authenticated users" ON stock_opname_sessions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON stock_opname_sessions FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON stock_opname_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON stock_opname_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete access for authenticated users" ON stock_opname_items FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON stock_opname_approvals FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update access for authenticated users" ON stock_opname_approvals FOR UPDATE USING (auth.role() = 'authenticated');
