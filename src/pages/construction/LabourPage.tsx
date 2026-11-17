import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Download, Plus, Trash2, Wallet } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Contractor, LabourEntry, LabourPayment, contractorBalances, labourAmount } from '../../lib/construction';
import { listContractors, upsertContractor, listLabour, addLabour, deleteLabour, listLabourPayments, addLabourPayment } from '../../lib/db/construction';
import { useProjectList, useSelectedProject, ProjectPicker, useSuitePerms, inr, field, btn, btnGhost, Stat, Tabs, Loading, Empty, PageHeader, today } from './shared';

const CATEGORIES = ['Mason', 'Helper', 'Carpenter', 'Bar bender', 'Electrician', 'Plumber', 'Painter', 'Welder', 'Tile layer', 'Operator', 'Unskilled'];
const shift = (d: string, days: number) => { const x = new Date(d); x.setDate(x.getDate() + days); return x.toISOString().slice(0, 10); };
const monthStart = () => today().slice(0, 8) + '01';

const LabourPage: React.FC = () => {
  const projects = useProjectList();
  const [projectId, setProjectId] = useSelectedProject('labour', projects);
  const perms = useSuitePerms('labour');
  const [tab, setTab] = useState('register');
  const [date, setDate] = useState(today());
  const [contractors, setContractors] = useState<Contractor[] | null>(null);
  const [dayEntries, setDayEntries] = useState<LabourEntry[] | null>(null);
  const [allEntries, setAllEntries] = useState<LabourEntry[]>([]);
  const [payments, setPayments] = useState<LabourPayment[]>([]);
  const [row, setRow] = useState({ contractor_id: '', category: 'Mason', headcount: '', rate: '', overtime_hours: '', overtime_rate: '', note: '' });
  const [con, setCon] = useState<Partial<Contractor>>({});
  const [pay, setPay] = useState({ contractor_id: '', kind: 'payment' as 'payment' | 'advance', amount: '', date: today(), reference: '' });
  const [range, setRange] = useState({ from: monthStart(), to: today() });
  const [busy, setBusy] = useState(false);

  const loadDay = async () => {
    if (!projectId) return;
    setDayEntries(null);
    try { setDayEntries(await listLabour({ projectId, from: date, to: date })); } catch (e: any) { toast.error(e.message); setDayEntries([]); }
  };
  const loadAll = async () => {
    try {
      const [c, e, p] = await Promise.all([listContractors(), listLabour({}), listLabourPayments()]);
      setContractors(c); setAllEntries(e); setPayments(p);
    } catch (e: any) { toast.error(e.message); setContractors([]); }
  };
  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadDay(); }, [projectId, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const cName = useMemo(() => new Map((contractors ?? []).map((c) => [c.id, c.name])), [contractors]);
  const balances = useMemo(() => contractorBalances(allEntries, payments), [allEntries, payments]);
  const dayTotal = (dayEntries ?? []).reduce((s, e) => ({ heads: s.heads + e.headcount, amt: s.amt + e.amount }), { heads: 0, amt: 0 });
  const monthEntries = allEntries.filter((e) => e.project_id === projectId && e.date >= monthStart());
  const monthTotal = monthEntries.reduce((s, e) => s + e.amount, 0);
  const monthMandays = monthEntries.reduce((s, e) => s + e.headcount, 0);
  const totalDue = [...balances.values()].reduce((s, b) => s + Math.max(0, b.balance), 0);

  const addRow = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addLabour({ project_id: projectId, date, contractor_id: row.contractor_id || null, category: row.category, headcount: Number(row.headcount), rate: Number(row.rate) || 0, overtime_hours: Number(row.overtime_hours) || 0, overtime_rate: Number(row.overtime_rate) || 0, note: row.note || null, created_by: perms.uid, created_by_name: perms.name });
      setRow({ ...row, headcount: '', overtime_hours: '', note: '' });
      await Promise.all([loadDay(), loadAll()]);
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const copyPrevious = async () => {
    setBusy(true);
    try {
      let prev: LabourEntry[] = [];
      for (let i = 1; i <= 7 && !prev.length; i++) prev = await listLabour({ projectId, from: shift(date, -i), to: shift(date, -i) });
      if (!prev.length) { toast('No entries in the previous 7 days'); return; }
      for (const p of prev) await addLabour({ project_id: projectId, date, contractor_id: p.contractor_id, category: p.category, headcount: p.headcount, rate: p.rate, overtime_hours: 0, overtime_rate: p.overtime_rate, note: null, created_by: perms.uid, created_by_name: perms.name });
      toast.success(`Copied ${prev.length} rows from ${prev[0].date} — adjust headcounts as needed`);
      await Promise.all([loadDay(), loadAll()]);
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const saveContractor = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await upsertContractor(con); toast.success('Contractor saved'); setCon({}); await loadAll(); } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };
  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await addLabourPayment({ contractor_id: pay.contractor_id, project_id: projectId || null, kind: pay.kind, amount: Number(pay.amount), date: pay.date, reference: pay.reference || null, note: null, created_by: perms.uid });
      toast.success(pay.kind === 'advance' ? 'Advance recorded' : 'Payment recorded');
      setPay({ ...pay, amount: '', reference: '' });
      await loadAll();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const reportRows = allEntries.filter((e) => (!projectId || e.project_id === projectId) && e.date >= range.from && e.date <= range.to);
  const byKey = (k: (e: LabourEntry) => string) => {
    const m = new Map<string, { mandays: number; amount: number }>();
    for (const e of reportRows) { const key = k(e); const s = m.get(key) ?? { mandays: 0, amount: 0 }; s.mandays += e.headcount; s.amount += e.amount; m.set(key, s); }
    return [...m.entries()].sort((a, b) => b[1].amount - a[1].amount);
  };
  const exportReport = () => {
    const ws = XLSX.utils.json_to_sheet(reportRows.map((e) => ({ Date: e.date, Project: projects?.find((p) => p.id === e.project_id)?.name ?? '', Contractor: e.contractor_id ? cName.get(e.contractor_id) : 'Direct', Category: e.category, Headcount: e.headcount, Rate: e.rate, 'OT hours': e.overtime_hours, 'OT rate': e.overtime_rate, Amount: e.amount, Note: e.note ?? '' })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Labour'); XLSX.writeFile(wb, `Labour_${range.from}_${range.to}.xlsx`);
  };

  const contractorOptions = (contractors ?? []).filter((c) => c.is_active).map((c) => <option key={c.id} value={c.id}>{c.name}{c.trade ? ` · ${c.trade}` : ''}</option>);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader title="Labour & contractors" subtitle="Daily labour register, wages, advances and contractor balances.">
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
      </PageHeader>
      {!contractors ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label={`Labour on ${date === today() ? 'site today' : date}`} value={dayTotal.heads} hint={inr(dayTotal.amt)} />
            <Stat label="This month — man-days" value={monthMandays} />
            <Stat label="This month — wages" value={inr(monthTotal)} hint="Counts towards project cost" />
            <Stat label="Due to contractors (all sites)" value={inr(totalDue)} tone={totalDue > 0 ? 'warn' : 'default'} />
          </div>
          <Tabs value={tab} onChange={setTab} tabs={[['register', 'Daily register'], ['contractors', 'Contractors & payments'], ['report', 'Report']]} />

          {tab === 'register' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <button className={btnGhost} onClick={() => setDate(shift(date, -1))} aria-label="Previous day">‹</button>
                <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className={field} aria-label="Date" />
                <button className={btnGhost} onClick={() => setDate(shift(date, 1))} disabled={date >= today()} aria-label="Next day">›</button>
                {perms.manage && <button onClick={copyPrevious} disabled={busy || !projectId} className={btnGhost}><Copy className="w-4 h-4" />Copy last working day</button>}
              </div>
              {perms.manage && (
                <form onSubmit={addRow} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap gap-2 items-center">
                  <select value={row.contractor_id} onChange={(e) => setRow({ ...row, contractor_id: e.target.value })} className={`${field} min-w-[180px]`} aria-label="Contractor"><option value="">Direct labour</option>{contractorOptions}</select>
                  <input list="labour-cats" required value={row.category} onChange={(e) => setRow({ ...row, category: e.target.value })} className={`${field} w-36`} aria-label="Category" />
                  <datalist id="labour-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
                  <input required type="number" min={0} step={1} placeholder="Headcount" value={row.headcount} onChange={(e) => setRow({ ...row, headcount: e.target.value })} className={`${field} w-28`} aria-label="Headcount" />
                  <input type="number" min={0} step="any" placeholder="Wage/day ₹" value={row.rate} onChange={(e) => setRow({ ...row, rate: e.target.value })} className={`${field} w-28`} aria-label="Daily wage" />
                  <input type="number" min={0} step="any" placeholder="OT hrs" value={row.overtime_hours} onChange={(e) => setRow({ ...row, overtime_hours: e.target.value })} className={`${field} w-20`} aria-label="Overtime hours" />
                  <input type="number" min={0} step="any" placeholder="OT ₹/hr" value={row.overtime_rate} onChange={(e) => setRow({ ...row, overtime_rate: e.target.value })} className={`${field} w-24`} aria-label="Overtime rate" />
                  <input placeholder="Work area / note" value={row.note} onChange={(e) => setRow({ ...row, note: e.target.value })} className={`${field} flex-1 min-w-[140px]`} aria-label="Note" />
                  <span className="text-sm tabular-nums text-slate-500 w-24 text-right">{inr(labourAmount({ headcount: Number(row.headcount), rate: Number(row.rate), overtime_hours: Number(row.overtime_hours), overtime_rate: Number(row.overtime_rate) }))}</span>
                  <button disabled={busy || !projectId} className={btn}><Plus className="w-4 h-4" />Add</button>
                </form>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
                {!dayEntries ? <Loading /> : dayEntries.length === 0 ? <Empty title="No labour recorded for this day" /> : (
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-slate-50 text-slate-500 text-left"><tr>{['Contractor', 'Category', 'Heads', 'Wage', 'OT', 'Amount', 'Note', ''].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {dayEntries.map((e) => (
                        <tr key={e.id}>
                          <td className="px-4 py-2.5">{e.contractor_id ? cName.get(e.contractor_id) : 'Direct'}</td><td className="px-4 py-2.5">{e.category}</td>
                          <td className="px-4 py-2.5 tabular-nums font-semibold">{e.headcount}</td><td className="px-4 py-2.5 tabular-nums">{inr(e.rate)}</td>
                          <td className="px-4 py-2.5 tabular-nums">{e.overtime_hours ? `${e.overtime_hours}h × ${inr(e.overtime_rate)}` : '—'}</td>
                          <td className="px-4 py-2.5 tabular-nums font-medium">{inr(e.amount)}</td><td className="px-4 py-2.5 text-xs text-slate-500">{e.note}</td>
                          <td className="px-4 py-2.5 text-right">{perms.manage && <button onClick={async () => { await deleteLabour(e.id).catch((x) => toast.error(x.message)); loadDay(); loadAll(); }} className="p-1 text-red-600" aria-label="Delete entry"><Trash2 className="w-4 h-4" /></button>}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-semibold"><td className="px-4 py-2.5" colSpan={2}>Total</td><td className="px-4 py-2.5">{dayTotal.heads}</td><td colSpan={2} /><td className="px-4 py-2.5">{inr(dayTotal.amt)}</td><td colSpan={2} /></tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {tab === 'contractors' && (
            <div className="space-y-4">
              {perms.manage && (
                <div className="grid lg:grid-cols-2 gap-4">
                  <form onSubmit={saveContractor} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                    <p className="font-semibold text-sm">{con.id ? 'Edit contractor' : 'Add contractor / labour gang'}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input required placeholder="Name" value={con.name ?? ''} onChange={(e) => setCon({ ...con, name: e.target.value })} className={field} aria-label="Contractor name" />
                      <input placeholder="Trade (e.g. Masonry)" value={con.trade ?? ''} onChange={(e) => setCon({ ...con, trade: e.target.value })} className={field} aria-label="Trade" />
                      <input placeholder="Phone" value={con.phone ?? ''} onChange={(e) => setCon({ ...con, phone: e.target.value })} className={field} aria-label="Phone" />
                      <input placeholder="GSTIN / PAN" value={con.tax_id ?? ''} onChange={(e) => setCon({ ...con, tax_id: e.target.value })} className={field} aria-label="Tax ID" />
                    </div>
                    <div className="flex gap-2"><button disabled={busy} className={btn}>Save</button>{con.id && <button type="button" onClick={() => setCon({})} className={btnGhost}>Cancel</button>}</div>
                  </form>
                  <form onSubmit={savePayment} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                    <p className="font-semibold text-sm flex items-center gap-2"><Wallet className="w-4 h-4" />Record payment / advance</p>
                    <div className="grid grid-cols-2 gap-2">
                      <select required value={pay.contractor_id} onChange={(e) => setPay({ ...pay, contractor_id: e.target.value })} className={field} aria-label="Contractor"><option value="">Contractor…</option>{contractorOptions}</select>
                      <select value={pay.kind} onChange={(e) => setPay({ ...pay, kind: e.target.value as any })} className={field} aria-label="Type"><option value="payment">Payment</option><option value="advance">Advance</option></select>
                      <input required type="number" min={1} step="any" placeholder="Amount ₹" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className={field} aria-label="Amount" />
                      <input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} className={field} aria-label="Date" />
                      <input placeholder="UTR / cheque / note" value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} className={`${field} col-span-2`} aria-label="Reference" />
                    </div>
                    <button disabled={busy} className={btn}>Record</button>
                  </form>
                </div>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
                {contractors.length === 0 ? <Empty title="No contractors yet" /> : (
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-slate-50 text-slate-500 text-left"><tr>{['Contractor', 'Phone', 'Man-days', 'Wages earned', 'Paid + advances', 'Balance due', ''].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {contractors.map((c) => {
                        const b = balances.get(c.id) ?? { earned: 0, paid: 0, balance: 0, mandays: 0 };
                        return (
                          <tr key={c.id}>
                            <td className="px-4 py-2.5 font-medium">{c.name}<span className="block text-xs text-slate-400">{c.trade}</span></td>
                            <td className="px-4 py-2.5">{c.phone ? <a href={`tel:${c.phone}`} className="underline">{c.phone}</a> : '—'}</td>
                            <td className="px-4 py-2.5 tabular-nums">{b.mandays}</td><td className="px-4 py-2.5 tabular-nums">{inr(b.earned)}</td><td className="px-4 py-2.5 tabular-nums">{inr(b.paid)}</td>
                            <td className={`px-4 py-2.5 tabular-nums font-semibold ${b.balance > 0 ? 'text-amber-700' : b.balance < 0 ? 'text-blue-700' : ''}`}>{b.balance < 0 ? `Advance ${inr(-b.balance)}` : inr(b.balance)}</td>
                            <td className="px-4 py-2.5 text-right">{perms.manage && <button onClick={() => setCon(c)} className="text-xs underline">Edit</button>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {tab === 'report' && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className={field} aria-label="From" />
                <span className="text-slate-400">to</span>
                <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className={field} aria-label="To" />
                <button onClick={exportReport} disabled={!reportRows.length} className={btnGhost}><Download className="w-4 h-4" />Export Excel</button>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                {([['By category', byKey((e) => e.category)], ['By contractor', byKey((e) => (e.contractor_id ? cName.get(e.contractor_id) ?? '—' : 'Direct'))]] as const).map(([title, rows]) => (
                  <div key={title} className="rounded-2xl border border-slate-200 bg-white">
                    <p className="px-4 py-3 font-semibold border-b border-slate-100">{title}</p>
                    {rows.length === 0 ? <Empty title="No data in range" /> : (
                      <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
                        {rows.map(([k, v]) => <tr key={k}><td className="px-4 py-2">{k}</td><td className="px-4 py-2 tabular-nums text-right">{v.mandays} man-days</td><td className="px-4 py-2 tabular-nums text-right font-medium">{inr(v.amount)}</td></tr>)}
                      </tbody></table>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LabourPage;
