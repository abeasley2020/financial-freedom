import type { GameState } from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';
import { discardMarketCard, marketCardOf, qualifyingAssets } from './acceptMarket';

/**
 * Spec, Card decks, Market card resolution: a buyout offer may be declined;
 * every other effect is mandatory once the player owns something it applies
 * to. Declining discards the card with no effect. DECLINE_MARKET carries no
 * payload beyond playerId, which `reduce` has already checked.
 */
export function declineMarket(state: GameState): ActionResult {
  if (state.pending.kind !== 'marketChoice') return rejected('INVALID_FOR_PENDING');

  const card = marketCardOf(state.pending.cardId);
  const optional = card.effects.every((e) => e.kind === 'offerBuyout');
  if (!optional && qualifyingAssets(state, card).length > 0) return rejected('MARKET_EFFECT_MANDATORY');

  return {
    ok: true,
    state: discardMarketCard(state, card.id),
    events: [{ kind: 'declinedMarket', cardId: card.id, principles: card.principles }],
  };
}
