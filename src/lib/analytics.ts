import { supabase } from '@/lib/supabase';

export type PeriodKey = 'today' | '7d' | '30d' | '3m' | '6m' | '1y' | 'custom';

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

export function getDateRange(period: PeriodKey, customStart?: Date, customEnd?: Date): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'today':
      return { start, end, label: 'Today' };
    case '7d':
      start.setDate(start.getDate() - 6);
      return { start, end, label: 'Last 7 Days' };
    case '30d':
      start.setDate(start.getDate() - 29);
      return { start, end, label: 'Last 30 Days' };
    case '3m':
      start.setMonth(start.getMonth() - 3);
      return { start, end, label: 'Last 3 Months' };
    case '6m':
      start.setMonth(start.getMonth() - 6);
      return { start, end, label: 'Last 6 Months' };
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      return { start, end, label: 'Last 12 Months' };
    case 'custom':
      return {
        start: customStart || start,
        end: customEnd || end,
        label: 'Custom Range',
      };
  }
}

export function getPreviousRange(range: DateRange): DateRange {
  const diff = range.end.getTime() - range.start.getTime();
  const prevEnd = new Date(range.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);
  return { start: prevStart, end: prevEnd, label: `Previous ${range.label}` };
}

export function formatCurrency(value: number, currency = 'USD'): string {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', INR: '₹' };
  const symbol = symbols[currency] || '$';
  if (Math.abs(value) >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${symbol}${(value / 1_000).toFixed(1)}K`;
  return `${symbol}${value.toFixed(0)}`;
}

export function formatNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

interface RawSaleRow {
  total_revenue: number;
  total_cost: number;
  gross_profit: number;
  sale_date: string;
  quantity: number;
}

export interface AggregatedMetrics {
  revenue: number;
  cost: number;
  grossProfit: number;
  grossMargin: number;
  orderCount: number;
  totalUnits: number;
  avgOrderValue: number;
}

export async function fetchSalesMetrics(
  orgId: string,
  range: DateRange
): Promise<AggregatedMetrics> {
  const { data, error } = await supabase
    .from('sales')
    .select('total_revenue, total_cost, gross_profit, sale_date, quantity')
    .eq('organization_id', orgId)
    .gte('sale_date', range.start.toISOString())
    .lte('sale_date', range.end.toISOString());

  if (error || !data) {
    return { revenue: 0, cost: 0, grossProfit: 0, grossMargin: 0, orderCount: 0, totalUnits: 0, avgOrderValue: 0 };
  }

  const rows = data as RawSaleRow[];
  const revenue = rows.reduce((s, r) => s + Number(r.total_revenue), 0);
  const cost = rows.reduce((s, r) => s + Number(r.total_cost), 0);
  const grossProfit = rows.reduce((s, r) => s + Number(r.gross_profit), 0);
  const orderCount = rows.length;
  const totalUnits = rows.reduce((s, r) => s + r.quantity, 0);

  return {
    revenue,
    cost,
    grossProfit,
    grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    orderCount,
    totalUnits,
    avgOrderValue: orderCount > 0 ? revenue / orderCount : 0,
  };
}

export async function fetchExpenseTotal(orgId: string, range: DateRange): Promise<number> {
  const { data, error } = await supabase
    .from('expenses')
    .select('amount')
    .eq('organization_id', orgId)
    .gte('expense_date', range.start.toISOString())
    .lte('expense_date', range.end.toISOString());

  if (error || !data) return 0;
  return data.reduce((s, r) => s + Number(r.amount), 0);
}

export async function fetchCustomerCount(orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (error) return 0;
  return count || 0;
}

export async function fetchInventoryValue(orgId: string): Promise<number> {
  const { data, error } = await supabase
    .from('products')
    .select('unit_cost, stock_quantity')
    .eq('organization_id', orgId)
    .eq('is_active', true);

  if (error || !data) return 0;
  return data.reduce((s, r) => s + Number(r.unit_cost) * Number(r.stock_quantity), 0);
}

export interface DailySeriesPoint {
  date: string;
  label: string;
  revenue: number;
  profit: number;
  expenses: number;
}

export async function fetchDailySeries(
  orgId: string,
  range: DateRange,
  period: PeriodKey
): Promise<DailySeriesPoint[]> {
  const salesPromise = supabase
    .from('sales')
    .select('total_revenue, gross_profit, sale_date')
    .eq('organization_id', orgId)
    .gte('sale_date', range.start.toISOString())
    .lte('sale_date', range.end.toISOString());

  const expensesPromise = supabase
    .from('expenses')
    .select('amount, expense_date')
    .eq('organization_id', orgId)
    .gte('expense_date', range.start.toISOString())
    .lte('expense_date', range.end.toISOString());

  const [salesRes, expensesRes] = await Promise.all([salesPromise, expensesPromise]);

  const interval = period === 'today' || period === '7d' ? 'day' : period === '30d' ? 'day' : 'month';
  const buckets = buildDateBuckets(range.start, range.end, interval);

  const salesData = (salesRes.data || []) as { total_revenue: number; gross_profit: number; sale_date: string }[];
  const expenseData = (expensesRes.data || []) as { amount: number; expense_date: string }[];

  for (const b of buckets) {
    const dayStart = new Date(b.date + 'T00:00:00');
    const dayEnd = new Date(b.date + 'T23:59:59.999');

    if (interval === 'month') {
      dayStart.setDate(1);
      dayStart.setHours(0, 0, 0, 0);
      dayEnd.setMonth(dayEnd.getMonth() + 1);
      dayEnd.setDate(0);
      dayEnd.setHours(23, 59, 59, 999);
    }

    const sStart = dayStart.getTime();
    const sEnd = dayEnd.getTime();

    const daySales = salesData.filter((s) => {
      const t = new Date(s.sale_date).getTime();
      return t >= sStart && t <= sEnd;
    });
    b.revenue = daySales.reduce((sum, s) => sum + Number(s.total_revenue), 0);
    b.profit = daySales.reduce((sum, s) => sum + Number(s.gross_profit), 0);

    const dayExpenses = expenseData.filter((e) => {
      const t = new Date(e.expense_date).getTime();
      return t >= sStart && t <= sEnd;
    });
    b.expenses = dayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }

  return buckets;
}

function buildDateBuckets(start: Date, end: Date, interval: 'day' | 'month'): DailySeriesPoint[] {
  const buckets: DailySeriesPoint[] = [];
  if (interval === 'day') {
    const cur = new Date(start);
    cur.setHours(0, 0, 0, 0);
    while (cur <= end) {
      const dateStr = cur.toISOString().split('T')[0];
      buckets.push({
        date: dateStr,
        label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        revenue: 0,
        profit: 0,
        expenses: 0,
      });
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    const cur = new Date(start);
    cur.setDate(1);
    cur.setHours(0, 0, 0, 0);
    while (cur <= end) {
      const dateStr = cur.toISOString().split('T')[0];
      buckets.push({
        date: dateStr,
        label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        revenue: 0,
        profit: 0,
        expenses: 0,
      });
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return buckets;
}

export interface ProductMetrics {
  product_id: string;
  product_name: string;
  revenue: number;
  profit: number;
  margin: number;
  units_sold: number;
}

export async function fetchTopProducts(
  orgId: string,
  range: DateRange,
  limit = 5
): Promise<ProductMetrics[]> {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      total_revenue, gross_profit, quantity, product_id,
      products!inner(name)
    `)
    .eq('organization_id', orgId)
    .gte('sale_date', range.start.toISOString())
    .lte('sale_date', range.end.toISOString());

  if (error || !data) return [];

  const rows = data as unknown as {
    total_revenue: number; gross_profit: number; quantity: number;
    product_id: string; products: { name: string };
  }[];

  const map = new Map<string, ProductMetrics>();
  for (const r of rows) {
    if (!r.product_id) continue;
    const existing = map.get(r.product_id);
    if (existing) {
      existing.revenue += Number(r.total_revenue);
      existing.profit += Number(r.gross_profit);
      existing.units_sold += r.quantity;
    } else {
      map.set(r.product_id, {
        product_id: r.product_id,
        product_name: r.products?.name || 'Unknown',
        revenue: Number(r.total_revenue),
        profit: Number(r.gross_profit),
        margin: 0,
        units_sold: r.quantity,
      });
    }
  }

  const products = Array.from(map.values());
  for (const p of products) {
    p.margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
  }

  return products.sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export interface ExpenseByCategory {
  category: string;
  amount: number;
}

export async function fetchExpensesByCategory(
  orgId: string,
  range: DateRange
): Promise<ExpenseByCategory[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('category, amount')
    .eq('organization_id', orgId)
    .gte('expense_date', range.start.toISOString())
    .lte('expense_date', range.end.toISOString());

  if (error || !data) return [];

  const map = new Map<string, number>();
  for (const r of data as { category: string; amount: number }[]) {
    map.set(r.category, (map.get(r.category) || 0) + Number(r.amount));
  }

  return Array.from(map.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}
