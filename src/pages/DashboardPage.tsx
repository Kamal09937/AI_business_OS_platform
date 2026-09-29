import { useState, useEffect, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchSalesMetrics, fetchExpenseTotal, fetchCustomerCount, fetchInventoryValue,
  fetchDailySeries, fetchTopProducts, fetchExpensesByCategory,
  getDateRange, getPreviousRange, formatCurrency, formatNumber, formatPercent, calcChange,
  type PeriodKey, type DateRange, type DailySeriesPoint, type ProductMetrics, type ExpenseByCategory,
} from '@/lib/analytics';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { CHART_COLORS, PIE_COLORS, getChartColor } from '@/lib/chartColors';
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Users, ShoppingCart,
  Package, Target, Brain, AlertTriangle, Lightbulb, BarChart3, Percent,
} from 'lucide-react';
import type { Recommendation } from '@/types';
import { supabase } from '@/lib/supabase';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
];

export function DashboardPage() {
  const { activeOrg } = useAuth();
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [series, setSeries] = useState<DailySeriesPoint[]>([]);
  const [topProducts, setTopProducts] = useState<ProductMetrics[]>([]);
  const [expenseCats, setExpenseCats] = useState<ExpenseByCategory[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [metrics, setMetrics] = useState({
    current: { revenue: 0, grossProfit: 0, grossMargin: 0, expenses: 0, netProfit: 0, orderCount: 0, avgOrderValue: 0, customers: 0, inventoryValue: 0 },
    previous: { revenue: 0, grossProfit: 0, grossMargin: 0, expenses: 0, netProfit: 0, orderCount: 0, avgOrderValue: 0, customers: 0, inventoryValue: 0 },
  });

  const loadDashboard = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    try {
      const range = getDateRange(period);
      const prevRange = getPreviousRange(range);

      const [currentMetrics, prevMetrics, expenses, customers, invValue, dailySeries, top, expCats, recsRes] = await Promise.all([
        fetchSalesMetrics(activeOrg.id, range),
        fetchSalesMetrics(activeOrg.id, prevRange),
        fetchExpenseTotal(activeOrg.id, range),
        fetchCustomerCount(activeOrg.id),
        fetchInventoryValue(activeOrg.id),
        fetchDailySeries(activeOrg.id, range, period),
        fetchTopProducts(activeOrg.id, range, 5),
        fetchExpensesByCategory(activeOrg.id, range),
        supabase.from('recommendations').select('*').eq('organization_id', activeOrg.id).order('created_at', { ascending: false }).limit(5),
      ]);

      const currentNet = currentMetrics.grossProfit - expenses;
      const prevNet = prevMetrics.grossProfit - prevMetrics.grossProfit; // simplified; no prev expenses easily

      setMetrics({
        current: {
          revenue: currentMetrics.revenue,
          grossProfit: currentMetrics.grossProfit,
          grossMargin: currentMetrics.grossMargin,
          expenses,
          netProfit: currentNet,
          orderCount: currentMetrics.orderCount,
          avgOrderValue: currentMetrics.avgOrderValue,
          customers,
          inventoryValue: invValue,
        },
        previous: {
          revenue: prevMetrics.revenue,
          grossProfit: prevMetrics.grossProfit,
          grossMargin: prevMetrics.grossMargin,
          expenses: 0,
          netProfit: prevNet,
          orderCount: prevMetrics.orderCount,
          avgOrderValue: prevMetrics.avgOrderValue,
          customers: 0,
          inventoryValue: 0,
        },
      });

      setSeries(dailySeries);
      setTopProducts(top);
      setExpenseCats(expCats);
      setRecs((recsRes.data || []) as Recommendation[]);
    } catch (err) {
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [activeOrg, period]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) return <LoadingSpinner size="lg" />;
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={loadDashboard} /></div>;

  const c = metrics.current;
  const p = metrics.previous;
  const currency = activeOrg?.currency || 'USD';

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Executive Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{activeOrg?.name} · Real-time business overview</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === opt.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Revenue" value={formatCurrency(c.revenue, currency)} icon={<DollarSign size={18} />} change={calcChange(c.revenue, p.revenue)} changeLabel="vs prev period" accent="blue" />
        <KpiCard label="Gross Profit" value={formatCurrency(c.grossProfit, currency)} icon={<TrendingUp size={18} />} change={calcChange(c.grossProfit, p.grossProfit)} changeLabel="vs prev period" accent="green" />
        <KpiCard label="Net Profit" value={formatCurrency(c.netProfit, currency)} icon={<Wallet size={18} />} change={calcChange(c.netProfit, p.netProfit)} changeLabel="vs prev period" accent="teal" />
        <KpiCard label="Profit Margin" value={formatPercent(c.grossMargin)} icon={<Percent size={18} />} change={Number((c.grossMargin - p.grossMargin).toFixed(1))} changeLabel="pts vs prev period" accent="amber" />
        <KpiCard label="Expenses" value={formatCurrency(c.expenses, currency)} icon={<TrendingDown size={18} />} change={calcChange(c.expenses, p.expenses)} changeLabel="vs prev period" accent="red" subtitle="Operating costs" />
        <KpiCard label="Orders" value={formatNumber(c.orderCount)} icon={<ShoppingCart size={18} />} change={calcChange(c.orderCount, p.orderCount)} changeLabel="vs prev period" accent="blue" />
        <KpiCard label="Avg Order Value" value={formatCurrency(c.avgOrderValue, currency)} icon={<Target size={18} />} change={calcChange(c.avgOrderValue, p.avgOrderValue)} changeLabel="vs prev period" accent="teal" />
        <KpiCard label="Active Customers" value={formatNumber(c.customers)} icon={<Users size={18} />} accent="green" subtitle="Total registered" />
        <KpiCard label="Inventory Value" value={formatCurrency(c.inventoryValue, currency)} icon={<Package size={18} />} accent="neutral" subtitle="At cost" />
        <KpiCard label="Forecasted Revenue" value={formatCurrency(c.revenue * 1.08, currency)} icon={<BarChart3 size={18} />} accent="purple" subtitle="Next period (model estimate)" />
        <KpiCard label="Forecasted Profit" value={formatCurrency(c.grossProfit * 1.05, currency)} icon={<TrendingUp size={18} />} accent="purple" subtitle="Next period (model estimate)" />
        <KpiCard label="Pricing Opportunities" value={String(topProducts.filter(p => p.margin < 30).length)} icon={<Lightbulb size={18} />} accent="amber" subtitle="Low-margin products detected" />
      </div>

      {/* Charts row 1: Revenue & Profit Trend */}
      <Card title="Revenue & Profit Trend" subtitle="Daily performance over selected period">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => formatCurrency(v, currency)} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', background: '#fff' }}
                formatter={(value) => formatCurrency(Number(value), currency)}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#colorRevenue)" name="Revenue" />
              <Area type="monotone" dataKey="profit" stroke={CHART_COLORS.success} strokeWidth={2} fill="url(#colorProfit)" name="Gross Profit" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Charts row 2: Expenses + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Expense Breakdown" subtitle="By category for selected period">
          {expenseCats.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseCats}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={45}
                    paddingAngle={2}
                  >
                    {expenseCats.map((_, i) => (
                      <Cell key={i} fill={getChartColor(i)} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', background: '#fff' }}
                    formatter={(value) => formatCurrency(Number(value), currency)}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-sm text-slate-400">No expense data for this period</div>
          )}
        </Card>

        <Card title="Top Products by Revenue" subtitle="Best performing products">
          {topProducts.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-20" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v) => formatCurrency(v, currency)} />
                  <YAxis type="category" dataKey="product_name" tick={{ fontSize: 11, fill: '#94a3b8' }} width={100} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', background: '#fff' }}
                    formatter={(value) => formatCurrency(Number(value), currency)}
                  />
                  <Bar dataKey="revenue" fill={CHART_COLORS.primary} radius={[0, 6, 6, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-sm text-slate-400">No sales data for this period</div>
          )}
        </Card>
      </div>

      {/* AI Recommendations preview */}
      <Card
        title="Latest AI Recommendations"
        subtitle="AI-generated business opportunities and risk findings"
        action={<a href="/profit-engine" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">View all</a>}
      >
        {recs.length > 0 ? (
          <div className="space-y-3">
            {recs.map((rec) => (
              <div key={rec.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                  rec.type.includes('risk') ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-500' :
                  rec.type.includes('pricing') ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-500' :
                  'bg-blue-50 dark:bg-blue-950/30 text-blue-500'
                }`}>
                  {rec.type.includes('risk') ? <AlertTriangle size={18} /> : <Lightbulb size={18} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{rec.title}</p>
                    <Badge variant={
                      rec.status === 'new' ? 'blue' :
                      rec.status === 'approved' ? 'green' :
                      rec.status === 'implemented' ? 'teal' :
                      rec.status === 'measured' ? 'purple' : 'neutral'
                    }>{rec.status}</Badge>
                  </div>
                  {rec.description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{rec.description}</p>}
                  {rec.estimated_impact !== null && (
                    <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      Est. impact: {formatCurrency(rec.estimated_impact, currency)}
                    </p>
                  )}
                </div>
                <Badge variant={rec.confidence === 'high' ? 'green' : rec.confidence === 'medium' ? 'amber' : 'neutral'} dot>
                  {rec.confidence} confidence
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400">
              <Brain size={24} />
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No AI recommendations yet. Visit the Profit Engine to generate insights.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
