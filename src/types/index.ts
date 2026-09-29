export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface Organization {
  id: string;
  name: string;
  industry: string;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Branch {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  organization_id: string;
  branch_id: string | null;
  name: string;
  sku: string | null;
  category: string | null;
  unit_cost: number;
  selling_price: number;
  stock_quantity: number;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  organization_id: string;
  branch_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  segment: string;
  status: 'active' | 'inactive' | 'churned' | 'lead';
  lifetime_value: number;
  total_orders: number;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  organization_id: string;
  branch_id: string | null;
  product_id: string | null;
  customer_id: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  sale_date: string;
  channel: string;
  created_at: string;
}

export interface Expense {
  id: string;
  organization_id: string;
  branch_id: string | null;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
  is_recurring: boolean;
  created_at: string;
}

export type RecommendationStatus = 'new' | 'reviewing' | 'approved' | 'implemented' | 'measured';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface Recommendation {
  id: string;
  organization_id: string;
  type: string;
  title: string;
  description: string | null;
  finding: string | null;
  supporting_data: Record<string, unknown> | null;
  reasoning: string | null;
  assumptions: string | null;
  confidence: ConfidenceLevel;
  estimated_impact: number | null;
  estimated_impact_description: string | null;
  recommended_action: string | null;
  time_period: string | null;
  status: RecommendationStatus;
  actual_result: number | null;
  actual_result_description: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  organization_id: string;
  recommendation_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  organization_id: string;
  category: string;
  title: string;
  description: string | null;
  severity: 'info' | 'warning' | 'critical';
  metric: string | null;
  threshold_value: number | null;
  actual_value: number | null;
  is_read: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AIConversation {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface DashboardKPIs {
  revenue: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  expenses: number;
  customers: number;
  orders: number;
  avgOrderValue: number;
  inventoryValue: number;
  salesConversion: number;
  forecastedRevenue: number;
  forecastedProfit: number;
}

export interface TimeSeriesPoint {
  date: string;
  value: number;
  label?: string;
}
