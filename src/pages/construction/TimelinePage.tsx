import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Diamond, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Milestone, timelineRange, DAY } from '../../lib/construction';
import { listMilestones, addMilestone, toggleMilestone, deleteMilestone, listTimelineTasks, setTaskSchedule } from '../../lib/db/construction';
import { useProjectList, useSelectedProject, ProjectPicker, useSuitePerms, field, btn, btnGhost, Stat, Loading, Empty, PageHeader } from './shared';

type Zoom = 'day' | 'week' | 'month';
const PX: Record<Zoom, number> = { day: 36, week: 14, month: 5 };
const STATUS_COLOR: Record<string, string> = {
  done: 'bg-emerald-500', completed: 'bg-emerald-500', approved: 'bg-emerald-500',
  in_progress: 'bg-blue-500', review: 'bg-amber-500', under_review: 'bg-amber-500',
  todo: 'bg-slate-400', pending: 'bg-slate-400', rejected: 'bg-red-500',
};
const toDate = (s?: string | null) => (s ? new Date(s) : null);
const isDone = (s: string) => ['done', 'completed', 'approved'].includes(s);

const TimelinePage: React.FC = () => {
  const projects = useProjectList();
  const [projectId, setProjectId] = useSelectedProject('timeline', projects);
  const perms = useSuitePerms('timeline');
  const [tasks, setTasks] = useState<any[] | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [zoom, setZoom] = useState<Zoom>('week');
  const [ms, setMs] = useState({ name: '', due_date: '' });
  const [editing, setEditing] = useState<{ id: string; start: string; due: string } | null>(null);
  const project = projects?.find((p) => p.id === projectId);

  const load = async () => {
    if (!projectId) return;
    try {
      const [t, m] = await Promise.all([listTimelineTasks(projectId), listMilestones(projectId)]);
      setTasks(t); setMilestones(m);
    } catch (e: any) { toast.error(e.message); setTasks([]); }
  };
  useEffect(() => { setTasks(null); load(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const bars = useMemo(() => (tasks ?? []).map((t) => {
    const end = toDate(t.completed_at && isDone(t.status) ? t.completed_at : t.due_date);
    let start = toDate(t.start_date) ?? toDate(t.created_at);
    if (start && end && start > end) start = new Date(end.getTime() - DAY);
    return { ...t, start, end };
  }).filter((t) => t.start && t.end), [tasks]);
  const unscheduled = (tasks ?? []).filter((t) => !t.due_date);

  const range = useMemo(() => timelineRange([
    ...bars.flatMap((b) => [b.start, b.end]), ...milestones.map((m) => toDate(m.due_date)),
    toDate(project?.startDate?.toDate?.().toISOString?.() ?? null), toDate(project?.expectedEndDate?.toDate?.().toISOString?.() ?? null),
  ]), [bars, milestones, project]);
  const px = PX[zoom];
  const x = (d: Date) => ((d.getTime() - range.start.getTime()) / DAY) * px;
  const width = range.days * px;
  const now = new Date();
  const overdue = bars.filter((b) => !isDone(b.status) && b.end < now).length;
  const nextMs = milestones.filter((m) => m.status === 'pending').sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  const ticks = useMemo(() => {
    const out: { left: number; label: string; major: boolean }[] = [];
    const d = new Date(range.start);
    while (d <= range.end) {
      const major = zoom === 'day' ? d.getDay() === 1 : zoom === 'week' ? d.getDay() === 1 : d.getDate() === 1;
      const show = zoom === 'day' || major;
      if (show) out.push({ left: x(d), major, label: zoom === 'month' ? d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }) : d.toLocaleDateString(undefined, { day: 'numeric', month: zoom === 'day' ? undefined : 'short' }) });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, [range, zoom, px]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSchedule = async () => {
    if (!editing) return;
    if (editing.start && editing.due && editing.start > editing.due) { toast.error('Start must be before due date'); return; }
    try {
      await setTaskSchedule(editing.id, editing.start ? new Date(editing.start).toISOString() : null, editing.due ? new Date(editing.due + 'T18:00:00').toISOString() : null);
      setEditing(null); await load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader title="Project timeline" subtitle="Gantt view of tasks and milestones. Bars run from start to due date (or completion).">
        <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden" role="radiogroup" aria-label="Zoom">
          {(['day', 'week', 'month'] as Zoom[]).map((z) => <button key={z} role="radio" aria-checked={zoom === z} onClick={() => setZoom(z)} className={`px-3 h-9 text-sm capitalize ${zoom === z ? 'bg-slate-900 text-white' : 'bg-white'}`}>{z}</button>)}
        </div>
      </PageHeader>
      {!tasks ? <Loading /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Scheduled tasks" value={bars.length} hint={`${unscheduled.length} without a due date`} />
            <Stat label="Completed" value={`${bars.filter((b) => isDone(b.status)).length} / ${bars.length}`} />
            <Stat label="Overdue" value={overdue} tone={overdue ? 'bad' : 'good'} />
            <Stat label="Next milestone" value={nextMs ? nextMs.name : '—'} hint={nextMs?.due_date} />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {bars.length === 0 && milestones.length === 0 ? <Empty title="Nothing to plot yet">Give tasks in this project a due date, or add milestones below.</Empty> : (
              <div className="flex">
                <div className="w-56 shrink-0 border-r border-slate-200">
                  <div className="h-10 border-b border-slate-200 bg-slate-50 px-3 flex items-center text-xs font-medium text-slate-500">Task</div>
                  {milestones.length > 0 && <div className="h-9 border-b border-slate-100 px-3 flex items-center text-xs font-semibold text-slate-600">Milestones</div>}
                  {bars.map((b) => (
                    <div key={b.id} className="h-9 border-b border-slate-100 px-3 flex items-center gap-2 text-sm">
                      <Link to={`/app/tasks/${b.id}`} className="truncate hover:underline flex-1" title={b.title}>{b.title}</Link>
                      {perms.manage && <button onClick={() => setEditing({ id: b.id, start: b.start.toISOString().slice(0, 10), due: b.due_date?.slice(0, 10) ?? '' })} className="text-[11px] text-slate-400 hover:text-slate-700">dates</button>}
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto flex-1">
                  <div style={{ width }} className="relative">
                    <div className="h-10 border-b border-slate-200 bg-slate-50 relative">
                      {ticks.map((t, i) => <span key={i} className={`absolute top-0 h-full border-l ${t.major ? 'border-slate-300' : 'border-slate-200'} text-[10px] text-slate-500 pl-1 pt-3 whitespace-nowrap`} style={{ left: t.left }}>{t.label}</span>)}
                    </div>
                    <div className="absolute top-10 bottom-0 w-px bg-red-500 z-10" style={{ left: x(now) }} title="Today" />
                    {ticks.filter((t) => t.major).map((t, i) => <div key={i} className="absolute top-10 bottom-0 w-px bg-slate-100" style={{ left: t.left }} />)}
                    {milestones.length > 0 && (
                      <div className="h-9 border-b border-slate-100 relative">
                        {milestones.map((m) => {
                          const d = new Date(m.due_date + 'T12:00:00');
                          const late = m.status === 'pending' && d < now;
                          return <span key={m.id} className="absolute top-1.5 -translate-x-1/2 flex items-center gap-1 text-[11px] whitespace-nowrap" style={{ left: x(d) }} title={`${m.name} — ${m.due_date}`}>
                            <Diamond className={`w-4 h-4 ${m.status === 'done' ? 'fill-emerald-500 text-emerald-600' : late ? 'fill-red-500 text-red-600' : 'fill-amber-400 text-amber-500'}`} />{m.name}
                          </span>;
                        })}
                      </div>
                    )}
                    {bars.map((b) => {
                      const left = x(b.start), w = Math.max(px * 0.6, x(b.end) - left);
                      const late = !isDone(b.status) && b.end < now;
                      return (
                        <div key={b.id} className="h-9 border-b border-slate-100 relative">
                          <div className={`absolute top-2 h-5 rounded-md ${late ? 'bg-red-500' : STATUS_COLOR[b.status] ?? 'bg-slate-400'} opacity-90`} style={{ left, width: w }}
                            title={`${b.title}\n${b.start.toLocaleDateString()} → ${b.end.toLocaleDateString()} · ${String(b.status).replace('_', ' ')}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-400" />To do</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" />In progress</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500" />In review</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500" />Done</span>
            <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" />Overdue</span>
            <span className="inline-flex items-center gap-1"><span className="w-px h-3 bg-red-500" />Today</span>
          </p>

          {editing && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap gap-2 items-center">
              <span className="text-sm font-semibold">Reschedule “{bars.find((b) => b.id === editing.id)?.title}”</span>
              <label className="text-xs text-slate-500 flex items-center gap-1">Start<input type="date" value={editing.start} onChange={(e) => setEditing({ ...editing, start: e.target.value })} className={field} /></label>
              <label className="text-xs text-slate-500 flex items-center gap-1">Due<input type="date" value={editing.due} onChange={(e) => setEditing({ ...editing, due: e.target.value })} className={field} /></label>
              <button onClick={saveSchedule} className={btn}>Save</button><button onClick={() => setEditing(null)} className={btnGhost}>Cancel</button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white">
            <p className="px-4 py-3 font-semibold border-b border-slate-100">Milestones</p>
            {perms.manage && (
              <form onSubmit={async (e) => { e.preventDefault(); try { await addMilestone({ project_id: projectId, ...ms, created_by: perms.uid }); setMs({ name: '', due_date: '' }); load(); } catch (err: any) { toast.error(err.message); } }} className="p-4 flex flex-wrap gap-2 border-b border-slate-100">
                <input required placeholder="Milestone (e.g. Roof slab cast)" value={ms.name} onChange={(e) => setMs({ ...ms, name: e.target.value })} className={`${field} flex-1 min-w-[200px]`} aria-label="Milestone name" />
                <input required type="date" value={ms.due_date} onChange={(e) => setMs({ ...ms, due_date: e.target.value })} className={field} aria-label="Due date" />
                <button className={btn}><Plus className="w-4 h-4" />Add</button>
              </form>
            )}
            {milestones.length === 0 ? <Empty title="No milestones yet" /> : (
              <ul className="divide-y divide-slate-100">
                {milestones.map((m) => (
                  <li key={m.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    <input type="checkbox" checked={m.status === 'done'} disabled={!perms.manage} onChange={async (e) => { await toggleMilestone(m.id, e.target.checked).catch((x) => toast.error(x.message)); load(); }} aria-label={`Mark ${m.name} done`} />
                    <span className={`flex-1 ${m.status === 'done' ? 'line-through text-slate-400' : ''}`}>{m.name}</span>
                    <span className={`tabular-nums ${m.status === 'pending' && m.due_date < now.toISOString().slice(0, 10) ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>{m.due_date}</span>
                    {perms.manage && <button onClick={async () => { await deleteMilestone(m.id).catch((x) => toast.error(x.message)); load(); }} className="p-1 text-red-600" aria-label={`Delete ${m.name}`}><Trash2 className="w-4 h-4" /></button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default TimelinePage;
