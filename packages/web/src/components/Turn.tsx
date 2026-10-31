import type { Action, GameState, Player } from '@ff/shared';

import { lastRoll, recentLines, seatColor } from '../lib/text';
import { useGame } from '../store';
import { Die } from './Board';

/** Whose turn it is, the roll and end-turn buttons, undo, and what happened this turn. Sits in the middle of the board. */
export function Turn({ state, player, legal }: { state: GameState; player: Player; legal: readonly Action[] }) {
  const dispatch = useGame((s) => s.dispatch);
  const undo = useGame((s) => s.undo);
  const canUndo = useGame((s) => s.undoStack.length > 0);
  const rollAction = legal.find((a) => a.type === 'ROLL');
  const endTurn = legal.find((a) => a.type === 'END_TURN');
  const seat = state.players.findIndex((p) => p.id === player.id);

  const { heading, lines } = recentLines(state);
  const roll = lastRoll(state);
  const rolledThisTurn = state.game.log.some((e) => e.turnNumber === state.game.turnNumber && e.action.type === 'ROLL');

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
        <span aria-hidden="true" className="inline-block h-5 w-5 rounded-full" style={{ backgroundColor: seatColor(seat) }} />
        {player.name}&rsquo;s turn
      </p>
      {roll !== null && rolledThisTurn && <Die value={roll.value} rollKey={roll.key} size={56} />}
      <div className="flex flex-wrap justify-center gap-2">
        {rollAction !== undefined && (
          <button type="button" className="btn-primary px-8 text-lg" onClick={() => dispatch(rollAction)}>
            Payday and roll
          </button>
        )}
        {endTurn !== undefined && (
          <button type="button" className="btn-primary px-8 text-lg" onClick={() => dispatch(endTurn)}>
            End turn
          </button>
        )}
        {canUndo && (
          <button type="button" className="btn-secondary" onClick={undo}>
            Undo
          </button>
        )}
      </div>
      <TurnEvents lines={lines} heading={heading} />
    </div>
  );
}

function TurnEvents({ lines, heading }: { lines: readonly { key: string; text: string }[]; heading: string | null }) {
  if (heading === null || lines.length === 0) return <div aria-live="polite" className="sr-only" />;
  return (
    <div className="w-full max-w-md rounded-lg bg-white/80 p-2 text-left text-sm">
      <p className="font-semibold text-slate-700">{heading}</p>
      <ul aria-live="polite" className="mt-1 list-disc space-y-0.5 pl-5">
        {lines.map((line) => (
          <li key={line.key}>{line.text}</li>
        ))}
      </ul>
    </div>
  );
}
