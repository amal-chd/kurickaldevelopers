import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, X, Truck, PackagePlus, PackageMinus, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Material, MaterialMovement, MaterialRequest, MovementKind, stockByMaterial, avgRate } from '../../lib/construction';
import { listMaterials, upsertMaterial, listMovements, addMovement, deleteMovement, listRequests, createRequest, setRequestStatus } from '../../lib/db/construction';
import { useProjectList, useSelectedProject, ProjectPicker, useSuitePerms, inr, qty, field, btn, btnGhost, Stat, Tabs, Loading, Empty, PageHeader, today } from './shared';

const REQ_STATUS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-800', approved: 'bg-blue-50 text-blue-700', ordered: 'bg-indigo-50 text-indigo-700',
  received: 'bg-emerald-50 text-emerald-700', rejected: 'bg-slate-100 text-slate-500',
};

const MaterialsPage: React.FC = () => {
  const projects = useProjectList();
  const [projectId, setProjectId] = useSelectedProject('materials', projects);
  const perms = useSuitePerms('materials');
  const [tab, setTab] = useState('stock');
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [moves, setMoves] = useState<MaterialMovement[] | null>(null);
  const [requests, setRequests] = useState<MaterialRequest[] | null>(null);
  const [mv, setMv] = useState({ kind: 'receipt' as MovementKind, material_id: '', quantity: '', rate: '', supplier: '', reference: '', note: '', date: today() });
  const [rq, setRq] = useState({ material_id: '', quantity: '', required_by: '', note: '' });
  const [mat, setMat] = useState<Partial<Material>>({ unit: 'bag' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [m, mm, r] = await Promise.all([listMaterials(), projectId ? listMovements(projectId) : Promise.resolve([]), projectId ? listRequests(projectId) : Promise.resolve([])]);
      setMaterials(m); setMoves(mm); setRequests(r);
    } catch (e: any) { toast.error(e.message); setMaterials([]); setMoves([]); setRequests([]); }
  };
  useEffect(() => { setMoves(null); load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map((materials ?? []).map((m) => [m.id, m])), [materials]);
  const stock = useMemo(() => stockByMaterial(moves ?? []), [moves]);
  const stockRows = useMemo(() => [...stock.entries()].map(([id, s]) => ({ m: byId.get(id), s })).filter((r) => r.m).sort((a, b) => a.m!.name.localeCompare(b.m!.name)), [stock, byId]);
  const low = stockRows.filter((r) => r.m!.min_stock > 0 && r.s.quantity < r.m!.min_stock);
  const receivedValue = stockRows.reduce((s, r) => s + r.s.receivedValue, 0);
  const stockValue = stockRows.reduce((s, r) => s + Math.max(0, r.s.quantity) * avgRate(r.s), 0);
  const pending = (requests ?? []).filter((r) => r.status === 'pending').length;

  const submitMove = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = Number(mv.quantity);
    if (mv.kind === 'issue') {
      const avail = stock.get(mv.material_id)?.quantity ?? 0;
      if (q > avail && !window.confirm(`Only ${qty(avail)} in stock. Record the issue anyway?`)) return;
    }
    setBusy(true);
    try {
      await addMovement({ ...mv, project_id: projectId, quantity: q, rate: Number(mv.rate) || byId.get(mv.material_id)?.default_rate || 0, created_by: perms.uid, created_by_name: perms.name });
      toast.success(mv.kind === 'receipt' ? 'Receipt recorded' : mv.kind === 'issue' ? 'Issue recorded' : 'Saved');
      setMv({ ...mv, quantity: '', rate: '', reference: '', note: '' });
      await load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const submitReq = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createRequest({ ...rq, project_id: projectId, quantity: Number(rq.quantity), requested_by: perms.uid, requested_by_name: perms.name });
      toast.success('Request sent for approval');
      setRq({ material_id: '', quantity: '', required_by: '', note: '' });
      await load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const decide = async (r: MaterialRequest, status: MaterialRequest['status']) => {
    try {
      await setRequestStatus(r.id, status, perms.uid);
      if (status === 'received') {
        const m = byId.get(r.material_id);
        await addMovement({ kind: 'receipt', material_id: r.material_id, project_id: r.project_id, quantity: r.quantity, rate: m?.default_rate ?? 0, reference: `REQ-${r.id.slice(0, 6)}`, note: 'Received against request', created_by: perms.uid, created_by_name: perms.name });
      }
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const saveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { await upsertMaterial(mat); toast.success('Material saved'); setMat({ unit: mat.unit }); await load(); }
    catch (err: any) { toast.error(/duplicate|unique/i.test(err.message) ? 'A material with this name already exists' : err.message); } finally { setBusy(false); }
  };

  const matOptions = (materials ?? []).filter((m) => m.is_active).map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader title="Materials & inventory" subtitle="Site-wise stock, receipts, issues and material requests.">
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
      </PageHeader>

      {!materials || !moves ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Materials in stock" value={stockRows.filter((r) => r.s.quantity > 0).length} />
            <Stat label="Stock value (avg. rate)" value={inr(stockValue)} />
            <Stat label="Received to date" value={inr(receivedValue)} hint="Counts towards project cost" />
            <Stat label="Low stock / pending requests" value={`${low.length} / ${pending}`} tone={low.length ? 'warn' : 'default'} />
          </div>

          <Tabs value={tab} onChange={setTab} tabs={[['stock', 'Stock'], ['moves', 'Receipts & issues'], ['requests', `Requests${pending ? ` (${pending})` : ''}`], ['catalog', 'Material catalogue']]} />

          {tab === 'stock' && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
              {stockRows.length === 0 ? <Empty title="No stock movements on this project yet">Record a receipt to start tracking stock.</Empty> : (
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-slate-50 text-slate-500 text-left"><tr>{['Material', 'In stock', 'Received', 'Issued', 'Avg. rate', 'Value', ''].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {stockRows.map(({ m, s }) => {
                      const isLow = m!.min_stock > 0 && s.quantity < m!.min_stock;
                      return (
                        <tr key={m!.id}>
                          <td className="px-4 py-2.5 font-medium">{m!.name}<span className="block text-xs text-slate-400">{m!.category}</span></td>
                          <td className={`px-4 py-2.5 tabular-nums font-semibold ${isLow ? 'text-amber-700' : ''}`}>{qty(s.quantity)} {m!.unit}</td>
                          <td className="px-4 py-2.5 tabular-nums">{qty(s.receivedQty)}</td>
                          <td className="px-4 py-2.5 tabular-nums">{qty(s.issuedQty)}</td>
                          <td className="px-4 py-2.5 tabular-nums">{inr(avgRate(s), 2)}</td>
                          <td className="px-4 py-2.5 tabular-nums">{inr(Math.max(0, s.quantity) * avgRate(s))}</td>
                          <td className="px-4 py-2.5">{isLow && <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertTriangle className="w-3.5 h-3.5" />Below {qty(m!.min_stock)}</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'moves' && (
            <div className="space-y-4">
              {perms.manage && (
                <form onSubmit={submitMove} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex gap-2">
                    {([['receipt', 'Receive', PackagePlus], ['issue', 'Issue to work', PackageMinus], ['return', 'Return to store', Truck]] as const).map(([k, l, I]) => (
                      <button type="button" key={k} onClick={() => setMv({ ...mv, kind: k })} className={`${btnGhost} ${mv.kind === k ? '!bg-slate-900 !text-white !border-slate-900' : ''}`}><I className="w-4 h-4" />{l}</button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select required value={mv.material_id} onChange={(e) => setMv({ ...mv, material_id: e.target.value, rate: String(byId.get(e.target.value)?.default_rate || '') })} className={`${field} min-w-[200px]`} aria-label="Material"><option value="">Material…</option>{matOptions}</select>
                    <input required type="number" min={0.001} step="any" placeholder="Quantity" value={mv.quantity} onChange={(e) => setMv({ ...mv, quantity: e.target.value })} className={`${field} w-28`} aria-label="Quantity" />
                    {mv.kind === 'receipt' && <>
                      <input type="number" min={0} step="any" placeholder="Rate ₹" value={mv.rate} onChange={(e) => setMv({ ...mv, rate: e.target.value })} className={`${field} w-28`} aria-label="Rate" />
                      <input placeholder="Supplier" value={mv.supplier} onChange={(e) => setMv({ ...mv, supplier: e.target.value })} className={`${field} w-40`} aria-label="Supplier" />
                    </>}
                    <input placeholder={mv.kind === 'receipt' ? 'Invoice / challan no.' : 'Reference'} value={mv.reference} onChange={(e) => setMv({ ...mv, reference: e.target.value })} className={`${field} w-40`} aria-label="Reference" />
                    <input type="date" value={mv.date} onChange={(e) => setMv({ ...mv, date: e.target.value })} className={field} aria-label="Date" />
                    <input placeholder={mv.kind === 'issue' ? 'Used for (e.g. 2nd floor slab)' : 'Note'} value={mv.note} onChange={(e) => setMv({ ...mv, note: e.target.value })} className={`${field} flex-1 min-w-[160px]`} aria-label="Note" />
                    <button disabled={busy || !projectId} className={btn}>Save</button>
                  </div>
                  {!materials.length && <p className="text-xs text-amber-700">Add materials in the Material catalogue tab first.</p>}
                </form>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
                {moves.length === 0 ? <Empty title="No movements yet" /> : (
                  <table className="w-full text-sm min-w-[720px]">
                    <thead className="bg-slate-50 text-slate-500 text-left"><tr>{['Date', 'Type', 'Material', 'Qty', 'Rate', 'Supplier / ref', 'By', ''].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {moves.map((m) => (
                        <tr key={m.id}>
                          <td className="px-4 py-2.5 whitespace-nowrap">{m.date}</td>
                          <td className="px-4 py-2.5 capitalize">{m.kind}</td>
                          <td className="px-4 py-2.5">{byId.get(m.material_id)?.name ?? '—'}{m.note && <span className="block text-xs text-slate-400">{m.note}</span>}</td>
                          <td className={`px-4 py-2.5 tabular-nums font-medium ${m.quantity < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{m.quantity > 0 ? '+' : ''}{qty(m.quantity)}</td>
                          <td className="px-4 py-2.5 tabular-nums">{m.rate ? inr(m.rate, 2) : '—'}</td>
                          <td className="px-4 py-2.5 text-xs">{[m.supplier, m.reference].filter(Boolean).join(' · ') || '—'}</td>
                          <td className="px-4 py-2.5 text-xs">{m.created_by_name}</td>
                          <td className="px-4 py-2.5 text-right">{perms.approve && <button onClick={async () => { if (window.confirm('Delete this entry?')) { await deleteMovement(m.id).catch((e) => toast.error(e.message)); load(); } }} className="text-xs text-red-600 underline">Delete</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {tab === 'requests' && (
            <div className="space-y-4">
              <form onSubmit={submitReq} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap gap-2 items-center">
                <span className="text-sm font-semibold mr-2">Request material</span>
                <select required value={rq.material_id} onChange={(e) => setRq({ ...rq, material_id: e.target.value })} className={`${field} min-w-[200px]`} aria-label="Material"><option value="">Material…</option>{matOptions}</select>
                <input required type="number" min={0.001} step="any" placeholder="Quantity" value={rq.quantity} onChange={(e) => setRq({ ...rq, quantity: e.target.value })} className={`${field} w-28`} aria-label="Quantity" />
                <label className="text-xs text-slate-500 flex items-center gap-1">Needed by<input type="date" value={rq.required_by} onChange={(e) => setRq({ ...rq, required_by: e.target.value })} className={field} /></label>
                <input placeholder="Purpose" value={rq.note} onChange={(e) => setRq({ ...rq, note: e.target.value })} className={`${field} flex-1 min-w-[160px]`} aria-label="Purpose" />
                <button disabled={busy || !projectId} className={btn}>Submit</button>
              </form>
              <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
                {(requests ?? []).length === 0 ? <Empty title="No requests" /> : requests!.map((r) => {
                  const m = byId.get(r.material_id);
                  return (
                    <div key={r.id} className="p-4 flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[220px]">
                        <p className="font-medium">{qty(r.quantity)} {m?.unit} · {m?.name ?? '—'}</p>
                        <p className="text-xs text-slate-500">{r.requested_by_name} · {new Date(r.created_at).toLocaleDateString()}{r.required_by && ` · needed by ${r.required_by}`}{r.note && ` · ${r.note}`}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${REQ_STATUS[r.status]}`}>{r.status}</span>
                      {perms.approve && r.status === 'pending' && <>
                        <button onClick={() => decide(r, 'approved')} className={btnGhost}><Check className="w-4 h-4 text-emerald-600" />Approve</button>
                        <button onClick={() => decide(r, 'rejected')} className={btnGhost}><X className="w-4 h-4 text-red-600" />Reject</button>
                      </>}
                      {perms.manage && r.status === 'approved' && <button onClick={() => decide(r, 'ordered')} className={btnGhost}>Mark ordered</button>}
                      {perms.manage && (r.status === 'approved' || r.status === 'ordered') && <button onClick={() => decide(r, 'received')} className={btnGhost}>Mark received (adds to stock)</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'catalog' && (
            <div className="space-y-4">
              {perms.manage && (
                <form onSubmit={saveMaterial} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap gap-2 items-center">
                  <input required placeholder="Material name (e.g. OPC Cement 53)" value={mat.name ?? ''} onChange={(e) => setMat({ ...mat, name: e.target.value })} className={`${field} flex-1 min-w-[200px]`} aria-label="Name" />
                  <input placeholder="Category" value={mat.category ?? ''} onChange={(e) => setMat({ ...mat, category: e.target.value })} className={`${field} w-36`} aria-label="Category" />
                  <select value={mat.unit} onChange={(e) => setMat({ ...mat, unit: e.target.value })} className={`${field} w-24`} aria-label="Unit">{['bag', 'kg', 'MT', 'cum', 'cft', 'nos', 'ltr', 'sqft', 'sqm', 'rmt', 'load', 'trip'].map((u) => <option key={u}>{u}</option>)}</select>
                  <input type="number" min={0} step="any" placeholder="Std. rate ₹" value={mat.default_rate ?? ''} onChange={(e) => setMat({ ...mat, default_rate: Number(e.target.value) })} className={`${field} w-28`} aria-label="Standard rate" />
                  <input type="number" min={0} step="any" placeholder="Min. stock" value={mat.min_stock ?? ''} onChange={(e) => setMat({ ...mat, min_stock: Number(e.target.value) })} className={`${field} w-28`} aria-label="Minimum stock" />
                  <button disabled={busy} className={btn}><Plus className="w-4 h-4" />{mat.id ? 'Update' : 'Add'}</button>
                  {mat.id && <button type="button" onClick={() => setMat({ unit: 'bag' })} className={btnGhost}>Cancel</button>}
                </form>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
                {materials.length === 0 ? <Empty title="No materials yet" /> : (
                  <table className="w-full text-sm min-w-[560px]">
                    <thead className="bg-slate-50 text-slate-500 text-left"><tr>{['Material', 'Category', 'Unit', 'Std. rate', 'Min. stock', ''].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {materials.map((m) => (
                        <tr key={m.id} className={m.is_active ? '' : 'opacity-50'}>
                          <td className="px-4 py-2.5 font-medium">{m.name}</td><td className="px-4 py-2.5">{m.category}</td><td className="px-4 py-2.5">{m.unit}</td>
                          <td className="px-4 py-2.5">{inr(m.default_rate, 2)}</td><td className="px-4 py-2.5">{qty(m.min_stock)}</td>
                          <td className="px-4 py-2.5 text-right">{perms.manage && <button onClick={() => setMat(m)} className="text-xs underline">Edit</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MaterialsPage;
