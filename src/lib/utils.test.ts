import { describe, it, expect } from 'vitest';
import { toDate, formatDate, formatTimeAgo, cn } from './utils';

// These pure helpers sit under every date the UI renders. The bugs fixed this
// cycle (timezone shifts, `.toDate()` on non-Timestamps) all traced back to
// date coercion, so lock the behaviour down here.

describe('toDate', () => {
  it('returns null for nullish / falsy input', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('')).toBeNull();
  });

  it('passes through a Date instance', () => {
    const d = new Date('2026-08-24T10:00:00.000Z');
    expect(toDate(d)).toBe(d);
  });

  it('parses an ISO string (the shape Supabase returns)', () => {
    const d = toDate('2026-08-24T11:52:00.000Z');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCHours()).toBe(11);
    expect(d!.getUTCFullYear()).toBe(2026);
  });

  it('calls .toDate() on a Firestore-style Timestamp', () => {
    const stamp = { toDate: () => new Date('2026-05-05T00:00:00.000Z') };
    expect(toDate(stamp)!.getUTCMonth()).toBe(4); // May
  });

  it('handles a serialized {_seconds} timestamp', () => {
    const d = toDate({ _seconds: 1_700_000_000 });
    expect(d!.getTime()).toBe(1_700_000_000 * 1000);
  });

  it('handles an epoch-millis number', () => {
    const ms = 1_700_000_000_000;
    expect(toDate(ms)!.getTime()).toBe(ms);
  });

  it('returns null for an unparseable string instead of an Invalid Date', () => {
    expect(toDate('not-a-date')).toBeNull();
  });
});

describe('formatDate', () => {
  it('renders an em dash for missing values (never "Invalid Date")', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('garbage')).toBe('—');
  });

  it('formats a real date with the default pattern', () => {
    expect(formatDate(new Date('2026-08-24T12:00:00.000Z'))).toMatch(/Aug 24, 2026/);
  });
});

describe('formatTimeAgo', () => {
  it('em-dashes missing values and returns a string otherwise', () => {
    expect(formatTimeAgo(null)).toBe('—');
    expect(typeof formatTimeAgo(new Date())).toBe('string');
  });
});

describe('cn', () => {
  it('joins truthy classes and drops falsy ones', () => {
    expect(cn('a', false, undefined, 'b', null)).toBe('a b');
  });
});
