import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Download, Plus, Trash2, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { BoqItem, boqTotals, costSummary, parseBoqRows } from '../../lib/construction';
import { listBoq, createBoqItems, updateBoqItem, deleteBoqItem, projectActuals } from '../../lib/db/construction';
import { useProjectList, useSelectedProject, ProjectPicker, useSuitePerms, inr, qty, field, btn, btnGhost, Stat, Loading, Empty, PageHeader } from './shared';

const blank = { code: '', description: '', category: '', unit: 'cum', quantity: '', rate: '' };

const BoqPage: React.FC = () => {
  const projects = useProjectList();
  const [projectId, setProjectId] = useSelectedProject('boq', projects);
  const perms = useSuitePerms('boq');
  const [items, setItems] = useState<BoqItem[] | null>(null);
  const [actuals, setActuals] = useState<{ materialReceipts: number; labour: number; expenses: number } | null>(null);
  const [draft, setDraft] = useState(blank);
  const [edits, setEdits] = useState<Record<string, Partial<BoqItem>>>({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const project = projects?.find((p) => p.id === projectId);

  const load = async () => {
    if (!projectId) return;
    setItems(null);
    try {
      const [b, a] = await Promise.all([listBoq(projectId), projectActuals(projectId)]);
      setItems(b); setActuals(a); setEdits({});
    } catch (e: any) { toast.error(e.message); setItems([]); }
  };
  useEffect(() => { load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => items && actuals ? costSummary({ budget: Number(project?.budget) || 0, boq: items, ...actuals }) : null, [items, actuals, project]);
  const groups = useMemo(() => {
    const g = new Map<string, BoqItem[]>();
    for (const i of items ?? []) { const k = i.category || 'General'; g.set(k, [...(g.get(k) ?? []), i]); }
    return [...g.entries()];
  }, [items]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createBoqItems(projectId, [{ ...draft, quantity: Number(draft.quantity), rate: Number(draft.rate), executed_qty: 0 }], perms.uid);
      setDraft({ ...blank, category: draft.category, unit: draft.unit });
      await load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const saveEdits = async () => {
    setBusy(true);
    try {
      await Promise.all(Object.entries(edits).map(([id, patch]) => updateBoqItem(id, patch)));
      toast.success('BOQ updated');
      await load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const importFile = async (f: File) => {
    try {
      const wb = XLSX.read(await f.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const parsed = parseBoqRows(rows);
      if (!parsed.length) { toast.error('No rows found. Use columns: Code, Description, Category, Unit, Quantity, Rate.'); return; }
      if (!window.confirm(`Import ${parsed.length} BOQ items into ${project?.name}?`)) return;
      setBusy(true);
      await createBoqItems(projectId, parsed, perms.uid);
      toast.success(`Imported ${parsed.length} items`);
      await load();
    } catch (err: any) { toast.error(err.message ?? 'Could not read the file'); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const exportXlsx = () => {
    const rows = (items ?? []).map((i) => ({
      Code: i.code ?? '', Description: i.description, Category: i.category ?? '', Unit: i.unit, Quantity: i.quantity, Rate: i.rate,
      Amount: i.quantity * i.rate, Executed: i.executed_qty, 'Executed value': i.executed_qty * i.rate,
      'Progress %': i.quantity ? Math.round((i.executed_qty / i.quantity) * 100) : 0,
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Code: '', Description: '', Category: '', Unit: '', Quantity: '', Rate: '' }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BOQ');
    XLSX.writeFile(wb, `BOQ_${(project?.name ?? 'project').replace(/[^\w]+/g, '_')}.xlsx`);
  };

  const val = (i: BoqItem, k: keyof BoqItem) => (edits[i.id]?.[k] ?? i[k]) as number;
  const setVal = (i: BoqItem, k: keyof BoqItem, v: string) => setEdits((e) => ({ ...e, [i.id]: { ...e[i.id], [k]: Number(v) } }));

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader title="BOQ & cost control" subtitle="Plan quantities, track executed work and compare earned value with actual spend.">
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
        <button onClick={exportXlsx} className={btnGhost} disabled={!items?.length}><Download className="w-4 h-4" />Export</button>
        {perms.manage && <>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} className={btnGhost} disabled={!projectId || busy}><Upload className="w-4 h-4" />Import Excel</button>
        </>}
      </PageHeader>

      {projects && !projects.length ? <Empty title="No projects yet">Create a project first.</Empty> : !items || !summary ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Stat label="Budget" value={summary.budget ? inr(summary.budget) : '—'} hint={summary.budget ? undefined : 'Set on the project'} />
            <Stat label="BOQ value" value={inr(summary.boqValue)} hint={`${items.length} items`} />
            <Stat label="Work done (earned)" value={inr(summary.earnedValue)} hint={`${Math.round(summary.progress * 100)}% complete`} />
            <Stat label="Actual cost" value={inr(summary.actual.total)} hint={`Mat ${inr(summary.actual.materials)} · Lab ${inr(summary.actual.labour)} · Exp ${inr(summary.actual.expenses)}`} />
            <Stat label="Cost efficiency (CPI)" value={summary.cpi ? summary.cpi.toFixed(2) : '—'} tone={summary.cpi === null ? 'default' : summary.cpi >= 1 ? 'good' : summary.cpi >= 0.9 ? 'warn' : 'bad'} hint={summary.cpi === null ? 'Needs progress & spend' : summary.cpi >= 1 ? 'Under budget' : 'Over budget'} />
            <Stat label="Forecast at completion" value={summary.forecast ? inr(summary.forecast) : '—'} tone={summary.variance === null ? 'default' : summary.variance >= 0 ? 'good' : 'bad'} hint={summary.variance === null ? undefined : `${summary.variance >= 0 ? 'Saving' : 'Overrun'} ${inr(Math.abs(summary.variance))}`} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead className="bg-slate-50 text-slate-500 text-left">
                  <tr>{['Code', 'Description', 'Unit', 'Qty', 'Rate', 'Amount', 'Executed', 'Progress', ''].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {groups.length === 0 && <tr><td colSpan={9}><Empty title="No BOQ items yet">Add items below or import an Excel sheet with Code, Description, Category, Unit, Quantity, Rate columns.</Empty></td></tr>}
                  {groups.map(([cat, rows]) => {
                    const t = boqTotals(rows);
                    return (
                      <React.Fragment key={cat}>
                        <tr className="bg-slate-50/70 border-t border-slate-200"><td colSpan={5} className="px-3 py-2 font-semibold">{cat}</td><td className="px-3 py-2 font-semibold tabular-nums">{inr(t.planned)}</td><td className="px-3 py-2 tabular-nums text-slate-500">{inr(t.earned)}</td><td className="px-3 py-2 text-slate-500">{Math.round(t.progress * 100)}%</td><td /></tr>
                        {rows.map((i) => {
                          const q = val(i, 'quantity'), r = val(i, 'rate'), ex = val(i, 'executed_qty');
                          const pct = q ? Math.min(100, Math.round((ex / q) * 100)) : 0;
                          return (
                            <tr key={i.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-xs text-slate-500">{i.code}</td>
                              <td className="px-3 py-2">{i.description}</td>
                              <td className="px-3 py-2">{i.unit}</td>
                              <td className="px-3 py-2">{perms.manage ? <input type="number" min={0} step="any" value={q} onChange={(e) => setVal(i, 'quantity', e.target.value)} className={`${field} w-24`} aria-label={`Quantity for ${i.description}`} /> : qty(q)}</td>
                              <td className="px-3 py-2">{perms.manage ? <input type="number" min={0} step="any" value={r} onChange={(e) => setVal(i, 'rate', e.target.value)} className={`${field} w-24`} aria-label={`Rate for ${i.description}`} /> : inr(r, 2)}</td>
                              <td className="px-3 py-2 tabular-nums font-medium">{inr(q * r)}</td>
                              <td className="px-3 py-2">{perms.manage ? <input type="number" min={0} step="any" value={ex} onChange={(e) => setVal(i, 'executed_qty', e.target.value)} className={`${field} w-24`} aria-label={`Executed quantity for ${i.description}`} /> : qty(ex)}</td>
                              <td className="px-3 py-2"><div className="flex items-center gap-2"><div className="w-16 h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div><span className="text-xs tabular-nums">{pct}%</span></div></td>
                              <td className="px-3 py-2 text-right">{perms.manage && <button onClick={async () => { if (window.confirm('Delete this BOQ item?')) { await deleteBoqItem(i.id).catch((e) => toast.error(e.message)); load(); } }} className="p-1.5 rounded hover:bg-red-50 text-red-600" aria-label={`Delete ${i.description}`}><Trash2 className="w-4 h-4" /></button>}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {perms.manage && (
              <div className="border-t border-slate-200 p-3 space-y-3 bg-slate-50/50">
                {Object.keys(edits).length > 0 && <button onClick={saveEdits} disabled={busy} className={btn}><Save className="w-4 h-4" />Save {Object.keys(edits).length} change{Object.keys(edits).length > 1 ? 's' : ''}</button>}
                <form onSubmit={add} className="flex flex-wrap gap-2 items-center">
                  <input placeholder="Code" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} className={`${field} w-20`} aria-label="Code" />
                  <input required placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={`${field} flex-1 min-w-[200px]`} aria-label="Description" />
                  <input placeholder="Category (e.g. Substructure)" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className={`${field} w-48`} aria-label="Category" list="boq-cats" />
                  <datalist id="boq-cats">{groups.map(([c]) => <option key={c} value={c} />)}</datalist>
                  <select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className={`${field} w-24`} aria-label="Unit">{['cum', 'sqm', 'rmt', 'kg', 'MT', 'nos', 'bag', 'LS', 'sqft', 'cft'].map((u) => <option key={u}>{u}</option>)}</select>
                  <input required type="number" min={0} step="any" placeholder="Qty" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} className={`${field} w-24`} aria-label="Quantity" />
                  <input required type="number" min={0} step="any" placeholder="Rate ₹" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} className={`${field} w-28`} aria-label="Rate" />
                  <button disabled={busy || !projectId} className={btn}><Plus className="w-4 h-4" />Add item</button>
                </form>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500">Actual cost = material receipts (Materials) + labour wages (Labour) + project expenses (Expenses). CPI = earned value ÷ actual cost.</p>
        </>
      )}
    </div>
  );
};

export default BoqPage;
