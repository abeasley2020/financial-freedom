import type { Action, GameState, LogEntry, Player } from '@ff/shared';

import { describeEvent, seatColor } from '../lib/text';
import { useGame } from '../store';

/** Whose turn it is, the roll and end-turn buttons, undo, and what happened this turn. Sits in the middle of the board. */
export function Turn({ state, player, legal }: { state: GameState; player: Player; legal: readonly Action[] }) {
  const dispatch = useGame((s) => s.dispatch);
  const undo = useGame((s) => s.undo);
  const canUndo = useGame((s) => s.undoStack.length > 0);
  const roll = legal.find((a) => a.type === 'ROLL');
  const endTurn = legal.find((a) => a.type === 'END_TURN');
  const seat = state.players.findIndex((p) => p.id === player.id);

  const thisTurn = state.game.log.filter((e) => e.turnNumber === state.game.turnNumber);
  const lastTurn = thisTurn.length === 0 ? state.game.log.filter((e) => e.turnNumber === state.game.turnNumber - 1) : [];
  const shown = thisTurn.length > 0 ? thisTurn : lastTurn;
  const lastActor = lastTurn[0]?.action.playerId;
  const lastActorName = state.players.find((p) => p.id === lastActor)?.name;

  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
        <span aria-hidden="true" className="inline-block h-5 w-5 rounded-full" style={{ backgroundColor: seatColor(seat) }} />
        {player.name}&rsquo;s turn
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {roll !== undefined && (
          <button type="button" className="btn-primary px-8 text-lg" onClick={() => dispatch(roll)}>
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
      <TurnEvents state={state} entries={shown} heading={thisTurn.length > 0 ? 'This turn' : lastActorName === undefined ? null : `Last turn (${lastActorName})`} />
    </div>
  );
}

function TurnEvents({ state, entries, heading }: { state: GameState; entries: readonly LogEntry[]; heading: string | null }) {
  const lines = entries.flatMap((entry, i) =>
    entry.events
      .map((event, j) => ({ key: `${String(i)}-${String(j)}`, text: describeEvent(state, entry.action.playerId, event) }))
      .filter((line): line is { key: string; text: string } => line.text !== null),
  );
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
