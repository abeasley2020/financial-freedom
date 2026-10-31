import { freedomPercent, monthlyCashFlow } from '@ff/engine';
import { formatMoney, type GameState } from '@ff/shared';

import { professionName, seatColor } from '../lib/text';
import { Money } from './Money';

/** Everyone at the table, at a glance. */
export function Scoreboard({ state }: { state: GameState }) {
  return (
    <section className="panel" aria-labelledby="scoreboard-heading">
      <h2 id="scoreboard-heading" className="text-xl font-bold">
        Table
      </h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-300">
              <th scope="col" className="py-2 pr-2">
                Player
              </th>
              <th scope="col" className="py-2 pr-2">
                Cash
              </th>
              <th scope="col" className="py-2 pr-2">
                Payday
              </th>
              <th scope="col" className="py-2 pr-2">
                Freedom
              </th>
            </tr>
          </thead>
          <tbody>
            {state.players.map((p, seat) => {
              const current = p.id === state.game.currentPlayerId;
              return (
                <tr key={p.id} className={`border-b border-slate-200 ${current ? 'bg-sky-50 font-semibold' : ''}`} aria-current={current ? 'true' : undefined}>
                  <th scope="row" className="py-2 pr-2 font-semibold">
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: seatColor(seat) }}>
                        {seat + 1}
                      </span>
                      <span>
                        {p.name}
                        <span className="block text-xs font-normal text-slate-600">
                          {professionName(p.professionId)}
                          {p.isOut ? ' · out of the game' : p.skipsNextTurn ? ' · skips next turn' : ''}
                          {p.favorTokens > 0 ? ` · ${String(p.favorTokens)} Favor` : ''}
                        </span>
                      </span>
                    </span>
                  </th>
                  <td className="py-2 pr-2">{formatMoney(p.cash)}</td>
                  <td className="py-2 pr-2">{p.isOut ? 'none' : <Money amount={monthlyCashFlow(p)} suffix="/mo" />}</td>
                  <td className="py-2 pr-2">{freedomPercent(p)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
