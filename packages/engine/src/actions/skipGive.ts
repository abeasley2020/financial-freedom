import type { GameState } from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';

/**
 * Spec, Card decks, Giving: giving is optional. Skipping clears the decision
 * and changes nothing else. SKIP_GIVE carries no payload beyond playerId.
 */
export function skipGive(state: GameState): ActionResult {
  if (state.pending.kind !== 'giveOrSkip') return rejected('INVALID_FOR_PENDING');
  return { ok: true, state: { ...state, pending: { kind: 'none' } }, events: [{ kind: 'skippedGive' }] };
}
