import { roundLimit, roundNumber } from '@ff/engine';
import { BOARD, BOARD_SIZE, type GameState, type SpaceKind } from '@ff/shared';
import { useEffect, useState, type ReactNode } from 'react';

import { Pawn } from './Show';

import { SPACE_LABEL, SPACE_SHORT, tokenLabels } from '../lib/text';

/** Grid cell (row, column), 1-based, for each board position on the 7 by 7 ring, clockwise from the top-left corner. */
function cellFor(position: number): { row: number; col: number } {
  if (position <= 6) return { row: 1, col: position + 1 };
  if (position <= 12) return { row: position - 5, col: 7 };
  if (position <= 18) return { row: 7, col: 7 - (position - 12) };
  return { row: 7 - (position - 18), col: 1 };
}

/** Jewel-tone tiles with white text: every fill keeps white text at 5:1 or better. */
const TILE: Readonly<Record<SpaceKind, string>> = {
  opportunity: 'from-emerald-700 to-emerald-900 border-emerald-400/40',
  lifeChoices: 'from-orange-700 to-rose-900 border-orange-300/40',
  market: 'from-sky-700 to-indigo-900 border-sky-300/40',
  giving: 'from-violet-700 to-fuchsia-900 border-violet-300/40',
  setback: 'from-rose-700 to-red-950 border-rose-300/40',
};

function Icon({ kind }: { kind: SpaceKind }) {
  const common = { className: 'h-[56%] w-[56%]', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (kind) {
    case 'opportunity':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v10M9.5 9.5h3.75a1.75 1.75 0 0 1 0 3.5h-2.5a1.75 1.75 0 0 0 0 3.5H14.5" />
        </svg>
      );
    case 'lifeChoices':
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
        </svg>
      );
    case 'market':
      return (
        <svg {...common}>
          <path d="M4 19h16M6 15l4-4 3 3 5-6" />
          <path d="M14 8h4v4" />
        </svg>
      );
    case 'giving':
      return (
        <svg {...common}>
          <path d="M20 12v8H4v-8M2 7h20v5H2zM12 7v13M12 7c-2-3-6-3-6 0 0 2 6 0 6 0zm0 0c2-3 6-3 6 0 0 2-6 0-6 0z" />
        </svg>
      );
    case 'setback':
      return (
        <svg {...common}>
          <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
        </svg>
      );
  }
}

/**
 * Where each token is drawn. A token walks one space at a time toward the
 * player's real position, so a roll of 5 is five hops around the loop rather
 * than a jump across the middle. The engine's position is the fact; this is
 * only where the picture is right now.
 */
function useWalkingTokens(state: GameState): ReadonlyMap<string, number> {
  const target = new Map(state.players.map((p) => [p.id, p.position]));
  const [shown, setShown] = useState<ReadonlyMap<string, number>>(target);
  useEffect(() => {
    const behind = state.players.find((p) => shown.get(p.id) !== p.position);
    if (behind === undefined) return;
    const timer = window.setTimeout(() => {
      setShown((prev) => {
        const next = new Map(prev);
        for (const p of state.players) {
          const at = prev.get(p.id);
          if (at === undefined) next.set(p.id, p.position);
          else if (at !== p.position) next.set(p.id, (at + 1) % BOARD_SIZE);
        }
        return next;
      });
    }, 170);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state.players, shown]);
  return shown;
}

/**
 * The 24-space loop with a free centre for whatever the view wants there.
 * `tv` enlarges labels for reading from a couch.
 */
export function Board({ state, children, tv = false }: { state: GameState; children?: ReactNode; tv?: boolean }) {
  const shown = useWalkingTokens(state);
  const current = state.game.currentPlayerId;
  const currentAt = shown.get(current);
  const labels = tokenLabels(state.players);
  const pawnSize = usePawnSize(tv);

  return (
    <section aria-label="Game board" className="relative aspect-square w-full">
      <div className="grid h-full w-full grid-cols-7 grid-rows-7 gap-[1.5%]">
        {BOARD.map((kind, position) => {
          const { row, col } = cellFor(position);
          const here = state.players.filter((p) => !p.isOut && p.position === position).map((p) => p.name);
          const lit = currentAt === position;
          return (
            <div
              key={position}
              style={{ gridRow: row, gridColumn: col }}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-[7%] overflow-hidden rounded-[18%] border bg-gradient-to-br p-[6%] text-center leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_6px_14px_-6px_rgba(0,0,0,0.7)] ${TILE[kind]} ${lit ? 'z-[1] scale-[1.06] shadow-glow' : ''} transition-transform duration-300`}
            >
              <span className="sr-only">{`Space ${String(position + 1)}: ${SPACE_LABEL[kind]}${here.length > 0 ? `. Here: ${here.join(', ')}` : ''}`}</span>
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[inherit] bg-gradient-to-b from-white/20 to-transparent" />
              <span aria-hidden="true" className="flex aspect-square w-[46%] items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                <Icon kind={kind} />
              </span>
              <span aria-hidden="true" className={`font-display font-extrabold uppercase tracking-wider ${tv ? 'text-[0.95vw]' : 'text-[0.55rem] sm:text-[0.7rem]'}`}>
                {SPACE_SHORT[kind]}
              </span>
            </div>
          );
        })}
        <div className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden p-2 text-center" style={{ gridRow: '2 / 7', gridColumn: '2 / 7' }}>
          <MonthMeter state={state} tv={tv} />
          {children}
        </div>
      </div>

      {/* Tokens float above the tiles so they can slide between them. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {state.players.map((p, seat) => {
          if (p.isOut) return null;
          const shareCount = (space: number) => state.players.filter((q) => !q.isOut && (shown.get(q.id) ?? q.position) === space).length;
          const at = shown.get(p.id) ?? p.position;
          const { row, col } = cellFor(at);
          const crowd = state.players.filter((q, i) => !q.isOut && (shown.get(q.id) ?? q.position) === at && i < seat).length;
          const cx = (col - 0.5) * (100 / 7) + (crowd % 2) * 3.2 - (crowd > 0 || shareCount(at) > 1 ? 1.6 : 0);
          // Pawns sit over the tile's icon so the label underneath stays readable.
          const cy = (row - 0.5) * (100 / 7) - 1.6 + Math.floor(crowd / 2) * 2.6;
          const isCurrent = p.id === current;
          return (
            <div
              key={p.id}
              className={`absolute transition-[left,top] duration-150 ease-out ${isCurrent ? 'z-10' : ''}`}
              style={{ left: `${String(cx)}%`, top: `${String(cy)}%`, transform: 'translate(-50%, -50%)' }}
              title={p.name}
            >
              <Pawn seat={seat} label={labels[seat] ?? '?'} size={pawnSize} active={isCurrent} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** A die face. Remounting with a new `rollKey` replays the tumble. */
export function Die({ value, rollKey, size = 64 }: { value: number; rollKey: number; size?: number }) {
  const pip = (x: number, y: number) => <circle key={`${String(x)}${String(y)}`} cx={x} cy={y} r={9} fill="#1a1033" />;
  const faces: Readonly<Record<number, [number, number][]>> = {
    1: [[50, 50]],
    2: [[26, 26], [74, 74]],
    3: [[26, 26], [50, 50], [74, 74]],
    4: [[26, 26], [74, 26], [26, 74], [74, 74]],
    5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
    6: [[26, 26], [74, 26], [26, 50], [74, 50], [26, 74], [74, 74]],
  };
  return (
    <svg key={rollKey} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Rolled a ${String(value)}`} className="die-tumble drop-shadow-[0_10px_20px_rgba(255,209,102,0.45)]">
      <defs><linearGradient id="die-face" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dfe3f5" /></linearGradient></defs>
      <rect x="4" y="4" width="92" height="92" rx="22" fill="url(#die-face)" stroke="#ffd166" strokeWidth="4" />
      {(faces[value] ?? []).map(([x, y]) => pip(x, y))}
    </svg>
  );
}

/** Pawn diameter in pixels: a share of the viewport so it scales from phone to TV. */
function usePawnSize(tv: boolean): number {
  const measure = () => Math.round(Math.min(window.innerWidth, window.innerHeight) * (tv ? 0.042 : 0.03));
  const [size, setSize] = useState(measure);
  useEffect(() => {
    const onResize = () => {
      setSize(Math.max(18, measure()));
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  });
  return Math.max(18, size);
}

/** Month progress: the round as text plus a row of pips, one per month. */
function MonthMeter({ state, tv }: { state: GameState; tv: boolean }) {
  const month = roundNumber(state);
  const limit = roundLimit(state);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <p className={`eyebrow text-white/70 ${tv ? '!text-[1vw]' : ''}`}>
        Month {month} of {limit}
      </p>
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: limit }, (_, i) => (
          <span key={i} className={`rounded-full ${tv ? 'h-[0.6vw] w-[0.6vw]' : 'h-1.5 w-1.5'} ${i < month - 1 ? 'bg-gold' : i === month - 1 ? 'bg-white' : 'bg-white/20'}`} />
        ))}
      </div>
    </div>
  );
}
