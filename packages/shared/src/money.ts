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
