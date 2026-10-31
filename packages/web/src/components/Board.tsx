import { roundLimit, roundNumber } from '@ff/engine';
import { BOARD, type GameState } from '@ff/shared';
import type { ReactNode } from 'react';

import { SPACE_LABEL, SPACE_SHORT, SPACE_STYLE, seatColor } from '../lib/text';

/** Grid cell (row, column) for each board position on the 7 by 7 ring, clockwise from the top-left corner. */
function cellFor(position: number): { row: number; col: number } {
  if (position <= 6) return { row: 1, col: position + 1 };
  if (position <= 12) return { row: position - 5, col: 7 };
  if (position <= 18) return { row: 7, col: 7 - (position - 12) };
  return { row: 7 - (position - 18), col: 1 };
}

export function Board({ state, children }: { state: GameState; children?: ReactNode }) {
  return (
    <section aria-label="Game board" className="grid aspect-square w-full grid-cols-7 grid-rows-7 gap-1">
      {BOARD.map((kind, position) => {
        const { row, col } = cellFor(position);
        const here = state.players.map((p, seat) => ({ p, seat })).filter(({ p }) => !p.isOut && p.position === position);
        const isCurrent = here.some(({ p }) => p.id === state.game.currentPlayerId);
        return (
          <div
            key={position}
            style={{ gridRow: row, gridColumn: col }}
            className={`relative flex min-w-0 flex-col justify-between overflow-hidden break-words rounded-md border-2 p-1 text-[0.7rem] leading-tight sm:text-xs ${SPACE_STYLE[kind]} ${isCurrent ? 'ring-4 ring-accent' : ''}`}
          >
            <span className="sr-only">
              {`Space ${String(position + 1)}: ${SPACE_LABEL[kind]}${here.length > 0 ? `. Here: ${here.map(({ p }) => p.name).join(', ')}` : ''}`}
            </span>
            <span className="font-bold" aria-hidden="true">
              <span className="sm:hidden">{SPACE_SHORT[kind]}</span>
              <span className="hidden sm:inline">{SPACE_LABEL[kind]}</span>
            </span>
            <span className="flex flex-wrap gap-0.5" aria-hidden="true">
              {here.map(({ p, seat }) => (
                <span
                  key={p.id}
                  title={p.name}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-white text-[0.65rem] font-bold text-white sm:h-6 sm:w-6"
                  style={{ backgroundColor: seatColor(seat) }}
                >
                  {seat + 1}
                </span>
              ))}
            </span>
          </div>
        );
      })}
      <div className="flex flex-col items-center justify-center gap-2 overflow-auto p-2 text-center" style={{ gridRow: '2 / 7', gridColumn: '2 / 7' }}>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Month {roundNumber(state)} of {roundLimit(state)}
        </p>
        {children}
      </div>
    </section>
  );
}
