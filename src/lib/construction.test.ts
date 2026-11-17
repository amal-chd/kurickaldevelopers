import { describe, it, expect } from 'vitest';
import {
  boqTotals, costSummary, parseBoqRows, signedQuantity, stockByMaterial, avgRate,
  labourAmount, contractorBalances, scoreInspection, timelineRange, DEFAULT_TEMPLATES,
} from './construction';

describe('BOQ & cost', () => {
  const boq = [
    { quantity: 100, rate: 5000, executed_qty: 50 },  // 5,00,000 planned, 2,50,000 earned
    { quantity: 10, rate: 1000, executed_qty: 12 },   // over-executed: capped at planned qty
  ];
  it('totals planned and earned value, capping over-execution', () => {
    const t = boqTotals(boq);
    expect(t.planned).toBe(510000);
    expect(t.earned).toBe(260000);
    expect(t.progress).toBeCloseTo(260000 / 510000);
  });
  it('computes CPI, forecast and variance', () => {
    const s = costSummary({ budget: 600000, boq, materialReceipts: 200000, labour: 100000, expenses: 25000 });
    expect(s.actual.total).toBe(325000);
    expect(s.cpi).toBeCloseTo(0.8, 2);
    expect(s.forecast).toBeCloseTo(510000 / 0.8, 0);
    expect(s.variance).toBeCloseTo(600000 - 510000 / 0.8, 0);
  });
  it('returns null CPI when nothing has been spent or earned', () => {
    expect(costSummary({ boq: [], materialReceipts: 0, labour: 0, expenses: 0 }).cpi).toBeNull();
  });
  it('parses spreadsheet rows with varied headers and skips blanks', () => {
    const rows = parseBoqRows([
      { 'Sl. No': '1.1', 'Item Description': 'PCC 1:4:8', UOM: 'cum', Qty: '12.5', Rate: 5200, Section: 'Substructure' },
      { Description: '', Qty: 1 },
      { particulars: 'Brickwork', unit: 'cum', quantity: -3, rate: 'abc' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ code: '1.1', description: 'PCC 1:4:8', unit: 'cum', quantity: 12.5, rate: 5200, category: 'Substructure' });
    expect(rows[1]).toMatchObject({ quantity: 0, rate: 0 });
  });
});

describe('materials', () => {
  it('signs quantities by movement kind', () => {
    expect(signedQuantity('receipt', 10)).toBe(10);
    expect(signedQuantity('issue', 10)).toBe(-10);
    expect(signedQuantity('issue', -10)).toBe(-10);
    expect(signedQuantity('return', 3)).toBe(3);
    expect(signedQuantity('adjustment', -2)).toBe(-2);
  });
  it('computes stock, issued and weighted average rate', () => {
    const s = stockByMaterial([
      { material_id: 'cement', kind: 'receipt', quantity: 100, rate: 400 },
      { material_id: 'cement', kind: 'receipt', quantity: 100, rate: 420 },
      { material_id: 'cement', kind: 'issue', quantity: -150, rate: 0 },
    ]).get('cement')!;
    expect(s.quantity).toBe(50);
    expect(s.issuedQty).toBe(150);
    expect(avgRate(s)).toBe(410);
  });
});

describe('labour', () => {
  it('computes wages with overtime', () => {
    expect(labourAmount({ headcount: 8, rate: 900, overtime_hours: 2, overtime_rate: 150 })).toBe(7500);
  });
  it('computes contractor balances net of payments and advances', () => {
    const b = contractorBalances(
      [{ contractor_id: 'a', amount: 10000, headcount: 10 }, { contractor_id: 'a', amount: 5000, headcount: 5 }, { contractor_id: null, amount: 999, headcount: 1 }],
      [{ contractor_id: 'a', amount: 12000 }, { contractor_id: 'b', amount: 2000 }],
    );
    expect(b.get('a')).toEqual({ earned: 15000, paid: 12000, balance: 3000, mandays: 15 });
    expect(b.get('b')!.balance).toBe(-2000); // advance outstanding
  });
});

describe('inspections', () => {
  it('scores applicable items and derives status', () => {
    const s = scoreInspection([
      { id: '1', label: 'a', result: 'pass' }, { id: '2', label: 'b', result: 'fail' }, { id: '3', label: 'c', result: 'na' }, { id: '4', label: 'd', result: 'pass' },
    ]);
    expect(s).toMatchObject({ score: 67, passed: 2, failed: 1, complete: true, status: 'failed' });
  });
  it('stays draft until every item is answered', () => {
    const s = scoreInspection([{ id: '1', label: 'a', result: 'pass', required: true }, { id: '2', label: 'b', result: null, required: true }]);
    expect(s.status).toBe('draft');
    expect(s.missingRequired).toBe(1);
  });
  it('ships sensible default checklists with unique item ids', () => {
    expect(DEFAULT_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    for (const t of DEFAULT_TEMPLATES) expect(new Set(t.items.map((i) => i.id)).size).toBe(t.items.length);
  });
});

describe('timeline', () => {
  it('spans all dates plus today with padding', () => {
    const a = new Date('2026-01-10'), b = new Date('2026-03-01');
    const r = timelineRange([a, b, null], 2);
    expect(r.start.getTime()).toBeLessThan(a.getTime());
    expect(r.end.getTime()).toBeGreaterThan(Math.max(b.getTime(), Date.now()));
    expect(r.days).toBeGreaterThan(0);
  });
});
