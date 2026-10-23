import { CARDS_BY_ID, type Action, type Asset, type GameState } from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';
import { currentPlayer } from '../selectors';

/**
 * Spec, Card decks, Stock rules: shares are sold only when the same stock
 * card is drawn again, at the newly rolled sharePrice, from one lot the
 * current player holds. Omitting `shares` sells the whole lot. A partial sale
 * shrinks the lot's cost basis in proportion (floored) and recomputes its
 * dividend. Non-stock assets are sold only through Market cards.
 */
export function sellAsset(state: GameState, action: Extract<Action, { type: 'SELL_ASSET' }>): ActionResult {
  if (state.pending.kind !== 'buyOrPass') return rejected('INVALID_FOR_PENDING');

  const { cardId, sharePrice } = state.pending;
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') {
    throw new Error(`unknown deal card "${cardId}" in pending buyOrPass`);
  }
  if (card.type !== 'stock') return rejected('INVALID_FOR_PENDING');
  if (sharePrice === undefined) {
    throw new Error(`stock "${card.id}" offered without a sharePrice in pending buyOrPass`);
  }

  const player = currentPlayer(state);
  const lot = player.assets.find((a) => a.id === action.assetId);
  if (lot?.cardId !== card.id || lot.type !== 'stock' || lot.shares === undefined) return rejected('INVALID_ASSET');

  const shares = action.shares ?? lot.shares;
  if (shares > lot.shares) return rejected('INVALID_SHARES');

  const proceeds = shares * sharePrice;
  const remaining = lot.shares - shares;
  const dividend = card.dividendPerShare ?? 0;
  const kept: Asset | undefined =
    remaining === 0
      ? undefined
      : {
          ...lot,
          shares: remaining,
          purchasePrice: Math.floor((lot.purchasePrice * remaining) / lot.shares),
          downPaid: Math.floor((lot.downPaid * remaining) / lot.shares),
          monthlyCashFlow: Math.floor(remaining * dividend),
        };

  const piles = state.decks[card.deck];
  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === player.id
          ? {
              ...p,
              cash: p.cash + proceeds,
              assets: kept === undefined ? p.assets.filter((a) => a.id !== lot.id) : p.assets.map((a) => (a.id === lot.id ? kept : a)),
            }
          : p,
      ),
      decks: { ...state.decks, [card.deck]: { ...piles, discardPile: [...piles.discardPile, card.id] } },
      pending: { kind: 'none' },
    },
    events: [
      { kind: 'cashChanged', delta: proceeds, reason: 'sell' },
      { kind: 'sold', assetId: lot.id, cardId: card.id, proceeds, shares, remainingShares: remaining, principles: card.principles },
    ],
  };
}
