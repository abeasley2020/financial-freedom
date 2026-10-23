import { CARDS_BY_ID, type GameState } from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';

/**
 * Spec, Card decks: decline the offered deal. The card goes to its deck's
 * discard pile. For a stock this is also how a holder declines to buy or
 * sell (Stock rules). PASS carries no payload beyond playerId, which
 * `reduce` has already checked.
 */
export function pass(state: GameState): ActionResult {
  if (state.pending.kind !== 'buyOrPass') return rejected('INVALID_FOR_PENDING');

  const { cardId } = state.pending;
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') {
    throw new Error(`unknown deal card "${cardId}" in pending buyOrPass`);
  }

  const piles = state.decks[card.deck];
  return {
    ok: true,
    state: {
      ...state,
      decks: { ...state.decks, [card.deck]: { ...piles, discardPile: [...piles.discardPile, cardId] } },
      pending: { kind: 'none' },
    },
    events: [{ kind: 'passed', cardId }],
  };
}
