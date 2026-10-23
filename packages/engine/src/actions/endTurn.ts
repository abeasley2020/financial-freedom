import type { Action, GameState, LogEvent } from '@ff/shared';

import { creditPayday } from '../payday';
import { rejected, type ActionResult } from '../reduce';
import { canEscape, currentPlayer, hasRolledThisTurn, playerById } from '../selectors';

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

  // A skipped seat's Payday can put that player out and leave one player standing.
  const stillIn = advanced.state.players.filter((p) => !p.isOut);
  if (stillIn.length < 2) {
    return {
      ok: true,
      state: {
        ...advanced.state,
        game: { ...advanced.state.game, phase: 'finished', currentPlayerId: stillIn[0]?.id ?? state.game.currentPlayerId },
      },
      events: advanced.events,
    };
  }

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
 * over once and its flag cleared; it still receives its Payday for the month
 * (spec, Core rules, turn step 1), which can put it out. Every seat is tried
 * at most twice.
 */
function advance(state: GameState, playerId: string): { state: GameState; nextId: string; events: LogEvent[] } {
  const seats = state.players;
  const start = seats.findIndex((p) => p.id === playerId);
  let next = state;
  const events: LogEvent[] = [];
  for (let offset = 1; offset <= seats.length * 2; offset++) {
    const index = (start + offset) % seats.length;
    const candidate = next.players[index];
    if (candidate === undefined || candidate.isOut) continue;
    if (candidate.skipsNextTurn) {
      next = { ...next, players: next.players.map((p) => (p.id === candidate.id ? { ...p, skipsNextTurn: false } : p)) };
      events.push({ kind: 'turnSkipped', playerId: candidate.id });
      const paid = creditPayday(next, candidate.id);
      next = paid.state;
      events.push(...paid.events);
      if (playerById(next, candidate.id).isOut && next.players.filter((p) => !p.isOut).length < 2) break;
      continue;
    }
    return { state: next, nextId: candidate.id, events };
  }
  const survivor = next.players.find((p) => !p.isOut);
  if (survivor === undefined) throw new Error('no player left in the game');
  return { state: next, nextId: survivor.id, events };
}
