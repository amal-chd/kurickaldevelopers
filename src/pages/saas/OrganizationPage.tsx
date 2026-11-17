import React, { useEffect, useState } from 'react';
import { Copy, Loader2, Send, Trash2, MessageCircle, Building, Download, ShieldAlert } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { saasApi } from '../../lib/saasApi';
import { useTenantStore, MODULES, OrgContext } from '../../lib/tenant';
import { getAllRoles } from '../../lib/firestore';
import { Role } from '../../types';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuthStore } from '../../store/authStore';

const input = 'w-full h-10 px-3 rounded-lg border border-slate-300 bg-white focus:border-slate-900 outline-none text-sm';

const OrganizationPage: React.FC = () => {
  const ctx = useTenantStore((s) => s.context);
  const { can } = usePermissions();
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [invites, setInvites] = useState<any[] | null>(null);
  const [inv, setInv] = useState({ email: '', name: '', roleId: '' });
  const [inviting, setInviting] = useState(false);
  const [modules, setModules] = useState<string[] | null>(null);
  const [exporting, setExporting] = useState(false);

  const exportAll = async (format: 'xlsx' | 'json') => {
    setExporting(true);
    try {
      const r = await saasApi<{ exportedAt: string; data: Record<string, any[]> }>('export_data');
      const stamp = r.exportedAt.slice(0, 10);
      if (format === 'json') {
        const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `taskpilot-export-${stamp}.json`; a.click(); URL.revokeObjectURL(a.href);
      } else {
        const wb = XLSX.utils.book_new();
        for (const [table, rows] of Object.entries(r.data)) {
          if (!rows.length) continue;
          const flat = rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v !== null && typeof v === 'object' ? JSON.stringify(v) : v])));
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flat), table.slice(0, 31));
        }
        XLSX.writeFile(wb, `taskpilot-export-${stamp}.xlsx`);
      }
      toast.success('Export ready');
    } catch (e: any) { toast.error(e.message); } finally { setExporting(false); }
  };

  useEffect(() => {
    if (!ctx) return;
    const o = ctx.org;
    setForm({ name: o.name ?? '', industry: o.industry ?? '', company_size: o.company_size ?? '', phone: o.phone ?? '', email: o.email ?? '', website: o.website ?? '', address: o.address ?? '', tax_id: o.tax_id ?? '', timezone: o.timezone ?? '', logo_url: o.logo_url ?? '' });
    setModules(o.enabled_modules ?? null);
  }, [ctx?.org.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getAllRoles().then((r) => setRoles(r.sort((a, b) => (b.level ?? 0) - (a.level ?? 0))));
    saasApi<{ invitations: any[] }>('list_invitations').then((r) => setInvites(r.invitations)).catch(() => setInvites([]));
  }, []);

  if (!ctx) return <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  const planFeatures = ctx.plan?.features ?? [];
  const toggleable = ctx.org.is_legacy ? [] : MODULES.filter((m) => planFeatures.includes(m.key) && !m.core);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saasApi('update_org', { ...form, enabled_modules: modules ?? undefined });
      useTenantStore.getState().setContext(await saasApi<OrgContext>('org_context'));
      toast.success('Organization updated');
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      const r = await saasApi<{ link: string; invitation: any }>('invite_member', inv);
      await navigator.clipboard?.writeText(r.link).catch(() => {});
      toast.success('Invitation created — link copied to clipboard');
      setInvites((x) => [{ ...r.invitation, link: r.link }, ...(x ?? [])]);
      setInv({ email: '', name: '', roleId: inv.roleId });
    } catch (err: any) { toast.error(err.message); } finally { setInviting(false); }
  };

  const revoke = async (id: string) => {
    try { await saasApi('revoke_invitation', { id }); setInvites((x) => (x ?? []).filter((i) => i.id !== id)); } catch (e: any) { toast.error(e.message); }
  };

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? '—';
  const F = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block text-sm font-medium">{label}<input value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={`${input} mt-1`} {...props} /></label>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      <form onSubmit={save} className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex items-center gap-3">
          {form.logo_url ? <img src={form.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover border" /> : <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center"><Building className="w-6 h-6 text-slate-400" /></div>}
          <div><h2 className="text-lg font-bold">Company profile</h2><p className="text-sm text-slate-500">Shown on invoices, invitations and the app header.</p></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {F('name', 'Company name', { required: true })}
          {F('logo_url', 'Logo URL', { type: 'url', placeholder: 'https://…' })}
          {F('email', 'Billing email', { type: 'email' })}
          {F('phone', 'Phone')}
          {F('website', 'Website', { type: 'url' })}
          {F('tax_id', 'GSTIN / Tax ID')}
          {F('timezone', 'Time zone')}
          {F('company_size', 'Team size')}
        </div>
        <label className="block text-sm font-medium">Registered address<textarea value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} className="w-full mt-1 px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-slate-900" /></label>

        {toggleable.length > 0 && (
          <fieldset>
            <legend className="text-sm font-semibold">Modules</legend>
            <p className="text-xs text-slate-500 mb-3">Hide modules your company doesn't use. Core modules are always on.</p>
            <div className="grid sm:grid-cols-2 gap-2">
              {toggleable.map((m) => {
                const on = modules === null ? true : modules.includes(m.key);
                return (
                  <label key={m.key} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" className="mt-1" checked={on} onChange={() => {
                      const base = modules ?? planFeatures;
                      setModules(on ? base.filter((k) => k !== m.key) : [...base, m.key]);
                    }} />
                    <span><span className="text-sm font-medium block">{m.label}</span><span className="text-xs text-slate-500">{m.description}</span></span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
        <button disabled={saving} className="h-10 px-5 rounded-lg bg-slate-900 text-white text-sm font-semibold disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
      </form>

      {(can('team_manage') || ctx.org.owner_uid) && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold">Invite your team</h2>
          <p className="text-sm text-slate-500">Create an invitation link and share it by email or WhatsApp. The person signs up with the invited email and joins with the chosen role. {ctx.limits.max_users !== null && `${ctx.usage.users + ctx.usage.pending_invites} of ${ctx.limits.max_users} seats used.`}</p>
          <form onSubmit={invite} className="mt-4 grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3">
            <input required type="email" placeholder="Email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} className={input} aria-label="Email" />
            <input placeholder="Name (optional)" value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} className={input} aria-label="Name" />
            <select required value={inv.roleId} onChange={(e) => setInv({ ...inv, roleId: e.target.value })} className={input} aria-label="Role">
              <option value="">Role…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button disabled={inviting} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"><Send className="w-4 h-4" />{inviting ? 'Inviting…' : 'Invite'}</button>
          </form>
          <div className="mt-5 divide-y divide-slate-100">
            {invites === null ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : invites.length === 0 ? <p className="text-sm text-slate-500">No pending invitations.</p> : invites.map((i) => (
              <div key={i.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[180px]"><p className="text-sm font-medium">{i.name || i.email}</p><p className="text-xs text-slate-500">{i.email} · {roleName(i.role_id)} · expires {new Date(i.expires_at).toLocaleDateString()}</p></div>
                <button onClick={() => { navigator.clipboard.writeText(i.link); toast.success('Link copied'); }} className="h-8 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" />Copy link</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(`You're invited to join ${ctx.org.name} on Task Pilot: ${i.link}`)}`} target="_blank" rel="noopener noreferrer" className="h-8 px-3 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" />WhatsApp</a>
                <button onClick={() => revoke(i.id)} className="h-8 px-2 rounded-lg text-red-600 hover:bg-red-50" aria-label={`Revoke invitation for ${i.email}`}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">You can also create accounts with a password directly from Admin → User Management.</p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
        <h2 className="text-lg font-bold">Data & privacy</h2>
        <p className="text-sm text-slate-500">Your data belongs to you. Download a complete copy of everything in this workspace at any time.</p>
        <div className="flex flex-wrap gap-2">
          <button disabled={exporting} onClick={() => exportAll('xlsx')} className="h-10 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"><Download className="w-4 h-4" />{exporting ? 'Preparing…' : 'Export to Excel'}</button>
          <button disabled={exporting} onClick={() => exportAll('json')} className="h-10 px-4 rounded-lg border border-slate-300 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60"><Download className="w-4 h-4" />Export JSON</button>
        </div>
        {!ctx.org.is_legacy && ctx.org.owner_uid === useAuthStore.getState().firebaseUser?.uid && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold flex items-center gap-2 text-red-700"><ShieldAlert className="w-4 h-4" />Delete workspace</p>
            {ctx.org.settings?.deletion_requested_at ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-slate-600">Deletion requested on {new Date(ctx.org.settings.deletion_requested_at).toLocaleDateString()}. Our team will confirm by email before anything is removed.</span>
                <button onClick={async () => { try { await saasApi('cancel_workspace_deletion'); useTenantStore.getState().setContext(await saasApi<OrgContext>('org_context')); toast.success('Deletion request cancelled'); } catch (e: any) { toast.error(e.message); } }} className="underline font-medium">Cancel request</button>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-500 flex-1 min-w-[240px]">Permanently removes all projects, tasks, files and users of this workspace. Export your data first.</p>
                <button onClick={async () => {
                  const confirm = window.prompt(`Type your workspace name "${ctx.org.name}" to request permanent deletion`);
                  if (confirm === null) return;
                  const reason = window.prompt('Optional: why are you leaving?') ?? '';
                  try { await saasApi('request_workspace_deletion', { confirm, reason }); useTenantStore.getState().setContext(await saasApi<OrgContext>('org_context')); toast.success('Deletion requested'); } catch (e: any) { toast.error(e.message); }
                }} className="h-10 px-4 rounded-lg border border-red-300 text-red-700 text-sm font-semibold hover:bg-red-50">Request deletion</button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default OrganizationPage;
