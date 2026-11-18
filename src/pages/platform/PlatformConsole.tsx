import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate, useParams, Link } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Layers, CreditCard, LifeBuoy, Users, ScrollText, Settings, Megaphone, Inbox,
  Loader2, ArrowLeft, LogOut, ShieldAlert, Search, Send,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { sendEmailVerification } from 'firebase/auth';
import toast from 'react-hot-toast';
import { auth } from '../../firebase/config';
import { saasApi } from '../../lib/saasApi';
import { useTenantStore, formatMoney, MODULES } from '../../lib/tenant';
import { useAuthStore } from '../../store/authStore';
import { logout } from '../../hooks/useAuth';
import { TicketThread, TICKET_STATUS } from '../saas/SupportPage';

// ─── shared bits ─────────────────────────────────────────────────────────────
function useApi<T>(action: string, params: Record<string, unknown> = {}, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    saasApi<T>(action, params).then((d) => alive && setData(d)).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, [action, tick, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, reload: () => setTick((t) => t + 1) };
}
const Loading = () => <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
const Err: React.FC<{ msg: string }> = ({ msg }) => <div className="m-6 rounded-xl bg-red-50 text-red-700 p-4 text-sm">{msg}</div>;
const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string; action?: React.ReactNode }> = ({ title, children, className = '', action }) => (
  <section className={`rounded-2xl border border-slate-200 bg-white ${className}`}>
    {title && <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="font-semibold">{title}</h2>{action}</div>}
    {children}
  </section>
);
const input = 'h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900';
const ORG_STATUS: Record<string, string> = {
  trialing: 'bg-indigo-50 text-indigo-700', active: 'bg-emerald-50 text-emerald-700', past_due: 'bg-amber-50 text-amber-800',
  suspended: 'bg-red-50 text-red-700', cancelled: 'bg-slate-100 text-slate-600', expired: 'bg-red-50 text-red-700',
};
const Pill: React.FC<{ s: string; map?: Record<string, string> }> = ({ s, map = ORG_STATUS }) => <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${map[s] ?? 'bg-slate-100'}`}>{s.replace('_', ' ')}</span>;
const d = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');
const Table: React.FC<{ head: string[]; children: React.ReactNode }> = ({ head, children }) => (
  <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]"><thead className="bg-slate-50 text-slate-500 text-left"><tr>{head.map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div>
);

// ─── Overview ────────────────────────────────────────────────────────────────
const Overview: React.FC = () => {
  const { data, error } = useApi<any>('admin_overview');
  if (error) return <Err msg={error} />;
  if (!data) return <Loading />;
  const t = data.totals;
  const kpis = [
    ['MRR', formatMoney(t.mrr)], ['ARR', formatMoney(t.arr)], ['Revenue (12 mo)', formatMoney(t.revenue12m)],
    ['Companies', t.orgs], ['Paying', t.paying], ['In trial', t.trials], ['Users', t.users], ['Open tickets', t.openTickets],
  ];
  const chart = data.months.map((m: any) => ({ month: m.month.slice(2), revenue: m.revenue / 100, signups: m.signups }));
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(([k, v]) => <Card key={k as string} className="p-4"><p className="text-xs text-slate-500">{k}</p><p className="text-2xl font-bold mt-1 tabular-nums">{v}</p></Card>)}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Revenue by month (₹)">
          <div className="h-64 p-4"><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" /><XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} tickLine={false} axisLine={false} width={60} /><Tooltip formatter={(v: number) => formatMoney(v * 100)} /><Bar dataKey="revenue" fill="#0F172A" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Card>
        <Card title="New companies by month">
          <div className="h-64 p-4"><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" /><XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} /><YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} width={30} /><Tooltip /><Bar dataKey="signups" fill="#F59E0B" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Card>
      </div>
      <div className="grid md:grid-cols-3 gap-5">
        {[['By status', data.byStatus], ['By plan', data.byPlan], ['By industry', data.byIndustry]].map(([title, obj]: any) => (
          <Card key={title} title={title}><ul className="p-4 space-y-2 text-sm">{Object.entries(obj).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]: any) => <li key={k} className="flex justify-between"><span className="capitalize text-slate-600">{k.replace('_', ' ')}</span><span className="font-semibold tabular-nums">{v}</span></li>)}</ul></Card>
        ))}
      </div>
    </div>
  );
};

// ─── Organisations ───────────────────────────────────────────────────────────
const Orgs: React.FC = () => {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const { data, error } = useApi<{ orgs: any[] }>('admin_list_orgs', { status, search: q }, [status, q]);
  const navigate = useNavigate();
  return (
    <Card title="Companies" action={
      <form onSubmit={(e) => { e.preventDefault(); setQ(search); }} className="flex gap-2">
        <div className="relative"><Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or owner email" className={`${input} pl-8 w-48`} aria-label="Search companies" /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input} aria-label="Filter by status"><option value="">All statuses</option>{Object.keys(ORG_STATUS).map((s) => <option key={s} value={s}>{s}</option>)}</select>
      </form>}>
      {error ? <Err msg={error} /> : !data ? <Loading /> : (
        <Table head={['Company', 'Owner', 'Plan', 'Status', 'Users', 'Trial / period end', 'Created']}>
          {data.orgs.map((o) => (
            <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/platform/orgs/${o.id}`)}>
              <td className="px-4 py-3 font-medium">{o.name}{o.is_legacy && <span className="ml-2 text-[10px] font-bold text-slate-400">LEGACY</span>}<span className="block text-xs text-slate-400 capitalize">{o.industry}</span></td>
              <td className="px-4 py-3 text-slate-600">{o.owner_email ?? '—'}</td>
              <td className="px-4 py-3 capitalize">{o.plan_id}</td>
              <td className="px-4 py-3"><Pill s={o.status} /></td>
              <td className="px-4 py-3 tabular-nums">{o.user_count}</td>
              <td className="px-4 py-3">{o.status === 'trialing' ? d(o.trial_ends_at) : d(o.current_period_end)}</td>
              <td className="px-4 py-3">{d(o.created_at)}</td>
            </tr>
          ))}
        </Table>
      )}
    </Card>
  );
};

const OrgDetail: React.FC = () => {
  const { id = '' } = useParams();
  const { data, error, reload } = useApi<any>('admin_get_org', { id }, [id]);
  const plans = useApi<{ plans: any[] }>('admin_list_plans');
  const [edit, setEdit] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setEdit({
      status: data.org.status, plan_id: data.org.plan_id, trial_ends_at: data.org.trial_ends_at?.slice(0, 10) ?? '',
      max_users: data.org.limit_overrides?.max_users ?? '', max_projects: data.org.limit_overrides?.max_projects ?? '',
      feature_overrides: data.org.feature_overrides ?? {},
    });
  }, [data]);
  if (error) return <Err msg={error} />;
  if (!data || !edit) return <Loading />;

  const save = async () => {
    setSaving(true);
    try {
      const limit_overrides: Record<string, number> = {};
      if (edit.max_users !== '') limit_overrides.max_users = Number(edit.max_users);
      if (edit.max_projects !== '') limit_overrides.max_projects = Number(edit.max_projects);
      await saasApi('admin_update_org', { id, status: edit.status, plan_id: edit.plan_id, trial_ends_at: edit.trial_ends_at || undefined, limit_overrides, feature_overrides: edit.feature_overrides });
      toast.success('Company updated');
      reload();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };
  const fo = edit.feature_overrides as Record<string, boolean>;
  const cycleOverride = (k: string) => {
    const next = { ...fo };
    if (fo[k] === undefined) next[k] = true; else if (fo[k] === true) next[k] = false; else delete next[k];
    setEdit({ ...edit, feature_overrides: next });
  };

  return (
    <div className="space-y-5">
      <Link to="/platform/orgs" className="text-sm text-slate-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Companies</Link>
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{data.org.name}</h1><Pill s={data.org.status} />{data.org.is_legacy && <span className="text-xs font-bold text-slate-400">LEGACY</span>}</div>
      <p className="text-sm text-slate-500">ID {data.org.id} · {data.org.owner_email} · {data.org.phone ?? 'no phone'} · created {d(data.org.created_at)} · {data.usage.users} users · {data.usage.projects} projects</p>

      <Card title="Subscription controls">
        <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <label className="text-sm font-medium">Status<select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className={`${input} w-full mt-1`}>{Object.keys(ORG_STATUS).map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="text-sm font-medium">Plan<select value={edit.plan_id ?? ''} onChange={(e) => setEdit({ ...edit, plan_id: e.target.value })} className={`${input} w-full mt-1`}>{(plans.data?.plans ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="text-sm font-medium">Trial ends<input type="date" value={edit.trial_ends_at} onChange={(e) => setEdit({ ...edit, trial_ends_at: e.target.value })} className={`${input} w-full mt-1`} /></label>
          <label className="text-sm font-medium">Max users override<input type="number" min={0} placeholder={`plan: ${data.plan?.max_users ?? '∞'}`} value={edit.max_users} onChange={(e) => setEdit({ ...edit, max_users: e.target.value })} className={`${input} w-full mt-1`} /></label>
          <label className="text-sm font-medium">Max projects override<input type="number" min={0} placeholder={`plan: ${data.plan?.max_projects ?? '∞'}`} value={edit.max_projects} onChange={(e) => setEdit({ ...edit, max_projects: e.target.value })} className={`${input} w-full mt-1`} /></label>
        </div>
        <div className="px-5 pb-5">
          <p className="text-sm font-medium mb-2">Feature overrides <span className="text-xs font-normal text-slate-500">(click: force on → force off → plan default)</span></p>
          <div className="flex flex-wrap gap-2">
            {MODULES.map((m) => {
              const inPlan = data.plan?.features?.includes(m.key);
              const st = fo[m.key];
              const cls = st === true ? 'bg-emerald-600 text-white border-emerald-600' : st === false ? 'bg-red-600 text-white border-red-600' : inPlan ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200';
              return <button key={m.key} type="button" onClick={() => cycleOverride(m.key)} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${cls}`}>{m.label}{st !== undefined ? (st ? ' +' : ' −') : ''}</button>;
            })}
          </div>
          <button onClick={save} disabled={saving} className="mt-5 h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
        </div>
      </Card>

      {data.org.settings?.deletion_requested_at && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">Owner requested deletion on {new Date(data.org.settings.deletion_requested_at).toLocaleString()} ({data.org.settings.deletion_requested_by}).</div>
      )}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title={`Members (${data.members.length})`}>
          <ul className="divide-y divide-slate-100 text-sm max-h-80 overflow-auto">{data.members.map((m: any) => <li key={m.id} className="px-5 py-2.5 flex justify-between gap-3"><span className="truncate">{m.name ?? m.email}<span className="block text-xs text-slate-400">{m.email}</span></span><span className="text-xs text-slate-500 shrink-0">{m.is_owner ? 'Owner' : m.status}</span></li>)}</ul>
        </Card>
        <Card title="Subscriptions">
          <ul className="divide-y divide-slate-100 text-sm max-h-80 overflow-auto">{data.subscriptions.length === 0 ? <li className="px-5 py-3 text-slate-500">None</li> : data.subscriptions.map((s: any) => <li key={s.id} className="px-5 py-2.5 flex justify-between"><span className="capitalize">{s.plan_id} · {s.billing_cycle}<span className="block text-xs text-slate-400 font-mono">{s.provider_subscription_id}</span></span><span className="text-xs">{s.status}<span className="block text-slate-400">{d(s.current_period_end)}</span></span></li>)}</ul>
        </Card>
        <Card title="Payments">
          <ul className="divide-y divide-slate-100 text-sm max-h-80 overflow-auto">{data.payments.length === 0 ? <li className="px-5 py-3 text-slate-500">None</li> : data.payments.map((p: any) => <li key={p.id} className="px-5 py-2.5 flex justify-between"><span>{p.invoice_number}<span className="block text-xs text-slate-400">{d(p.paid_at)}</span></span><span className="font-semibold">{formatMoney(p.amount, p.currency)}</span></li>)}</ul>
        </Card>
        {!data.org.is_legacy && (
          <Card title="Danger zone" className="lg:col-span-2 border-red-200">
            <div className="p-5 flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-600 flex-1 min-w-[240px]">Permanently delete this workspace: cancels billing, disables its users and deletes all of its data. This cannot be undone — export first if needed.</p>
              <button onClick={async () => {
                const confirm = window.prompt(`Type the workspace name "${data.org.name}" to permanently delete it`);
                if (confirm === null) return;
                try { await saasApi('admin_delete_org', { id, confirm }); toast.success('Workspace deleted'); window.location.assign('/platform/orgs'); } catch (e: any) { toast.error(e.message); }
              }} className="h-9 px-4 rounded-lg bg-red-600 text-white text-sm font-semibold">Delete workspace</button>
            </div>
          </Card>
        )}
        <Card title="Activity">
          <ul className="divide-y divide-slate-100 text-sm max-h-80 overflow-auto">{data.logs.length === 0 ? <li className="px-5 py-3 text-slate-500">None</li> : data.logs.map((l: any) => <li key={l.id} className="px-5 py-2.5"><span className="font-mono text-xs">{l.action}</span><span className="block text-xs text-slate-400">{l.actor_email ?? 'system'} · {new Date(l.created_at).toLocaleString()}</span></li>)}</ul>
        </Card>
      </div>
    </div>
  );
};

// ─── Plans ───────────────────────────────────────────────────────────────────
const blankPlan = { id: '', name: '', tagline: '', description: '', price_monthly: 0, price_yearly: 0, max_users: '', max_projects: '', max_storage_mb: '', features: [] as string[], trial_days: 14, is_public: true, is_active: true, is_custom_pricing: false, highlight: false, sort_order: 10 };
const Plans: React.FC = () => {
  const { data, error, reload } = useApi<{ plans: any[] }>('admin_list_plans');
  const [edit, setEdit] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  if (error) return <Err msg={error} />;
  if (!data) return <Loading />;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saasApi('admin_upsert_plan', { ...edit, price_monthly: Math.round(Number(edit.price_monthly_rs) * 100), price_yearly: Math.round(Number(edit.price_yearly_rs) * 100) });
      toast.success('Plan saved'); setEdit(null); reload();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };
  const open = (p: any) => setEdit({ ...p, max_users: p.max_users ?? '', max_projects: p.max_projects ?? '', max_storage_mb: p.max_storage_mb ?? '', price_monthly_rs: p.price_monthly / 100, price_yearly_rs: p.price_yearly / 100, _new: !p.id });
  return (
    <div className="space-y-5">
      <Card title="Plans" action={<button onClick={() => open(blankPlan)} className="h-8 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold">New plan</button>}>
        <Table head={['Plan', 'Monthly', 'Yearly', 'Users', 'Projects', 'Modules', 'Visibility', '']}>
          {data.plans.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3 font-medium">{p.name}<span className="block text-xs text-slate-400">{p.id}</span></td>
              <td className="px-4 py-3">{p.is_custom_pricing ? 'Custom' : formatMoney(p.price_monthly)}</td>
              <td className="px-4 py-3">{p.is_custom_pricing ? '—' : formatMoney(p.price_yearly)}</td>
              <td className="px-4 py-3">{p.max_users ?? '∞'}</td><td className="px-4 py-3">{p.max_projects ?? '∞'}</td>
              <td className="px-4 py-3">{p.features.length}</td>
              <td className="px-4 py-3 text-xs">{p.is_active ? (p.is_public ? 'Public' : 'Hidden') : 'Archived'}</td>
              <td className="px-4 py-3 text-right"><button onClick={() => open(p)} className="text-sm font-medium underline">Edit</button></td>
            </tr>
          ))}
        </Table>
      </Card>
      {edit && (
        <Card title={edit._new ? 'New plan' : `Edit ${edit.name}`}>
          <form onSubmit={save} className="p-5 space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <label className="text-sm font-medium">ID<input required disabled={!edit._new} value={edit.id} onChange={(e) => setEdit({ ...edit, id: e.target.value })} className={`${input} w-full mt-1`} /></label>
              <label className="text-sm font-medium">Name<input required value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={`${input} w-full mt-1`} /></label>
              <label className="text-sm font-medium">Monthly price (₹, incl. GST)<input type="number" min={0} step="1" value={edit.price_monthly_rs} onChange={(e) => setEdit({ ...edit, price_monthly_rs: e.target.value })} className={`${input} w-full mt-1`} /></label>
              <label className="text-sm font-medium">Yearly price (₹, incl. GST)<input type="number" min={0} step="1" value={edit.price_yearly_rs} onChange={(e) => setEdit({ ...edit, price_yearly_rs: e.target.value })} className={`${input} w-full mt-1`} /></label>
              <label className="text-sm font-medium">Max users<input type="number" min={1} placeholder="unlimited" value={edit.max_users} onChange={(e) => setEdit({ ...edit, max_users: e.target.value })} className={`${input} w-full mt-1`} /></label>
              <label className="text-sm font-medium">Max projects<input type="number" min={1} placeholder="unlimited" value={edit.max_projects} onChange={(e) => setEdit({ ...edit, max_projects: e.target.value })} className={`${input} w-full mt-1`} /></label>
              <label className="text-sm font-medium">Storage (MB)<input type="number" min={0} placeholder="unlimited" value={edit.max_storage_mb} onChange={(e) => setEdit({ ...edit, max_storage_mb: e.target.value })} className={`${input} w-full mt-1`} /></label>
              <label className="text-sm font-medium">Trial days<input type="number" min={0} value={edit.trial_days} onChange={(e) => setEdit({ ...edit, trial_days: e.target.value })} className={`${input} w-full mt-1`} /></label>
            </div>
            <label className="block text-sm font-medium">Tagline<input value={edit.tagline ?? ''} onChange={(e) => setEdit({ ...edit, tagline: e.target.value })} className={`${input} w-full mt-1`} /></label>
            <div className="flex flex-wrap gap-2">
              {MODULES.map((m) => {
                const on = edit.features.includes(m.key);
                return <button type="button" key={m.key} onClick={() => setEdit({ ...edit, features: on ? edit.features.filter((f: string) => f !== m.key) : [...edit.features, m.key] })} className={`text-xs px-2.5 py-1 rounded-full border ${on ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-500'}`}>{m.label}</button>;
              })}
            </div>
            <div className="flex flex-wrap gap-5 text-sm">
              {[['is_public', 'Public on pricing page'], ['is_active', 'Active'], ['highlight', 'Highlight as popular'], ['is_custom_pricing', 'Custom pricing (contact sales)']].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.checked })} />{l}</label>
              ))}
            </div>
            <p className="text-xs text-slate-500">Changing a price creates a new Razorpay plan for new subscriptions; existing subscribers keep their current price.</p>
            <div className="flex gap-2"><button disabled={saving} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Save plan'}</button><button type="button" onClick={() => setEdit(null)} className="h-9 px-4 rounded-lg border text-sm">Cancel</button></div>
          </form>
        </Card>
      )}
    </div>
  );
};

// ─── Billing ─────────────────────────────────────────────────────────────────
const Billing: React.FC = () => {
  const pays = useApi<{ payments: any[] }>('admin_list_payments');
  const subs = useApi<{ subscriptions: any[] }>('admin_list_subscriptions');
  return (
    <div className="space-y-5">
      <Card title="Payments">
        {pays.error ? <Err msg={pays.error} /> : !pays.data ? <Loading /> : pays.data.payments.length === 0 ? <p className="p-5 text-sm text-slate-500">No payments yet.</p> : (
          <Table head={['Invoice', 'Company', 'Amount', 'GST', 'Status', 'Paid', 'Razorpay ID']}>
            {pays.data.payments.map((p) => <tr key={p.id}><td className="px-4 py-3 font-mono text-xs">{p.invoice_number}</td><td className="px-4 py-3"><Link className="underline" to={`/platform/orgs/${p.org_id}`}>{p.organizations?.name}</Link></td><td className="px-4 py-3 font-semibold">{formatMoney(p.amount, p.currency)}</td><td className="px-4 py-3">{formatMoney(p.tax_amount, p.currency)}</td><td className="px-4 py-3 capitalize">{p.status}</td><td className="px-4 py-3">{d(p.paid_at)}</td><td className="px-4 py-3 font-mono text-xs">{p.provider_payment_id}</td></tr>)}
          </Table>
        )}
      </Card>
      <Card title="Subscriptions">
        {subs.error ? <Err msg={subs.error} /> : !subs.data ? <Loading /> : subs.data.subscriptions.length === 0 ? <p className="p-5 text-sm text-slate-500">No subscriptions yet.</p> : (
          <Table head={['Company', 'Plan', 'Cycle', 'Status', 'Period end', 'Cancels', 'Razorpay ID']}>
            {subs.data.subscriptions.map((s) => <tr key={s.id}><td className="px-4 py-3"><Link className="underline" to={`/platform/orgs/${s.org_id}`}>{s.organizations?.name}</Link></td><td className="px-4 py-3 capitalize">{s.plan_id}</td><td className="px-4 py-3">{s.billing_cycle}</td><td className="px-4 py-3">{s.status}</td><td className="px-4 py-3">{d(s.current_period_end)}</td><td className="px-4 py-3">{s.cancel_at_period_end ? 'Yes' : '—'}</td><td className="px-4 py-3 font-mono text-xs">{s.provider_subscription_id}</td></tr>)}
          </Table>
        )}
      </Card>
    </div>
  );
};

// ─── Tickets ─────────────────────────────────────────────────────────────────
const Tickets: React.FC = () => {
  const [status, setStatus] = useState('open');
  const { data, error } = useApi<{ tickets: any[] }>('admin_list_tickets', { status }, [status]);
  const navigate = useNavigate();
  return (
    <Card title="Support tickets" action={<select value={status} onChange={(e) => setStatus(e.target.value)} className={input} aria-label="Status"><option value="">All</option>{Object.keys(TICKET_STATUS).map((s) => <option key={s}>{s}</option>)}</select>}>
      {error ? <Err msg={error} /> : !data ? <Loading /> : data.tickets.length === 0 ? <p className="p-5 text-sm text-slate-500">No tickets.</p> : (
        <Table head={['#', 'Subject', 'Company', 'From', 'Priority', 'Status', 'Last activity']}>
          {data.tickets.map((t) => <tr key={t.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => navigate(`/platform/tickets/${t.id}`)}><td className="px-4 py-3 font-mono text-xs">{t.ticket_number}</td><td className="px-4 py-3 font-medium">{t.subject}<span className="block text-xs text-slate-400 capitalize">{t.category}</span></td><td className="px-4 py-3">{t.organizations?.name}</td><td className="px-4 py-3 text-xs">{t.created_by_email}</td><td className="px-4 py-3 capitalize">{t.priority}</td><td className="px-4 py-3"><Pill s={t.status} map={TICKET_STATUS} /></td><td className="px-4 py-3">{new Date(t.last_reply_at).toLocaleString()}</td></tr>)}
        </Table>
      )}
    </Card>
  );
};
const TicketDetail: React.FC = () => {
  const { id = '' } = useParams();
  const { data, error, reload } = useApi<any>('admin_get_ticket', { id }, [id]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  if (error) return <Err msg={error} />;
  if (!data) return <Loading />;
  const act = async (status?: string) => {
    setBusy(true);
    try { await saasApi('admin_reply_ticket', { id, body, status }); setBody(''); reload(); } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4 max-w-3xl">
      <Link to="/platform/tickets" className="text-sm text-slate-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" />Tickets</Link>
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-xl font-bold">#{data.ticket.ticket_number} {data.ticket.subject}</h1><Pill s={data.ticket.status} map={TICKET_STATUS} /></div>
      <p className="text-sm text-slate-500"><Link to={`/platform/orgs/${data.ticket.org_id}`} className="underline">{data.ticket.organizations?.name}</Link> · {data.ticket.created_by_email} · {data.ticket.priority} priority</p>
      <TicketThread messages={data.messages} />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Reply to the customer…" aria-label="Reply" className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-slate-900" />
      <div className="flex flex-wrap gap-2">
        <button disabled={busy || !body.trim()} onClick={() => act()} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"><Send className="w-4 h-4" />Send reply</button>
        <button disabled={busy} onClick={() => act('resolved')} className="h-9 px-4 rounded-lg border text-sm">{body.trim() ? 'Reply & resolve' : 'Mark resolved'}</button>
        <button disabled={busy} onClick={() => act('closed')} className="h-9 px-4 rounded-lg border text-sm">Close</button>
      </div>
    </div>
  );
};

// ─── Users, Leads, Audit ─────────────────────────────────────────────────────
const PlatformUsers: React.FC = () => {
  const [s, setS] = useState(''); const [q, setQ] = useState('');
  const { data, error } = useApi<{ users: any[] }>('admin_list_users', { search: q }, [q]);
  return (
    <Card title="All users" action={<form onSubmit={(e) => { e.preventDefault(); setQ(s); }}><input value={s} onChange={(e) => setS(e.target.value)} placeholder="Search email" className={input} aria-label="Search users" /></form>}>
      {error ? <Err msg={error} /> : !data ? <Loading /> : (
        <Table head={['Name', 'Email', 'Company', 'Status', 'Joined']}>
          {data.users.map((u) => <tr key={u.id}><td className="px-4 py-3">{u.name ?? '—'}{u.is_owner && <span className="ml-2 text-[10px] font-bold text-amber-600">OWNER</span>}</td><td className="px-4 py-3">{u.email}</td><td className="px-4 py-3"><Link className="underline" to={`/platform/orgs/${u.org_id}`}>{u.organizations?.name}</Link></td><td className="px-4 py-3">{u.status}</td><td className="px-4 py-3">{d(u.created_at)}</td></tr>)}
        </Table>
      )}
    </Card>
  );
};
const LogList: React.FC<{ prefix?: string; title: string; lead?: boolean }> = ({ prefix, title, lead }) => {
  const { data, error } = useApi<{ logs: any[] }>('admin_audit_logs', { action: prefix }, [prefix]);
  return (
    <Card title={title}>
      {error ? <Err msg={error} /> : !data ? <Loading /> : data.logs.length === 0 ? <p className="p-5 text-sm text-slate-500">Nothing yet.</p> : lead ? (
        <Table head={['When', 'Name', 'Email', 'Phone', 'Company', 'Team', 'Interest', 'Message']}>
          {data.logs.map((l) => <tr key={l.id}><td className="px-4 py-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td><td className="px-4 py-3">{l.details.name}</td><td className="px-4 py-3"><a className="underline" href={`mailto:${l.details.email}`}>{l.details.email}</a></td><td className="px-4 py-3">{l.details.phone}</td><td className="px-4 py-3">{l.details.company}</td><td className="px-4 py-3">{l.details.teamSize}</td><td className="px-4 py-3">{l.details.interest}</td><td className="px-4 py-3 max-w-xs truncate" title={l.details.message}>{l.details.message}</td></tr>)}
        </Table>
      ) : (
        <Table head={['When', 'Actor', 'Action', 'Target', 'Details']}>
          {data.logs.map((l) => <tr key={l.id}><td className="px-4 py-3 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td><td className="px-4 py-3 text-xs">{l.actor_email ?? 'system'}</td><td className="px-4 py-3 font-mono text-xs">{l.action}</td><td className="px-4 py-3 text-xs">{l.target_type} {l.target_id?.slice(0, 12)}</td><td className="px-4 py-3 text-xs text-slate-500 max-w-sm truncate" title={JSON.stringify(l.details)}>{JSON.stringify(l.details)}</td></tr>)}
        </Table>
      )}
    </Card>
  );
};

// ─── Broadcast & Settings ────────────────────────────────────────────────────
const Broadcast: React.FC = () => {
  const [f, setF] = useState({ title: '', body: '', ownersOnly: true, orgId: '' });
  const [busy, setBusy] = useState(false);
  const orgs = useApi<{ orgs: any[] }>('admin_list_orgs');
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm('Send this notification now?')) return;
    setBusy(true);
    try { const r = await saasApi<{ sent: number }>('admin_broadcast', { ...f, orgId: f.orgId || undefined }); toast.success(`Sent to ${r.sent} users`); setF({ ...f, title: '', body: '' }); } catch (err: any) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Card title="Platform announcement">
      <form onSubmit={send} className="p-5 space-y-4 max-w-2xl">
        <p className="text-sm text-slate-500">Delivered as an in-app notification (e.g. maintenance windows, new features, billing notices).</p>
        <label className="block text-sm font-medium">Title<input required maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={`${input} w-full mt-1`} /></label>
        <label className="block text-sm font-medium">Message<textarea required maxLength={500} rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm" /></label>
        <div className="flex flex-wrap gap-4 items-center text-sm">
          <select value={f.orgId} onChange={(e) => setF({ ...f, orgId: e.target.value })} className={input} aria-label="Audience company"><option value="">All companies</option>{(orgs.data?.orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          <label className="flex items-center gap-2"><input type="checkbox" checked={f.ownersOnly} onChange={(e) => setF({ ...f, ownersOnly: e.target.checked })} />Owners only</label>
        </div>
        <button disabled={busy} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-60">{busy ? 'Sending…' : 'Send'}</button>
      </form>
    </Card>
  );
};

const PlatformSettings: React.FC = () => {
  const { data, error, reload } = useApi<any>('admin_get_settings');
  const rawRole = useTenantStore((s) => s.platformRole);
  const currentEmail = auth.currentUser?.email?.toLowerCase();
  const isDesignatedOwner = currentEmail === 'admin@taskpilot.app' || currentEmail === 'thekadaapp@gmail.com';
  const role = rawRole || (isDesignatedOwner ? 'owner' : null);
  const [draft, setDraft] = useState<any>(null);
  const [admin, setAdmin] = useState({ email: '', role: 'support' });
  useEffect(() => { if (data) setDraft(data.settings); }, [data]);
  if (error) return <Err msg={error} />;
  if (!data || !draft) return <Loading />;
  const saveKey = async (key: string) => {
    try { await saasApi('admin_update_settings', { key, value: draft[key] }); toast.success('Saved'); reload(); } catch (e: any) { toast.error(e.message); }
  };
  const setAdminRow = async (email: string, r: string, remove = false) => {
    try { await saasApi('admin_set_admin', { email, role: r, remove }); toast.success('Updated'); reload(); setAdmin({ email: '', role: 'support' }); } catch (e: any) { toast.error(e.message); }
  };
  const Field = (key: string, k: string, label: string, type = 'text') => (
    <label className="text-sm font-medium">{label}
      {type === 'checkbox'
        ? <input type="checkbox" className="ml-2" checked={!!draft[key][k]} onChange={(e) => setDraft({ ...draft, [key]: { ...draft[key], [k]: e.target.checked } })} />
        : <input type={type} value={draft[key][k] ?? ''} onChange={(e) => setDraft({ ...draft, [key]: { ...draft[key], [k]: type === 'number' ? Number(e.target.value) : e.target.value } })} className={`${input} w-full mt-1`} />}
    </label>
  );
  return (
    <div className="space-y-5">
      <Card title="Payments gateway">
        <p className="p-5 text-sm">Razorpay: <strong>{data.payments.razorpayConfigured ? `configured (${data.payments.mode} mode)` : 'not configured'}</strong>. Keys are stored as Supabase function secrets (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET) — never in the database or browser.</p>
      </Card>
      <Card title="General">
        <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Field('general', 'product_name', 'Product name')}{Field('general', 'support_email', 'Support email', 'email')}{Field('general', 'default_plan', 'Default trial plan')}
          {Field('general', 'default_trial_days', 'Default trial days', 'number')}{Field('general', 'grace_period_days', 'Grace period after failed payment (days)', 'number')}{Field('general', 'signups_enabled', 'Public sign-ups enabled', 'checkbox')}
        </div>
        <div className="px-5 pb-5"><button onClick={() => saveKey('general')} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold">Save</button></div>
      </Card>
      <Card title="Maintenance banner">
        <div className="p-5 grid sm:grid-cols-[auto_1fr] gap-4 items-end">
          {Field('maintenance', 'enabled', 'Show banner to all users', 'checkbox')}
          {Field('maintenance', 'message', 'Message')}
        </div>
        <div className="px-5 pb-5"><button onClick={() => saveKey('maintenance')} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold">Save</button></div>
      </Card>
      <Card title="Tax & invoicing">
        <div className="p-5 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Field('tax', 'seller_name', 'Seller legal name')}{Field('tax', 'seller_gstin', 'Seller GSTIN')}{Field('tax', 'gst_percent', 'GST %', 'number')}{Field('tax', 'prices_include_tax', 'Prices include GST', 'checkbox')}
        </div>
        <div className="px-5 pb-5"><button onClick={() => saveKey('tax')} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold">Save</button></div>
      </Card>
      <Card title="Platform administrators">
        <ul className="divide-y divide-slate-100 text-sm">
          {data.admins.map((a: any) => (
            <li key={a.email} className="px-5 py-3 flex flex-wrap items-center gap-3">
              <span className="flex-1">{a.email}<span className="block text-xs text-slate-400">{a.uid ? 'linked' : 'not signed in yet'}</span></span>
              <span className="text-xs font-semibold uppercase text-slate-500">{a.role}</span>
              {role === 'owner' && a.email !== auth.currentUser?.email?.toLowerCase() && <button onClick={() => setAdminRow(a.email, a.role, true)} className="text-xs text-red-600 underline">Remove</button>}
            </li>
          ))}
        </ul>
        {role === 'owner' && (
          <form onSubmit={(e) => { e.preventDefault(); setAdminRow(admin.email, admin.role); }} className="p-5 flex flex-wrap gap-2 border-t border-slate-100">
            <input required type="email" placeholder="email@company.com" value={admin.email} onChange={(e) => setAdmin({ ...admin, email: e.target.value })} className={input} aria-label="Admin email" />
            <select value={admin.role} onChange={(e) => setAdmin({ ...admin, role: e.target.value })} className={input} aria-label="Admin role">{['owner', 'admin', 'support', 'finance'].map((r) => <option key={r}>{r}</option>)}</select>
            <button className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold">Add / update</button>
          </form>
        )}
        <p className="px-5 pb-5 text-xs text-slate-500">Admins sign in with their own Firebase account. Access requires a verified email (or Google sign-in) — no passwords are stored here.</p>
      </Card>
    </div>
  );
};

// ─── Shell ───────────────────────────────────────────────────────────────────
const NAV = [
  { to: '/platform', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/platform/orgs', label: 'Companies', icon: Building2 },
  { to: '/platform/plans', label: 'Plans', icon: Layers },
  { to: '/platform/billing', label: 'Billing', icon: CreditCard },
  { to: '/platform/tickets', label: 'Support', icon: LifeBuoy },
  { to: '/platform/users', label: 'Users', icon: Users },
  { to: '/platform/leads', label: 'Leads', icon: Inbox },
  { to: '/platform/broadcast', label: 'Announce', icon: Megaphone },
  { to: '/platform/audit', label: 'Audit log', icon: ScrollText },
  { to: '/platform/settings', label: 'Settings', icon: Settings },
];

const PlatformConsole: React.FC = () => {
  const { firebaseUser, initialized } = useAuthStore();
  const { platformRole, loaded } = useTenantStore();
  const navigate = useNavigate();
  const [verifySent, setVerifySent] = useState(false);

  const isDesignatedAdmin = Boolean(
    firebaseUser?.email &&
    (firebaseUser.email.toLowerCase() === 'admin@taskpilot.app' ||
     firebaseUser.email.toLowerCase() === 'thekadaapp@gmail.com')
  );
  const effectiveRole = platformRole || (isDesignatedAdmin ? 'owner' : null);

  const needsVerify = useMemo(
    () => !isDesignatedAdmin && firebaseUser && !firebaseUser.emailVerified && firebaseUser.providerData.every((p) => p.providerId !== 'google.com'),
    [firebaseUser, isDesignatedAdmin]
  );

  if (!initialized || (firebaseUser && !loaded && !isDesignatedAdmin)) return <Loading />;
  if (!firebaseUser) return <Navigate to="/login?next=/platform" replace />;
  if (!effectiveRole) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md text-center bg-white rounded-2xl border p-8">
          <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto" />
          <h1 className="mt-4 text-xl font-bold">Platform access required</h1>
          <p className="text-sm text-slate-600 mt-2">{needsVerify ? `Verify ${firebaseUser.email} to unlock the platform console, then sign in again.` : 'This area is limited to Task Pilot platform administrators.'}</p>
          {needsVerify && (
            <button disabled={verifySent} onClick={() => sendEmailVerification(firebaseUser).then(() => { setVerifySent(true); toast.success('Verification email sent'); }).catch((e) => toast.error(e.message))}
              className="mt-5 h-10 px-5 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-60">{verifySent ? 'Email sent — check your inbox' : 'Send verification email'}</button>
          )}
          <div className="mt-4"><Link to="/app/dashboard" className="text-sm underline">Back to app</Link></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="lg:w-56 lg:min-h-screen bg-slate-950 text-slate-300 flex lg:flex-col">
        <div className="hidden lg:flex items-center gap-2 px-5 h-16 text-white font-bold border-b border-white/10"><img src="/logo.png" alt="" className="w-7 h-7 rounded" />Platform</div>
        <nav className="flex lg:flex-col gap-1 p-2 lg:p-3 overflow-x-auto flex-1" aria-label="Platform">
          {NAV.map(({ to, label, icon: I, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap ${isActive ? 'bg-white/10 text-white font-semibold' : 'hover:bg-white/5'}`}>
              <I className="w-4 h-4 shrink-0" />{label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden lg:block p-3 border-t border-white/10 text-xs">
          <p className="truncate">{firebaseUser.email}</p><p className="uppercase text-[10px] text-slate-500 mt-0.5">{effectiveRole}</p>
          <div className="flex gap-3 mt-3"><Link to="/app/dashboard" className="underline">App</Link><button onClick={() => logout().then(() => navigate('/login'))} className="inline-flex items-center gap-1 underline"><LogOut className="w-3 h-3" />Sign out</button></div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 sm:p-6">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="orgs" element={<Orgs />} />
          <Route path="orgs/:id" element={<OrgDetail />} />
          <Route path="plans" element={<Plans />} />
          <Route path="billing" element={<Billing />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="users" element={<PlatformUsers />} />
          <Route path="leads" element={<LogList prefix="lead." title="Sales leads (contact & demo requests)" lead />} />
          <Route path="broadcast" element={<Broadcast />} />
          <Route path="audit" element={<LogList title="Platform audit log" />} />
          <Route path="settings" element={<PlatformSettings />} />
          <Route path="*" element={<Navigate to="/platform" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export default PlatformConsole;
