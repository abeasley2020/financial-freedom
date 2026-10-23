import type { Action, GameState, LogEvent } from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';
import { canEscape, currentPlayer, hasRolledThisTurn } from '../selectors';

/**
 * Spec, Core rules, turn step 5: check the win condition, then advance to the
 * next player who is still in and not sitting out a Setback. Phase 1 ends the
 * game at the first escape, and also when fewer than two players remain
 * (Core rules, Bankruptcy).
 */
export function endTurn(state: GameState, action: Extract<Action, { type: 'END_TURN' }>): ActionResult {
  if (state.pending.kind !== 'none') return rejected('INVALID_FOR_PENDING');
  if (!hasRolledThisTurn(state)) return rejected('MUST_ROLL_FIRST');

  const player = currentPlayer(state);

  if (!player.isOut && canEscape(player)) {
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

  const remaining = state.players.filter((p) => !p.isOut);
  if (remaining.length < 2) {
    const last = remaining[0];
    return {
      ok: true,
      state: {
        ...state,
        game: { ...state.game, phase: 'finished', currentPlayerId: last?.id ?? state.game.currentPlayerId },
      },
      events: [],
    };
  }

  const advanced = advance(state, action.playerId);
  return {
    ok: true,
    state: {
      ...advanced.state,
      game: { ...advanced.state.game, turnNumber: state.game.turnNumber + 1, currentPlayerId: advanced.nextId },
    },
    events: advanced.events,
  };
}

/**
 * Finds the next seat after `playerId` that is in the game, wrapping around
 * and coming back to `playerId` itself last. A seat that must skip is passed
 * over once and its flag cleared, so every seat is tried at most twice.
 */
function advance(state: GameState, playerId: string): { state: GameState; nextId: string; events: LogEvent[] } {
  const seats = state.players;
  const start = seats.findIndex((p) => p.id === playerId);
  let players = seats;
  const events: LogEvent[] = [];
  for (let offset = 1; offset <= seats.length * 2; offset++) {
    const candidate = players[(start + offset) % seats.length];
    if (candidate === undefined || candidate.isOut) continue;
    if (candidate.skipsNextTurn) {
      players = players.map((p) => (p.id === candidate.id ? { ...p, skipsNextTurn: false } : p));
      events.push({ kind: 'turnSkipped', playerId: candidate.id });
      continue;
    }
    return { state: { ...state, players }, nextId: candidate.id, events };
  }
  throw new Error('no player left in the game');
}
