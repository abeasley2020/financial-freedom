import { formatSignedMoney } from '@ff/shared';

/**
 * A signed money amount: green with "in" for money coming in, red with "out"
 * for money going out. The sign and the hidden word carry the meaning, so
 * color is never the only signal (CLAUDE.md, Money).
 */
export function Money({ amount, suffix = '' }: { amount: number; suffix?: string }) {
  if (amount === 0) return <span className="font-semibold text-white/80">{formatSignedMoney(0) + suffix}</span>;
  const incoming = amount > 0;
  return (
    <span className={`font-semibold ${incoming ? 'text-gain' : 'text-loss'}`}>
      {formatSignedMoney(amount) + suffix}
      <span className="sr-only">{incoming ? ' money in' : ' money out'}</span>
    </span>
  );
}
