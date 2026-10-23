import type { Action, GameState, LogEvent } from '@ff/shared';

import { creditPayday } from '../payday';
import { rejected, type ActionResult } from '../reduce';
import { canEscape, currentPlayer, hasRolledThisTurn, playerById, rankPlayers, roundLimit, roundNumber } from '../selectors';

/**
 * Spec, Core rules, turn step 5: check escape, then the round limit, then
 * advance to the next player who is still in and not sitting out a Setback.
 * Escape ends the game at once (v1). A round completes when every seat still
 * in has taken a turn (a skipped turn counts: decided 2026-10-23, Q3), and
 * the END_TURN that completes the final round ends the game with the winner
 * by freedomPercent, cash, netWorth, then seat (spec v2, Winning). The game
 * also ends when fewer than two players remain (Core rules, Bankruptcy).
 */
export function endTurn(state: GameState, action: Extract<Action, { type: 'END_TURN' }>): ActionResult {
  if (state.pending.kind !== 'none') return rejected('INVALID_FOR_PENDING');
  if (!hasRolledThisTurn(state)) return rejected('MUST_ROLL_FIRST');

  const player = currentPlayer(state);

  if (!player.isOut && canEscape(player)) {
    return {
      ok: true,
      state: finish(
        {
          ...state,
          players: state.players.map((p) => (p.id === action.playerId ? { ...p, hasEscaped: true } : p)),
        },
        action.playerId,
      ),
      events: [{ kind: 'gameEnded', reason: 'escape', winnerId: action.playerId }],
    };
  }

  const remaining = state.players.filter((p) => !p.isOut);
  if (remaining.length < 2) return lastStanding(state, []);

  const advanced = advance(state, action.playerId);
  const events: LogEvent[] = [...advanced.events];

  // A skipped seat's Payday can put that player out and leave one player standing.
  if (advanced.state.players.filter((p) => !p.isOut).length < 2) return lastStanding(advanced.state, events);

  if (advanced.wrapped) {
    const round = roundNumber(advanced.state);
    if (round >= roundLimit(advanced.state)) {
      const winnerId = rankPlayers(advanced.state)[0]?.id ?? advanced.nextId;
      events.push({ kind: 'gameEnded', reason: 'roundLimit', winnerId });
      return { ok: true, state: finish(advanced.state, winnerId), events };
    }
    events.push({ kind: 'roundCompleted', round });
  }

  return {
    ok: true,
    state: {
      ...advanced.state,
      game: { ...advanced.state.game, turnNumber: state.game.turnNumber + 1, currentPlayerId: advanced.nextId },
    },
    events,
  };
}

function finish(state: GameState, winnerId: string): GameState {
  return { ...state, game: { ...state.game, phase: 'finished', currentPlayerId: winnerId } };
}

function lastStanding(state: GameState, events: readonly LogEvent[]): ActionResult {
  const survivor = state.players.find((p) => !p.isOut);
  const winnerId = survivor?.id ?? state.game.currentPlayerId;
  return { ok: true, state: finish(state, winnerId), events: [...events, { kind: 'gameEnded', reason: 'lastStanding', winnerId }] };
}

interface Advanced {
  readonly state: GameState;
  readonly nextId: string;
  /** True when the next seat is at or before the ending seat: every seat still in has now taken its turn this round. */
  readonly wrapped: boolean;
  readonly events: LogEvent[];
}

/**
 * Finds the next seat after `playerId` that is in the game, wrapping around
 * and coming back to `playerId` itself last. A seat that must skip is passed
 * over once and its flag cleared; it still receives its Payday for the month
 * (spec, Core rules, turn step 1), which can put it out. Every seat is tried
 * at most twice.
 */
function advance(state: GameState, playerId: string): Advanced {
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
    return { state: next, nextId: candidate.id, wrapped: index <= start, events };
  }
  const survivor = next.players.find((p) => !p.isOut);
  if (survivor === undefined) throw new Error('no player left in the game');
  return { state: next, nextId: survivor.id, wrapped: true, events };
}
