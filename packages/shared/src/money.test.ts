import { describe, expect, it } from 'vitest';

import { formatMoney } from './money';

// CLAUDE.md, Money: display is $1,234 with no decimals, through one formatMoney.

describe('formatMoney', () => {
  it('formatMoney: writes whole dollars with a dollar sign and thousands commas', () => {
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(7)).toBe('$7');
    expect(formatMoney(999)).toBe('$999');
    expect(formatMoney(1_000)).toBe('$1,000');
    expect(formatMoney(1_234)).toBe('$1,234');
    expect(formatMoney(45_000)).toBe('$45,000');
    expect(formatMoney(1_234_567)).toBe('$1,234,567');
  });

  it('formatMoney: puts the minus sign before the dollar sign', () => {
    expect(formatMoney(-380)).toBe('-$380');
    expect(formatMoney(-12_500)).toBe('-$12,500');
  });

  it('formatMoney: never writes a negative zero', () => {
    expect(formatMoney(-0)).toBe('$0');
  });

  it('formatMoney: throws on a fraction, since money in state is always whole dollars', () => {
    expect(() => formatMoney(1.5)).toThrow();
    expect(() => formatMoney(Number.NaN)).toThrow();
  });
});
