import { describe, expect, it } from 'vitest';

import { pct } from './money';

describe('pct', () => {
  it('takes a whole-number percent of an amount', () => {
    expect(pct(12_000, 1)).toBe(120);
    expect(pct(6_000, 2)).toBe(120);
    expect(pct(2_000, 3)).toBe(60);
    expect(pct(1_000, 10)).toBe(100);
  });

  it('floors to whole dollars', () => {
    expect(pct(999, 10)).toBe(99);
    expect(pct(150_000, 1)).toBe(1_500);
    expect(pct(2_500, 3)).toBe(75);
    expect(pct(333, 50)).toBe(166);
  });

  it('returns 0 for a zero amount or zero percent', () => {
    expect(pct(0, 10)).toBe(0);
    expect(pct(500, 0)).toBe(0);
  });
});
