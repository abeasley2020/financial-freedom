import { CARDS_BY_ID, type Action, type Asset, type GameState, type LogEvent, type MarketCard } from '@ff/shared';

import { pct } from '../money';
import { rejected, type ActionResult } from '../reduce';
import { liquidate } from '../sales';
import { currentPlayer, playerById } from '../selectors';

/** The current player's assets a Market card can touch. */
export function qualifyingAssets(state: GameState, card: MarketCard): readonly Asset[] {
  return currentPlayer(state).assets.filter((a) => card.appliesTo.includes(a.type));
}

/** Looks up the Market card behind a marketChoice decision. Throws on an unknown id (programmer bug). */
export function marketCardOf(cardId: string): MarketCard {
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'market') throw new Error(`unknown market card "${cardId}" in pending marketChoice`);
  return card;
}

/** Moves the Market card to its discard pile and clears the decision. */
export function discardMarketCard(state: GameState, cardId: string): GameState {
  const piles = state.decks.market;
  return {
    ...state,
    decks: { ...state.decks, market: { ...piles, discardPile: [...piles.discardPile, cardId] } },
    pending: { kind: 'none' },
  };
}

/**
 * Spec, Card decks, Market card resolution: apply the card's effects, in
 * order, to the current player's qualifying assets. A buyout sells one asset
 * (the only qualifying one, or the one named by assetId); a forced sale sells
 * every qualifying asset; cash flow changes and stock splits touch every
 * qualifying asset. With nothing qualifying the card is simply discarded.
 */
export function acceptMarket(state: GameState, action: Extract<Action, { type: 'ACCEPT_MARKET' }>): ActionResult {
  if (state.pending.kind !== 'marketChoice') return rejected('INVALID_FOR_PENDING');

  const card = marketCardOf(state.pending.cardId);
  const playerId = state.game.currentPlayerId;
  const qualifying = qualifyingAssets(state, card);

  if (action.assetId !== undefined && !qualifying.some((a) => a.id === action.assetId)) return rejected('INVALID_ASSET');
  const hasBuyout = card.effects.some((e) => e.kind === 'offerBuyout');
  if (hasBuyout && qualifying.length > 1 && action.assetId === undefined) return rejected('INVALID_ASSET');

  let next = state;
  const events: LogEvent[] = [];
  for (const effect of card.effects) {
    // Recompute each time: an earlier effect may have sold an asset.
    const targets = qualifyingAssets(next, card);
    switch (effect.kind) {
      case 'offerBuyout': {
        const target = action.assetId === undefined ? targets[0] : targets.find((a) => a.id === action.assetId);
        if (target === undefined) break;
        const sale = liquidate(next, playerId, target, pct(target.purchasePrice, effect.percentOfPurchasePrice), 'sell');
        next = sale.state;
        events.push(...sale.events);
        break;
      }
      case 'forceSale': {
        for (const target of targets) {
          const sale = liquidate(next, playerId, target, pct(target.purchasePrice, effect.percentOfPurchasePrice), 'sell');
          next = sale.state;
          events.push(...sale.events);
        }
        break;
      }
      case 'changeCashFlow': {
        const ids = new Set(targets.map((a) => a.id));
        next = updateAssets(next, playerId, (a) => (ids.has(a.id) ? { ...a, monthlyCashFlow: a.monthlyCashFlow + effect.delta } : a));
        for (const a of playerById(next, playerId).assets) {
          if (ids.has(a.id)) events.push({ kind: 'cashFlowChanged', assetId: a.id, delta: effect.delta, monthlyCashFlow: a.monthlyCashFlow });
        }
        break;
      }
      case 'splitShares': {
        const ids = new Set(targets.filter((a) => a.shares !== undefined).map((a) => a.id));
        next = updateAssets(next, playerId, (a) =>
          ids.has(a.id) && a.shares !== undefined ? { ...a, shares: a.shares * effect.ratio } : a,
        );
        for (const a of playerById(next, playerId).assets) {
          if (ids.has(a.id) && a.shares !== undefined) {
            events.push({ kind: 'sharesSplit', assetId: a.id, ratio: effect.ratio, shares: a.shares });
          }
        }
        break;
      }
    }
  }

  return { ok: true, state: discardMarketCard(next, card.id), events };
}

function updateAssets(state: GameState, playerId: string, update: (asset: Asset) => Asset): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, assets: p.assets.map(update) } : p)),
  };
}
