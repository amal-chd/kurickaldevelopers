import { supabase } from '../supabaseClient';
import type {
  BoqItem, Material, MaterialMovement, MaterialRequest, Contractor, LabourEntry, LabourPayment,
  InspectionTemplate, Inspection, PunchItem, Milestone, MovementKind,
} from '../construction';
import { signedQuantity, DEFAULT_TEMPLATES } from '../construction';

// Thin Supabase data layer for the construction suite. Rows are tenant-scoped
// by RLS (org_id is filled by the DB default from the x-org-id header).

async function run<T>(p: PromiseLike<{ data: T | null; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) {
    // Surface DB guard messages (plan limit / inactive workspace) verbatim.
    const msg = String(error.message ?? '');
    const m = msg.match(/(PLAN_LIMIT|ORG_INACTIVE): (.*)/);
    throw new Error(m ? m[2] : msg || 'Request failed');
  }
  return data as T;
}
const num = (v: unknown) => Number(v) || 0;

// ─── BOQ ─────────────────────────────────────────────────────────────────────
const mapBoq = (r: any): BoqItem => ({ ...r, quantity: num(r.quantity), rate: num(r.rate), executed_qty: num(r.executed_qty) });
export const listBoq = async (projectId: string) =>
  (await run<any[]>(supabase.from('boq_items').select('*').eq('project_id', projectId).order('sort_order').order('created_at'))).map(mapBoq);
export const createBoqItems = async (projectId: string, items: Partial<BoqItem>[], createdBy?: string) => {
  const base = Date.now();
  return run(supabase.from('boq_items').insert(items.map((i, idx) => ({
    project_id: projectId, code: i.code ?? null, description: i.description, category: i.category ?? null, unit: i.unit || 'nos',
    quantity: num(i.quantity), rate: num(i.rate), executed_qty: num(i.executed_qty), sort_order: i.sort_order ?? Math.floor(base / 1000) + idx, created_by: createdBy ?? null,
  }))));
};
export const updateBoqItem = (id: string, patch: Partial<BoqItem>) => {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of ['code', 'description', 'category', 'unit', 'quantity', 'rate', 'executed_qty'] as const) if (patch[k] !== undefined) row[k] = patch[k];
  return run(supabase.from('boq_items').update(row).eq('id', id));
};
export const deleteBoqItem = (id: string) => run(supabase.from('boq_items').delete().eq('id', id));

// Actual costs feeding the cost dashboard.
export async function projectActuals(projectId: string) {
  const [mats, labour, exp] = await Promise.all([
    run<any[]>(supabase.from('material_movements').select('quantity, rate').eq('project_id', projectId).eq('kind', 'receipt')),
    run<any[]>(supabase.from('labour_entries').select('amount').eq('project_id', projectId)),
    run<any[]>(supabase.from('expenses').select('amount').eq('project_id', projectId)),
  ]);
  return {
    materialReceipts: mats.reduce((s, m) => s + num(m.quantity) * num(m.rate), 0),
    labour: labour.reduce((s, l) => s + num(l.amount), 0),
    expenses: exp.reduce((s, e) => s + num(e.amount), 0),
  };
}

// ─── Materials ───────────────────────────────────────────────────────────────
const mapMat = (r: any): Material => ({ ...r, min_stock: num(r.min_stock), default_rate: num(r.default_rate) });
export const listMaterials = async () => (await run<any[]>(supabase.from('materials').select('*').order('name'))).map(mapMat);
export const upsertMaterial = (m: Partial<Material>) => {
  const row = { name: m.name?.trim(), code: m.code || null, category: m.category || null, unit: m.unit || 'nos', min_stock: num(m.min_stock), default_rate: num(m.default_rate), is_active: m.is_active ?? true };
  return m.id ? run(supabase.from('materials').update(row).eq('id', m.id)) : run(supabase.from('materials').insert(row));
};
export const listMovements = async (projectId?: string) => {
  let q = supabase.from('material_movements').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).limit(1000);
  if (projectId) q = q.eq('project_id', projectId);
  return (await run<any[]>(q)).map((r): MaterialMovement => ({ ...r, quantity: num(r.quantity), rate: num(r.rate) }));
};
export const addMovement = (m: { material_id: string; project_id: string; kind: MovementKind; quantity: number; rate?: number; supplier?: string; reference?: string; note?: string; date?: string; created_by?: string; created_by_name?: string }) =>
  run(supabase.from('material_movements').insert({
    material_id: m.material_id, project_id: m.project_id, kind: m.kind, quantity: signedQuantity(m.kind, m.quantity), rate: num(m.rate),
    supplier: m.supplier || null, reference: m.reference || null, note: m.note || null, date: m.date || new Date().toISOString().slice(0, 10),
    created_by: m.created_by ?? null, created_by_name: m.created_by_name ?? null,
  }));
export const deleteMovement = (id: string) => run(supabase.from('material_movements').delete().eq('id', id));
export const listRequests = async (projectId?: string) => {
  let q = supabase.from('material_requests').select('*').order('created_at', { ascending: false }).limit(500);
  if (projectId) q = q.eq('project_id', projectId);
  return (await run<any[]>(q)).map((r): MaterialRequest => ({ ...r, quantity: num(r.quantity) }));
};
export const createRequest = (r: { material_id: string; project_id: string; quantity: number; required_by?: string; note?: string; requested_by?: string; requested_by_name?: string }) =>
  run(supabase.from('material_requests').insert({ ...r, required_by: r.required_by || null, note: r.note || null }));
export const setRequestStatus = (id: string, status: MaterialRequest['status'], by: string) =>
  run(supabase.from('material_requests').update({ status, decided_by: by, decided_at: new Date().toISOString() }).eq('id', id));

// ─── Labour ──────────────────────────────────────────────────────────────────
export const listContractors = async () => run<Contractor[]>(supabase.from('contractors').select('*').order('name'));
export const upsertContractor = (c: Partial<Contractor>) => {
  const row = { name: c.name?.trim(), trade: c.trade || null, phone: c.phone || null, tax_id: c.tax_id || null, address: c.address || null, notes: c.notes || null, is_active: c.is_active ?? true };
  return c.id ? run(supabase.from('contractors').update(row).eq('id', c.id)) : run(supabase.from('contractors').insert(row));
};
export const listLabour = async (f: { projectId?: string; from?: string; to?: string; contractorId?: string } = {}) => {
  let q = supabase.from('labour_entries').select('*').order('date', { ascending: false }).limit(2000);
  if (f.projectId) q = q.eq('project_id', f.projectId);
  if (f.contractorId) q = q.eq('contractor_id', f.contractorId);
  if (f.from) q = q.gte('date', f.from);
  if (f.to) q = q.lte('date', f.to);
  return (await run<any[]>(q)).map((r): LabourEntry => ({ ...r, rate: num(r.rate), amount: num(r.amount), overtime_hours: num(r.overtime_hours), overtime_rate: num(r.overtime_rate) }));
};
export const addLabour = (e: Omit<LabourEntry, 'id' | 'amount' | 'created_by_name'> & { created_by?: string; created_by_name?: string }) =>
  run(supabase.from('labour_entries').insert({ ...e, contractor_id: e.contractor_id || null, note: e.note || null }));
export const deleteLabour = (id: string) => run(supabase.from('labour_entries').delete().eq('id', id));
export const listLabourPayments = async (contractorId?: string) => {
  let q = supabase.from('labour_payments').select('*').order('date', { ascending: false }).limit(2000);
  if (contractorId) q = q.eq('contractor_id', contractorId);
  return (await run<any[]>(q)).map((r): LabourPayment => ({ ...r, amount: num(r.amount) }));
};
export const addLabourPayment = (p: Omit<LabourPayment, 'id'> & { created_by?: string }) =>
  run(supabase.from('labour_payments').insert({ ...p, project_id: p.project_id || null, reference: p.reference || null, note: p.note || null }));

// ─── Inspections ─────────────────────────────────────────────────────────────
export const listTemplates = async () => run<InspectionTemplate[]>(supabase.from('inspection_templates').select('*').order('created_at'));
export async function ensureDefaultTemplates(createdBy?: string) {
  const existing = await listTemplates();
  if (existing.length) return existing;
  await run(supabase.from('inspection_templates').insert(DEFAULT_TEMPLATES.map((t) => ({ ...t, created_by: createdBy ?? 'system' }))));
  return listTemplates();
}
export const saveTemplate = (t: Partial<InspectionTemplate>) =>
  t.id ? run(supabase.from('inspection_templates').update({ name: t.name, category: t.category, items: t.items }).eq('id', t.id))
       : run(supabase.from('inspection_templates').insert({ name: t.name, category: t.category, items: t.items }));
export const deleteTemplate = (id: string) => run(supabase.from('inspection_templates').delete().eq('id', id));
export const listInspections = async (projectId?: string) => {
  let q = supabase.from('inspections').select('*').order('created_at', { ascending: false }).limit(500);
  if (projectId) q = q.eq('project_id', projectId);
  return run<Inspection[]>(q);
};
export const createInspection = async (i: Partial<Inspection>) =>
  (await run<Inspection[]>(supabase.from('inspections').insert({
    project_id: i.project_id, template_id: i.template_id ?? null, title: i.title, category: i.category ?? 'quality',
    location: i.location || null, results: i.results ?? [], inspector_id: i.inspector_id ?? null, inspector_name: i.inspector_name ?? null,
  }).select('*')))[0];
export const saveInspection = (id: string, patch: Partial<Inspection>) =>
  run(supabase.from('inspections').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id));
export const deleteInspection = (id: string) => run(supabase.from('inspections').delete().eq('id', id));

export const listPunch = async (projectId?: string) => {
  let q = supabase.from('punch_items').select('*').order('created_at', { ascending: false }).limit(1000);
  if (projectId) q = q.eq('project_id', projectId);
  return (await run<any[]>(q)).map((r): PunchItem => ({ ...r, photo_urls: Array.isArray(r.photo_urls) ? r.photo_urls : [] }));
};
export const createPunch = (items: Partial<PunchItem>[]) =>
  run(supabase.from('punch_items').insert(items.map((p) => ({
    project_id: p.project_id, inspection_id: p.inspection_id ?? null, title: p.title, description: p.description || null,
    location: p.location || null, priority: p.priority ?? 'medium', assignee_id: p.assignee_id || null, due_date: p.due_date || null,
    photo_urls: p.photo_urls ?? [], created_by: p.created_by ?? null,
  }))));
export const updatePunch = (id: string, patch: Partial<PunchItem> & { closed_by?: string }) => {
  const row: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() };
  if (patch.status === 'closed') row.closed_at = new Date().toISOString();
  else if (patch.status) { row.closed_at = null; row.closed_by = null; }
  return run(supabase.from('punch_items').update(row).eq('id', id));
};
export const deletePunch = (id: string) => run(supabase.from('punch_items').delete().eq('id', id));

// ─── Timeline ────────────────────────────────────────────────────────────────
export const listMilestones = async (projectId: string) => run<Milestone[]>(supabase.from('project_milestones').select('*').eq('project_id', projectId).order('due_date'));
export const addMilestone = (m: { project_id: string; name: string; due_date: string; created_by?: string }) => run(supabase.from('project_milestones').insert(m));
export const toggleMilestone = (id: string, done: boolean) =>
  run(supabase.from('project_milestones').update({ status: done ? 'done' : 'pending', completed_at: done ? new Date().toISOString() : null }).eq('id', id));
export const deleteMilestone = (id: string) => run(supabase.from('project_milestones').delete().eq('id', id));
export const listTimelineTasks = async (projectId: string) =>
  run<any[]>(supabase.from('tasks').select('id, title, status, priority, start_date, created_at, due_date, completed_at, assignee_ids, depends_on, is_archived')
    .eq('project_id', projectId).or('is_archived.is.null,is_archived.eq.false').order('due_date', { ascending: true, nullsFirst: false }).limit(500));
export const setTaskSchedule = (taskId: string, start: string | null, due: string | null) =>
  run(supabase.from('tasks').update({ start_date: start, due_date: due, updated_at: new Date().toISOString() }).eq('id', taskId));
