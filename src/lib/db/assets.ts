import { supabase } from '../supabaseClient';
import { Asset, AssetMaintenance } from '../../types';

// ─── Depreciation ──────────────────────────────────────────────────────────────
/** Straight-line book value: cost minus accumulated depreciation, floored at salvage. */
export const bookValue = (a: Asset): number => {
  const cost = a.purchaseCost ?? 0;
  const salvage = a.salvageValue ?? 0;
  const life = a.usefulLifeYears ?? 0;
  if (!a.purchaseDate || life <= 0) return cost;
  const years =
    (Date.now() - new Date(a.purchaseDate).getTime()) / (365.25 * 24 * 3600 * 1000);
  const depreciable = Math.max(cost - salvage, 0);
  const value = cost - depreciable * (years / life);
  return value < salvage ? salvage : value;
};

export const lifeUsedPercent = (a: Asset): number => {
  const life = a.usefulLifeYears ?? 0;
  if (!a.purchaseDate || life <= 0) return 0;
  const years =
    (Date.now() - new Date(a.purchaseDate).getTime()) / (365.25 * 24 * 3600 * 1000);
  return Math.min(Math.max((years / life) * 100, 0), 100);
};

// ─── Mappers ────────────────────────────────────────────────────────────────────
const toAsset = (r: any): Asset => ({
  id: r.id,
  name: r.name ?? '',
  code: r.code ?? '',
  category: r.category ?? 'equipment',
  serialNumber: r.serial_number ?? '',
  manufacturer: r.manufacturer ?? '',
  model: r.model ?? '',
  status: r.status ?? 'available',
  condition: r.condition ?? 'good',
  purchaseDate: r.purchase_date ?? null,
  purchaseCost: Number(r.purchase_cost ?? 0),
  salvageValue: Number(r.salvage_value ?? 0),
  usefulLifeYears: Number(r.useful_life_years ?? 5),
  projectId: r.project_id ?? null,
  assignedTo: r.assigned_to ?? null,
  location: r.location ?? '',
  photoUrls: Array.isArray(r.photo_urls) ? r.photo_urls : [],
  documentUrls: Array.isArray(r.document_urls) ? r.document_urls : [],
  warrantyExpiry: r.warranty_expiry ?? null,
  supplier: r.supplier ?? '',
  notes: r.notes ?? '',
  createdBy: r.created_by ?? '',
  createdAt: r.created_at ?? null,
  updatedAt: r.updated_at ?? null,
});

// Map a partial Asset (camelCase) → real snake_case columns only.
const assetToRow = (a: Partial<Asset>): Record<string, any> => {
  const row: Record<string, any> = {};
  const set = (k: string, v: any) => { if (v !== undefined) row[k] = v; };
  set('name', a.name);
  set('code', a.code);
  set('category', a.category);
  set('serial_number', a.serialNumber);
  set('manufacturer', a.manufacturer);
  set('model', a.model);
  set('status', a.status);
  set('condition', a.condition);
  set('purchase_date', a.purchaseDate || null);
  set('purchase_cost', a.purchaseCost);
  set('salvage_value', a.salvageValue);
  set('useful_life_years', a.usefulLifeYears);
  set('project_id', a.projectId ?? null);
  set('assigned_to', a.assignedTo ?? null);
  set('location', a.location);
  set('photo_urls', a.photoUrls);
  set('document_urls', a.documentUrls);
  set('warranty_expiry', a.warrantyExpiry || null);
  set('supplier', a.supplier);
  set('notes', a.notes);
  return row;
};

const toMaintenance = (r: any): AssetMaintenance => ({
  id: r.id,
  assetId: r.asset_id,
  type: r.type ?? 'routine',
  status: r.status ?? 'completed',
  scheduledDate: r.scheduled_date ?? null,
  completedDate: r.completed_date ?? null,
  cost: Number(r.cost ?? 0),
  performedBy: r.performed_by ?? '',
  vendor: r.vendor ?? '',
  notes: r.notes ?? '',
  nextDueDate: r.next_due_date ?? null,
  createdAt: r.created_at ?? null,
});

// ─── Assets CRUD ─────────────────────────────────────────────────────────────────
export const getAssets = async (): Promise<Asset[]> => {
  try {
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(toAsset);
  } catch (err) {
    console.warn('getAssets error:', err);
    return [];
  }
};

export const getAsset = async (id: string): Promise<Asset | null> => {
  const { data, error } = await supabase.from('assets').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return toAsset(data);
};

export const createAsset = async (a: Partial<Asset>, createdBy: string): Promise<string> => {
  const row = assetToRow(a);
  row.id = crypto.randomUUID();
  row.created_by = createdBy;
  row.created_at = new Date().toISOString();
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('assets').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
};

export const updateAsset = async (id: string, patch: Partial<Asset>): Promise<void> => {
  const row = assetToRow(patch);
  row.updated_at = new Date().toISOString();
  const { error } = await supabase.from('assets').update(row).eq('id', id);
  if (error) throw error;
};

export const deleteAsset = async (id: string): Promise<void> => {
  const { error } = await supabase.from('assets').delete().eq('id', id);
  if (error) throw error;
};

// ─── Allocation ──────────────────────────────────────────────────────────────────
export const assignAsset = async (opts: {
  assetId: string;
  projectId?: string | null;
  assignedTo?: string | null;
  assignedBy: string;
  expectedReturn?: string | null;
  notes?: string;
}): Promise<void> => {
  // Close any open allocation, open a new one, flip status to In Use.
  await supabase
    .from('asset_assignments')
    .update({ checkin_at: new Date().toISOString() })
    .eq('asset_id', opts.assetId)
    .is('checkin_at', null);

  await supabase.from('asset_assignments').insert({
    id: crypto.randomUUID(),
    asset_id: opts.assetId,
    project_id: opts.projectId ?? null,
    assigned_to: opts.assignedTo ?? null,
    assigned_by: opts.assignedBy,
    checkout_at: new Date().toISOString(),
    expected_return: opts.expectedReturn ?? null,
    notes: opts.notes ?? '',
  });

  await updateAsset(opts.assetId, {
    projectId: opts.projectId ?? null,
    assignedTo: opts.assignedTo ?? null,
    status: 'in_use',
  });
};

export const returnAsset = async (assetId: string): Promise<void> => {
  await supabase
    .from('asset_assignments')
    .update({ checkin_at: new Date().toISOString() })
    .eq('asset_id', assetId)
    .is('checkin_at', null);
  await updateAsset(assetId, { projectId: null, assignedTo: null, status: 'available' });
};

// ─── Maintenance ─────────────────────────────────────────────────────────────────
export const getMaintenance = async (assetId: string): Promise<AssetMaintenance[]> => {
  const { data, error } = await supabase
    .from('asset_maintenance')
    .select('*')
    .eq('asset_id', assetId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(toMaintenance);
};

export const logMaintenance = async (
  m: Partial<AssetMaintenance>,
  createdBy: string,
): Promise<void> => {
  const row: Record<string, any> = {
    id: crypto.randomUUID(),
    asset_id: m.assetId,
    type: m.type ?? 'routine',
    status: m.status ?? 'completed',
    scheduled_date: m.scheduledDate || null,
    completed_date: m.completedDate || null,
    cost: m.cost ?? 0,
    performed_by: m.performedBy ?? '',
    vendor: m.vendor ?? '',
    notes: m.notes ?? '',
    next_due_date: m.nextDueDate || null,
    created_by: createdBy,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('asset_maintenance').insert(row);
  if (error) throw error;
  await updateAsset(m.assetId!, {
    status: m.status === 'completed' ? 'available' : 'maintenance',
  });
};

// ─── Realtime ────────────────────────────────────────────────────────────────────
export const subscribeAssets = (cb: (assets: Asset[]) => void) => {
  const channel = supabase
    .channel(`assets_${Date.now()}_${Math.floor(Math.random() * 1e6)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, async () => {
      cb(await getAssets());
    })
    .subscribe();
  getAssets().then(cb).catch(console.warn);
  return () => { supabase.removeChannel(channel); };
};
