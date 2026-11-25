import React, { useEffect, useMemo, useState } from 'react';
import { Receipt, Plus, Trash2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input, { Textarea } from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/ui/Avatar';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import {
  createExpense, getMyExpenses, getAllExpenses, deleteExpense, getProjects,
} from '../../lib/firestore';
import { logAudit, AuditCategory } from '../../lib/auditLog';
import { Expense, ExpenseCategory, Project } from '../../types';
import toast from 'react-hot-toast';

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'materials', label: 'Materials' },
  { value: 'labour', label: 'Labour' },
  { value: 'transport', label: 'Transport' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'food', label: 'Food' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
];

const catLabel = (c: ExpenseCategory) => CATEGORIES.find((x) => x.value === c)?.label ?? c;
const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ExpensePage: React.FC = () => {
  const { appUser, role } = useAuthStore();
  const { can } = usePermissions();

  const canViewAll = can('expense_manage') || can('reports_view') || (role?.level ?? 0) >= 80;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', category: 'materials' as ExpenseCategory, amount: '',
    date: new Date().toISOString().slice(0, 10), projectId: '', note: '',
  });

  const load = async () => {
    if (!appUser) return;
    setLoading(true);
    const [e, p] = await Promise.all([
      canViewAll ? getAllExpenses() : getMyExpenses(appUser.id),
      getProjects(),
    ]);
    setExpenses(e);
    setProjects(p);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.id, canViewAll]);

  const total = useMemo(() => expenses.reduce((s, e) => s + (e.amount || 0), 0), [expenses]);

  const openCreate = () => {
    setForm({ title: '', category: 'materials', amount: '', date: new Date().toISOString().slice(0, 10), projectId: '', note: '' });
    setModal(true);
  };

  const handleSave = async () => {
    if (!appUser) return;
    if (!form.title.trim()) { toast.error('Enter a title'); return; }
    if (!(Number(form.amount) > 0)) { toast.error('Enter a valid amount'); return; }
    if (!form.date) { toast.error('Pick a date'); return; }
    setSaving(true);
    try {
      const project = projects.find((p) => p.id === form.projectId);
      await createExpense({
        userId: appUser.id,
        userName: appUser.name,
        title: form.title.trim(),
        category: form.category,
        amount: Number(form.amount),
        date: form.date,
        projectId: form.projectId || undefined,
        projectName: project?.name,
        note: form.note.trim() || undefined,
        orgId: appUser.orgId || 'main',
      });
      void logAudit({
        action: 'expense.submitted',
        category: AuditCategory.expense,
        targetName: form.title.trim(),
        description: `Logged expense "${form.title.trim()}"`,
        meta: { amount: Number(form.amount), category: form.category, project: project?.name ?? '—' },
      });
      toast.success('Expense logged');
      setModal(false);
      load();
    } catch {
      toast.error('Failed to log expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (exp: Expense) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await deleteExpense(exp.id);
      setExpenses((prev) => prev.filter((e) => e.id !== exp.id));
      void logAudit({
        action: 'expense.deleted',
        category: AuditCategory.expense,
        targetId: exp.id,
        targetName: exp.title,
        description: `Deleted expense "${exp.title}"`,
        meta: { amount: exp.amount },
        severity: 'warning',
      });
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase & Expenses</h2>
          <p className="text-sm text-slate-500 mt-0.5">{canViewAll ? 'All logged expenses' : 'Log and track your expenses'}</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>Log Expense</Button>
      </div>

      {!loading && expenses.length > 0 && (
        <Card className="flex items-center justify-between">
          <span className="text-sm text-slate-500">{canViewAll ? 'Total (all staff)' : 'Your total'}</span>
          <span className="text-xl font-bold text-slate-900">{money(total)}</span>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : expenses.length === 0 ? (
        <EmptyState icon={<Receipt className="w-8 h-8" />} title="No expenses logged" description="Logged expenses will appear here." />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left border-b border-slate-100 bg-slate-50/60">
                  {canViewAll && <th className="px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">By</th>}
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Title</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Category</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Project</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide text-right">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/60">
                    {canViewAll && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={e.userName || '?'} size="sm" />
                          <span className="text-slate-700 text-xs">{e.userName}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3.5 font-medium text-slate-900">{e.title}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">{catLabel(e.category)}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs">{e.projectName || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900">{money(e.amount)}</td>
                    <td className="px-4 py-3.5 text-right">
                      {(e.userId === appUser?.id || canViewAll) && (
                        <button onClick={() => handleDelete(e)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Log Expense"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input label="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g. Cement purchase" />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as ExpenseCategory }))}
              options={CATEGORIES}
            />
            <Input label="Amount" type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date" type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            <Select
              label="Project (optional)"
              value={form.projectId}
              onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="No project"
            />
          </div>
          <Textarea label="Note (optional)" rows={2} value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="Details..." />
        </div>
      </Modal>
    </div>
  );
};

export default ExpensePage;
