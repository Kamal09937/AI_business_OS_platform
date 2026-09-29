import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Expense } from '@/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { formatCurrency } from '@/lib/analytics';
import { Receipt, Plus, TrendingDown } from 'lucide-react';

const CATEGORIES = ['Rent', 'Payroll', 'Utilities', 'Marketing', 'Supplies', 'Software', 'Travel', 'Insurance', 'Equipment', 'Professional Services', 'Other'];

export function ExpensesPage() {
  const { activeOrg } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ category: 'Rent', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], is_recurring: false });
  const [saving, setSaving] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  const [categoryTotals, setCategoryTotals] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('organization_id', activeOrg.id)
      .order('expense_date', { ascending: false })
      .limit(100);
    if (error) setError(error.message);
    else {
      const e = (data || []) as Expense[];
      setExpenses(e);
      setTotalAmount(e.reduce((s, x) => s + Number(x.amount), 0));
      const cats: Record<string, number> = {};
      for (const exp of e) {
        cats[exp.category] = (cats[exp.category] || 0) + Number(exp.amount);
      }
      setCategoryTotals(cats);
    }
    setLoading(false);
  }, [activeOrg]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ category: 'Rent', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], is_recurring: false });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!activeOrg || !form.amount) return;
    setSaving(true);
    await supabase.from('expenses').insert({
      organization_id: activeOrg.id,
      category: form.category,
      description: form.description || null,
      amount: parseFloat(form.amount),
      expense_date: new Date(form.expense_date).toISOString(),
      is_recurring: form.is_recurring,
    });
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const currency = activeOrg?.currency || 'USD';

  const columns: Column<Expense>[] = [
    { key: 'expense_date', label: 'Date', sortable: true, sortValue: (r) => r.expense_date, render: (r) => new Date(r.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
    { key: 'category', label: 'Category', sortable: true, sortValue: (r) => r.category, render: (r) => <Badge variant="neutral">{r.category}</Badge> },
    { key: 'description', label: 'Description', render: (r) => r.description || <span className="text-slate-400">—</span> },
    { key: 'amount', label: 'Amount', sortable: true, sortValue: (r) => r.amount, align: 'right', render: (r) => <span className="font-medium text-rose-600 dark:text-rose-400">{formatCurrency(r.amount, currency)}</span> },
    { key: 'is_recurring', label: 'Recurring', render: (r) => r.is_recurring ? <Badge variant="blue">Recurring</Badge> : <span className="text-slate-400 text-xs">One-time</span> },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{expenses.length} expense records</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Add Expense</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Total Expenses" subtitle="All recorded transactions">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"><TrendingDown size={22} /></div>
            <div><p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalAmount, currency)}</p><p className="text-xs text-slate-400">across {Object.keys(categoryTotals).length} categories</p></div>
          </div>
        </Card>

        <Card title="Top Categories" subtitle="By total spend" className="lg:col-span-2">
          <div className="space-y-2">
            {Object.entries(categoryTotals).sort(([,a],[,b]) => b - a).slice(0, 5).map(([cat, amt]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-300 w-32 truncate">{cat}</span>
                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${totalAmount > 0 ? (amt / totalAmount) * 100 : 0}%` }} />
                </div>
                <span className="text-sm font-medium text-slate-900 dark:text-white w-20 text-right">{formatCurrency(amt, currency)}</span>
              </div>
            ))}
            {Object.keys(categoryTotals).length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No expense data yet</p>}
          </div>
        </Card>
      </div>

      {loading ? <LoadingSpinner size="lg" /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       expenses.length === 0 ? (
         <Card><EmptyState icon={Receipt} title="No expenses recorded" description="Track your business expenses to monitor cash flow and detect anomalies." action={<Button icon={<Plus size={16} />} onClick={openCreate}>Add Expense</Button>} /></Card>
       ) : (
         <DataTable columns={columns} data={expenses} rowKey={(r) => r.id} />
       )}

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title="Add Expense" subtitle="Record a business expense"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>Add Expense</Button></>}
      >
        <div className="space-y-4">
          <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Monthly office rent" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount" type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" required />
            <Input label="Date" type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} required />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={form.is_recurring} onChange={(e) => setForm({ ...form, is_recurring: e.target.checked })} className="rounded border-slate-300 dark:border-slate-700" />
            Recurring expense
          </label>
        </div>
      </Modal>
    </div>
  );
}
