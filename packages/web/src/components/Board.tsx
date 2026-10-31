import { roundLimit, roundNumber } from '@ff/engine';
import { BOARD, BOARD_SIZE, type GameState, type SpaceKind } from '@ff/shared';
import { useEffect, useState, type ReactNode } from 'react';

import { SPACE_LABEL, SPACE_SHORT, seatColor, tokenLabels } from '../lib/text';

/** Grid cell (row, column), 1-based, for each board position on the 7 by 7 ring, clockwise from the top-left corner. */
function cellFor(position: number): { row: number; col: number } {
  if (position <= 6) return { row: 1, col: position + 1 };
  if (position <= 12) return { row: position - 5, col: 7 };
  if (position <= 18) return { row: 7, col: 7 - (position - 12) };
  return { row: 7 - (position - 18), col: 1 };
}

/** Tile fills, dark text on a light tint, for both the paper and the TV themes. */
const TILE: Readonly<Record<SpaceKind, string>> = {
  opportunity: 'bg-emerald-100 border-emerald-700 text-emerald-950',
  lifeChoices: 'bg-amber-100 border-amber-700 text-amber-950',
  market: 'bg-sky-100 border-sky-700 text-sky-950',
  giving: 'bg-violet-100 border-violet-700 text-violet-950',
  setback: 'bg-rose-100 border-rose-700 text-rose-950',
};

function Icon({ kind }: { kind: SpaceKind }) {
  const common = { className: 'h-[38%] w-[38%] shrink-0', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
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
              className={`relative flex min-w-0 flex-col items-center justify-center gap-[6%] overflow-hidden rounded-[14%] border-[3px] p-[6%] text-center leading-none ${TILE[kind]} ${lit ? 'ring-4 ring-yellow-400 ring-offset-2' : ''}`}
            >
              <span className="sr-only">{`Space ${String(position + 1)}: ${SPACE_LABEL[kind]}${here.length > 0 ? `. Here: ${here.join(', ')}` : ''}`}</span>
              <Icon kind={kind} />
              <span aria-hidden="true" className={`font-extrabold uppercase tracking-wide ${tv ? 'text-[1vw]' : 'text-[0.6rem] sm:text-xs'}`}>
                {SPACE_SHORT[kind]}
              </span>
            </div>
          );
        })}
        <div className="flex min-h-0 min-w-0 flex-col items-center justify-center gap-2 overflow-hidden p-2 text-center" style={{ gridRow: '2 / 7', gridColumn: '2 / 7' }}>
          <p className={`font-semibold uppercase tracking-widest opacity-70 ${tv ? 'text-[1.3vw]' : 'text-sm'}`}>
            Month {roundNumber(state)} of {roundLimit(state)}
          </p>
          {children}
        </div>
      </div>

      {/* Tokens float above the tiles so they can slide between them. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {state.players.map((p, seat) => {
          if (p.isOut) return null;
          const at = shown.get(p.id) ?? p.position;
          const { row, col } = cellFor(at);
          const crowd = state.players.filter((q, i) => !q.isOut && (shown.get(q.id) ?? q.position) === at && i < seat).length;
          const cx = (col - 0.5) * (100 / 7) + (crowd % 2) * 3.2 - 1.6;
          const cy = (row - 0.5) * (100 / 7) + Math.floor(crowd / 2) * 3.2 + 1.2;
          const isCurrent = p.id === current;
          return (
            <div
              key={p.id}
              className={`absolute flex items-center justify-center rounded-full border-[3px] border-white font-black text-white shadow-lg transition-[left,top] duration-150 ease-out ${tv ? 'h-[4.2%] w-[4.2%] text-[1.3vw]' : 'h-[5%] w-[5%] text-[0.75rem]'} ${isCurrent ? 'z-10 scale-125 ring-4 ring-yellow-400' : ''}`}
              style={{ left: `${String(cx)}%`, top: `${String(cy)}%`, transform: 'translate(-50%, -50%)', backgroundColor: seatColor(seat) }}
              title={p.name}
            >
              {labels[seat]}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** A die face. Remounting with a new `rollKey` replays the tumble. */
export function Die({ value, rollKey, size = 64 }: { value: number; rollKey: number; size?: number }) {
  const pip = (x: number, y: number) => <circle key={`${String(x)}${String(y)}`} cx={x} cy={y} r={9} fill="#1f2328" />;
  const faces: Readonly<Record<number, [number, number][]>> = {
    1: [[50, 50]],
    2: [[26, 26], [74, 74]],
    3: [[26, 26], [50, 50], [74, 74]],
    4: [[26, 26], [74, 26], [26, 74], [74, 74]],
    5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
    6: [[26, 26], [74, 26], [26, 50], [74, 50], [26, 74], [74, 74]],
  };
  return (
    <svg key={rollKey} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Rolled a ${String(value)}`} className="die-tumble drop-shadow-md">
      <rect x="4" y="4" width="92" height="92" rx="18" fill="#fff" stroke="#1f2328" strokeWidth="4" />
      {(faces[value] ?? []).map(([x, y]) => pip(x, y))}
    </svg>
  );
}
