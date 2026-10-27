import { z } from 'zod';

/** Whole dollars, never negative. Cash, prices, principals, payments (CLAUDE.md, Money). */
export const MoneySchema = z.number().int().nonnegative();
export type Money = z.infer<typeof MoneySchema>;

/** Whole dollars that may be negative: monthly cash flow of an asset, a cash delta in the log. */
export const SignedMoneySchema = z.number().int();
export type SignedMoney = z.infer<typeof SignedMoneySchema>;

/** A whole-number percent such as 10 for 10%. */
export const PercentSchema = z.number().int().nonnegative();
export type Percent = z.infer<typeof PercentSchema>;

/**
 * Display form of whole dollars: `$1,234`, `-$380` (CLAUDE.md, Money). The
 * one place money becomes text. Written by hand rather than with
 * toLocaleString so the output never depends on the machine's locale.
 */
export function formatMoney(amount: number): string {
  if (!Number.isInteger(amount)) throw new Error(`formatMoney: ${String(amount)} is not whole dollars`);
  const digits = String(Math.abs(amount));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return amount < 0 ? `-$${grouped}` : `$${grouped}`;
}
