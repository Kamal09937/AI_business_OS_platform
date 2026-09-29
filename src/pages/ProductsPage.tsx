import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Product } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatCurrency, formatPercent } from '@/lib/analytics';
import { Package, Plus, Pencil, Trash2, AlertCircle } from 'lucide-react';

export function ProductsPage() {
  const { activeOrg } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ name: '', sku: '', category: '', unit_cost: '', selling_price: '', stock_quantity: '', reorder_level: '10' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('organization_id', activeOrg.id)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setProducts((data || []) as Product[]);
    setLoading(false);
  }, [activeOrg]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', sku: '', category: '', unit_cost: '', selling_price: '', stock_quantity: '', reorder_level: '10' });
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, sku: p.sku || '', category: p.category || '',
      unit_cost: String(p.unit_cost), selling_price: String(p.selling_price),
      stock_quantity: String(p.stock_quantity), reorder_level: String(p.reorder_level),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!activeOrg || !form.name || !form.unit_cost || !form.selling_price) return;
    setSaving(true);
    const payload = {
      name: form.name,
      sku: form.sku || null,
      category: form.category || null,
      unit_cost: parseFloat(form.unit_cost),
      selling_price: parseFloat(form.selling_price),
      stock_quantity: parseInt(form.stock_quantity) || 0,
      reorder_level: parseInt(form.reorder_level) || 0,
    };
    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('products').insert({ ...payload, organization_id: activeOrg.id });
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await supabase.from('products').delete().eq('id', p.id);
    load();
  };

  const currency = activeOrg?.currency || 'USD';
  const margin = (p: Product) => p.selling_price > 0 ? ((p.selling_price - p.unit_cost) / p.selling_price) * 100 : 0;

  const columns: Column<Product>[] = [
    {
      key: 'name', label: 'Product', sortable: true, sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{r.name}</p>
          {r.sku && <p className="text-xs text-slate-400">SKU: {r.sku}</p>}
        </div>
      ),
    },
    { key: 'category', label: 'Category', sortable: true, sortValue: (r) => r.category || '', render: (r) => r.category || <span className="text-slate-400">—</span> },
    { key: 'unit_cost', label: 'Unit Cost', sortable: true, sortValue: (r) => r.unit_cost, align: 'right', render: (r) => formatCurrency(r.unit_cost, currency) },
    { key: 'selling_price', label: 'Price', sortable: true, sortValue: (r) => r.selling_price, align: 'right', render: (r) => formatCurrency(r.selling_price, currency) },
    {
      key: 'margin', label: 'Margin', sortable: true, sortValue: (r) => margin(r), align: 'right',
      render: (r) => <span className={margin(r) < 20 ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>{formatPercent(margin(r))}</span>,
    },
    {
      key: 'stock_quantity', label: 'Stock', sortable: true, sortValue: (r) => r.stock_quantity, align: 'right',
      render: (r) => (
        <span className={r.stock_quantity <= r.reorder_level ? 'text-rose-600 dark:text-rose-400 font-medium' : ''}>
          {r.stock_quantity}
          {r.stock_quantity <= r.reorder_level && <AlertCircle size={12} className="inline ml-1" />}
        </span>
      ),
    },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors">
            <Pencil size={15} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Products</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{products.length} products in catalog</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Add Product</Button>
      </div>

      {loading ? <LoadingSpinner size="lg" /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       products.length === 0 ? (
         <Card>
           <EmptyState icon={Package} title="No products yet" description="Add your first product to start tracking sales, inventory, and pricing intelligence." action={<Button icon={<Plus size={16} />} onClick={openCreate}>Add Product</Button>} />
         </Card>
       ) : (
         <DataTable columns={columns} data={products} rowKey={(r) => r.id} />
       )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Product' : 'Add Product'}
        subtitle="Product details for inventory and pricing analysis"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Product'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Product Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Premium Widget" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="WGT-001" />
            <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Electronics" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Unit Cost" type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} placeholder="0.00" required />
            <Input label="Selling Price" type="number" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} placeholder="0.00" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Stock Quantity" type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} placeholder="0" />
            <Input label="Reorder Level" type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} placeholder="10" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
