import { CARDS_BY_ID, type Action, type GameState, type Liability, type LogEvent } from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';
import { currentPlayer } from '../selectors';

/**
 * Spec, Card decks, Lifestyle card resolution: a drawn Lifestyle card must be
 * paid. `cash` pays the card's cashCost; `loan` adds a lifestyle liability
 * with the card's monthlyCost and loanPrincipal. A method the card does not
 * offer is rejected. The card then goes to the discard pile.
 */
export function payLifestyle(state: GameState, action: Extract<Action, { type: 'PAY_LIFESTYLE' }>): ActionResult {
  if (state.pending.kind !== 'payLifestyle') return rejected('INVALID_FOR_PENDING');

  const { cardId } = state.pending;
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'lifestyle') {
    throw new Error(`unknown lifestyle card "${cardId}" in pending payLifestyle`);
  }

  const player = currentPlayer(state);
  const piles = state.decks.lifestyle;
  const discarded = {
    ...state,
    decks: { ...state.decks, lifestyle: { ...piles, discardPile: [...piles.discardPile, cardId] } },
    pending: { kind: 'none' } as const,
  };

  if (action.method === 'cash') {
    const cost = card.cashCost;
    if (cost === undefined) return rejected('INVALID_METHOD');
    if (player.cash < cost) return rejected('INSUFFICIENT_CASH');
    const events: LogEvent[] = [
      { kind: 'cashChanged', delta: -cost, reason: 'lifestyle' },
      { kind: 'paidLifestyle', cardId, method: 'cash', amount: cost },
    ];
    return {
      ok: true,
      state: {
        ...discarded,
        players: state.players.map((p) => (p.id === player.id ? { ...p, cash: p.cash - cost } : p)),
      },
      events,
    };
  }

  const { monthlyCost, loanPrincipal } = card;
  if (monthlyCost === undefined || loanPrincipal === undefined) return rejected('INVALID_METHOD');
  const loan: Liability = {
    id: `${player.id}-lifestyle-${String(state.game.log.length)}`,
    kind: 'lifestyle',
    principal: loanPrincipal,
    monthlyPayment: monthlyCost,
    sourceCardId: cardId,
  };
  return {
    ok: true,
    state: {
      ...discarded,
      players: state.players.map((p) => (p.id === player.id ? { ...p, liabilities: [...p.liabilities, loan] } : p)),
    },
    events: [
      {
        kind: 'paidLifestyle',
        cardId,
        method: 'loan',
        amount: loanPrincipal,
        liabilityId: loan.id,
        monthlyPayment: monthlyCost,
      },
    ],
  };
}
