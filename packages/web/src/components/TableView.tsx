import { currentPlayer, freedomPercent, optionCost, passiveIncome, totalExpenses } from '@ff/engine';
import { formatMoney, isGrowthAssetType, type GameState, type Player } from '@ff/shared';
import { useEffect, useState } from 'react';

import { card, cardText, lastRoll, professionName, recentLines, seatColor, tokenLabels } from '../lib/text';
import { useGame } from '../store';
import { Board, Die } from './Board';
import { EndScreen } from './EndScreen';
import { Money } from './Money';

/**
 * The shared table for the TV: read-only, big, dark. It renders whatever the
 * controller window saved; it never dispatches. Private numbers (cash,
 * balance sheet) stay on the controller; the TV shows the race and the card.
 */
export function TableView() {
  const state = useGame((s) => s.state);
  useFullscreenShortcut();

  if (state === null) return <Waiting />;
  if (state.game.phase === 'finished') {
    return (
      <div className="tv min-h-screen">
        <EndScreen state={state} readOnly />
      </div>
    );
  }
  return <Table state={state} />;
}

function Waiting() {
  return (
    <main className="tv flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-[6vw] font-black leading-none">Freedom Loop</h1>
      <p className="max-w-3xl text-[2vw] opacity-80">Waiting for the game to start. Start it in the other window, then press F or double-click here for full screen.</p>
      <FullscreenButton />
    </main>
  );
}

function Table({ state }: { state: GameState }) {
  const player = currentPlayer(state);
  const seat = state.players.findIndex((p) => p.id === player.id);
  const roll = lastRoll(state);
  const rolledThisTurn = state.game.log.some((e) => e.turnNumber === state.game.turnNumber && e.action.type === 'ROLL');
  const { lines } = recentLines(state);
  const ranked = [...state.players].sort((a, b) => freedomPercent(b) - freedomPercent(a) || b.cash - a.cash);
  const labels = tokenLabels(state.players);

  return (
    <main className="tv grid h-screen w-screen grid-cols-[minmax(0,54fr)_minmax(0,46fr)] gap-[2vw] overflow-hidden p-[2vw]" onDoubleClick={toggleFullscreen}>
      <div className="flex min-h-0 items-center justify-center">
        <div className="aspect-square h-full max-h-full max-w-full">
          <Board state={state} tv>
            <div className="flex flex-col items-center gap-[1vh]">
              <p className="flex items-center gap-[0.8vw] text-[2.6vw] font-black leading-none">
                <span aria-hidden="true" className="inline-block h-[2.2vw] w-[2.2vw] rounded-full border-4 border-white" style={{ backgroundColor: seatColor(seat) }} />
                {player.name}
              </p>
              <p className="text-[1.3vw] opacity-80">{rolledThisTurn ? 'is deciding' : 'is up: Payday, then roll'}</p>
              {roll !== null && rolledThisTurn && <Die value={roll.value} rollKey={roll.key} size={Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.09)} />}
            </div>
          </Board>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-[1.5vh]">
        <header className="flex items-baseline justify-between">
          <h1 className="text-[2.2vw] font-black tracking-tight">Freedom Loop{state.game.mode === 'kids' ? ' · kids' : ''}</h1>
          <FullscreenButton small />
        </header>

        <Spotlight state={state} player={player} />

        <section aria-labelledby="race-heading" className="tv-panel min-h-0 flex-1 overflow-hidden">
          <h2 id="race-heading" className="text-[1.4vw] font-bold uppercase tracking-widest opacity-80">
            Freedom race
          </h2>
          <ol className="mt-[0.8vh] space-y-[0.7vh]">
            {ranked.map((p) => {
              const i = state.players.findIndex((q) => q.id === p.id);
              const pctFree = freedomPercent(p);
              const isTurn = p.id === player.id;
              return (
                <li key={p.id} className={`rounded-xl px-[0.6vw] py-[0.4vh] ${isTurn ? 'bg-white/10 ring-2 ring-yellow-400' : ''}`}>
                  <div className="flex items-center justify-between gap-[1vw] text-[1.35vw] leading-tight">
                    <span className="flex min-w-0 items-center gap-[0.6vw] font-bold">
                      <span aria-hidden="true" className="inline-flex h-[1.7vw] w-[1.7vw] shrink-0 items-center justify-center rounded-full border-2 border-white text-[0.95vw] font-black" style={{ backgroundColor: seatColor(i) }}>
                        {labels[i]}
                      </span>
                      <span className="truncate">{p.name}</span>
                      <span className="truncate text-[0.95vw] font-normal opacity-70">
                        {professionName(p.professionId)}
                        {p.isOut ? ' · out' : p.skipsNextTurn ? ' · sits out next turn' : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-[0.95vw] opacity-80">
                      {formatMoney(passiveIncome(p))} of {formatMoney(totalExpenses(p))}/mo
                    </span>
                    <span className="w-[3.2vw] shrink-0 text-right font-black tabular-nums">{pctFree}%</span>
                  </div>
                  <div
                    role="meter"
                    aria-label={`${p.name} freedom`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, pctFree)}
                    className="mt-[0.4vh] h-[1.3vh] w-full overflow-hidden rounded-full bg-white/15"
                  >
                    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${String(Math.min(100, pctFree))}%`, backgroundColor: seatColor(i) }} />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-live="polite" className="tv-panel shrink-0 overflow-hidden">
          <ul className="space-y-[0.3vh] text-[1.25vw] leading-snug">
            {lines.slice(-3).map((line) => (
              <li key={line.key} className="rise truncate">
                {line.text}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

/** The card on the table right now, large, so the whole family sees the choice. */
function Spotlight({ state, player }: { state: GameState; player: Player }) {
  const pending = state.pending;
  const mode = state.game.mode;
  const kids = mode === 'kids';
  if (pending.kind === 'none' || pending.kind === 'chooseDealSize' || pending.kind === 'giveOrSkip') {
    const text =
      pending.kind === 'chooseDealSize'
        ? `${player.name} is choosing: small deal or big deal?`
        : pending.kind === 'giveOrSkip'
          ? `${player.name} landed on Giving. Give 10% of cash and earn a Favor token?`
          : null;
    return text === null ? null : (
      <section className="tv-panel rise">
        <p className="text-[1.8vw] font-bold leading-tight">{text}</p>
      </section>
    );
  }
  const c = card(pending.cardId);
  const kicker = c.deck === 'bigDeals' ? 'Big deal' : c.deck === 'smallDeals' ? 'Small deal' : c.deck === 'market' ? 'Market' : 'Life Choices';
  return (
    <section key={c.id} className="tv-panel rise border-2 border-yellow-400/70">
      <p className="text-[1.1vw] font-bold uppercase tracking-widest text-yellow-300">{kicker}</p>
      <h2 className="text-[2.4vw] font-black leading-tight">{c.title}</h2>
      <p className="mt-[0.5vh] text-[1.35vw] leading-snug opacity-90">{cardText(c, mode)}</p>
      {(c.deck === 'smallDeals' || c.deck === 'bigDeals') && (
        <dl className="mt-[1vh] grid grid-cols-2 gap-[1vw] text-[1.2vw]">
          {c.type === 'stock' ? (
            <>
              <Fact label="Price per share today" value={formatMoney(pending.kind === 'buyOrPass' ? (pending.sharePrice ?? c.price) : c.price)} />
              <Fact label="Dividend per share" value={`${formatMoney(c.dividendPerShare ?? 0)}/mo`} />
            </>
          ) : isGrowthAssetType(c.type) ? (
            <>
              <Fact label="Grows every month" value={`${String(c.growthPercent ?? 0)}%`} />
              <Fact label="Pays out every month" value={`${String(c.payoutPercent ?? 0)}% of value`} />
            </>
          ) : (
            <>
              <Fact label="Cost today" value={formatMoney(c.downPayment)} />
              <Fact label="Change per month" value={<Money amount={c.monthlyCashFlow} suffix="/mo" />} />
            </>
          )}
        </dl>
      )}
      {c.deck === 'lifeChoices' && (
        <ul className="mt-[1vh] grid grid-cols-3 gap-[0.8vw]">
          {c.options
            .filter((o) => !kids || o.kidsOk)
            .map((o) => {
              const { costToday, monthlyChange } = optionCost(o, player);
              return (
                <li key={o.id} className="rounded-xl bg-white/10 p-[0.7vw]">
                  <p className="text-[1.3vw] font-bold leading-tight">{o.label}</p>
                  <p className="mt-[0.4vh] text-[1.05vw] leading-tight">
                    Today: <Money amount={-costToday} />
                  </p>
                  <p className="text-[1.05vw] leading-tight">
                    Monthly: <Money amount={-monthlyChange} suffix="/mo" />
                  </p>
                </li>
              );
            })}
        </ul>
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="opacity-70">{label}</dt>
      <dd className="text-[1.6vw] font-black">{value}</dd>
    </div>
  );
}

function toggleFullscreen(): void {
  if (document.fullscreenElement !== null) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}

function useFullscreenShortcut(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}

function FullscreenButton({ small = false }: { small?: boolean }) {
  const [full, setFull] = useState(false);
  useEffect(() => {
    const onChange = () => {
      setFull(document.fullscreenElement !== null);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
    };
  }, []);
  return (
    <button type="button" onClick={toggleFullscreen} className={`btn rounded-full border border-white/40 bg-white/10 text-white hover:bg-white/20 ${small ? 'px-3 text-[1vw]' : 'px-6 text-xl'}`}>
      {full ? 'Exit full screen' : 'Full screen (F)'}
    </button>
  );
}
