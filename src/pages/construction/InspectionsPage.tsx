import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, Check, ClipboardCheck, Minus, Plus, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Inspection, InspectionTemplate, PunchItem, ChecklistResult, scoreInspection } from '../../lib/construction';
import {
  ensureDefaultTemplates, saveTemplate, deleteTemplate, listInspections, createInspection, saveInspection, deleteInspection,
  listPunch, createPunch, updatePunch, deletePunch,
} from '../../lib/db/construction';
import { getAllUsers } from '../../lib/firestore';
import { uploadToSupabase, STORAGE_BUCKETS } from '../../lib/storage';
import { getActiveOrgId } from '../../lib/tenant';
import { AppUser } from '../../types';
import { useProjectList, useSelectedProject, ProjectPicker, useSuitePerms, field, btn, btnGhost, Stat, Tabs, Loading, Empty, PageHeader } from './shared';

const PRIORITY: Record<string, string> = { low: 'bg-slate-100 text-slate-600', medium: 'bg-blue-50 text-blue-700', high: 'bg-amber-50 text-amber-800', critical: 'bg-red-50 text-red-700' };
const PSTATUS: [PunchItem['status'], string][] = [['open', 'Open'], ['in_progress', 'In progress'], ['ready_for_review', 'Ready for review'], ['closed', 'Closed']];
const ISTATUS: Record<string, string> = { draft: 'bg-slate-100 text-slate-600', passed: 'bg-emerald-50 text-emerald-700', failed: 'bg-red-50 text-red-700' };

const InspectionsPage: React.FC = () => {
  const projects = useProjectList();
  const [projectId, setProjectId] = useSelectedProject('inspections', projects);
  const perms = useSuitePerms('inspections');
  const [tab, setTab] = useState('inspections');
  const [templates, setTemplates] = useState<InspectionTemplate[] | null>(null);
  const [inspections, setInspections] = useState<Inspection[] | null>(null);
  const [punch, setPunch] = useState<PunchItem[] | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [open, setOpen] = useState<Inspection | null>(null);
  const [newInsp, setNewInsp] = useState({ template_id: '', location: '' });
  const [pf, setPf] = useState({ title: '', location: '', priority: 'medium', assignee_id: '', due_date: '', description: '' });
  const [pFilter, setPFilter] = useState<'active' | PunchItem['status']>('active');
  const [tpl, setTpl] = useState<{ id?: string; name: string; category: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!projectId) return;
    try {
      const [t, i, p] = await Promise.all([ensureDefaultTemplates(perms.uid), listInspections(projectId), listPunch(projectId)]);
      setTemplates(t); setInspections(i); setPunch(p);
    } catch (e: any) { toast.error(e.message); setTemplates([]); setInspections([]); setPunch([]); }
  };
  useEffect(() => { setInspections(null); load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { getAllUsers().then(setUsers); }, []);
  const userName = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = templates?.find((x) => x.id === newInsp.template_id);
    if (!t) return;
    setBusy(true);
    try {
      const created = await createInspection({
        project_id: projectId, template_id: t.id, title: t.name, category: t.category, location: newInsp.location,
        results: t.items.map((i) => ({ ...i, result: null })), inspector_id: perms.uid, inspector_name: perms.name,
      });
      setOpen(created); setNewInsp({ template_id: '', location: '' });
      await load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const setResult = (id: string, patch: Partial<ChecklistResult>) =>
    setOpen((o) => (o ? { ...o, results: o.results.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : o));

  const persist = async (complete: boolean) => {
    if (!open) return;
    const s = scoreInspection(open.results);
    if (complete && !s.complete) { toast.error('Mark every item Pass, Fail or N/A before completing'); return; }
    setBusy(true);
    try {
      await saveInspection(open.id, {
        results: open.results, notes: open.notes, location: open.location, score: s.score,
        status: complete ? s.status : 'draft', completed_at: complete ? new Date().toISOString() : null,
      });
      if (complete && s.failed > 0 && window.confirm(`${s.failed} item(s) failed. Create punch-list items for them?`)) {
        await createPunch(open.results.filter((r) => r.result === 'fail').map((r) => ({
          project_id: open.project_id, inspection_id: open.id, title: r.label, description: r.note || `Failed in "${open.title}"`,
          location: open.location ?? undefined, priority: open.category === 'safety' ? 'high' : 'medium', created_by: perms.uid,
        })));
        toast.success('Punch items created');
      } else toast.success(complete ? `Inspection ${s.status}` : 'Draft saved');
      if (complete) setOpen(null);
      await load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const addPunch = async (e: React.FormEvent, files?: FileList | null) => {
    e.preventDefault();
    setBusy(true);
    try {
      const photo_urls: string[] = [];
      for (const f of Array.from(files ?? [])) photo_urls.push((await uploadToSupabase(f, STORAGE_BUCKETS.documents, `punch/${getActiveOrgId()}/${projectId}`)).url);
      await createPunch([{ ...pf, project_id: projectId, priority: pf.priority as PunchItem['priority'], photo_urls, created_by: perms.uid }]);
      setPf({ title: '', location: pf.location, priority: 'medium', assignee_id: '', due_date: '', description: '' });
      (e.target as HTMLFormElement).reset();
      await load();
    } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const addPhoto = async (p: PunchItem, file: File) => {
    try {
      const { url } = await uploadToSupabase(file, STORAGE_BUCKETS.documents, `punch/${getActiveOrgId()}/${p.project_id}`);
      await updatePunch(p.id, { photo_urls: [...p.photo_urls, url] });
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const saveTpl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpl) return;
    const items = tpl.text.split('\n').map((l) => l.trim()).filter(Boolean).map((label, i) => ({ id: `i${i + 1}`, label: label.replace(/^\*\s*/, ''), required: label.startsWith('*') }));
    if (!items.length) { toast.error('Add at least one checklist item'); return; }
    setBusy(true);
    try { await saveTemplate({ id: tpl.id, name: tpl.name, category: tpl.category, items }); setTpl(null); await load(); toast.success('Template saved'); }
    catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };

  const punchShown = (punch ?? []).filter((p) => (pFilter === 'active' ? p.status !== 'closed' : p.status === pFilter));
  const openPunch = (punch ?? []).filter((p) => p.status !== 'closed');
  const overdue = openPunch.filter((p) => p.due_date && p.due_date < new Date().toISOString().slice(0, 10)).length;
  const done = (inspections ?? []).filter((i) => i.status !== 'draft');
  const passRate = done.length ? Math.round((done.filter((i) => i.status === 'passed').length / done.length) * 100) : null;

  // ── Inspection runner ──
  if (open) {
    const s = scoreInspection(open.results);
    return (
      <div className="p-4 sm:p-6 max-w-3xl space-y-4">
        <button onClick={() => setOpen(null)} className="text-sm text-slate-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Back</button>
        <div className="flex flex-wrap items-center gap-3"><h1 className="text-xl font-bold">{open.title}</h1><span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ISTATUS[open.status]}`}>{open.status}</span></div>
        <p className="text-sm text-slate-500">{projects?.find((p) => p.id === open.project_id)?.name} · {open.location || 'No location'} · {open.inspector_name}</p>
        <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
          {open.results.map((r, idx) => (
            <div key={r.id} className="p-4 space-y-2">
              <div className="flex flex-wrap items-start gap-3">
                <p className="flex-1 min-w-[200px] text-sm"><span className="text-slate-400 mr-2">{idx + 1}.</span>{r.label}{r.required && <span className="text-red-500 ml-1" aria-label="required">*</span>}</p>
                <div className="flex gap-1" role="radiogroup" aria-label={`Result for ${r.label}`}>
                  {([['pass', 'Pass', Check, 'bg-emerald-600'], ['fail', 'Fail', X, 'bg-red-600'], ['na', 'N/A', Minus, 'bg-slate-500']] as const).map(([k, l, I, on]) => (
                    <button key={k} role="radio" aria-checked={r.result === k} disabled={!perms.manage} onClick={() => setResult(r.id, { result: k })}
                      className={`h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1 border ${r.result === k ? `${on} text-white border-transparent` : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><I className="w-3.5 h-3.5" />{l}</button>
                  ))}
                </div>
              </div>
              {r.result === 'fail' && <input value={r.note ?? ''} onChange={(e) => setResult(r.id, { note: e.target.value })} placeholder="What's wrong? (becomes the punch item description)" className={`${field} w-full`} aria-label={`Note for ${r.label}`} />}
            </div>
          ))}
        </div>
        <textarea value={open.notes ?? ''} onChange={(e) => setOpen({ ...open, notes: e.target.value })} rows={3} placeholder="Overall remarks" className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" aria-label="Remarks" />
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-slate-600 flex-1">{s.passed} passed · {s.failed} failed{s.score !== null && ` · score ${s.score}%`}{!s.complete && ` · ${open.results.filter((x) => x.result === null).length} remaining`}</p>
          {perms.manage && <>
            <button disabled={busy} onClick={() => persist(false)} className={btnGhost}>Save draft</button>
            <button disabled={busy} onClick={() => persist(true)} className={btn}><ClipboardCheck className="w-4 h-4" />Complete inspection</button>
          </>}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader title="Inspections & punch list" subtitle="Quality and safety checklists, handover snags and defect tracking.">
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
      </PageHeader>
      {!inspections || !punch || !templates ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Inspections done" value={done.length} hint={`${inspections.length - done.length} in draft`} />
            <Stat label="Pass rate" value={passRate === null ? '—' : `${passRate}%`} tone={passRate === null ? 'default' : passRate >= 90 ? 'good' : passRate >= 70 ? 'warn' : 'bad'} />
            <Stat label="Open punch items" value={openPunch.length} hint={`${openPunch.filter((p) => p.priority === 'critical' || p.priority === 'high').length} high / critical`} />
            <Stat label="Overdue punch items" value={overdue} tone={overdue ? 'bad' : 'default'} />
          </div>
          <Tabs value={tab} onChange={setTab} tabs={[['inspections', 'Inspections'], ['punch', `Punch list (${openPunch.length})`], ['templates', 'Checklist templates']]} />

          {tab === 'inspections' && (
            <div className="space-y-4">
              {perms.manage && (
                <form onSubmit={start} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap gap-2 items-center">
                  <span className="text-sm font-semibold mr-2">New inspection</span>
                  <select required value={newInsp.template_id} onChange={(e) => setNewInsp({ ...newInsp, template_id: e.target.value })} className={`${field} min-w-[220px]`} aria-label="Checklist"><option value="">Checklist…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.items.length})</option>)}</select>
                  <input placeholder="Location (e.g. Block A, 3rd floor slab)" value={newInsp.location} onChange={(e) => setNewInsp({ ...newInsp, location: e.target.value })} className={`${field} flex-1 min-w-[200px]`} aria-label="Location" />
                  <button disabled={busy || !projectId} className={btn}>Start</button>
                </form>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
                {inspections.length === 0 ? <Empty title="No inspections yet">Start one from a checklist above.</Empty> : inspections.map((i) => (
                  <div key={i.id} className="p-4 flex flex-wrap items-center gap-3">
                    <button onClick={() => setOpen(i)} className="flex-1 min-w-[220px] text-left">
                      <p className="font-medium">{i.title}</p>
                      <p className="text-xs text-slate-500 capitalize">{i.category} · {i.location || 'No location'} · {i.inspector_name} · {new Date(i.completed_at ?? i.created_at).toLocaleDateString()}</p>
                    </button>
                    {i.score !== null && <span className="text-sm font-semibold tabular-nums">{i.score}%</span>}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${ISTATUS[i.status]}`}>{i.status}</span>
                    {perms.approve && <button onClick={async () => { if (window.confirm('Delete this inspection?')) { await deleteInspection(i.id).catch((e) => toast.error(e.message)); load(); } }} className="p-1 text-red-600" aria-label="Delete inspection"><Trash2 className="w-4 h-4" /></button>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'punch' && (
            <div className="space-y-4">
              <form onSubmit={(e) => addPunch(e, (e.currentTarget.elements.namedItem('photos') as HTMLInputElement)?.files)} className="rounded-2xl border border-slate-200 bg-white p-4 grid sm:grid-cols-2 lg:grid-cols-6 gap-2">
                <input required placeholder="Issue (e.g. Hollow tiles near balcony door)" value={pf.title} onChange={(e) => setPf({ ...pf, title: e.target.value })} className={`${field} lg:col-span-2`} aria-label="Issue" />
                <input placeholder="Location" value={pf.location} onChange={(e) => setPf({ ...pf, location: e.target.value })} className={field} aria-label="Location" />
                <select value={pf.priority} onChange={(e) => setPf({ ...pf, priority: e.target.value })} className={field} aria-label="Priority">{Object.keys(PRIORITY).map((p) => <option key={p} value={p}>{p}</option>)}</select>
                <select value={pf.assignee_id} onChange={(e) => setPf({ ...pf, assignee_id: e.target.value })} className={field} aria-label="Assignee"><option value="">Assign to…</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                <input type="date" value={pf.due_date} onChange={(e) => setPf({ ...pf, due_date: e.target.value })} className={field} aria-label="Due date" />
                <label className={`${btnGhost} cursor-pointer lg:col-span-2`}><Camera className="w-4 h-4" />Photos<input name="photos" type="file" accept="image/*" capture="environment" multiple hidden /></label>
                <input placeholder="Details" value={pf.description} onChange={(e) => setPf({ ...pf, description: e.target.value })} className={`${field} lg:col-span-3`} aria-label="Details" />
                <button disabled={busy || !projectId} className={btn}><Plus className="w-4 h-4" />Add</button>
              </form>
              <div className="flex gap-2 flex-wrap">
                {([['active', 'Not closed'], ...PSTATUS] as [string, string][]).map(([k, l]) => <button key={k} onClick={() => setPFilter(k as any)} className={`${btnGhost} ${pFilter === k ? '!bg-slate-900 !text-white' : ''}`}>{l}</button>)}
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {punchShown.length === 0 ? <div className="col-span-full rounded-2xl border border-slate-200 bg-white"><Empty title="Nothing here" /></div> : punchShown.map((p) => {
                  const overdueP = p.status !== 'closed' && p.due_date && p.due_date < new Date().toISOString().slice(0, 10);
                  const canClose = perms.approve;
                  return (
                    <div key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
                      <div className="flex items-start gap-2"><p className="font-medium flex-1">{p.title}</p><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${PRIORITY[p.priority]}`}>{p.priority}</span></div>
                      {p.description && <p className="text-sm text-slate-600">{p.description}</p>}
                      <p className="text-xs text-slate-500">{p.location || 'No location'} · {p.assignee_id ? userName.get(p.assignee_id) ?? 'Assigned' : 'Unassigned'}{p.due_date && <span className={overdueP ? 'text-red-600 font-semibold' : ''}> · due {p.due_date}</span>}</p>
                      {p.photo_urls.length > 0 && <div className="flex gap-1.5 flex-wrap">{p.photo_urls.map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt="Punch item photo" className="w-14 h-14 rounded-lg object-cover border" /></a>)}</div>}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <select value={p.status} onChange={async (e) => {
                          const st = e.target.value as PunchItem['status'];
                          if (st === 'closed' && !canClose) { toast.error('Only approvers can close items — mark Ready for review'); return; }
                          await updatePunch(p.id, { status: st, ...(st === 'closed' ? { closed_by: perms.uid } : {}) }).catch((x) => toast.error(x.message)); load();
                        }} className={`${field} h-8 text-xs`} aria-label="Status">{PSTATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                        <label className={`${btnGhost} h-8 text-xs cursor-pointer`}><Camera className="w-3.5 h-3.5" />Photo<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && addPhoto(p, e.target.files[0])} /></label>
                        {perms.approve && <button onClick={async () => { if (window.confirm('Delete this item?')) { await deletePunch(p.id).catch((x) => toast.error(x.message)); load(); } }} className="h-8 px-2 text-red-600" aria-label="Delete item"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'templates' && (
            <div className="space-y-4">
              {perms.approve && !tpl && <button onClick={() => setTpl({ name: '', category: 'quality', text: '' })} className={btn}><Plus className="w-4 h-4" />New checklist</button>}
              {tpl && (
                <form onSubmit={saveTpl} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <input required placeholder="Checklist name" value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} className={`${field} flex-1`} aria-label="Checklist name" />
                    <select value={tpl.category} onChange={(e) => setTpl({ ...tpl, category: e.target.value })} className={field} aria-label="Category">{['quality', 'safety', 'handover', 'other'].map((c) => <option key={c}>{c}</option>)}</select>
                  </div>
                  <textarea required rows={8} value={tpl.text} onChange={(e) => setTpl({ ...tpl, text: e.target.value })} placeholder={'One item per line. Prefix with * to make it mandatory.\n* Helmets worn by all workers\nScaffold tags valid'} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-mono" aria-label="Checklist items" />
                  <div className="flex gap-2"><button disabled={busy} className={btn}>Save checklist</button><button type="button" onClick={() => setTpl(null)} className={btnGhost}>Cancel</button></div>
                </form>
              )}
              <div className="grid md:grid-cols-2 gap-3">
                {templates.map((t) => (
                  <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-2"><p className="font-semibold flex-1">{t.name}</p><span className="text-xs capitalize text-slate-500">{t.category} · {t.items.length} items</span></div>
                    <ul className="mt-2 text-sm text-slate-600 list-disc pl-5 space-y-0.5 max-h-32 overflow-auto">{t.items.map((i) => <li key={i.id}>{i.label}{i.required && ' *'}</li>)}</ul>
                    {perms.approve && <div className="mt-3 flex gap-3 text-xs">
                      <button onClick={() => setTpl({ id: t.id, name: t.name, category: t.category, text: t.items.map((i) => (i.required ? '* ' : '') + i.label).join('\n') })} className="underline">Edit</button>
                      <button onClick={async () => { if (window.confirm('Delete this checklist? Past inspections are kept.')) { await deleteTemplate(t.id).catch((e) => toast.error(e.message)); load(); } }} className="underline text-red-600">Delete</button>
                    </div>}
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

export default InspectionsPage;
