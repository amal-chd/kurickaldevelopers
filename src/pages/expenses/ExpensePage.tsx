import React, { useEffect, useMemo, useState } from 'react';
import {
  Receipt, Plus, Trash2, ArrowUpRight, ArrowDownRight, Search,
  DollarSign, Building, Wallet, TrendingUp, TrendingDown,
} from 'lucide-react';
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

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'materials', label: 'Materials' },
  { value: 'labour', label: 'Labour' },
  { value: 'transport', label: 'Transport' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'food', label: 'Food' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
];

const INCOME_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'other', label: 'Client Milestone Payment' },
  { value: 'office', label: 'Advance Payment' },
  { value: 'labour', label: 'Service / Retainer' },
  { value: 'materials', label: 'Materials Refund / Resale' },
  { value: 'equipment', label: 'Asset Sale / Rental Income' },
];

const catLabel = (c: ExpenseCategory) =>
  EXPENSE_CATEGORIES.find((x) => x.value === c)?.label ??
  INCOME_CATEGORIES.find((x) => x.value === c)?.label ??
  c;

const money = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ExpensePage: React.FC = () => {
  const { appUser, role } = useAuthStore();
  const { can } = usePermissions();

  const canViewAll = can('expense_manage') || can('reports_view') || (role?.level ?? 0) >= 80;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create form
  const [form, setForm] = useState({
    type: 'expense' as 'expense' | 'income',
    title: '',
    category: 'materials' as ExpenseCategory,
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    projectId: '',
    note: '',
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

  // Filtered dataset
  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (projectFilter && e.projectId !== projectFilter) return false;
      if (typeFilter !== 'all') {
        const itemType = e.type || 'expense';
        if (itemType !== typeFilter) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (e.title || '').toLowerCase().includes(q);
        const matchNote = (e.note || '').toLowerCase().includes(q);
        const matchProject = (e.projectName || '').toLowerCase().includes(q);
        const matchUser = (e.userName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchNote && !matchProject && !matchUser) return false;
      }
      return true;
    });
  }, [expenses, projectFilter, typeFilter, searchQuery]);

  // Aggregate stats
  const stats = useMemo(() => {
    const list = projectFilter ? expenses.filter((e) => e.projectId === projectFilter) : expenses;
    let income = 0;
    let expense = 0;
    for (const item of list) {
      if (item.type === 'income') {
        income += item.amount || 0;
      } else {
        expense += item.amount || 0;
      }
    }
    return {
      income,
      expense,
      net: income - expense,
    };
  }, [expenses, projectFilter]);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectFilter),
    [projects, projectFilter],
  );

  const openCreate = (defaultType: 'expense' | 'income' = 'expense') => {
    setForm({
      type: defaultType,
      title: '',
      category: defaultType === 'income' ? 'other' : 'materials',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      projectId: projectFilter || '',
      note: '',
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!appUser) return;
    if (!form.title.trim()) {
      toast.error('Enter a title');
      return;
    }
    if (!(Number(form.amount) > 0)) {
      toast.error('Enter a valid amount');
      return;
    }
    if (!form.date) {
      toast.error('Pick a date');
      return;
    }
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
        type: form.type,
        orgId: appUser.orgId || 'main',
      });
      void logAudit({
        action: form.type === 'income' ? 'income.logged' : 'expense.submitted',
        category: AuditCategory.expense,
        targetName: form.title.trim(),
        description: `Logged ${form.type} "${form.title.trim()}" of ${money(Number(form.amount))}`,
        meta: {
          type: form.type,
          amount: Number(form.amount),
          category: form.category,
          project: project?.name ?? '—',
        },
      });
      toast.success(`${form.type === 'income' ? 'Income' : 'Expense'} logged successfully`);
      setModal(false);
      load();
    } catch {
      toast.error(`Failed to log ${form.type}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (exp: Expense) => {
    const isInc = exp.type === 'income';
    if (!window.confirm(`Delete this ${isInc ? 'income entry' : 'expense'}?`)) return;
    try {
      await deleteExpense(exp.id);
      setExpenses((prev) => prev.filter((e) => e.id !== exp.id));
      void logAudit({
        action: isInc ? 'income.deleted' : 'expense.deleted',
        category: AuditCategory.expense,
        targetId: exp.id,
        targetName: exp.title,
        description: `Deleted ${isInc ? 'income' : 'expense'} "${exp.title}"`,
        meta: { amount: exp.amount, type: exp.type },
        severity: 'warning',
      });
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Wallet className="w-7 h-7 text-primary" />
            Project Finances & Expenses
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Track project expenses, material purchases, client income, and budget burn rate.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            leftIcon={<ArrowDownRight className="w-4 h-4 text-emerald-600" />}
            onClick={() => openCreate('income')}
          >
            Log Income
          </Button>
          <Button
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => openCreate('expense')}
          >
            Log Expense
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {projectFilter ? 'Project Income' : 'Total Income'}
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{money(stats.income)}</p>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
            <TrendingUp className="w-6 h-6" />
          </div>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {projectFilter ? 'Project Expenses' : 'Total Expenses'}
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{money(stats.expense)}</p>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
            <TrendingDown className="w-6 h-6" />
          </div>
        </Card>

        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Cash Flow</p>
            <p className={`text-2xl font-extrabold mt-1 ${stats.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
              {money(stats.net)}
            </p>
          </div>
          <div className={`p-3 rounded-2xl ${stats.net >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
            <Wallet className="w-6 h-6" />
          </div>
        </Card>

        {selectedProject && (selectedProject.budget || 0) > 0 ? (
          <Card className="p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Project Budget</p>
                <p className="text-lg font-bold text-slate-900 mt-0.5">{money(selectedProject.budget || 0)}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                stats.expense > (selectedProject.budget || 0)
                  ? 'bg-rose-100 text-rose-700'
                  : 'bg-blue-50 text-blue-700'
              }`}>
                {Math.round((stats.expense / (selectedProject.budget || 1)) * 100)}% Spent
              </span>
            </div>
            <div className="mt-3">
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats.expense > (selectedProject.budget || 0) ? 'bg-rose-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, Math.round((stats.expense / (selectedProject.budget || 1)) * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5 flex justify-between">
                <span>Remaining:</span>
                <span className="font-semibold text-slate-700">
                  {money(Math.max(0, (selectedProject.budget || 0) - stats.expense))}
                </span>
              </p>
            </div>
          </Card>
        ) : (
          <Card className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Records Count</p>
              <p className="text-2xl font-extrabold text-slate-800 mt-1">{filtered.length} entries</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-2xl text-primary">
              <Building className="w-6 h-6" />
            </div>
          </Card>
        )}
      </div>

      {/* Filters Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by title, note, project, staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Project Filter */}
          <div className="w-full md:w-64">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter Buttons */}
          <div className="flex rounded-xl bg-slate-100 p-1 shrink-0">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                typeFilter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter('expense')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                typeFilter === 'expense' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" /> Expenses
            </button>
            <button
              onClick={() => setTypeFilter('income')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
                typeFilter === 'income' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" /> Income
            </button>
          </div>
        </div>
      </Card>

      {/* Transactions Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-8 h-8" />}
          title="No records found"
          description={
            searchQuery || projectFilter || typeFilter !== 'all'
              ? 'Try adjusting your filters or search query.'
              : 'Logged income and expenses will appear here.'
          }
        />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="text-left border-b border-slate-100 bg-slate-50/60">
                  <th className="px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Title & Details</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Project</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Category</th>
                  {canViewAll && (
                    <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Logged By</th>
                  )}
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide text-right">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((e) => {
                  const isInc = e.type === 'income';
                  return (
                    <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            isInc
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isInc ? (
                            <>
                              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" /> Income
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" /> Expense
                            </>
                          )}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900">{e.title}</p>
                        {e.note && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{e.note}</p>}
                      </td>

                      <td className="px-4 py-3.5">
                        {e.projectName ? (
                          <span
                            onClick={() => setProjectFilter(e.projectId || '')}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-700 hover:text-primary cursor-pointer font-medium"
                            title="Click to filter by this project"
                          >
                            <Building className="w-3.5 h-3.5 text-slate-400" />
                            {e.projectName}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">General</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                          {catLabel(e.category)}
                        </span>
                      </td>

                      {canViewAll && (
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <Avatar name={e.userName || '?'} size="sm" />
                            <span className="text-slate-700 text-xs font-medium">{e.userName}</span>
                          </div>
                        </td>
                      )}

                      <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{e.date}</td>

                      <td className="px-4 py-3.5 text-right font-bold whitespace-nowrap">
                        <span className={isInc ? 'text-emerald-700' : 'text-slate-900'}>
                          {isInc ? `+${money(e.amount)}` : `-${money(e.amount)}`}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        {(e.userId === appUser?.id || canViewAll) && (
                          <button
                            onClick={() => handleDelete(e)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={form.type === 'income' ? 'Log Project Income' : 'Log Project Expense'}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Save {form.type === 'income' ? 'Income' : 'Expense'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Type Selector Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, type: 'expense', category: 'materials' }))}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  form.type === 'expense'
                    ? 'bg-white text-rose-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-rose-500" /> Project Expense
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, type: 'income', category: 'other' }))}
                className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  form.type === 'income'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownRight className="w-4 h-4 text-emerald-600" /> Client Income
              </button>
            </div>
          </div>

          <Input
            label="Title"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder={
              form.type === 'income' ? 'e.g. Stage 1 Milestone payout' : 'e.g. Cement and Sand purchase'
            }
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as ExpenseCategory }))}
              options={form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES}
            />
            <Input
              label="Amount (₹)"
              type="number"
              value={form.amount}
              onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              placeholder="0.00"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              required
            />
            <Select
              label="Project (optional)"
              value={form.projectId}
              onChange={(e) => setForm((p) => ({ ...p, projectId: e.target.value }))}
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              placeholder="General / No specific project"
            />
          </div>

          <Textarea
            label="Note & Description"
            rows={2}
            value={form.note}
            onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            placeholder="Payment mode, invoice number, vendor details..."
          />
        </div>
      </Modal>
    </div>
  );
};

export default ExpensePage;
