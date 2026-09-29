import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Recommendation, RecommendationStatus, Product, Sale } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Textarea, Select } from '@/components/ui/Form';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatCurrency } from '@/lib/analytics';
import {
  TrendingUp, Sparkles, AlertTriangle, Lightbulb, Tag, Package,
  CheckCircle, ArrowRight, Eye, BarChart3,
} from 'lucide-react';

const STATUS_FLOW: RecommendationStatus[] = ['new', 'reviewing', 'approved', 'implemented', 'measured'];
const STATUS_VARIANT: Record<RecommendationStatus, 'blue' | 'amber' | 'green' | 'teal' | 'purple'> = {
  new: 'blue', reviewing: 'amber', approved: 'green', implemented: 'teal', measured: 'purple',
};

export function ProfitEnginePage() {
  const { activeOrg } = useAuth();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detailRec, setDetailRec] = useState<Recommendation | null>(null);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('recommendations')
      .select('*')
      .eq('organization_id', activeOrg.id)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setRecs((data || []) as Recommendation[]);
    setLoading(false);
  }, [activeOrg]);

  useEffect(() => { load(); }, [load]);

  // AI analysis: scan products and sales for profit opportunities
  const runAnalysis = async () => {
    if (!activeOrg) return;
    setAnalyzing(true);
    try {
      const [productsRes, salesRes, expensesRes] = await Promise.all([
        supabase.from('products').select('*').eq('organization_id', activeOrg.id).eq('is_active', true),
        supabase.from('sales').select('product_id, total_revenue, gross_profit, quantity, sale_date').eq('organization_id', activeOrg.id).gte('sale_date', new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from('expenses').select('category, amount').eq('organization_id', activeOrg.id).gte('expense_date', new Date(Date.now() - 30 * 86400000).toISOString()),
      ]);

      const products = (productsRes.data || []) as Product[];
      const sales = (salesRes.data || []) as { product_id: string; total_revenue: number; gross_profit: number; quantity: number; sale_date: string }[];
      const expenses = (expensesRes.data || []) as { category: string; amount: number }[];
      const newRecs: Partial<Recommendation>[] = [];

      // 1. Low-margin products
      for (const p of products) {
        if (p.selling_price <= 0) continue;
        const margin = ((p.selling_price - p.unit_cost) / p.selling_price) * 100;
        if (margin < 20) {
          const suggestedPrice = p.unit_cost * 1.4;
          newRecs.push({
            organization_id: activeOrg.id,
            type: 'pricing_low_margin',
            title: `Low margin detected: ${p.name}`,
            description: `${p.name} has a gross margin of ${margin.toFixed(1)}%, below the 20% healthy threshold. Current price ${formatCurrency(p.selling_price, activeOrg.currency)} may be too low relative to cost ${formatCurrency(p.unit_cost, activeOrg.currency)}.`,
            finding: `Gross margin ${margin.toFixed(1)}% is below recommended 20% minimum.`,
            supporting_data: { current_price: p.selling_price, unit_cost: p.unit_cost, margin, suggested_price: suggestedPrice },
            reasoning: `The product's selling price does not provide sufficient margin over its cost. Increasing the price or reducing the cost would improve profitability.`,
            assumptions: 'Assumes demand remains relatively stable at the suggested price point. Price elasticity not yet estimated due to limited historical data.',
            confidence: margin < 10 ? 'high' : 'medium',
            estimated_impact: (suggestedPrice - p.selling_price) * 100,
            estimated_impact_description: `Estimated +${formatCurrency((suggestedPrice - p.selling_price) * 100, activeOrg.currency)} per 100 units sold at suggested price of ${formatCurrency(suggestedPrice, activeOrg.currency)}.`,
            recommended_action: `Consider increasing price to ${formatCurrency(suggestedPrice, activeOrg.currency)} (40% margin) or negotiating lower supplier costs. Test with a small price change first.`,
            time_period: 'Last 30 days',
            status: 'new',
            related_entity_type: 'product',
            related_entity_id: p.id,
          });
        }
      }

      // 2. Low stock / reorder needed
      for (const p of products) {
        if (p.stock_quantity <= p.reorder_level && p.stock_quantity > 0) {
          newRecs.push({
            organization_id: activeOrg.id,
            type: 'inventory_reorder',
            title: `Reorder needed: ${p.name}`,
            description: `${p.name} has ${p.stock_quantity} units in stock, at or below the reorder level of ${p.reorder_level}. Risk of stockout if not replenished soon.`,
            finding: `Stock level ${p.stock_quantity} units is at/below reorder threshold ${p.reorder_level}.`,
            supporting_data: { stock_quantity: p.stock_quantity, reorder_level: p.reorder_level },
            reasoning: 'At current stock levels, the product may run out before the next replenishment cycle, leading to lost sales.',
            assumptions: 'Assumes current sales velocity continues. Does not account for seasonal demand spikes.',
            confidence: 'high',
            estimated_impact: null,
            estimated_impact_description: 'Prevents potential lost revenue from stockout events.',
            recommended_action: `Place a purchase order for ${p.name} to replenish stock above the reorder level.`,
            time_period: 'Current',
            status: 'new',
            related_entity_type: 'product',
            related_entity_id: p.id,
          });
        }
      }

      // 3. Dead stock (zero sales in 30 days with stock > 0)
      const soldProductIds = new Set(sales.filter(s => s.product_id).map(s => s.product_id!));
      for (const p of products) {
        if (p.stock_quantity > 0 && !soldProductIds.has(p.id)) {
          newRecs.push({
            organization_id: activeOrg.id,
            type: 'inventory_dead_stock',
            title: `Dead stock detected: ${p.name}`,
            description: `${p.name} has ${p.stock_quantity} units in stock (value: ${formatCurrency(p.stock_quantity * p.unit_cost, activeOrg.currency)}) but zero sales in the last 30 days. This capital is tied up in non-moving inventory.`,
            finding: `Zero sales in 30 days with ${p.stock_quantity} units in stock.`,
            supporting_data: { stock_quantity: p.stock_quantity, stock_value: p.stock_quantity * p.unit_cost, days_without_sales: 30 },
            reasoning: 'Inventory that does not sell ties up working capital and may eventually require write-downs.',
            assumptions: 'Assumes the product was available for sale during the period. Does not account for seasonal factors.',
            confidence: 'medium',
            estimated_impact: -(p.stock_quantity * p.unit_cost * 0.1),
            estimated_impact_description: `Estimated carrying cost: ${formatCurrency(p.stock_quantity * p.unit_cost * 0.1, activeOrg.currency)}/year (10% of stock value).`,
            recommended_action: 'Consider discounting, bundling, or liquidating dead stock to free up working capital.',
            time_period: 'Last 30 days',
            status: 'new',
            related_entity_type: 'product',
            related_entity_id: p.id,
          });
        }
      }

      // 4. High expense category
      const expByCat = new Map<string, number>();
      for (const e of expenses) {
        expByCat.set(e.category, (expByCat.get(e.category) || 0) + Number(e.amount));
      }
      const totalExp = Array.from(expByCat.values()).reduce((a, b) => a + b, 0);
      for (const [cat, amt] of expByCat) {
        if (totalExp > 0 && amt / totalExp > 0.3) {
          newRecs.push({
            organization_id: activeOrg.id,
            type: 'expense_concentration',
            title: `High expense concentration: ${cat}`,
            description: `${cat} represents ${((amt / totalExp) * 100).toFixed(0)}% of total expenses (${formatCurrency(amt, activeOrg.currency)} of ${formatCurrency(totalExp, activeOrg.currency)}). This concentration warrants review for potential cost optimization.`,
            finding: `${cat} is ${((amt / totalExp) * 100).toFixed(0)}% of total expenses.`,
            supporting_data: { category: cat, amount: amt, total_expenses: totalExp, percentage: (amt / totalExp) * 100 },
            reasoning: 'When a single expense category dominates, it is the most impactful target for cost reduction.',
            assumptions: 'Expense categorization is accurate. Does not account for mandatory vs discretionary spending.',
            confidence: 'medium',
            estimated_impact: amt * 0.1,
            estimated_impact_description: `A 10% reduction in ${cat} would save ${formatCurrency(amt * 0.1, activeOrg.currency)}/month.`,
            recommended_action: `Review ${cat} expenses for negotiable contracts, unnecessary services, or alternative suppliers.`,
            time_period: 'Last 30 days',
            status: 'new',
          });
        }
      }

      // 5. Top performer insight
      const productPerf = new Map<string, { revenue: number; profit: number; qty: number }>();
      for (const s of sales) {
        if (!s.product_id) continue;
        const ex = productPerf.get(s.product_id);
        if (ex) { ex.revenue += Number(s.total_revenue); ex.profit += Number(s.gross_profit); ex.qty += s.quantity; }
        else productPerf.set(s.product_id, { revenue: Number(s.total_revenue), profit: Number(s.gross_profit), qty: s.quantity });
      }
      const topPerf = Array.from(productPerf.entries()).sort(([,a],[,b]) => b.profit - a.profit)[0];
      if (topPerf) {
        const prod = products.find(p => p.id === topPerf[0]);
        if (prod) {
          newRecs.push({
            organization_id: activeOrg.id,
            type: 'profit_top_performer',
            title: `Top profit performer: ${prod.name}`,
            description: `${prod.name} generated ${formatCurrency(topPerf[1].profit, activeOrg.currency)} in gross profit over the last 30 days (${topPerf[1].qty} units sold). Consider investing in marketing or inventory for this product to scale its success.`,
            finding: `Highest profit contributor with ${formatCurrency(topPerf[1].profit, activeOrg.currency)} in profit.`,
            supporting_data: { revenue: topPerf[1].revenue, profit: topPerf[1].profit, units: topPerf[1].qty, margin: topPerf[1].revenue > 0 ? (topPerf[1].profit / topPerf[1].revenue) * 100 : 0 },
            reasoning: 'Products with high profit contribution are the best candidates for increased investment to drive overall profitability.',
            assumptions: 'Historical performance is indicative of future demand at similar or higher volumes.',
            confidence: 'high',
            estimated_impact: topPerf[1].profit * 0.2,
            estimated_impact_description: `Estimated +20% profit growth potential: ${formatCurrency(topPerf[1].profit * 0.2, activeOrg.currency)} additional monthly profit.`,
            recommended_action: `Allocate additional marketing budget or ensure adequate stock levels for ${prod.name}.`,
            time_period: 'Last 30 days',
            status: 'new',
            related_entity_type: 'product',
            related_entity_id: prod.id,
          });
        }
      }

      if (newRecs.length > 0) {
        await supabase.from('recommendations').insert(newRecs);
      }
      await load();
    } catch (err) {
      setError('Analysis failed. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const updateStatus = async (rec: Recommendation, newStatus: RecommendationStatus) => {
    await supabase.from('recommendations').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', rec.id);
    setDetailRec(null);
    load();
  };

  const currency = activeOrg?.currency || 'USD';
  const stats = {
    total: recs.length,
    new: recs.filter(r => r.status === 'new').length,
    approved: recs.filter(r => r.status === 'approved').length,
    implemented: recs.filter(r => r.status === 'implemented').length,
    measured: recs.filter(r => r.status === 'measured').length,
    totalImpact: recs.filter(r => r.estimated_impact).reduce((s, r) => s + (r.estimated_impact || 0), 0),
  };

  const typeIcon = (type: string) => {
    if (type.includes('risk') || type.includes('dead')) return AlertTriangle;
    if (type.includes('pricing')) return Tag;
    if (type.includes('inventory')) return Package;
    if (type.includes('top')) return TrendingUp;
    return Lightbulb;
  };

  const columns: Column<Recommendation>[] = [
    {
      key: 'title', label: 'Opportunity', sortable: true, sortValue: (r) => r.title,
      render: (r) => {
        const Icon = typeIcon(r.type);
        return (
          <div className="flex items-start gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${
              r.type.includes('risk') || r.type.includes('dead') ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-500' :
              r.type.includes('top') ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500' :
              'bg-blue-50 dark:bg-blue-950/30 text-blue-500'
            }`}><Icon size={16} /></div>
            <div className="min-w-0"><p className="font-medium text-slate-900 dark:text-white">{r.title}</p><p className="text-xs text-slate-400 mt-0.5">{r.type.replace(/_/g, ' ')}</p></div>
          </div>
        );
      },
    },
    { key: 'confidence', label: 'Confidence', sortable: true, sortValue: (r) => r.confidence, render: (r) => <Badge variant={r.confidence === 'high' ? 'green' : r.confidence === 'medium' ? 'amber' : 'neutral'} dot>{r.confidence}</Badge> },
    { key: 'estimated_impact', label: 'Est. Impact', sortable: true, sortValue: (r) => r.estimated_impact || 0, align: 'right', render: (r) => r.estimated_impact !== null ? <span className={r.estimated_impact >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-rose-600 dark:text-rose-400 font-medium'}>{formatCurrency(r.estimated_impact, currency)}</span> : <span className="text-slate-400">—</span> },
    { key: 'status', label: 'Status', sortable: true, sortValue: (r) => r.status, render: (r) => <Badge variant={STATUS_VARIANT[r.status]} dot>{r.status}</Badge> },
    { key: 'action', label: '', align: 'right', render: (r) => <button onClick={(e) => { e.stopPropagation(); setDetailRec(r); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"><Eye size={15} /></button> },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">AI Profit Engine</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Detect profit opportunities, track from discovery to measured result</p>
        </div>
        <Button icon={<Sparkles size={16} />} onClick={runAnalysis} loading={analyzing}>
          {analyzing ? 'Analyzing...' : 'Run AI Analysis'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><div><p className="text-xs text-slate-400">Total</p><p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{stats.total}</p></div></Card>
        <Card><div><p className="text-xs text-slate-400">New</p><p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">{stats.new}</p></div></Card>
        <Card><div><p className="text-xs text-slate-400">Approved</p><p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.approved}</p></div></Card>
        <Card><div><p className="text-xs text-slate-400">Implemented</p><p className="text-xl font-bold text-teal-600 dark:text-teal-400 mt-1">{stats.implemented}</p></div></Card>
        <Card><div><p className="text-xs text-slate-400">Measured</p><p className="text-xl font-bold text-violet-600 dark:text-violet-400 mt-1">{stats.measured}</p></div></Card>
        <Card><div><p className="text-xs text-slate-400">Total Est. Impact</p><p className={`text-xl font-bold mt-1 ${stats.totalImpact >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatCurrency(stats.totalImpact, currency)}</p></div></Card>
      </div>

      {loading ? <LoadingSpinner size="lg" /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       recs.length === 0 ? (
         <Card><EmptyState icon={TrendingUp} title="No opportunities detected yet" description="Run the AI analysis to scan your products, sales, and expenses for profit opportunities, pricing issues, and cost optimizations." action={<Button icon={<Sparkles size={16} />} onClick={runAnalysis} loading={analyzing}>Run AI Analysis</Button>} /></Card>
       ) : (
         <DataTable columns={columns} data={recs} rowKey={(r) => r.id} onRowClick={(r) => setDetailRec(r)} />
       )}

      {/* Detail Modal */}
      <Modal
        open={!!detailRec} onClose={() => setDetailRec(null)}
        title={detailRec?.title || ''}
        subtitle={detailRec ? `Type: ${detailRec.type.replace(/_/g, ' ')} · ${detailRec.time_period || ''}` : ''}
        size="lg"
        footer={
          detailRec && (
            <div className="flex items-center gap-2">
              {STATUS_FLOW.map((s, i) => {
                const currentIdx = STATUS_FLOW.indexOf(detailRec.status);
                return (
                  <Button
                    key={s}
                    variant={s === detailRec.status ? 'primary' : i < currentIdx ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => updateStatus(detailRec, s)}
                  >
                    {s}
                  </Button>
                );
              })}
            </div>
          )
        }
      >
        {detailRec && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[detailRec.status]} dot>{detailRec.status}</Badge>
              <Badge variant={detailRec.confidence === 'high' ? 'green' : detailRec.confidence === 'medium' ? 'amber' : 'neutral'} dot>{detailRec.confidence} confidence</Badge>
              {detailRec.estimated_impact !== null && (
                <Badge variant={detailRec.estimated_impact >= 0 ? 'green' : 'red'}>
                  Est. Impact: {formatCurrency(detailRec.estimated_impact, currency)}
                </Badge>
              )}
            </div>

            {detailRec.description && <div><p className="text-xs font-semibold uppercase text-slate-400 mb-1">Description</p><p className="text-sm text-slate-700 dark:text-slate-300">{detailRec.description}</p></div>}
            {detailRec.finding && <div><p className="text-xs font-semibold uppercase text-slate-400 mb-1">Finding</p><p className="text-sm text-slate-700 dark:text-slate-300">{detailRec.finding}</p></div>}
            {detailRec.reasoning && <div><p className="text-xs font-semibold uppercase text-slate-400 mb-1">Reasoning</p><p className="text-sm text-slate-700 dark:text-slate-300">{detailRec.reasoning}</p></div>}
            {detailRec.assumptions && <div><p className="text-xs font-semibold uppercase text-slate-400 mb-1">Assumptions</p><p className="text-sm text-slate-700 dark:text-slate-300">{detailRec.assumptions}</p></div>}
            {detailRec.recommended_action && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-4">
                <p className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-400 mb-1">Recommended Action</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{detailRec.recommended_action}</p>
              </div>
            )}
            {detailRec.estimated_impact_description && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 p-4">
                <p className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-400 mb-1">Estimated Impact</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{detailRec.estimated_impact_description}</p>
              </div>
            )}
            {detailRec.supporting_data && Object.keys(detailRec.supporting_data).length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400 mb-2">Supporting Data</p>
                <div className="rounded-lg bg-slate-50 dark:bg-slate-800/50 p-3 space-y-1">
                  {Object.entries(detailRec.supporting_data).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-slate-500 dark:text-slate-400">{k.replace(/_/g, ' ')}</span>
                      <span className="font-medium text-slate-900 dark:text-white">{typeof v === 'number' ? (k.includes('price') || k.includes('cost') || k.includes('value') || k.includes('amount') || k.includes('revenue') || k.includes('profit') || k.includes('impact') ? formatCurrency(v, currency) : v.toFixed(2)) : String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
              Generated: {new Date(detailRec.created_at).toLocaleString()}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
