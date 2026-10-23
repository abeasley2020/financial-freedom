import type { Action, GameState } from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';
import { canEscape, currentPlayer, hasRolledThisTurn } from '../selectors';

/**
 * Spec, Core rules, turn step 5: check the win condition, then advance to the
 * next player who is still in. Phase 1 ends the game at the first escape.
 */
export function endTurn(state: GameState, action: Extract<Action, { type: 'END_TURN' }>): ActionResult {
  if (state.pending.kind !== 'none') return rejected('INVALID_FOR_PENDING');
  if (!hasRolledThisTurn(state)) return rejected('MUST_ROLL_FIRST');

  const player = currentPlayer(state);

  if (canEscape(player)) {
    return {
      ok: true,
      state: {
        ...state,
        game: { ...state.game, phase: 'finished' },
        players: state.players.map((p) => (p.id === action.playerId ? { ...p, hasEscaped: true } : p)),
      },
      events: [],
    };
  }

  return {
    ok: true,
    state: {
      ...state,
      game: {
        ...state.game,
        turnNumber: state.game.turnNumber + 1,
        currentPlayerId: nextPlayerId(state, action.playerId),
      },
    },
    events: [],
  };
}

/** The next seat after `playerId` that is still in the game, wrapping around. */
function nextPlayerId(state: GameState, playerId: string): string {
  const seats = state.players;
  const start = seats.findIndex((p) => p.id === playerId);
  for (let offset = 1; offset <= seats.length; offset++) {
    const candidate = seats[(start + offset) % seats.length];
    if (candidate !== undefined && !candidate.isOut) return candidate.id;
  }
  throw new Error('no player left in the game');
}
