import { freedomPercent, monthlyCashFlow } from '@ff/engine';
import { formatMoney, type GameState } from '@ff/shared';

import { professionName, tokenLabels } from '../lib/text';
import { Money } from './Money';
import { FreedomRing, Pawn } from './Show';

/** Everyone at the table, as contestant cards. */
export function Scoreboard({ state }: { state: GameState }) {
  const labels = tokenLabels(state.players);
  return (
    <section aria-labelledby="scoreboard-heading">
      <h2 id="scoreboard-heading" className="eyebrow mb-3 text-white/70">
        Contestants
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {state.players.map((p, seat) => {
          const current = p.id === state.game.currentPlayerId;
          return (
            <li key={p.id} aria-current={current ? 'true' : undefined} className={`glass flex items-center gap-3 p-3 ${current ? 'shadow-glow' : ''} ${p.isOut ? 'opacity-50' : ''}`}>
              <Pawn seat={seat} label={labels[seat] ?? '?'} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-extrabold leading-tight">{p.name}</p>
                <p className="truncate text-xs text-white/70">
                  {professionName(p.professionId)}
                  {p.isOut ? ' · out' : p.skipsNextTurn ? ' · sits out next' : ''}
                  {p.favorTokens > 0 ? ` · ${String(p.favorTokens)} Favor` : ''}
                </p>
                <p className="text-sm">
                  {formatMoney(p.cash)} · {p.isOut ? 'no Payday' : <Money amount={monthlyCashFlow(p)} suffix="/mo" />}
                </p>
              </div>
              <FreedomRing percent={freedomPercent(p)} seat={seat} size={52} label={`${p.name} freedom`} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
