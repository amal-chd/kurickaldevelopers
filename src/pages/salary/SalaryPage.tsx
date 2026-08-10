import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, Plus, Trash2, Download, X } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Modal from '../../components/ui/Modal';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import {
  createSalarySlip, getMySalarySlips, getAllSalarySlips, deleteSalarySlip,
  getAllUsers, createNotification,
} from '../../lib/firestore';
import { logAudit, AuditCategory } from '../../lib/auditLog';
import { SalarySlip, SalaryComponent, AppUser } from '../../types';
import toast from 'react-hot-toast';

const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const monthLabel = (m: string) => {
  if (!m) return '';
  const [y, mm] = m.split('-');
  const d = new Date(Number(y), Number(mm) - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

const sumComponents = (list: SalaryComponent[]) =>
  list.reduce((s, c) => s + (Number(c.amount) || 0), 0);

function printSlip(slip: SalarySlip) {
  const rows = (list: SalaryComponent[]) =>
    list.filter((c) => c.label || c.amount)
      .map((c) => `<tr><td>${c.label || '—'}</td><td style="text-align:right">${money(c.amount)}</td></tr>`)
      .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip - ${slip.userName} - ${monthLabel(slip.month)}</title>
  <style>
    *{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;box-sizing:border-box}
    body{margin:0;padding:32px;color:#0f172a}
    .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1A3A5C;padding-bottom:16px}
    .brand{font-size:22px;font-weight:800;color:#1A3A5C}
    .muted{color:#64748b;font-size:12px}
    h2{margin:24px 0 4px}
    table{width:100%;border-collapse:collapse;margin-top:12px}
    th,td{padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px}
    th{text-align:left;background:#f8fafc;color:#475569;text-transform:uppercase;font-size:11px;letter-spacing:.04em}
    .cols{display:flex;gap:24px}.cols>div{flex:1}
    .net{margin-top:24px;background:#1A3A5C;color:#fff;padding:16px 20px;border-radius:12px;display:flex;justify-content:space-between;align-items:center}
    .net b{font-size:22px}
    .foot{margin-top:32px;color:#94a3b8;font-size:11px;text-align:center}
  </style></head><body>
    <div class="head">
      <div><div class="brand">Kurickal Developers</div><div class="muted">Payslip</div></div>
      <div style="text-align:right"><div style="font-weight:700">${monthLabel(slip.month)}</div><div class="muted">Employee: ${slip.userName}</div></div>
    </div>
    <div class="cols">
      <div>
        <h2>Earnings</h2>
        <table><thead><tr><th>Component</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody><tr><td>Basic</td><td style="text-align:right">${money(slip.basic)}</td></tr>${rows(slip.allowances)}
        <tr><td><b>Gross</b></td><td style="text-align:right"><b>${money(slip.gross)}</b></td></tr></tbody></table>
      </div>
      <div>
        <h2>Deductions</h2>
        <table><thead><tr><th>Component</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${rows(slip.deductions) || '<tr><td>—</td><td style="text-align:right">₹0.00</td></tr>'}
        <tr><td><b>Total Deductions</b></td><td style="text-align:right"><b>${money(slip.totalDeductions)}</b></td></tr></tbody></table>
      </div>
    </div>
    <div class="net"><span>Net Pay</span><b>${money(slip.net)}</b></div>
    ${slip.notes ? `<p class="muted" style="margin-top:16px">Note: ${slip.notes}</p>` : ''}
    <div class="foot">This is a computer-generated payslip and does not require a signature.</div>
    <script>window.onload=function(){window.print();}</script>
  </body></html>`;
  const w = window.open('', '_blank');
  if (!w) { toast.error('Allow pop-ups to download the payslip'); return; }
  w.document.write(html);
  w.document.close();
}

const emptyRow = (): SalaryComponent => ({ label: '', amount: 0 });

const SalaryPage: React.FC = () => {
  const { appUser } = useAuthStore();
  const { can } = usePermissions();

  // Accounts / Directors / Admins manage payroll; everyone else views their own.
  const canManage = can('payroll_manage') || can('settings_manage') || can('reports_export');

  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ userId: '', month: '', basic: '', notes: '' });
  const [allowances, setAllowances] = useState<SalaryComponent[]>([{ label: 'HRA', amount: 0 }]);
  const [deductions, setDeductions] = useState<SalaryComponent[]>([{ label: 'PF', amount: 0 }]);

  const load = async () => {
    if (!appUser) return;
    setLoading(true);
    const [s, u] = await Promise.all([
      canManage ? getAllSalarySlips() : getMySalarySlips(appUser.id),
      canManage ? getAllUsers() : Promise.resolve([] as AppUser[]),
    ]);
    setSlips(s);
    setUsers(u);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser?.id, canManage]);

  const gross = useMemo(() => (Number(form.basic) || 0) + sumComponents(allowances), [form.basic, allowances]);
  const totalDeductions = useMemo(() => sumComponents(deductions), [deductions]);
  const net = gross - totalDeductions;

  const updateRow = (
    list: SalaryComponent[], setList: (v: SalaryComponent[]) => void,
    i: number, key: 'label' | 'amount', value: string,
  ) => {
    const next = [...list];
    next[i] = { ...next[i], [key]: key === 'amount' ? Number(value) || 0 : value };
    setList(next);
  };

  const openCreate = () => {
    setForm({ userId: '', month: new Date().toISOString().slice(0, 7), basic: '', notes: '' });
    setAllowances([{ label: 'HRA', amount: 0 }]);
    setDeductions([{ label: 'PF', amount: 0 }]);
    setModal(true);
  };

  const handleSave = async () => {
    if (!appUser) return;
    if (!form.userId) { toast.error('Select an employee'); return; }
    if (!form.month) { toast.error('Select a month'); return; }
    if (!(Number(form.basic) > 0)) { toast.error('Enter basic pay'); return; }
    const emp = users.find((u) => u.id === form.userId);
    if (!emp) { toast.error('Employee not found'); return; }

    setSaving(true);
    try {
      const cleanAllow = allowances.filter((a) => a.label.trim() || a.amount);
      const cleanDeduct = deductions.filter((d) => d.label.trim() || d.amount);
      const payload = {
        userId: emp.id,
        userName: emp.name,
        month: form.month,
        basic: Number(form.basic),
        allowances: cleanAllow,
        deductions: cleanDeduct,
        gross,
        totalDeductions,
        net,
        notes: form.notes.trim(),
        createdBy: appUser.id,
        createdByName: appUser.name,
      };
      await createSalarySlip(payload);
      void logAudit({
        action: 'salary.created',
        category: AuditCategory.salary,
        targetId: emp.id,
        targetName: emp.name,
        description: `Issued payslip for "${emp.name}" (${monthLabel(form.month)})`,
        meta: { month: form.month, net, gross },
      });
      createNotification({
        title: 'Payslip Available',
        body: `Your payslip for ${monthLabel(form.month)} is ready (Net ${money(net)}).`,
        userId: emp.id,
        type: 'salary',
        isRead: {},
        createdAt: null as any,
      }).catch(() => {});
      toast.success('Payslip created');
      setModal(false);
      load();
    } catch {
      toast.error('Failed to create payslip');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (slip: SalarySlip) => {
    if (!window.confirm('Delete this payslip?')) return;
    try {
      await deleteSalarySlip(slip.id);
      setSlips((prev) => prev.filter((s) => s.id !== slip.id));
      void logAudit({
        action: 'salary.deleted',
        category: AuditCategory.salary,
        targetId: slip.id,
        targetName: slip.userName,
        description: `Deleted payslip for "${slip.userName}" (${monthLabel(slip.month)})`,
        meta: { net: slip.net },
        severity: 'warning',
      });
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const ComponentEditor = (
    title: string, list: SalaryComponent[], setList: (v: SalaryComponent[]) => void,
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <button type="button" onClick={() => setList([...list, emptyRow()])} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      {list.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Label"
            value={row.label}
            onChange={(e) => updateRow(list, setList, i, 'label', e.target.value)}
          />
          <input
            className="w-28 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            type="number" placeholder="0" value={row.amount || ''}
            onChange={(e) => updateRow(list, setList, i, 'amount', e.target.value)}
          />
          <button type="button" onClick={() => setList(list.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-400 hover:text-red-500">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Salary Slips</h2>
          <p className="text-sm text-slate-500 mt-0.5">{canManage ? 'Generate and manage payslips' : 'Your payslips'}</p>
        </div>
        {canManage && <Button leftIcon={<Plus className="w-4 h-4" />} onClick={openCreate}>New Payslip</Button>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : slips.length === 0 ? (
        <EmptyState icon={<Wallet className="w-8 h-8" />} title="No payslips yet" description={canManage ? 'Create the first payslip.' : 'Your payslips will appear here.'} />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="text-left border-b border-slate-100 bg-slate-50/60">
                  {canManage && <th className="px-5 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Employee</th>}
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide">Month</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide text-right">Gross</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide text-right">Deductions</th>
                  <th className="px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wide text-right">Net</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {slips.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    {canManage && <td className="px-5 py-3.5 font-semibold text-slate-900">{s.userName}</td>}
                    <td className="px-4 py-3.5 text-slate-600">{monthLabel(s.month)}</td>
                    <td className="px-4 py-3.5 text-right text-slate-700">{money(s.gross)}</td>
                    <td className="px-4 py-3.5 text-right text-slate-500">{money(s.totalDeductions)}</td>
                    <td className="px-4 py-3.5 text-right font-bold text-slate-900">{money(s.net)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => printSlip(s)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-xl transition-colors" title="Download / Print">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {canManage && (
                          <button onClick={() => handleDelete(s)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
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
        title="Create Payslip"
        footer={
          <div className="flex items-center justify-between w-full gap-3">
            <span className="text-sm text-slate-500">Net Pay: <span className="font-bold text-slate-900">{money(net)}</span></span>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Create</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Employee"
              value={form.userId}
              onChange={(e) => setForm((p) => ({ ...p, userId: e.target.value }))}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="Select employee"
            />
            <Input label="Month" type="month" value={form.month} onChange={(e) => setForm((p) => ({ ...p, month: e.target.value }))} />
          </div>
          <Input label="Basic Pay" type="number" value={form.basic} onChange={(e) => setForm((p) => ({ ...p, basic: e.target.value }))} placeholder="0" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
            {ComponentEditor('Allowances', allowances, setAllowances)}
            {ComponentEditor('Deductions', deductions, setDeductions)}
          </div>
          <div className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
            <span className="text-slate-500">Gross: <span className="font-semibold text-slate-800">{money(gross)}</span></span>
            <span className="text-slate-500">Deductions: <span className="font-semibold text-slate-800">{money(totalDeductions)}</span></span>
            <span className="text-slate-500">Net: <span className="font-bold text-slate-900">{money(net)}</span></span>
          </div>
          <Input label="Notes (optional)" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Any note for this payslip" />
        </div>
      </Modal>
    </div>
  );
};

export default SalaryPage;
