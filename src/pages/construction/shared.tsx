import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getProjects } from '../../lib/firestore';
import { Project } from '../../types';
import { useAuthStore } from '../../store/authStore';

export const inr = (v: number, frac = 0) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: frac }).format(Number.isFinite(v) ? v : 0);
export const qty = (v: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 }).format(v || 0);
export const today = () => new Date().toISOString().slice(0, 10);

export const field = 'h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10';
export const btn = 'h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-2';
export const btnGhost = 'h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium hover:bg-slate-50 inline-flex items-center justify-center gap-1.5';

/** Projects the current user can see (same rules as the Projects page). */
export function useProjectList() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  useEffect(() => { getProjects().then(setProjects).catch(() => setProjects([])); }, []);
  return projects;
}

/** Remembers the last selected project per module. */
export function useSelectedProject(module: string, projects: Project[] | null) {
  const key = `tp.${module}.project`;
  const [id, setId] = useState<string>(() => { try { return localStorage.getItem(key) ?? ''; } catch { return ''; } });
  useEffect(() => {
    if (!projects?.length) return;
    if (!projects.some((p) => p.id === id)) setId(projects[0].id);
  }, [projects]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { if (id) localStorage.setItem(key, id); } catch { /* ignore */ } }, [id, key]);
  return [id, setId] as const;
}

export const ProjectPicker: React.FC<{ projects: Project[] | null; value: string; onChange: (id: string) => void; allowAll?: boolean }> = ({ projects, value, onChange, allowAll }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={`${field} min-w-[200px]`} aria-label="Project">
    {allowAll && <option value="">All projects</option>}
    {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
  </select>
);

/**
 * Suite permissions. New permission keys (e.g. materials_manage) can be set
 * per role in Role Management; roles that predate them fall back to the
 * closest existing project permissions so nobody loses access.
 */
export function useSuitePerms(module: 'boq' | 'materials' | 'labour' | 'inspections' | 'timeline') {
  const { permissions, role, appUser } = useAuthStore();
  const p = permissions as Record<string, boolean | undefined>;
  const level = role?.level ?? 0;
  const view = p[`${module}_view`] ?? (p.projects_view !== false);
  const manage = p[`${module}_manage`] ?? (level >= 80 || !!p.projects_edit || !!p.projects_create);
  const approve = p[`${module}_approve`] ?? (level >= 80 || !!p.projects_edit);
  return { view, manage, approve, uid: appUser?.id ?? '', name: appUser?.name?.trim() ?? '' };
}

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'default' | 'good' | 'bad' | 'warn' }> = ({ label, value, hint, tone = 'default' }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-xs text-slate-500">{label}</p>
    <p className={`text-xl font-bold mt-1 tabular-nums ${tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : tone === 'warn' ? 'text-amber-700' : 'text-slate-900'}`}>{value}</p>
    {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
  </div>
);

export const Tabs: React.FC<{ tabs: [string, string][]; value: string; onChange: (v: string) => void }> = ({ tabs, value, onChange }) => (
  <div role="tablist" className="flex gap-1 border-b border-slate-200 overflow-x-auto">
    {tabs.map(([k, l]) => (
      <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
        className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${value === k ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{l}</button>
    ))}
  </div>
);

export const Loading = () => <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
export const Empty: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="py-12 text-center"><p className="font-semibold text-slate-700">{title}</p>{children && <div className="text-sm text-slate-500 mt-1">{children}</div>}</div>
);

export const PageHeader: React.FC<{ title: string; subtitle?: string; children?: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-xl font-bold tracking-tight">{title}</h1>{subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}</div>
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);
