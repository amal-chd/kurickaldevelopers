import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Truck, Wrench, Cog, Boxes, Plus, Search,
  IndianRupee, Hammer, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import {
  getAssets, subscribeAssets, createAsset, updateAsset, bookValue,
} from '../../lib/db/assets';
import { Asset } from '../../types';

const CATEGORIES = ['equipment', 'vehicle', 'tool', 'machinery', 'material', 'other'];
const CONDITIONS = ['new', 'good', 'fair', 'poor'];
const STATUSES = ['available', 'in_use', 'maintenance', 'retired'];

const statusColor: Record<string, string> = {
  available: 'text-emerald-700 bg-emerald-50',
  in_use: 'text-blue-700 bg-blue-50',
  maintenance: 'text-amber-700 bg-amber-50',
  retired: 'text-slate-500 bg-slate-100',
};
const catIcon = (c?: string) => {
  switch (c) {
    case 'vehicle': return Truck;
    case 'tool': return Hammer;
    case 'machinery': return Cog;
    case 'material': return Boxes;
    default: return Package;
  }
};
const money = (n: number) =>
  `₹${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const titleCase = (s?: string) =>
  (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const AssetsPage: React.FC = () => {
  const navigate = useNavigate();
  const { appUser } = useAuthStore();
  const { can } = usePermissions();
  const canManage = can('assets_manage');

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [modal, setModal] = useState<Asset | 'new' | null>(null);

  useEffect(() => {
    const unsub = subscribeAssets((a) => { setAssets(a); setLoading(false); });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => assets.filter((a) => {
    const q = query.trim().toLowerCase();
    const mq = !q || a.name.toLowerCase().includes(q) ||
      (a.code || '').toLowerCase().includes(q) ||
      (a.manufacturer || '').toLowerCase().includes(q);
    const ms = !status || a.status === status;
    return mq && ms;
  }), [assets, query, status]);

  const totalValue = assets.reduce((s, a) => s + bookValue(a), 0);
  const inUse = assets.filter((a) => a.status === 'in_use').length;
  const maint = assets.filter((a) => a.status === 'maintenance').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Assets</h1>
          <p className="text-sm text-slate-500">Equipment, vehicles, tools &amp; machinery</p>
        </div>
        {canManage && (
          <button onClick={() => setModal('new')}
            className="inline-flex items-center gap-2 bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-800">
            <Plus size={17} /> Add Asset
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Summary icon={<Package size={18} />} tint="bg-slate-100 text-slate-700" label="Assets" value={`${assets.length}`} />
        <Summary icon={<IndianRupee size={18} />} tint="bg-emerald-50 text-emerald-700" label="Book Value" value={money(totalValue)} />
        <Summary icon={<Wrench size={18} />} tint="bg-blue-50 text-blue-700" label="In Use" value={`${inUse}`} />
        <Summary icon={<Cog size={18} />} tint="bg-amber-50 text-amber-700" label="Maintenance" value={`${maint}`} />
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search assets…"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <Chip active={status === null} onClick={() => setStatus(null)}>All</Chip>
          {STATUSES.map((s) => (
            <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{titleCase(s)}</Chip>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-16">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="font-semibold text-slate-500">No assets found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((a) => {
            const Icon = catIcon(a.category);
            return (
              <button key={a.id} onClick={() => navigate(`/app/assets/${a.id}`)}
                className="text-left bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl grid place-items-center ${statusColor[a.status || 'available']}`}>
                  <Icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 truncate">{a.name}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {[a.code, titleCase(a.category), a.location].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[a.status || 'available']}`}>
                    {titleCase(a.status)}
                  </span>
                  <p className="text-sm font-bold text-slate-900 mt-1">{money(bookValue(a))}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {modal && (
        <AssetFormModal
          asset={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSave={async (data) => {
            try {
              if (modal === 'new') {
                await createAsset(data, appUser?.id || '');
                toast.success('Asset created');
              } else {
                await updateAsset((modal as Asset).id, data);
                toast.success('Asset updated');
              }
              setModal(null);
            } catch (e: any) {
              toast.error('Could not save: ' + (e?.message || e));
            }
          }}
        />
      )}
    </div>
  );
};

const Summary: React.FC<{ icon: React.ReactNode; tint: string; label: string; value: string }> =
  ({ icon, tint, label, value }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4">
    <div className={`w-9 h-9 rounded-lg grid place-items-center mb-2 ${tint}`}>{icon}</div>
    <p className="text-lg font-extrabold text-slate-900 truncate">{value}</p>
    <p className="text-xs text-slate-500">{label}</p>
  </div>
);

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> =
  ({ active, onClick, children }) => (
  <button onClick={onClick}
    className={`whitespace-nowrap text-xs font-semibold px-3.5 py-2 rounded-full border ${
      active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>
    {children}
  </button>
);

// ─── Create / edit modal ─────────────────────────────────────────────────────────
export const AssetFormModal: React.FC<{
  asset: Asset | null;
  onClose: () => void;
  onSave: (data: Partial<Asset>) => void;
}> = ({ asset, onClose, onSave }) => {
  const [f, setF] = useState<Partial<Asset>>(asset ?? {
    name: '', category: 'equipment', condition: 'good', usefulLifeYears: 5,
    purchaseCost: 0, salvageValue: 0,
  });
  const up = (k: keyof Asset, v: any) => setF((s) => ({ ...s, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <h2 className="font-extrabold text-slate-900">{asset ? 'Edit Asset' : 'New Asset'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Name *"><input className={inp} value={f.name || ''} onChange={(e) => up('name', e.target.value)} /></Field>
          <Field label="Asset tag / code"><input className={inp} value={f.code || ''} onChange={(e) => up('code', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category"><select className={inp} value={f.category} onChange={(e) => up('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></Field>
            <Field label="Condition"><select className={inp} value={f.condition} onChange={(e) => up('condition', e.target.value)}>{CONDITIONS.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Manufacturer"><input className={inp} value={f.manufacturer || ''} onChange={(e) => up('manufacturer', e.target.value)} /></Field>
            <Field label="Model"><input className={inp} value={f.model || ''} onChange={(e) => up('model', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Serial number"><input className={inp} value={f.serialNumber || ''} onChange={(e) => up('serialNumber', e.target.value)} /></Field>
            <Field label="Location"><input className={inp} value={f.location || ''} onChange={(e) => up('location', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Cost (₹)"><input type="number" className={inp} value={f.purchaseCost ?? ''} onChange={(e) => up('purchaseCost', +e.target.value)} /></Field>
            <Field label="Salvage (₹)"><input type="number" className={inp} value={f.salvageValue ?? ''} onChange={(e) => up('salvageValue', +e.target.value)} /></Field>
            <Field label="Life (yrs)"><input type="number" className={inp} value={f.usefulLifeYears ?? ''} onChange={(e) => up('usefulLifeYears', +e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase date"><input type="date" className={inp} value={f.purchaseDate || ''} onChange={(e) => up('purchaseDate', e.target.value)} /></Field>
            <Field label="Warranty expiry"><input type="date" className={inp} value={f.warrantyExpiry || ''} onChange={(e) => up('warrantyExpiry', e.target.value)} /></Field>
          </div>
          <Field label="Supplier"><input className={inp} value={f.supplier || ''} onChange={(e) => up('supplier', e.target.value)} /></Field>
          <Field label="Notes"><textarea className={inp} rows={2} value={f.notes || ''} onChange={(e) => up('notes', e.target.value)} /></Field>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-600 text-sm font-semibold">Cancel</button>
          <button
            onClick={() => { if (!f.name?.trim()) { toast.error('Name is required'); return; } onSave(f); }}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
            {asset ? 'Save changes' : 'Create asset'}
          </button>
        </div>
      </div>
    </div>
  );
};

const inp = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10';
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-xs font-semibold text-slate-500 mb-1">{label}</span>
    {children}
  </label>
);

export default AssetsPage;
