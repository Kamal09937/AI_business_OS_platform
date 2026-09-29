import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Product, Sale } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatCurrency, formatPercent } from '@/lib/analytics';
import { Tag, TrendingUp, AlertCircle, Sparkles, ArrowRight, Info, History } from 'lucide-react';

export function PricingPage() {
  const { activeOrg } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [salesByProduct, setSalesByProduct] = useState<Map<string, { revenue: number; profit: number; qty: number; margin: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simulateProduct, setSimulateProduct] = useState<Product | null>(null);
  const [simPrice, setSimPrice] = useState('');
  const [simQty, setSimQty] = useState('');

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    const [prodRes, salesRes] = await Promise.all([
      supabase.from('products').select('*').eq('organization_id', activeOrg.id).eq('is_active', true),
      supabase.from('sales').select('product_id, total_revenue, gross_profit, quantity').eq('organization_id', activeOrg.id).gte('sale_date', new Date(Date.now() - 90 * 86400000).toISOString()),
    ]);
    if (prodRes.error) { setError(prodRes.error.message); setLoading(false); return; }

    const prods = (prodRes.data || []) as Product[];
    setProducts(prods);

    const sales = (salesRes.data || []) as { product_id: string; total_revenue: number; gross_profit: number; quantity: number }[];
    const map = new Map<string, { revenue: number; profit: number; qty: number; margin: number }>();
    for (const s of sales) {
      if (!s.product_id) continue;
      const ex = map.get(s.product_id);
      if (ex) { ex.revenue += Number(s.total_revenue); ex.profit += Number(s.gross_profit); ex.qty += s.quantity; }
      else map.set(s.product_id, { revenue: Number(s.total_revenue), profit: Number(s.gross_profit), qty: s.quantity, margin: 0 });
    }
    for (const [, v] of map) v.margin = v.revenue > 0 ? (v.profit / v.revenue) * 100 : 0;
    setSalesByProduct(map);
    setLoading(false);
  }, [activeOrg]);

  useEffect(() => { load(); }, [load]);

  const currency = activeOrg?.currency || 'USD';

  const calcMargin = (p: Product) => p.selling_price > 0 ? ((p.selling_price - p.unit_cost) / p.selling_price) * 100 : 0;
  const calcGrossProfit = (p: Product) => p.selling_price - p.unit_cost;
  const suggestedPrice = (p: Product) => p.unit_cost > 0 ? p.unit_cost * 1.4 : p.selling_price * 1.1;

  const openSimulate = (p: Product) => {
    setSimulateProduct(p);
    setSimPrice(String(p.selling_price));
    const salesData = salesByProduct.get(p.id);
    setSimQty(String(salesData?.qty || 100));
  };

  // Simulation calculations
  const simPriceNum = parseFloat(simPrice) || 0;
  const simQtyNum = parseInt(simQty) || 0;
  const currentRevenue = simulateProduct ? simulateProduct.selling_price * simQtyNum : 0;
  const currentProfit = simulateProduct ? (simulateProduct.selling_price - simulateProduct.unit_cost) * simQtyNum : 0;
  const simRevenue = simPriceNum * simQtyNum;
  const simProfit = simulateProduct ? (simPriceNum - simulateProduct.unit_cost) * simQtyNum : 0;
  const revenueDelta = simRevenue - currentRevenue;
  const profitDelta = simProfit - currentProfit;
  const currentMargin = simulateProduct ? calcMargin(simulateProduct) : 0;
  const simMargin = simPriceNum > 0 && simulateProduct ? ((simPriceNum - simulateProduct.unit_cost) / simPriceNum) * 100 : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Pricing Intelligence</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">AI-powered pricing analysis, simulations, and recommendations</p>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 p-4">
        <Info size={18} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Pricing recommendations are <strong>AI-estimated opportunities</strong> based on cost structure and historical sales data. They are not guaranteed to maximize profit. When data is insufficient, recommendations will state this clearly.
        </p>
      </div>

      {loading ? <LoadingSpinner size="lg" /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       products.length === 0 ? (
         <Card><EmptyState icon={Tag} title="No products to analyze" description="Add products with cost and pricing data to unlock AI pricing recommendations, simulations, and margin analysis." /></Card>
       ) : (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {products.map((p) => {
            const margin = calcMargin(p);
            const gp = calcGrossProfit(p);
            const suggested = suggestedPrice(p);
            const salesData = salesByProduct.get(p.id);
            const hasSales = salesData && salesData.qty > 0;
            const priceChangePct = p.selling_price > 0 ? ((suggested - p.selling_price) / p.selling_price) * 100 : 0;

            return (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">{p.name}</h3>
                    {p.sku && <p className="text-xs text-slate-400 mt-0.5">SKU: {p.sku}</p>}
                  </div>
                  <Badge variant={margin < 20 ? 'red' : margin < 40 ? 'amber' : 'green'} dot>
                    {formatPercent(margin)} margin
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div><p className="text-xs text-slate-400">Unit Cost</p><p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(p.unit_cost, currency)}</p></div>
                  <div><p className="text-xs text-slate-400">Current Price</p><p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(p.selling_price, currency)}</p></div>
                  <div><p className="text-xs text-slate-400">Gross Profit</p><p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(gp, currency)}</p></div>
                </div>

                {hasSales && (
                  <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div><p className="text-xs text-slate-400">Units Sold (90d)</p><p className="text-sm font-semibold text-slate-900 dark:text-white">{salesData!.qty}</p></div>
                    <div><p className="text-xs text-slate-400">Revenue (90d)</p><p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(salesData!.revenue, currency)}</p></div>
                    <div><p className="text-xs text-slate-400">Profit (90d)</p><p className="text-sm font-semibold text-slate-900 dark:text-white">{formatCurrency(salesData!.profit, currency)}</p></div>
                  </div>
                )}

                {/* AI Recommendation */}
                <div className={`rounded-lg p-3 mb-3 ${margin < 20 ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900' : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={14} className={margin < 20 ? 'text-amber-500' : 'text-slate-400'} />
                    <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">AI Price Recommendation</p>
                  </div>
                  {margin < 20 ? (
                    <>
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        Suggested price: <strong>{formatCurrency(suggested, currency)}</strong> ({priceChangePct > 0 ? '+' : ''}{priceChangePct.toFixed(1)}% change)
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Model-based scenario targeting 40% gross margin. Estimated impact: +{formatCurrency((suggested - p.selling_price) * (salesData?.qty || 100), currency)} per {salesData?.qty || 100} units.
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Confidence: {hasSales ? 'medium' : 'low'} — {hasSales ? 'based on 90-day sales data' : 'insufficient historical sales data for a reliable recommendation'}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Current margin is healthy at {formatPercent(margin)}. {hasSales ? 'No urgent pricing action needed.' : 'Add sales data for deeper analysis.'}
                    </p>
                  )}
                </div>

                <Button variant="outline" size="sm" icon={<TrendingUp size={14} />} onClick={() => openSimulate(p)} className="w-full">
                  Simulate Price Change
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Simulation Modal */}
      <Modal
        open={!!simulateProduct} onClose={() => setSimulateProduct(null)}
        title="Price Simulation" subtitle={simulateProduct?.name}
        size="lg"
        footer={<Button variant="ghost" onClick={() => setSimulateProduct(null)}>Close</Button>}
      >
        {simulateProduct && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Input label="New Price" type="number" step="0.01" value={simPrice} onChange={(e) => setSimPrice(e.target.value)} />
              <Input label="Estimated Units Sold" type="number" value={simQty} onChange={(e) => setSimQty(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Card title="Current" noPadding>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Price</span><span className="font-medium">{formatCurrency(simulateProduct.selling_price, currency)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Revenue</span><span className="font-medium">{formatCurrency(currentRevenue, currency)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Profit</span><span className="font-medium">{formatCurrency(currentProfit, currency)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Margin</span><span className="font-medium">{formatPercent(currentMargin)}</span></div>
                </div>
              </Card>
              <Card title="Simulated" noPadding>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Price</span><span className="font-medium">{formatCurrency(simPriceNum, currency)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Revenue</span><span className="font-medium">{formatCurrency(simRevenue, currency)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Profit</span><span className="font-medium">{formatCurrency(simProfit, currency)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-400">Margin</span><span className="font-medium">{formatPercent(simMargin)}</span></div>
                </div>
              </Card>
            </div>

            <div className={`rounded-lg p-4 ${profitDelta >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900' : 'bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900'}`}>
              <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Price-Volume-Profit Analysis</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400">Revenue Change</p>
                  <p className={`text-lg font-bold ${revenueDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {revenueDelta >= 0 ? '+' : ''}{formatCurrency(revenueDelta, currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Profit Change</p>
                  <p className={`text-lg font-bold ${profitDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {profitDelta >= 0 ? '+' : ''}{formatCurrency(profitDelta, currency)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                This is a model-based scenario assuming demand remains constant. Actual results may vary based on price elasticity, competition, and market conditions.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
