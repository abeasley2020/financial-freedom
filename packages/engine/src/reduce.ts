import type { Action, GameState, LogEntry, LogEvent } from '@ff/shared';

import { endTurn } from './actions/endTurn';
import { roll } from './actions/roll';
import type { EngineError } from './errors';

export type ReduceResult = { readonly ok: true; readonly state: GameState } | { readonly ok: false; readonly error: EngineError };

/** What one action handler returns. `reduce` appends the log entry. */
export type ActionResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly LogEvent[] }
  | { readonly ok: false; readonly error: EngineError };

export function rejected(error: EngineError): ActionResult {
  return { ok: false, error };
}

/**
 * The engine's one entry point (CLAUDE.md, Rule 1.5). A rejected action does
 * not throw, does not change state, and is not logged.
 */
export function reduce(state: GameState, action: Action): ReduceResult {
  if (state.game.phase !== 'playing') return { ok: false, error: 'GAME_NOT_PLAYING' };
  if (action.playerId !== state.game.currentPlayerId) return { ok: false, error: 'NOT_YOUR_TURN' };

  const result = dispatch(state, action);
  if (!result.ok) return result;

  const entry: LogEntry = { turnNumber: state.game.turnNumber, action, events: result.events };
  const next = result.state;
  return {
    ok: true,
    state: { ...next, game: { ...next.game, log: [...next.game.log, entry] } },
  };
}

function dispatch(state: GameState, action: Action): ActionResult {
  switch (action.type) {
    case 'ROLL':
      return roll(state, action);
    case 'END_TURN':
      return endTurn(state, action);
    default:
      return rejected('NOT_IMPLEMENTED');
  }
}
