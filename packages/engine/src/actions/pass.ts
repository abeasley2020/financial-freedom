import { CARDS_BY_ID, type GameState } from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';
import { currentPlayer } from '../selectors';

/**
 * Spec, Card decks: decline the offered deal. The card goes to its deck's
 * discard pile. For a stock this is also how a holder declines to buy or
 * sell (Stock rules). The event records the deal's cash flow, down payment,
 * and whether the player could have afforded it (spec, Decision log), so
 * the debrief can score a passed deal without replaying. PASS carries no
 * payload beyond playerId, which `reduce` has already checked.
 */
export function pass(state: GameState): ActionResult {
  if (state.pending.kind !== 'buyOrPass') return rejected('INVALID_FOR_PENDING');

  const { cardId } = state.pending;
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') {
    throw new Error(`unknown deal card "${cardId}" in pending buyOrPass`);
  }

  const piles = state.decks[card.deck];
  const affordable = currentPlayer(state).cash >= card.downPayment;
  return {
    ok: true,
    state: {
      ...state,
      decks: { ...state.decks, [card.deck]: { ...piles, discardPile: [...piles.discardPile, cardId] } },
      pending: { kind: 'none' },
    },
    events: [
      { kind: 'passed', cardId, principles: card.principles, monthlyCashFlow: card.monthlyCashFlow, downPayment: card.downPayment, affordable },
    ],
  };
}
