/**
 * `percent` percent of `amount`, floored to whole dollars (CLAUDE.md, Money).
 * Every percentage in the engine goes through here: loan payments, borrow
 * interest, giving, half-price sales, market offers.
 */
export function pct(amount: number, percent: number): number {
  return Math.floor((amount * percent) / 100);
}
