import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Trash2, UserPlus, Undo2, Plus, Wrench,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import {
  getAsset, deleteAsset, updateAsset, getMaintenance, logMaintenance,
  assignAsset, returnAsset, bookValue, lifeUsedPercent,
} from '../../lib/db/assets';
import { getProjects } from '../../lib/db/projects';
import { getAllUsers } from '../../lib/db/users';
import { Asset, AssetMaintenance, Project, AppUser } from '../../types';
import { AssetFormModal } from './AssetsPage';

const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const titleCase = (s?: string) => (s || '—').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const AssetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { appUser } = useAuthStore();
  const { can } = usePermissions();
  const canManage = can('assets_manage');
  const canAssign = can('assets_assign');
  const canMaintain = can('assets_maintain');

  const [asset, setAsset] = useState<Asset | null>(null);
  const [logs, setLogs] = useState<AssetMaintenance[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    const [a, m] = await Promise.all([getAsset(id), getMaintenance(id)]);
    setAsset(a); setLogs(m); setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
    getProjects().then(setProjects).catch(() => {});
    getAllUsers().then(setUsers).catch(() => {});
  }, [refresh]);

  if (loading) return <div className="text-center text-slate-400 py-20">Loading…</div>;
  if (!asset) return <div className="text-center text-slate-500 py-20">Asset not found.</div>;

  const projName = projects.find((p) => p.id === asset.projectId)?.name;
  const holder = users.find((u) => u.id === asset.assignedTo)?.name;
  const life = lifeUsedPercent(asset);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/app/assets')} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium">
          <ArrowLeft size={17} /> Assets
        </button>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"><Pencil size={15} /> Edit</button>
            <button onClick={async () => { if (confirm('Delete this asset?')) { await deleteAsset(asset.id); navigate('/app/assets'); } }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"><Trash2 size={15} /> Delete</button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4">
        <h1 className="text-xl font-extrabold text-slate-900">{asset.name}</h1>
        <p className="text-sm text-slate-500 mt-0.5">{[asset.code, titleCase(asset.category)].filter(Boolean).join(' · ')}</p>
        <div className="flex gap-2 mt-3">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{titleCase(asset.status)}</span>
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">Condition: {titleCase(asset.condition)}</span>
        </div>
      </div>

      {/* Valuation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4">
        <h3 className="font-extrabold text-slate-900 mb-3">Valuation</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Stat label="Purchase" value={money(asset.purchaseCost || 0)} />
          <Stat label="Book value" value={money(bookValue(asset))} accent />
          <Stat label="Salvage" value={money(asset.salvageValue || 0)} />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Useful life used</span><span className="font-bold text-slate-800">{life.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full ${life > 85 ? 'bg-red-500' : 'bg-slate-900'}`} style={{ width: `${life}%` }} />
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">{asset.usefulLifeYears || 0} yr life · straight-line depreciation</p>
      </div>

      {/* Details */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4">
        <h3 className="font-extrabold text-slate-900 mb-2">Details</h3>
        <KV k="Serial no." v={asset.serialNumber} />
        <KV k="Manufacturer" v={asset.manufacturer} />
        <KV k="Model" v={asset.model} />
        <KV k="Supplier" v={asset.supplier} />
        <KV k="Purchased" v={fmtDate(asset.purchaseDate)} />
        <KV k="Warranty" v={asset.warrantyExpiry ? fmtDate(asset.warrantyExpiry) : '—'} />
        {asset.notes ? <KV k="Notes" v={asset.notes} /> : null}
      </div>

      {/* Allocation */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-4">
        <h3 className="font-extrabold text-slate-900 mb-2">Allocation</h3>
        <KV k="Site / project" v={projName || '—'} />
        <KV k="Holder" v={holder || '—'} />
        {canAssign && (
          <div className="flex gap-2 mt-3">
            <button onClick={() => setAssignOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"><UserPlus size={15} /> Assign</button>
            {(asset.assignedTo || asset.projectId) && (
              <button onClick={async () => { await returnAsset(asset.id); await refresh(); toast.success('Asset returned'); }}
                className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50"><Undo2 size={15} /> Return</button>
            )}
          </div>
        )}
      </div>

      {/* Maintenance */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-extrabold text-slate-900">Maintenance</h3>
          {canMaintain && (
            <button onClick={() => setMaintOpen(true)} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-slate-900"><Plus size={15} /> Log</button>
          )}
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">No maintenance logged yet.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((m) => (
              <div key={m.id} className="flex gap-3">
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${m.type === 'repair' ? 'bg-red-500' : m.type === 'inspection' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-sm">{titleCase(m.type)} · {titleCase(m.status)}</p>
                  {m.notes ? <p className="text-xs text-slate-500">{m.notes}</p> : null}
                  <p className="text-[11px] text-slate-400">
                    {[fmtDate(m.completedDate || m.scheduledDate || m.createdAt),
                      m.cost ? money(m.cost) : null, m.vendor,
                      m.nextDueDate ? `next: ${fmtDate(m.nextDueDate)}` : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editing && (
        <AssetFormModal asset={asset} onClose={() => setEditing(false)}
          onSave={async (data) => { await updateAsset(asset.id, data); setEditing(false); refresh(); toast.success('Asset updated'); }} />
      )}
      {assignOpen && (
        <AssignModal asset={asset} projects={projects} users={users}
          onClose={() => setAssignOpen(false)}
          onSave={async (pid, uid) => {
            await assignAsset({ assetId: asset.id, projectId: pid, assignedTo: uid, assignedBy: appUser?.id || '' });
            setAssignOpen(false); await refresh(); toast.success('Asset assigned');
          }} />
      )}
      {maintOpen && (
        <MaintModal onClose={() => setMaintOpen(false)}
          onSave={async (m) => {
            await logMaintenance({ ...m, assetId: asset.id }, appUser?.id || '');
            setMaintOpen(false); await refresh(); toast.success('Maintenance logged');
          }} />
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div>
    <p className={`text-base font-extrabold ${accent ? 'text-emerald-600' : 'text-slate-900'} truncate`}>{value}</p>
    <p className="text-[11px] text-slate-500">{label}</p>
  </div>
);
const KV: React.FC<{ k: string; v?: string }> = ({ k, v }) => (
  <div className="flex py-1.5 text-sm">
    <span className="w-32 text-slate-500 shrink-0">{k}</span>
    <span className="font-semibold text-slate-800">{v || '—'}</span>
  </div>
);

const inp = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10';
const Shell: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }> =
  ({ title, onClose, children, footer }) => (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
      <div className="px-5 py-4 border-b border-slate-100"><h2 className="font-extrabold text-slate-900">{title}</h2></div>
      <div className="p-5 space-y-3">{children}</div>
      <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2">{footer}</div>
    </div>
  </div>
);

const AssignModal: React.FC<{ asset: Asset; projects: Project[]; users: AppUser[]; onClose: () => void; onSave: (pid: string | null, uid: string | null) => void }> =
  ({ asset, projects, users, onClose, onSave }) => {
  const [pid, setPid] = useState<string | null>(asset.projectId ?? null);
  const [uid, setUid] = useState<string | null>(asset.assignedTo ?? null);
  return (
    <Shell title="Assign asset" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button onClick={() => onSave(pid, uid)} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold">Save</button>
      </>}>
      <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1">Site / project</span>
        <select className={inp} value={pid ?? ''} onChange={(e) => setPid(e.target.value || null)}>
          <option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></label>
      <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1">Holder</span>
        <select className={inp} value={uid ?? ''} onChange={(e) => setUid(e.target.value || null)}>
          <option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select></label>
    </Shell>
  );
};

const MaintModal: React.FC<{ onClose: () => void; onSave: (m: Partial<AssetMaintenance>) => void }> = ({ onClose, onSave }) => {
  const [type, setType] = useState('routine');
  const [status, setStatus] = useState('completed');
  const [cost, setCost] = useState('');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [nextDue, setNextDue] = useState('');
  return (
    <Shell title="Log maintenance" onClose={onClose}
      footer={<>
        <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600">Cancel</button>
        <button onClick={() => onSave({
          type, status, cost: +cost || 0, vendor, notes,
          completedDate: status === 'completed' ? new Date().toISOString().slice(0, 10) : null,
          scheduledDate: status !== 'completed' ? new Date().toISOString().slice(0, 10) : null,
          nextDueDate: nextDue || null,
        })} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold">Save log</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1"><Wrench size={12} className="inline mr-1" />Type</span>
          <select className={inp} value={type} onChange={(e) => setType(e.target.value)}>{['routine', 'repair', 'inspection'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></label>
        <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1">Status</span>
          <select className={inp} value={status} onChange={(e) => setStatus(e.target.value)}>{['completed', 'scheduled', 'in_progress'].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select></label>
      </div>
      <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1">Cost (₹)</span><input type="number" className={inp} value={cost} onChange={(e) => setCost(e.target.value)} /></label>
      <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1">Vendor</span><input className={inp} value={vendor} onChange={(e) => setVendor(e.target.value)} /></label>
      <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1">Notes</span><textarea rows={2} className={inp} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <label className="block"><span className="block text-xs font-semibold text-slate-500 mb-1">Next due (optional)</span><input type="date" className={inp} value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></label>
    </Shell>
  );
};

export default AssetDetailPage;
