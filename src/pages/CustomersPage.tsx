import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Customer } from '@/types';
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
import { Users, Plus, Pencil, Trash2, Mail, Phone } from 'lucide-react';

export function CustomersPage() {
  const { activeOrg } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', segment: 'standard', status: 'active' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('organization_id', activeOrg.id)
      .order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setCustomers((data || []) as Customer[]);
    setLoading(false);
  }, [activeOrg]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', phone: '', company: '', segment: 'standard', status: 'active' });
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', company: c.company || '', segment: c.segment, status: c.status });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!activeOrg || !form.name) return;
    setSaving(true);
    const payload = {
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      company: form.company || null,
      segment: form.segment,
      status: form.status,
    };
    if (editing) {
      await supabase.from('customers').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('customers').insert({ ...payload, organization_id: activeOrg.id });
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Delete customer "${c.name}"?`)) return;
    await supabase.from('customers').delete().eq('id', c.id);
    load();
  };

  const currency = activeOrg?.currency || 'USD';
  const statusVariant = (s: string) => s === 'active' ? 'green' : s === 'churned' ? 'red' : s === 'lead' ? 'blue' : 'neutral';

  const columns: Column<Customer>[] = [
    {
      key: 'name', label: 'Customer', sortable: true, sortValue: (r) => r.name,
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{r.name}</p>
          {r.company && <p className="text-xs text-slate-400">{r.company}</p>}
        </div>
      ),
    },
    {
      key: 'contact', label: 'Contact',
      render: (r) => (
        <div className="space-y-0.5">
          {r.email && <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><Mail size={11} /> {r.email}</p>}
          {r.phone && <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><Phone size={11} /> {r.phone}</p>}
        </div>
      ),
    },
    { key: 'segment', label: 'Segment', sortable: true, sortValue: (r) => r.segment, render: (r) => <Badge variant="teal">{r.segment}</Badge> },
    { key: 'status', label: 'Status', sortable: true, sortValue: (r) => r.status, render: (r) => <Badge variant={statusVariant(r.status)} dot>{r.status}</Badge> },
    { key: 'total_orders', label: 'Orders', sortable: true, sortValue: (r) => r.total_orders, align: 'right', render: (r) => formatNumber(r.total_orders) },
    { key: 'lifetime_value', label: 'LTV', sortable: true, sortValue: (r) => r.lifetime_value, align: 'right', render: (r) => <span className="font-medium">{formatCurrency(r.lifetime_value, currency)}</span> },
    {
      key: 'actions', label: '', align: 'right',
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition-colors"><Pencil size={15} /></button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(r); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 transition-colors"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Customers</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{customers.length} customers · {customers.filter(c => c.status === 'active').length} active</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Add Customer</Button>
      </div>

      {loading ? <LoadingSpinner size="lg" /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       customers.length === 0 ? (
         <Card><EmptyState icon={Users} title="No customers yet" description="Add your first customer to start tracking relationships, lifetime value, and segmentation." action={<Button icon={<Plus size={16} />} onClick={openCreate}>Add Customer</Button>} /></Card>
       ) : (
         <DataTable columns={columns} data={customers} rowKey={(r) => r.id} />
       )}

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Customer' : 'Add Customer'}
        subtitle="Customer information for CRM and intelligence"
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleSave} loading={saving}>{editing ? 'Save Changes' : 'Create Customer'}</Button></>}
      >
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Smith" required />
          <Input label="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Acme Corp" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@acme.com" />
            <Input label="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555-0100" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Segment" value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })}>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
              <option value="vip">VIP</option>
            </Select>
            <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="lead">Lead</option>
              <option value="churned">Churned</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
