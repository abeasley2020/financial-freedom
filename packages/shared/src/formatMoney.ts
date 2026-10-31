/**
 * The one money display (CLAUDE.md, Money): whole dollars, thousands
 * separators, no decimals, minus sign before the dollar sign: `-$1,234`.
 */
export function formatMoney(amount: number): string {
  const digits = String(Math.abs(Math.trunc(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${amount < 0 ? '-' : ''}$${digits}`;
}

/** Like formatMoney, with a plus sign on money in, so direction never relies on color alone. */
export function formatSignedMoney(amount: number): string {
  return amount > 0 ? `+${formatMoney(amount)}` : formatMoney(amount);
}
