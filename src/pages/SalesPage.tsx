import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Sale, Product, Customer } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Form';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatCurrency, formatNumber } from '@/lib/analytics';
import { ShoppingCart, Plus, TrendingUp } from 'lucide-react';

export function SalesPage() {
  const { activeOrg } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ product_id: '', customer_id: '', quantity: '1', unit_price: '', unit_cost: '', channel: 'direct' });
  const [saving, setSaving] = useState(false);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    const [salesRes, prodRes, custRes] = await Promise.all([
      supabase.from('sales').select('*').eq('organization_id', activeOrg.id).order('sale_date', { ascending: false }).limit(100),
      supabase.from('products').select('*').eq('organization_id', activeOrg.id).eq('is_active', true),
      supabase.from('customers').select('*').eq('organization_id', activeOrg.id).eq('status', 'active'),
    ]);
    if (salesRes.error) setError(salesRes.error.message);
    else {
      const s = (salesRes.data || []) as Sale[];
      setSales(s);
      setTotalRevenue(s.reduce((sum, x) => sum + Number(x.total_revenue), 0));
      setTotalProfit(s.reduce((sum, x) => sum + Number(x.gross_profit), 0));
    }
    setProducts((prodRes.data || []) as Product[]);
    setCustomers((custRes.data || []) as Customer[]);
    setLoading(false);
  }, [activeOrg]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ product_id: '', customer_id: '', quantity: '1', unit_price: '', unit_cost: '', channel: 'direct' });
    setModalOpen(true);
  };

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    setForm({
      ...form,
      product_id: productId,
      unit_price: product ? String(product.selling_price) : '',
      unit_cost: product ? String(product.unit_cost) : '',
    });
  };

  const handleSave = async () => {
    if (!activeOrg || !form.product_id || !form.unit_price) return;
    setSaving(true);
    await supabase.from('sales').insert({
      organization_id: activeOrg.id,
      product_id: form.product_id,
      customer_id: form.customer_id || null,
      quantity: parseInt(form.quantity) || 1,
      unit_price: parseFloat(form.unit_price),
      unit_cost: parseFloat(form.unit_cost) || 0,
      channel: form.channel,
    });
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const currency = activeOrg?.currency || 'USD';
  const productMap = new Map(products.map(p => [p.id, p.name]));
  const customerMap = new Map(customers.map(c => [c.id, c.name]));

  const columns: Column<Sale>[] = [
    { key: 'sale_date', label: 'Date', sortable: true, sortValue: (r) => r.sale_date, render: (r) => <span className="text-sm">{new Date(r.sale_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span> },
    { key: 'product', label: 'Product', render: (r) => <span className="font-medium text-slate-900 dark:text-white">{r.product_id ? productMap.get(r.product_id) || 'Unknown' : '—'}</span> },
    { key: 'customer', label: 'Customer', render: (r) => r.customer_id ? customerMap.get(r.customer_id) || 'Unknown' : <span className="text-slate-400">Walk-in</span> },
    { key: 'quantity', label: 'Qty', sortable: true, sortValue: (r) => r.quantity, align: 'right', render: (r) => formatNumber(r.quantity) },
    { key: 'total_revenue', label: 'Revenue', sortable: true, sortValue: (r) => Number(r.total_revenue), align: 'right', render: (r) => formatCurrency(Number(r.total_revenue), currency) },
    { key: 'gross_profit', label: 'Profit', sortable: true, sortValue: (r) => Number(r.gross_profit), align: 'right', render: (r) => <span className={Number(r.gross_profit) < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>{formatCurrency(Number(r.gross_profit), currency)}</span> },
    { key: 'channel', label: 'Channel', render: (r) => <Badge variant="neutral">{r.channel}</Badge> },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Sales</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sales.length} recent transactions</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate} disabled={products.length === 0}>Record Sale</Button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"><ShoppingCart size={18} /></div><div><p className="text-xs text-slate-500 dark:text-slate-400">Total Revenue</p><p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalRevenue, currency)}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400"><TrendingUp size={18} /></div><div><p className="text-xs text-slate-500 dark:text-slate-400">Gross Profit</p><p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalProfit, currency)}</p></div></div></Card>
        <Card><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400"><ShoppingCart size={18} /></div><div><p className="text-xs text-slate-500 dark:text-slate-400">Avg Order Value</p><p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(sales.length > 0 ? totalRevenue / sales.length : 0, currency)}</p></div></div></Card>
      </div>

      {loading ? <LoadingSpinner size="lg" /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       sales.length === 0 ? (
         <Card><EmptyState icon={ShoppingCart} title="No sales recorded yet" description={products.length === 0 ? "Add products first, then record sales to track revenue and profit." : "Record your first sale to start tracking revenue and profit performance."} action={products.length > 0 ? <Button icon={<Plus size={16} />} onClick={openCreate}>Record Sale</Button> : undefined} /></Card>
       ) : (
         <DataTable columns={columns} data={sales} rowKey={(r) => r.id} />
       )}

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title="Record Sale" subtitle="Log a new transaction"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>Record Sale</Button></>}
      >
        <div className="space-y-4">
          <Select label="Product" value={form.product_id} onChange={(e) => handleProductChange(e.target.value)} required>
            <option value="">Select a product...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.selling_price, currency)}</option>)}
          </Select>
          <Select label="Customer (optional)" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
            <option value="">Walk-in / No customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Quantity" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} min="1" />
            <Select label="Channel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              <option value="direct">Direct</option>
              <option value="online">Online</option>
              <option value="wholesale">Wholesale</option>
              <option value="partner">Partner</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Unit Price" type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} required />
            <Input label="Unit Cost" type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
          </div>
          {form.unit_price && form.quantity && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm">
              <span className="text-slate-600 dark:text-slate-400">Total: </span>
              <span className="font-semibold text-blue-700 dark:text-blue-300">{formatCurrency(parseFloat(form.unit_price || '0') * parseInt(form.quantity || '1'), currency)}</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
