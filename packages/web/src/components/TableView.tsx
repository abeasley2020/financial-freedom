import { currentPlayer, freedomPercent, optionCost, passiveIncome, totalExpenses } from '@ff/engine';
import { formatMoney, isGrowthAssetType, type GameState, type Player } from '@ff/shared';
import { useEffect, useState } from 'react';

import { card, cardText, celebrationKey, lastRoll, professionName, recentLines, seatColor, seatGlow, tokenLabels } from '../lib/text';
import { useGame } from '../store';
import { Board, Die } from './Board';
import { EndScreen } from './EndScreen';
import { Money } from './Money';
import { BigStat, Confetti, GameCard, PaydayPop, Pawn, TurnSplash, type DeckTone } from './Show';

/**
 * The shared table for the TV: read-only, big, and loud. It renders whatever
 * the controller window saved; it never dispatches. Private details (the
 * balance sheet) stay on the controller; the TV shows the race and the card.
 */
export function TableView() {
  const state = useGame((s) => s.state);
  useFullscreenShortcut();

  if (state === null) return <Waiting />;
  if (state.game.phase === 'finished') return <EndScreen state={state} readOnly />;
  return <Table state={state} />;
}

function Waiting() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <p className="eyebrow !text-[1.4vw] text-gold">Family game night</p>
      <h1 className="font-display text-[8vw] font-extrabold leading-none">
        <span className="shimmer-text">Freedom Loop</span>
      </h1>
      <p className="max-w-4xl text-[2vw] text-white/80">Start the game in the other window. Press F or double-click for full screen.</p>
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
  const labels = tokenLabels(state.players);
  const ranked = [...state.players].sort((a, b) => freedomPercent(b) - freedomPercent(a) || b.cash - a.cash);
  const dieSize = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.1);

  return (
    <main className="grid h-screen w-screen grid-cols-[minmax(0,54fr)_minmax(0,46fr)] gap-[2vw] overflow-hidden p-[2vw]" onDoubleClick={toggleFullscreen}>
      <TurnSplash state={state} label={(s) => labels[s] ?? '?'} />
      <PaydayPop state={state} placement="left-[27vw] top-[70vh]" size="text-[2.4vw]" />
      <Confetti trigger={celebrationKey(state)} pieces={110} />

      <div className="flex min-h-0 items-center justify-center">
        <div className="aspect-square h-full max-h-full max-w-full">
          <Board state={state} tv>
            <div className="flex flex-col items-center gap-[1.2vh]">
              <Pawn seat={seat} label={labels[seat] ?? '?'} size={Math.round(dieSize * 0.8)} active />
              <p className="font-display text-[3vw] font-extrabold leading-none">{player.name}</p>
              <p className="text-[1.3vw] text-white/80">{rolledThisTurn ? 'is deciding' : 'is up next: Payday, then roll'}</p>
              {roll !== null && rolledThisTurn && <Die value={roll.value} rollKey={roll.key} size={dieSize} />}
            </div>
          </Board>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-[1.6vh]">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-[2.4vw] font-extrabold tracking-tight">
            <span className="shimmer-text">Freedom Loop</span>
            {state.game.mode === 'kids' && <span className="ml-[0.6vw] text-[1.2vw] text-white/70">kids</span>}
          </h1>
          <FullscreenButton small />
        </header>

        <Spotlight state={state} player={player} />

        <section aria-labelledby="race-heading" className="glass min-h-0 flex-1 overflow-hidden p-[1.2vw]">
          <h2 id="race-heading" className="eyebrow !text-[1vw] text-white/70">
            Freedom race
          </h2>
          {/* Five or six players: two columns, so the race never runs off the screen. */}
          <ol className={`mt-[0.8vh] grid gap-[0.6vh] ${state.players.length > 4 ? 'grid-cols-2 gap-x-[0.8vw]' : 'grid-cols-1'}`}>
            {ranked.map((p, place) => {
              const i = state.players.findIndex((q) => q.id === p.id);
              const pctFree = freedomPercent(p);
              const isTurn = p.id === player.id;
              return (
                <li key={p.id} className={`flex items-center gap-[0.8vw] rounded-2xl px-[0.8vw] py-[0.5vh] transition ${isTurn ? 'bg-white/10 shadow-glow' : ''} ${p.isOut ? 'opacity-50' : ''}`}>
                  <span className="w-[1.4vw] font-display text-[1.3vw] font-extrabold text-white/60">{place + 1}</span>
                  <Pawn seat={i} label={labels[i] ?? '?'} size={Math.round(window.innerHeight * 0.038)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-[0.6vw]">
                      <p className="truncate font-display text-[1.35vw] font-extrabold leading-tight">{p.name}</p>
                      <span className="shrink-0 font-display text-[1.6vw] font-extrabold tabular-nums">{pctFree}%</span>
                    </div>
                    <div
                      role="meter"
                      aria-label={`${p.name} freedom`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(100, pctFree)}
                      className="mt-[0.3vh] h-[1.2vh] w-full overflow-hidden rounded-full bg-white/10"
                    >
                      <div className="h-full rounded-full transition-[width] duration-1000" style={{ width: `${String(Math.max(2, Math.min(100, pctFree)))}%`, background: `linear-gradient(90deg, ${seatColor(i)}, ${seatGlow(i)})` }} />
                    </div>
                    <p className={`mt-[0.3vh] truncate text-[0.85vw] text-white/75 ${state.players.length > 4 ? 'sr-only' : ''}`}>
                      {p.isOut ? 'out of the game' : p.skipsNextTurn ? 'sits out next turn' : professionName(p.professionId)} · {formatMoney(passiveIncome(p))} of {formatMoney(totalExpenses(p))}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-live="polite" className="glass shrink-0 overflow-hidden px-[1.2vw] py-[1vh]">
          <ul className="space-y-[0.3vh] text-[1.2vw] leading-snug">
            {lines.slice(-3).map((line) => (
              <li key={line.key} className="rise flex items-center gap-[0.6vw] truncate">
                <span aria-hidden="true" className="h-[0.5vw] w-[0.5vw] shrink-0 rounded-full bg-gold" />
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
  if (pending.kind === 'none') return null;
  if (pending.kind === 'chooseDealSize') {
    return <GameCard key="size" tone="deal" kicker="Opportunity" title={`${player.name} picks: small deal or big deal?`} size="tv" />;
  }
  if (pending.kind === 'giveOrSkip') {
    return (
      <GameCard key="give" tone="give" kicker="Giving" title={`${player.name}, give 10%?`} size="tv">
        <p className="text-[1.4vw] text-white/90">Give 10% of cash to help others and earn a Favor token.</p>
      </GameCard>
    );
  }
  const c = card(pending.cardId);
  const tone: DeckTone = c.deck === 'bigDeals' ? 'big' : c.deck === 'smallDeals' ? 'deal' : c.deck === 'market' ? 'market' : 'life';
  const kicker = c.deck === 'bigDeals' ? 'Big deal' : c.deck === 'smallDeals' ? 'Small deal' : c.deck === 'market' ? 'Market news' : 'Life Choices';
  return (
    <GameCard key={c.id} tone={tone} kicker={kicker} title={c.title} size="tv">
      <p className="text-[1.35vw] leading-snug text-white/90">{cardText(c, mode)}</p>
      {(c.deck === 'smallDeals' || c.deck === 'bigDeals') && (
        <dl className="mt-[1.2vh] grid grid-cols-2 gap-[0.8vw]">
          {c.type === 'stock' ? (
            <>
              <BigStat label="Price per share today" tv>
                {formatMoney(pending.kind === 'buyOrPass' ? (pending.sharePrice ?? c.price) : c.price)}
              </BigStat>
              <BigStat label="Dividend per share" tv>
                <Money amount={c.dividendPerShare ?? 0} suffix="/mo" />
              </BigStat>
            </>
          ) : isGrowthAssetType(c.type) ? (
            <>
              <BigStat label="Grows every month" tv>{`${String(c.growthPercent ?? 0)}%`}</BigStat>
              <BigStat label="Pays out every month" tv>{`${String(c.payoutPercent ?? 0)}% of value`}</BigStat>
            </>
          ) : (
            <>
              <BigStat label="Cost today" tv>
                {formatMoney(c.downPayment)}
              </BigStat>
              <BigStat label="Change per month" tv>
                <Money amount={c.monthlyCashFlow} suffix="/mo" />
              </BigStat>
            </>
          )}
        </dl>
      )}
      {c.deck === 'lifeChoices' && (
        <ul className="mt-[1.2vh] grid grid-cols-3 gap-[0.8vw]">
          {c.options
            .filter((o) => !kids || o.kidsOk)
            .map((o) => {
              const { costToday, monthlyChange } = optionCost(o, player);
              return (
                <li key={o.id} className="rounded-2xl bg-white/[0.08] p-[0.8vw]">
                  <p className="font-display text-[1.35vw] font-extrabold leading-tight">{o.label}</p>
                  <p className="mt-[0.5vh] text-[1.05vw]">
                    Today <Money amount={-costToday} />
                  </p>
                  <p className="text-[1.05vw]">
                    Monthly <Money amount={-monthlyChange} suffix="/mo" />
                  </p>
                </li>
              );
            })}
        </ul>
      )}
    </GameCard>
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
    <button type="button" onClick={toggleFullscreen} className={`btn-ghost ${small ? '!min-h-0 px-3 py-1 text-[0.9vw]' : 'px-8 text-xl'}`}>
      {full ? 'Exit full screen' : 'Full screen (F)'}
    </button>
  );
}
