import type { Action, GameState, LogEntry, LogEvent } from '@ff/shared';

import { acceptMarket } from './actions/acceptMarket';
import { borrow } from './actions/borrow';
import { buy } from './actions/buy';
import { chooseDealSize } from './actions/chooseDealSize';
import { declineMarket } from './actions/declineMarket';
import { endTurn } from './actions/endTurn';
import { pass } from './actions/pass';
import { payLifestyle } from './actions/payLifestyle';
import { repay } from './actions/repay';
import { roll } from './actions/roll';
import { sellAsset } from './actions/sellAsset';
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
    case 'CHOOSE_DEAL_SIZE':
      return chooseDealSize(state, action);
    case 'BUY':
      return buy(state, action);
    case 'PASS':
      return pass(state);
    case 'BORROW':
      return borrow(state, action);
    case 'REPAY':
      return repay(state, action);
    case 'PAY_LIFESTYLE':
      return payLifestyle(state, action);
    case 'SELL_ASSET':
      return sellAsset(state, action);
    case 'ACCEPT_MARKET':
      return acceptMarket(state, action);
    case 'DECLINE_MARKET':
      return declineMarket(state);
    default:
      return rejected('NOT_IMPLEMENTED');
  }
}
