import { CARDS_BY_ID, isGrowthAsset, type Action, type GameState, type StockAsset } from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';
import { liquidate } from '../sales';
import { currentPlayer, hasRolledThisTurn } from '../selectors';

/**
 * Two sales live here. Spec, Card decks, Stock rules: shares are sold only
 * when the same stock card is drawn again, at the newly rolled sharePrice,
 * from one lot the current player holds; omitting `shares` sells the whole
 * lot, and a partial sale shrinks the lot's cost basis in proportion
 * (floored) and recomputes its dividend. Spec v2, Growth assets (decided
 * Q9): a growth asset is sold whole at its marketValue any time nothing is
 * pending, after the roll. Rentals, businesses, and land are sold only
 * through Market cards.
 */
export function sellAsset(state: GameState, action: Extract<Action, { type: 'SELL_ASSET' }>): ActionResult {
  if (state.pending.kind === 'none') return sellGrowth(state, action);
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
  if (lot?.cardId !== card.id || lot.type !== 'stock') return rejected('INVALID_ASSET');

  const shares = action.shares ?? lot.shares;
  if (shares > lot.shares) return rejected('INVALID_SHARES');

  const proceeds = shares * sharePrice;
  const remaining = lot.shares - shares;
  const dividend = card.dividendPerShare ?? 0;
  const kept: StockAsset | undefined =
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

function sellGrowth(state: GameState, action: Extract<Action, { type: 'SELL_ASSET' }>): ActionResult {
  if (!hasRolledThisTurn(state)) return rejected('MUST_ROLL_FIRST');
  const player = currentPlayer(state);
  const asset = player.assets.find((a) => a.id === action.assetId);
  if (asset === undefined) return rejected('INVALID_ASSET');
  if (!isGrowthAsset(asset)) return rejected('INVALID_FOR_PENDING');
  if (action.shares !== undefined) return rejected('INVALID_SHARES');

  const sale = liquidate(state, player.id, asset, asset.marketValue, 'sell');
  // liquidate logs sold then cashChanged; keep the engine-wide order of cash first for a voluntary sale.
  const events = [...sale.events].sort((a, b) => Number(b.kind === 'cashChanged') - Number(a.kind === 'cashChanged'));
  return { ok: true, state: sale.state, events };
}
