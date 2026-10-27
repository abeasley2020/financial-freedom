import type { Action, GameState, LogEvent } from '@ff/shared';

import { creditPayday } from '../payday';
import { rejected, type ActionResult } from '../reduce';
import { canEscape, currentPlayer, hasRolledThisTurn, rankPlayers, roundLimit, roundNumber } from '../selectors';

/**
 * Spec, Core rules, turn step 5: check escape, then advance to the next
 * player who is still in and not sitting out a Setback. Escape ends the game
 * at once (v1). The game also ends when fewer than two players remain (Core
 * rules, Bankruptcy). Rounds and the round limit are kept by `advance`.
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

  return advance(state, action.playerId);
}

function finish(state: GameState, winnerId: string): GameState {
  return { ...state, game: { ...state.game, phase: 'finished', currentPlayerId: winnerId } };
}

function lastStanding(state: GameState, events: readonly LogEvent[]): ActionResult {
  const survivor = state.players.find((p) => !p.isOut);
  const winnerId = survivor?.id ?? state.game.currentPlayerId;
  return { ok: true, state: finish(state, winnerId), events: [...events, { kind: 'gameEnded', reason: 'lastStanding', winnerId }] };
}

/**
 * Walks the seats after `playerId` in order, wrapping around, until it finds
 * one that is in and not sitting out a Setback, and gives that seat the turn.
 *
 * Spec v2, Winning and game length: a round is complete when every seat
 * still in has taken a turn since it began, and a skipped turn counts
 * (decided 2026-10-23, Q3). Seat order starts each round, so a round
 * completes each time the walk passes from the last seat to the first,
 * whoever takes or skips the turns on either side. roundCompleted is logged
 * right there, before any skipped seat in the new round is paid, so that
 * seat's paydaySnapshot carries the new round. One END_TURN can complete two
 * rounds when every seat is skipping. When the walk completes the final
 * round the game ends at once with the winner by freedomPercent, cash,
 * netWorth, then seat; no seat is paid for a round past the limit.
 *
 * A seat that must skip is passed over once and its flag cleared; it still
 * receives its Payday for the month (spec, Core rules, turn step 1), which
 * can put it out and leave one player standing.
 */
function advance(state: GameState, playerId: string): ActionResult {
  const seats = state.players.length;
  const start = state.players.findIndex((p) => p.id === playerId);
  let next = state;
  let round = roundNumber(state);
  const events: LogEvent[] = [];

  // Each seat skips at most once, so with two players in, a seat to play turns up within two laps.
  for (let offset = 1; offset <= seats * 2; offset++) {
    const index = (start + offset) % seats;

    if (index === 0) {
      // The walk passes from the last seat to the first: the round is complete.
      if (round >= roundLimit(next)) {
        const winnerId = rankPlayers(next)[0]?.id ?? playerId;
        events.push({ kind: 'gameEnded', reason: 'roundLimit', winnerId });
        return { ok: true, state: finish(next, winnerId), events };
      }
      events.push({ kind: 'roundCompleted', round });
      round++;
    }

    const candidate = next.players[index];
    if (candidate === undefined || candidate.isOut) continue;

    if (candidate.skipsNextTurn) {
      next = { ...next, players: next.players.map((p) => (p.id === candidate.id ? { ...p, skipsNextTurn: false } : p)) };
      events.push({ kind: 'turnSkipped', playerId: candidate.id });
      const paid = creditPayday(next, candidate.id, round);
      next = paid.state;
      events.push(...paid.events);
      if (next.players.filter((p) => !p.isOut).length < 2) return lastStanding(next, events);
      continue;
    }

    return {
      ok: true,
      state: { ...next, game: { ...next.game, turnNumber: state.game.turnNumber + 1, currentPlayerId: candidate.id } },
      events,
    };
  }
  throw new Error('END_TURN found no seat to take the next turn');
}
