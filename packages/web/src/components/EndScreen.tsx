import { freedomPercent, netWorth, passiveIncome, rankPlayers, totalExpenses, winner } from '@ff/engine';
import { formatMoney, type GameState, type Player } from '@ff/shared';

import { professionName, seatColor } from '../lib/text';
import { useGame } from '../store';

/** End of game: the winner, the family ranking, and each player's money story. */
export function EndScreen({ state }: { state: GameState }) {
  const quit = useGame((s) => s.quit);
  const start = useGame((s) => s.start);
  const champ = winner(state);
  const ended = state.game.log.flatMap((e) => e.events).find((e) => e.kind === 'gameEnded');
  const ranked = [...rankPlayers(state), ...state.players.filter((p) => p.isOut)];
  const reason =
    ended?.kind !== 'gameEnded'
      ? ''
      : ended.reason === 'escape'
        ? 'escaped the rat race: their assets now pay every monthly bill.'
        : ended.reason === 'roundLimit'
          ? 'reached the highest Freedom when time ran out.'
          : 'is the last player standing.';

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-4xl font-extrabold">Game over</h1>
      {champ !== undefined && (
        <p className="mt-2 text-2xl">
          <span className="font-bold">{champ.name}</span> wins! {champ.name} {reason}
        </p>
      )}

      <section className="panel mt-6" aria-labelledby="ranking-heading">
        <h2 id="ranking-heading" className="text-xl font-bold">
          Family ranking
        </h2>
        <ol className="mt-3 space-y-3">
          {ranked.map((p, i) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-300 p-3">
              <span className="text-2xl font-extrabold">{i + 1}.</span>
              <span className="min-w-[10rem] flex-1">
                <span className="block text-lg font-bold">{p.name}</span>
                <span className="block text-sm text-slate-600">
                  {professionName(p.professionId)}
                  {p.isOut ? ', ran out of money' : ''}
                </span>
              </span>
              <span className="text-lg font-bold">{freedomPercent(p)}% Freedom</span>
              <span className="text-sm">
                Assets paid {formatMoney(passiveIncome(p))} of {formatMoney(totalExpenses(p))} monthly bills. Cash {formatMoney(p.cash)}, net worth {formatMoney(netWorth(p))}.
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel mt-6" aria-labelledby="story-heading">
        <h2 id="story-heading" className="text-xl font-bold">
          Money stories
        </h2>
        <p className="text-sm text-slate-700">Each month: passive income (solid line) against monthly bills (dashed line). Where the solid line crosses above the dashed line is freedom.</p>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {state.players.map((p, seat) => (
            <MoneyStory key={p.id} state={state} player={p} color={seatColor(seat)} />
          ))}
        </div>
      </section>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            start({ mode: state.game.mode, players: state.players.map((p) => ({ id: p.id, name: p.name, professionId: p.professionId })) });
          }}
        >
          Rematch, same players
        </button>
        <button type="button" className="btn-primary" onClick={quit}>
          New game
        </button>
      </div>
    </main>
  );
}

function MoneyStory({ state, player, color }: { state: GameState; player: Player; color: string }) {
  // One point per Payday, then the final state, so deals bought after the last Payday still show.
  const points = [
    ...state.game.log
      .flatMap((e) => e.events)
      .flatMap((e) => (e.kind === 'paydaySnapshot' && e.playerId === player.id ? [{ passive: e.passiveIncome, bills: e.totalExpenses }] : [])),
    { passive: passiveIncome(player), bills: totalExpenses(player) },
  ];
  const W = 320;
  const H = 160;
  const pad = 8;
  const max = Math.max(1, ...points.map((p) => Math.max(p.passive, p.bills)));
  const x = (i: number) => pad + (points.length <= 1 ? 0 : (i * (W - 2 * pad)) / (points.length - 1));
  const y = (v: number) => H - pad - (Math.max(0, v) * (H - 2 * pad)) / max;
  const line = (key: 'passive' | 'bills') => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const last = points.at(-1);
  return (
    <figure className="rounded-lg border border-slate-300 p-3">
      <figcaption className="font-bold">{player.name}</figcaption>
      <svg viewBox={`0 0 ${String(W)} ${String(H)}`} className="mt-2 w-full" role="img" aria-label={`${player.name}: ${String(points.length - 1)} paydays. Final passive income ${formatMoney(last?.passive ?? 0)}, final monthly bills ${formatMoney(last?.bills ?? 0)}.`}>
        <rect x={0} y={0} width={W} height={H} fill="#fff" />
        <path d={line('bills')} fill="none" stroke="#1f2328" strokeWidth={2} strokeDasharray="6 4" />
        <path d={line('passive')} fill="none" stroke={color} strokeWidth={3} />
      </svg>
      <p className="mt-1 text-sm">
        Final: passive income {formatMoney(last?.passive ?? 0)}/mo, bills {formatMoney(last?.bills ?? 0)}/mo.
      </p>
    </figure>
  );
}
