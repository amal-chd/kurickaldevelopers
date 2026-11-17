// Pure, framework-free calculations for the construction suite (unit-tested).

export interface BoqItem {
  id: string; project_id: string; code: string | null; description: string; category: string | null;
  unit: string; quantity: number; rate: number; executed_qty: number; sort_order: number;
  created_at?: string; updated_at?: string;
}
export interface Material {
  id: string; name: string; code: string | null; category: string | null; unit: string;
  min_stock: number; default_rate: number; is_active: boolean;
}
export type MovementKind = 'receipt' | 'issue' | 'return' | 'adjustment';
export interface MaterialMovement {
  id: string; material_id: string; project_id: string; kind: MovementKind; quantity: number; rate: number;
  supplier: string | null; reference: string | null; note: string | null; date: string;
  created_by: string | null; created_by_name: string | null; created_at: string;
}
export interface MaterialRequest {
  id: string; material_id: string; project_id: string; quantity: number; required_by: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'ordered' | 'received'; note: string | null;
  requested_by: string | null; requested_by_name: string | null; decided_by: string | null; decided_at: string | null; created_at: string;
}
export interface Contractor {
  id: string; name: string; trade: string | null; phone: string | null; tax_id: string | null;
  address: string | null; notes: string | null; is_active: boolean;
}
export interface LabourEntry {
  id: string; project_id: string; contractor_id: string | null; date: string; category: string;
  headcount: number; rate: number; overtime_hours: number; overtime_rate: number; amount: number;
  note: string | null; created_by_name: string | null;
}
export interface LabourPayment {
  id: string; contractor_id: string; project_id: string | null; kind: 'payment' | 'advance';
  amount: number; date: string; reference: string | null; note: string | null;
}
export interface ChecklistItem { id: string; label: string; required?: boolean }
export interface ChecklistResult extends ChecklistItem { result: 'pass' | 'fail' | 'na' | null; note?: string }
export interface InspectionTemplate { id: string; name: string; category: string; items: ChecklistItem[] }
export interface Inspection {
  id: string; project_id: string; template_id: string | null; title: string; category: string;
  location: string | null; status: 'draft' | 'passed' | 'failed'; results: ChecklistResult[];
  score: number | null; notes: string | null; inspector_id: string | null; inspector_name: string | null;
  completed_at: string | null; created_at: string;
}
export interface PunchItem {
  id: string; project_id: string; inspection_id: string | null; title: string; description: string | null;
  location: string | null; priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'ready_for_review' | 'closed'; assignee_id: string | null;
  due_date: string | null; photo_urls: string[]; created_by: string | null; closed_at: string | null; created_at: string;
}
export interface Milestone { id: string; project_id: string; name: string; due_date: string; status: 'pending' | 'done'; completed_at: string | null }

const n = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);

// ─── BOQ & cost ──────────────────────────────────────────────────────────────
export function boqTotals(items: Pick<BoqItem, 'quantity' | 'rate' | 'executed_qty'>[]) {
  let planned = 0, earned = 0;
  for (const i of items) {
    planned += n(i.quantity) * n(i.rate);
    earned += Math.min(n(i.executed_qty), n(i.quantity) || n(i.executed_qty)) * n(i.rate);
  }
  return { planned, earned, progress: planned > 0 ? earned / planned : 0 };
}

export interface CostSummary {
  budget: number; boqValue: number; earnedValue: number; progress: number;
  actual: { materials: number; labour: number; expenses: number; total: number };
  /** Cost Performance Index: earned / actual (>1 = under budget). null when nothing spent. */
  cpi: number | null;
  /** Estimate at completion, extrapolated from CPI. */
  forecast: number | null;
  variance: number | null; // reference value (budget or BOQ) − forecast
}

export function costSummary(input: {
  budget?: number | null; boq: Pick<BoqItem, 'quantity' | 'rate' | 'executed_qty'>[];
  materialReceipts: number; labour: number; expenses: number;
}): CostSummary {
  const t = boqTotals(input.boq);
  const actualTotal = n(input.materialReceipts) + n(input.labour) + n(input.expenses);
  const reference = n(input.budget) || t.planned;
  const cpi = actualTotal > 0 && t.earned > 0 ? t.earned / actualTotal : null;
  const forecast = cpi ? (t.planned || reference) / cpi : null;
  return {
    budget: n(input.budget), boqValue: t.planned, earnedValue: t.earned, progress: t.progress,
    actual: { materials: n(input.materialReceipts), labour: n(input.labour), expenses: n(input.expenses), total: actualTotal },
    cpi, forecast, variance: forecast !== null && reference ? reference - forecast : null,
  };
}

/** Parse rows from a spreadsheet into BOQ items. Accepts common header spellings. */
export function parseBoqRows(rows: Record<string, unknown>[]) {
  const pick = (r: Record<string, unknown>, keys: string[]) => {
    for (const k of Object.keys(r)) if (keys.includes(k.trim().toLowerCase().replace(/[^a-z]/g, ''))) return r[k];
    return undefined;
  };
  const out: Omit<BoqItem, 'id' | 'project_id' | 'sort_order'>[] = [];
  for (const r of rows) {
    const description = String(pick(r, ['description', 'item', 'itemdescription', 'particulars', 'work']) ?? '').trim();
    if (!description) continue;
    out.push({
      code: (pick(r, ['code', 'itemno', 'no', 'sno', 'slno']) ?? null) as string | null,
      description,
      category: (pick(r, ['category', 'section', 'head', 'group']) ?? null) as string | null,
      unit: String(pick(r, ['unit', 'uom', 'units']) ?? 'nos'),
      quantity: Math.max(0, n(pick(r, ['quantity', 'qty']))),
      rate: Math.max(0, n(pick(r, ['rate', 'unitrate', 'price']))),
      executed_qty: Math.max(0, n(pick(r, ['executed', 'executedqty', 'done', 'completed']))),
    });
  }
  return out;
}

// ─── Materials ───────────────────────────────────────────────────────────────
/** Signed quantity for a movement as entered (users always type positive numbers). */
export function signedQuantity(kind: MovementKind, qty: number) {
  const q = Math.abs(n(qty));
  return kind === 'issue' ? -q : kind === 'adjustment' ? n(qty) : q;
}

export function stockByMaterial(movements: Pick<MaterialMovement, 'material_id' | 'quantity' | 'kind' | 'rate'>[]) {
  const map = new Map<string, { quantity: number; receivedQty: number; receivedValue: number; issuedQty: number }>();
  for (const m of movements) {
    const s = map.get(m.material_id) ?? { quantity: 0, receivedQty: 0, receivedValue: 0, issuedQty: 0 };
    s.quantity += n(m.quantity);
    if (m.kind === 'receipt') { s.receivedQty += n(m.quantity); s.receivedValue += n(m.quantity) * n(m.rate); }
    if (m.kind === 'issue') s.issuedQty += -n(m.quantity);
    map.set(m.material_id, s);
  }
  return map;
}
export const avgRate = (s: { receivedQty: number; receivedValue: number }) => (s.receivedQty > 0 ? s.receivedValue / s.receivedQty : 0);

// ─── Labour ──────────────────────────────────────────────────────────────────
export const labourAmount = (e: Pick<LabourEntry, 'headcount' | 'rate' | 'overtime_hours' | 'overtime_rate'>) =>
  n(e.headcount) * n(e.rate) + n(e.overtime_hours) * n(e.overtime_rate);

export function contractorBalances(entries: Pick<LabourEntry, 'contractor_id' | 'amount' | 'headcount'>[], payments: Pick<LabourPayment, 'contractor_id' | 'amount'>[]) {
  const map = new Map<string, { earned: number; paid: number; balance: number; mandays: number }>();
  const get = (id: string) => map.get(id) ?? { earned: 0, paid: 0, balance: 0, mandays: 0 };
  for (const e of entries) {
    if (!e.contractor_id) continue;
    const s = get(e.contractor_id); s.earned += n(e.amount); s.mandays += n(e.headcount); map.set(e.contractor_id, s);
  }
  for (const p of payments) { const s = get(p.contractor_id); s.paid += n(p.amount); map.set(p.contractor_id, s); }
  for (const s of map.values()) s.balance = s.earned - s.paid;
  return map;
}

// ─── Inspections ─────────────────────────────────────────────────────────────
export function scoreInspection(results: ChecklistResult[]) {
  const applicable = results.filter((r) => r.result === 'pass' || r.result === 'fail');
  const passed = applicable.filter((r) => r.result === 'pass').length;
  const failed = applicable.length - passed;
  const missingRequired = results.filter((r) => r.required && r.result === null).length;
  const complete = results.every((r) => r.result !== null);
  return {
    score: applicable.length ? Math.round((passed / applicable.length) * 100) : null,
    passed, failed, complete, missingRequired,
    status: (!complete ? 'draft' : failed > 0 ? 'failed' : 'passed') as Inspection['status'],
  };
}

export const DEFAULT_TEMPLATES: Omit<InspectionTemplate, 'id'>[] = [
  { name: 'Daily safety walk', category: 'safety', items: [
    'All workers wearing helmets & safety shoes', 'Harness used for work at height (> 2 m)', 'Edge protection / guard rails in place',
    'Scaffolding tagged and inspected', 'Electrical cables & DBs protected, no loose wiring', 'Fire extinguisher accessible and charged',
    'First-aid kit stocked', 'Housekeeping — walkways clear of debris', 'Excavations barricaded', 'Toolbox talk conducted today',
  ].map((label, i) => ({ id: `s${i + 1}`, label, required: true })) },
  { name: 'Pre-concrete pour check', category: 'quality', items: [
    'Shuttering aligned, levelled and braced', 'Shuttering joints sealed, release agent applied', 'Reinforcement as per drawing (dia, spacing, laps)',
    'Cover blocks placed', 'Embedded conduits / sleeves fixed', 'Construction joints prepared', 'Vibrators and standby available',
    'Cube moulds ready for sampling', 'Engineer approval of reinforcement obtained',
  ].map((label, i) => ({ id: `c${i + 1}`, label, required: true })) },
  { name: 'Brickwork / blockwork', category: 'quality', items: [
    'Bricks soaked / blocks as per spec', 'Mortar ratio as specified', 'Line, level and plumb checked', 'Joints fully filled, thickness ≤ 10–12 mm',
    'Lintels / bands at correct level', 'Curing in progress',
  ].map((label, i) => ({ id: `b${i + 1}`, label })) },
  { name: 'Handover snag list (flat / unit)', category: 'handover', items: [
    'Doors & windows operate smoothly, hardware fixed', 'No cracks / dampness on walls & ceiling', 'Tiles — no hollowness, chips or lippage',
    'Plumbing — no leaks, adequate pressure', 'Sanitary fittings fixed and working', 'Electrical points, switches & DB working',
    'Paint finish uniform', 'Balcony / toilet slopes drain correctly', 'Unit cleaned before handover',
  ].map((label, i) => ({ id: `h${i + 1}`, label })) },
];

// ─── Timeline ────────────────────────────────────────────────────────────────
export const DAY = 86_400_000;
export function timelineRange(dates: (Date | null | undefined)[], padDays = 3) {
  const ts = dates.filter((d): d is Date => !!d && !isNaN(d.getTime())).map((d) => d.getTime());
  const now = Date.now();
  const min = Math.min(now, ...(ts.length ? ts : [now]));
  const max = Math.max(now + 14 * DAY, ...(ts.length ? ts : [now]));
  const start = new Date(min - padDays * DAY); start.setHours(0, 0, 0, 0);
  const end = new Date(max + padDays * DAY); end.setHours(0, 0, 0, 0);
  return { start, end, days: Math.round((end.getTime() - start.getTime()) / DAY) };
}
