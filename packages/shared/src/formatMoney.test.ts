import { describe, expect, it } from 'vitest';

import { formatMoney, formatSignedMoney } from './formatMoney';

describe('formatMoney: whole dollars with thousands separators, no decimals (CLAUDE.md, Money)', () => {
  it('formatMoney: formats zero, small, and large amounts', () => {
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(7)).toBe('$7');
    expect(formatMoney(1_234)).toBe('$1,234');
    expect(formatMoney(1_234_567)).toBe('$1,234,567');
  });

  it('formatMoney: puts the minus sign before the dollar sign', () => {
    expect(formatMoney(-380)).toBe('-$380');
    expect(formatMoney(-12_000)).toBe('-$12,000');
  });

  it('formatSignedMoney: always shows a sign, so money in and money out read without color', () => {
    expect(formatSignedMoney(740)).toBe('+$740');
    expect(formatSignedMoney(-380)).toBe('-$380');
    expect(formatSignedMoney(0)).toBe('$0');
  });
});
