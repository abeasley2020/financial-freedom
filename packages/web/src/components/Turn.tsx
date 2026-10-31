import type { Action, GameState, Player } from '@ff/shared';

import { lastRoll, recentLines, seatColor, tokenLabels } from '../lib/text';
import { useGame } from '../store';
import { Die } from './Board';
import { Decision } from './Decision';
import { Pawn } from './Show';

/**
 * The host console: exactly one next step at a time. Before the roll it is a
 * giant Roll button; with a decision open it is the card; afterwards it is
 * what happened and a giant End turn.
 */
export function Stage({ state, player, legal }: { state: GameState; player: Player; legal: readonly Action[] }) {
  const dispatch = useGame((s) => s.dispatch);
  const rollAction = legal.find((a) => a.type === 'ROLL');
  const endTurn = legal.find((a) => a.type === 'END_TURN');
  const seat = state.players.findIndex((p) => p.id === player.id);
  const { heading, lines } = recentLines(state);

  if (state.pending.kind !== 'none') return <Decision state={state} player={player} legal={legal} />;

  if (rollAction !== undefined) {
    return (
      <section aria-labelledby="stage-heading" className="glass rise flex flex-col items-center gap-6 px-6 py-10 text-center" style={{ boxShadow: `0 30px 80px -30px ${seatColor(seat)}` }}>
        <Pawn seat={seat} label={tokenLabels(state.players)[seat] ?? '?'} size={88} active />
        <div>
          <p className="eyebrow text-gold">You&rsquo;re up</p>
          <h2 id="stage-heading" className="font-display text-5xl font-extrabold leading-tight">
            {player.name}
          </h2>
          <p className="mt-2 text-white/80">Collect your Payday, then roll and see where you land.</p>
        </div>
        <button type="button" className="btn-go px-14 py-6 text-3xl" onClick={() => dispatch(rollAction)}>
          Payday &amp; roll
        </button>
        {heading !== null && lines.length > 0 && <Recap heading={heading} lines={lines} />}
      </section>
    );
  }

  return (
    <section aria-labelledby="stage-heading" className="glass rise flex flex-col items-center gap-6 px-6 py-10 text-center">
      <h2 id="stage-heading" className="font-display text-4xl font-extrabold">
        {player.isOut ? `${player.name} is out of the game` : 'Nice move.'}
      </h2>
      <Recap heading={heading ?? 'This turn'} lines={lines} />
      <p className="text-white/80">Pay off a loan or sell savings in My money, or hand it to the next player.</p>
      {endTurn !== undefined && (
        <button type="button" className="btn-go px-14 py-6 text-3xl" onClick={() => dispatch(endTurn)}>
          End turn
        </button>
      )}
    </section>
  );
}

function Recap({ heading, lines }: { heading: string; lines: readonly { key: string; text: string }[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="w-full max-w-lg rounded-2xl bg-black/25 p-4 text-left">
      <p className="eyebrow text-white/70">{heading}</p>
      <ul aria-live="polite" className="mt-2 space-y-1">
        {lines.map((line) => (
          <li key={line.key} className="rise flex gap-2">
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            {line.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What sits in the middle of the board on the controller: whose turn and the die. */
export function BoardCenter({ state, player }: { state: GameState; player: Player }) {
  const seat = state.players.findIndex((p) => p.id === player.id);
  const roll = lastRoll(state);
  const rolledThisTurn = state.game.log.some((e) => e.turnNumber === state.game.turnNumber && e.action.type === 'ROLL');
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="flex items-center gap-2 font-display text-2xl font-extrabold">
        <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: seatColor(seat) }} />
        {player.name}
      </p>
      {roll !== null && rolledThisTurn && <Die value={roll.value} rollKey={roll.key} size={64} />}
    </div>
  );
}
