// Show pieces shared by the controller and the TV: pawns, Freedom rings,
// the card frame, and the moments (turn splash, Payday pop, confetti).
// Display only: every number shown comes from engine state or the log.

import type { GameState } from '@ff/shared';
import { formatSignedMoney } from '@ff/shared';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { seatColor, seatGlow } from '../lib/text';

/** A glossy pawn in the seat's color. */
export function Pawn({ seat, label, size = 40, active = false }: { seat: number; label: string; size?: number; active?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full font-display font-extrabold text-white ${active ? 'pulse-ring' : ''}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.46,
        background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.75) 0, rgba(255,255,255,0) 34%), ${seatColor(seat)}`,
        boxShadow: `0 0 0 ${String(Math.max(2, size / 14))}px ${seatGlow(seat)}, 0 ${String(size / 6)}px ${String(size / 3)}px rgba(0,0,0,0.5)`,
        textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}
    >
      {label}
    </span>
  );
}

/** Freedom as a ring that fills toward 100%. */
export function FreedomRing({ percent, seat, size = 64, label }: { percent: number; seat: number; size?: number; label: string }) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const shown = Math.min(100, Math.max(0, percent));
  return (
    <span role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={shown} aria-valuetext={`${String(percent)} percent free`} className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="11" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={seatGlow(seat)}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.2,0.8,0.2,1)' }}
        />
      </svg>
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-display font-extrabold" style={{ fontSize: size * 0.27 }}>
        {percent}%
      </span>
    </span>
  );
}

export type DeckTone = 'deal' | 'big' | 'life' | 'market' | 'give' | 'setback';

const TONE: Readonly<Record<DeckTone, { band: string; glow: string }>> = {
  deal: { band: 'from-emerald-500 to-teal-700', glow: 'rgba(16,185,129,0.45)' },
  big: { band: 'from-emerald-400 via-teal-500 to-cyan-700', glow: 'rgba(20,184,166,0.5)' },
  life: { band: 'from-orange-500 to-rose-700', glow: 'rgba(249,115,22,0.45)' },
  market: { band: 'from-sky-500 to-indigo-700', glow: 'rgba(14,165,233,0.45)' },
  give: { band: 'from-violet-500 to-fuchsia-700', glow: 'rgba(168,85,247,0.45)' },
  setback: { band: 'from-rose-500 to-red-800', glow: 'rgba(244,63,94,0.45)' },
};

/** A game card: colored header band, title, and a body. Flips in when its key changes. */
export function GameCard({ tone, kicker, title, children, headingId, size = 'md' }: { tone: DeckTone; kicker: string; title: string; children?: ReactNode; headingId?: string; size?: 'md' | 'tv' }) {
  const t = TONE[tone];
  const tv = size === 'tv';
  return (
    <section aria-labelledby={headingId} className="card-flip overflow-hidden rounded-[28px] border border-white/15 bg-surface" style={{ boxShadow: `0 30px 60px -20px ${t.glow}, 0 0 0 1px rgba(255,255,255,0.04) inset` }}>
      <div className={`bg-gradient-to-br ${t.band} ${tv ? 'px-[1.6vw] py-[1.2vw]' : 'px-6 py-5'}`}>
        <p className={`eyebrow text-white/90 ${tv ? '!text-[1vw]' : ''}`}>{kicker}</p>
        <h2 id={headingId} className={`font-display font-extrabold leading-[1.05] text-white drop-shadow ${tv ? 'text-[2.6vw]' : 'text-3xl sm:text-4xl'}`}>
          {title}
        </h2>
      </div>
      <div className={tv ? 'p-[1.4vw]' : 'p-5 sm:p-6'}>{children}</div>
    </section>
  );
}

/** A big number with a small label: the two numbers every decision shows. */
export function BigStat({ label, children, tv = false }: { label: string; children: ReactNode; tv?: boolean }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-4 py-3">
      <dt className={`eyebrow text-white/70 ${tv ? '!text-[0.85vw]' : ''}`}>{label}</dt>
      <dd className={`font-display font-extrabold leading-tight ${tv ? 'text-[2vw]' : 'text-2xl'}`}>{children}</dd>
    </div>
  );
}

/** True for `ms` after `key` changes (not on first mount unless `onMount`). */
function useMoment(key: string | number | null, ms: number, onMount = false): boolean {
  const [shownFor, setShownFor] = useState<string | number | null>(onMount ? key : null);
  const [last, setLast] = useState(key);
  if (key !== last) {
    setLast(key);
    setShownFor(key);
  }
  useEffect(() => {
    if (shownFor === null) return;
    const timer = window.setTimeout(() => {
      setShownFor(null);
    }, ms);
    return () => {
      window.clearTimeout(timer);
    };
  }, [shownFor, ms]);
  return shownFor !== null && shownFor === key;
}

/** Full-screen "Your turn" moment in the new player's color. */
export function TurnSplash({ state, label }: { state: GameState; label: (seat: number) => string }) {
  const seat = state.players.findIndex((p) => p.id === state.game.currentPlayerId);
  const player = state.players[seat];
  const showing = useMoment(`${String(state.game.turnNumber)}:${state.game.currentPlayerId}`, 1600, true);
  if (!showing || player === undefined) return null;
  return (
    <div aria-hidden="true" className="splash pointer-events-none fixed inset-0 z-50 flex items-center justify-center" style={{ background: `radial-gradient(circle at center, ${seatColor(seat)}ee 0%, rgba(11,13,38,0.92) 70%)` }}>
      <div className="splash-name flex flex-col items-center gap-4 text-center">
        <Pawn seat={seat} label={label(seat)} size={120} />
        <p className="eyebrow text-white/80">Your turn</p>
        <p className="font-display text-6xl font-extrabold drop-shadow-lg sm:text-7xl">{player.name}</p>
      </div>
    </div>
  );
}

/** The Payday amount, floating up over the stage right after a roll. */
export function PaydayPop({ state, placement = 'bottom-10 left-1/2', size = 'text-3xl' }: { state: GameState; placement?: string; size?: string }) {
  const last = state.game.log.at(-1);
  const payday = last?.action.type === 'ROLL' ? last.events.find((e) => e.kind === 'payday') : undefined;
  const key = payday?.kind === 'payday' ? state.game.log.length : null;
  const showing = useMoment(key, 2200);
  if (!showing || payday?.kind !== 'payday') return null;
  const up = payday.amount >= 0;
  return (
    <div aria-hidden="true" className={`pop pointer-events-none fixed z-40 ${placement}`}>
      <div className={`whitespace-nowrap rounded-full px-6 py-3 font-display font-extrabold shadow-2xl ${size} ${up ? 'bg-emerald-500 text-ink' : 'bg-rose-600 text-white'}`}>
        Payday {formatSignedMoney(payday.amount)}
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ['#ffd166', '#5ee39a', '#60a5fa', '#f472b6', '#c084fc', '#fb923c'];

/** A burst of confetti when `trigger` changes to a non-null value. */
export function Confetti({ trigger, pieces = 70 }: { trigger: string | number | null; pieces?: number }) {
  const showing = useMoment(trigger, 3200);
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        left: `${String((i * 37) % 100)}%`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? '#ffd166',
        drift: `${String(((i * 53) % 40) - 20)}vw`,
        spin: `${String(360 + ((i * 97) % 720))}deg`,
        dur: `${String(1.8 + ((i * 13) % 12) / 10)}s`,
        delay: `${String(((i * 7) % 10) / 20)}s`,
      })),
    [pieces],
  );
  if (!showing) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{ left: b.left, background: b.color, ['--drift' as string]: b.drift, ['--spin' as string]: b.spin, ['--dur' as string]: b.dur, ['--delay' as string]: b.delay }}
        />
      ))}
    </div>
  );
}
