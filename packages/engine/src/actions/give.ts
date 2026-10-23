import type { GameState } from '@ff/shared';

import { pct } from '../money';
import { rejected, type ActionResult } from '../reduce';
import { currentPlayer } from '../selectors';

/** Share of cash on hand a gift costs (spec, Card decks, Giving). */
const GIVE_PERCENT = 10;

/**
 * Spec, Card decks, Giving: give 10 percent of cash on hand and gain one
 * Favor token. Rejected when the gift would floor to $0, so a token is never
 * free; SKIP_GIVE is the way out. GIVE carries no payload beyond playerId.
 */
export function give(state: GameState): ActionResult {
  if (state.pending.kind !== 'giveOrSkip') return rejected('INVALID_FOR_PENDING');

  const player = currentPlayer(state);
  const amount = pct(player.cash, GIVE_PERCENT);
  if (amount === 0) return rejected('INSUFFICIENT_CASH');

  const favorTokens = player.favorTokens + 1;
  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) => (p.id === player.id ? { ...p, cash: p.cash - amount, favorTokens } : p)),
      pending: { kind: 'none' },
    },
    events: [
      { kind: 'cashChanged', delta: -amount, reason: 'give' },
      { kind: 'gave', amount, favorTokens },
    ],
  };
}
