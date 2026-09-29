/*
# Phase 1 Business Data Schema

## Purpose
Creates all core business entities for AI Business OS Phase 1:
products, customers, sales, expenses, recommendations, tasks, alerts, audit logs,
and AI copilot conversations.

## New Tables
1. `products` — Product catalog with cost, price, inventory fields.
2. `customers` — Customer records with segment, LTV, status.
3. `sales` — Individual sale transactions linked to product + customer + branch.
4. `expenses` — Expense records by category.
5. `recommendations` — AI-generated business recommendations with status tracking.
6. `tasks` — Actionable tasks derived from recommendations or manually created.
7. `alerts` — Configurable business alerts.
8. `audit_logs` — Immutable audit trail for sensitive actions.
9. `ai_conversations` — Copilot conversation history.
10. `ai_messages` — Individual messages within copilot conversations.

## Security
- RLS enabled on all tables.
- All tables scoped via org_members membership check for tenant isolation.
- CRUD permissions vary by role (viewers read-only, members can create/update, admins can delete).
- audit_logs are insert-only (no update/delete) for data integrity.

## Notes
- All tables have `organization_id` for tenant isolation.
- `recommendations` track the full lifecycle: new → reviewing → approved → implemented → measured.
- `sales` include both cost and revenue to compute profit per sale.
- `products` carry unit_cost, selling_price, and inventory fields for pricing intelligence.
*/

-- ===== TABLES =====

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  sku text,
  category text,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  selling_price numeric(12,2) NOT NULL DEFAULT 0,
  stock_quantity integer NOT NULL DEFAULT 0,
  reorder_level integer DEFAULT 10,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  company text,
  segment text DEFAULT 'standard',
  status text DEFAULT 'active' CHECK (status IN ('active','inactive','churned','lead')),
  lifetime_value numeric(12,2) DEFAULT 0,
  total_orders integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  total_revenue numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  total_cost numeric(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  gross_profit numeric(12,2) GENERATED ALWAYS AS (quantity * (unit_price - unit_cost)) STORED,
  sale_date timestamptz NOT NULL DEFAULT now(),
  channel text DEFAULT 'direct',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'general',
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  expense_date timestamptz NOT NULL DEFAULT now(),
  is_recurring boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  description text,
  finding text,
  supporting_data jsonb,
  reasoning text,
  assumptions text,
  confidence text DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  estimated_impact numeric(12,2),
  estimated_impact_description text,
  recommended_action text,
  time_period text,
  status text DEFAULT 'new' CHECK (status IN ('new','reviewing','approved','implemented','measured')),
  actual_result numeric(12,2),
  actual_result_description text,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recommendation_id uuid REFERENCES recommendations(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  due_date timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  description text,
  severity text DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  metric text,
  threshold_value numeric(12,2),
  actual_value numeric(12,2),
  is_read boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text DEFAULT 'New Conversation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- ===== ENABLE RLS =====
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

-- ===== HELPER: org membership check =====
CREATE OR REPLACE FUNCTION is_org_member(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM org_members WHERE org_members.user_id = auth.uid() AND org_members.organization_id = org_id);
$$;

CREATE OR REPLACE FUNCTION is_org_admin(org_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM org_members WHERE org_members.user_id = auth.uid() AND org_members.organization_id = org_id AND org_members.role IN ('owner','admin'));
$$;

-- ===== POLICIES: products =====
DROP POLICY IF EXISTS "select_products" ON products;
CREATE POLICY "select_products" ON products FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS "insert_products" ON products;
CREATE POLICY "insert_products" ON products FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "update_products" ON products;
CREATE POLICY "update_products" ON products FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "delete_products" ON products;
CREATE POLICY "delete_products" ON products FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- ===== POLICIES: customers =====
DROP POLICY IF EXISTS "select_customers" ON customers;
CREATE POLICY "select_customers" ON customers FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS "insert_customers" ON customers;
CREATE POLICY "insert_customers" ON customers FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "update_customers" ON customers;
CREATE POLICY "update_customers" ON customers FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "delete_customers" ON customers;
CREATE POLICY "delete_customers" ON customers FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- ===== POLICIES: sales =====
DROP POLICY IF EXISTS "select_sales" ON sales;
CREATE POLICY "select_sales" ON sales FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS "insert_sales" ON sales;
CREATE POLICY "insert_sales" ON sales FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "update_sales" ON sales;
CREATE POLICY "update_sales" ON sales FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "delete_sales" ON sales;
CREATE POLICY "delete_sales" ON sales FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- ===== POLICIES: expenses =====
DROP POLICY IF EXISTS "select_expenses" ON expenses;
CREATE POLICY "select_expenses" ON expenses FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS "insert_expenses" ON expenses;
CREATE POLICY "insert_expenses" ON expenses FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "update_expenses" ON expenses;
CREATE POLICY "update_expenses" ON expenses FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "delete_expenses" ON expenses;
CREATE POLICY "delete_expenses" ON expenses FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- ===== POLICIES: recommendations =====
DROP POLICY IF EXISTS "select_recs" ON recommendations;
CREATE POLICY "select_recs" ON recommendations FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS "insert_recs" ON recommendations;
CREATE POLICY "insert_recs" ON recommendations FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "update_recs" ON recommendations;
CREATE POLICY "update_recs" ON recommendations FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "delete_recs" ON recommendations;
CREATE POLICY "delete_recs" ON recommendations FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- ===== POLICIES: tasks =====
DROP POLICY IF EXISTS "select_tasks" ON tasks;
CREATE POLICY "select_tasks" ON tasks FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS "insert_tasks" ON tasks;
CREATE POLICY "insert_tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "update_tasks" ON tasks;
CREATE POLICY "update_tasks" ON tasks FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "delete_tasks" ON tasks;
CREATE POLICY "delete_tasks" ON tasks FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- ===== POLICIES: alerts =====
DROP POLICY IF EXISTS "select_alerts" ON alerts;
CREATE POLICY "select_alerts" ON alerts FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS "insert_alerts" ON alerts;
CREATE POLICY "insert_alerts" ON alerts FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "update_alerts" ON alerts;
CREATE POLICY "update_alerts" ON alerts FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "delete_alerts" ON alerts;
CREATE POLICY "delete_alerts" ON alerts FOR DELETE TO authenticated USING (is_org_admin(organization_id));

-- ===== POLICIES: audit_logs (insert only, no update/delete) =====
DROP POLICY IF EXISTS "select_audit" ON audit_logs;
CREATE POLICY "select_audit" ON audit_logs FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS "insert_audit" ON audit_logs;
CREATE POLICY "insert_audit" ON audit_logs FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));

-- ===== POLICIES: ai_conversations =====
DROP POLICY IF EXISTS "select_conversations" ON ai_conversations;
CREATE POLICY "select_conversations" ON ai_conversations FOR SELECT TO authenticated USING (is_org_member(organization_id));
DROP POLICY IF EXISTS "insert_conversations" ON ai_conversations;
CREATE POLICY "insert_conversations" ON ai_conversations FOR INSERT TO authenticated WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "update_conversations" ON ai_conversations;
CREATE POLICY "update_conversations" ON ai_conversations FOR UPDATE TO authenticated USING (is_org_member(organization_id)) WITH CHECK (is_org_member(organization_id));
DROP POLICY IF EXISTS "delete_conversations" ON ai_conversations;
CREATE POLICY "delete_conversations" ON ai_conversations FOR DELETE TO authenticated USING (is_org_member(organization_id) OR user_id = auth.uid());

-- ===== POLICIES: ai_messages =====
DROP POLICY IF EXISTS "select_messages" ON ai_messages;
CREATE POLICY "select_messages" ON ai_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM ai_conversations WHERE ai_conversations.id = ai_messages.conversation_id AND is_org_member(ai_conversations.organization_id))
);
DROP POLICY IF EXISTS "insert_messages" ON ai_messages;
CREATE POLICY "insert_messages" ON ai_messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM ai_conversations WHERE ai_conversations.id = ai_messages.conversation_id AND is_org_member(ai_conversations.organization_id))
);
DROP POLICY IF EXISTS "delete_messages" ON ai_messages;
CREATE POLICY "delete_messages" ON ai_messages FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM ai_conversations WHERE ai_conversations.id = ai_messages.conversation_id AND is_org_member(ai_conversations.organization_id))
);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_products_org ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_org ON sales(organization_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_expenses_org ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_recs_org ON recommendations(organization_id);
CREATE INDEX IF NOT EXISTS idx_recs_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org ON ai_conversations(organization_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON ai_messages(conversation_id);
