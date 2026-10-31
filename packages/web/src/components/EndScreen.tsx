import { freedomPercent, netWorth, passiveIncome, rankPlayers, totalExpenses, winner } from '@ff/engine';
import { formatMoney, type GameState, type Player } from '@ff/shared';

import { professionName, seatGlow, tokenLabels } from '../lib/text';
import { useGame } from '../store';
import { Confetti, FreedomRing, Pawn } from './Show';

/** End of game: the champion, a podium, and each player's money story. */
export function EndScreen({ state, readOnly = false }: { state: GameState; readOnly?: boolean }) {
  const quit = useGame((s) => s.quit);
  const start = useGame((s) => s.start);
  const champ = winner(state);
  const ended = state.game.log.flatMap((e) => e.events).find((e) => e.kind === 'gameEnded');
  const ranked = [...rankPlayers(state), ...state.players.filter((p) => p.isOut)];
  const labels = tokenLabels(state.players);
  const seatOf = (p: Player) => state.players.findIndex((q) => q.id === p.id);
  const reason =
    ended?.kind !== 'gameEnded'
      ? ''
      : ended.reason === 'escape'
        ? 'escaped the rat race: their assets now pay every monthly bill.'
        : ended.reason === 'roundLimit'
          ? 'reached the highest Freedom when time ran out.'
          : 'is the last player standing.';
  const podium = ranked.slice(0, 3);
  // Classic podium order: second, first, third.
  const order = [podium[1], podium[0], podium[2]].filter((p): p is Player => p !== undefined);
  const heights = new Map([
    [podium[0]?.id, 'h-44'],
    [podium[1]?.id, 'h-32'],
    [podium[2]?.id, 'h-24'],
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Confetti trigger={state.game.id} pieces={110} />
      <header className="text-center">
        <p className="eyebrow text-gold">Game over</p>
        {champ !== undefined && (
          <>
            <h1 className="mt-2 font-display text-6xl font-extrabold sm:text-7xl">
              <span className="shimmer-text">{champ.name} wins!</span>
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-xl text-white/85">
              {champ.name} {reason}
            </p>
          </>
        )}
      </header>

      <section aria-labelledby="ranking-heading" className="mt-10">
        <h2 id="ranking-heading" className="sr-only">
          Family ranking
        </h2>
        <ol aria-hidden="true" className="flex items-end justify-center gap-4">
          {order.map((p) => {
            const seat = seatOf(p);
            const place = podium.findIndex((q) => q.id === p.id) + 1;
            return (
              <li key={p.id} className="flex w-40 flex-col items-center gap-3">
                <Pawn seat={seat} label={labels[seat] ?? '?'} size={place === 1 ? 84 : 64} active={place === 1} />
                <p className="font-display text-xl font-extrabold">{p.name}</p>
                <div className={`flex w-full flex-col items-center justify-start rounded-t-3xl pt-4 ${heights.get(p.id) ?? 'h-20'}`} style={{ background: `linear-gradient(180deg, ${seatGlow(seat)}, rgba(255,255,255,0.05))` }}>
                  <span className="font-display text-5xl font-extrabold text-ink">{place}</span>
                  <span className="font-display text-lg font-extrabold text-ink">{freedomPercent(p)}%</span>
                </div>
              </li>
            );
          })}
        </ol>
        <ol className="glass mt-6 divide-y divide-white/10">
          {ranked.map((p, i) => {
            const seat = seatOf(p);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
                <span className="w-8 font-display text-2xl font-extrabold text-white/70">{i + 1}</span>
                <Pawn seat={seat} label={labels[seat] ?? '?'} size={40} />
                <span className="min-w-[10rem] flex-1">
                  <span className="block font-display text-xl font-extrabold">{p.name}</span>
                  <span className="block text-sm text-white/70">
                    {professionName(p.professionId)}
                    {p.isOut ? ', ran out of money' : ''}
                  </span>
                </span>
                <span className="text-white/85">
                  Assets paid {formatMoney(passiveIncome(p))} of {formatMoney(totalExpenses(p))} in bills · net worth {formatMoney(netWorth(p))}
                </span>
                <FreedomRing percent={freedomPercent(p)} seat={seat} size={60} label={`${p.name} final freedom`} />
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="story-heading" className="mt-10">
        <h2 id="story-heading" className="font-display text-3xl font-extrabold">
          Money stories
        </h2>
        <p className="mt-1 text-white/80">Each month: passive income (solid) against monthly bills (dashed). When solid climbs above dashed, that player is free.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.players.map((p) => (
            <MoneyStory key={p.id} state={state} player={p} color={seatGlow(seatOf(p))} />
          ))}
        </div>
      </section>

      {!readOnly && (
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            className="btn-go px-10 py-5 text-2xl"
            onClick={() => {
              start({ mode: state.game.mode, players: state.players.map((p) => ({ id: p.id, name: p.name, professionId: p.professionId })) });
            }}
          >
            Rematch
          </button>
          <button type="button" className="btn-ghost px-10 py-5 text-2xl" onClick={quit}>
            New game
          </button>
        </div>
      )}
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
  const pad = 10;
  const max = Math.max(1, ...points.map((p) => Math.max(p.passive, p.bills)));
  const x = (i: number) => pad + (points.length <= 1 ? 0 : (i * (W - 2 * pad)) / (points.length - 1));
  const y = (v: number) => H - pad - (Math.max(0, v) * (H - 2 * pad)) / max;
  const line = (key: 'passive' | 'bills') => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  const area = `${line('passive')} L${x(points.length - 1).toFixed(1)},${String(H - pad)} L${String(pad)},${String(H - pad)} Z`;
  const last = points.at(-1);
  const gradientId = `story-${player.id}`;
  return (
    <figure className="glass p-4">
      <figcaption className="font-display text-lg font-extrabold">{player.name}</figcaption>
      <svg viewBox={`0 0 ${String(W)} ${String(H)}`} className="mt-2 w-full" role="img" aria-label={`${player.name}: ${String(points.length - 1)} paydays. Final passive income ${formatMoney(last?.passive ?? 0)}, final monthly bills ${formatMoney(last?.bills ?? 0)}.`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.5" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line('bills')} fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth={2} strokeDasharray="6 5" />
        <path d={line('passive')} fill="none" stroke={color} strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
      <p className="mt-1 text-sm text-white/80">
        Final: assets pay {formatMoney(last?.passive ?? 0)}/mo, bills {formatMoney(last?.bills ?? 0)}/mo.
      </p>
    </figure>
  );
}
