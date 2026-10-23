import { isGrowthAsset, type Asset, type GameState, type LogEvent } from '@ff/shared';

import { pct } from './money';
import { liquidate } from './sales';
import { assetCashFlow, playerById } from './selectors';

/** Share of purchase price a bankruptcy sale fetches (spec, Core rules, Bankruptcy). */
const BANKRUPTCY_SALE_PERCENT = 50;

/** Sale order: lowest monthly cash flow first, ties by lowest purchasePrice, then holding order. */
function saleOrder(a: Asset, b: Asset): number {
  return assetCashFlow(a) - assetCashFlow(b) || a.purchasePrice - b.purchasePrice;
}

/** What a bankruptcy sale fetches: half the purchase price, or half the marketValue of a growth asset (spec v2, Bankruptcy). */
export function bankruptcyPrice(asset: Asset): number {
  return pct(isGrowthAsset(asset) ? asset.marketValue : asset.purchasePrice, BANKRUPTCY_SALE_PERCENT);
}

/**
 * Spec, Core rules, Bankruptcy (decided 2026-10-23): a player whose cash has
 * gone below zero sells assets automatically, one at a time in `saleOrder`,
 * each at half its purchase price (mortgage paid off first), until cash is
 * zero or more. If every asset is gone and cash is still negative the player
 * is out: `isOut` is set and cash becomes 0. Called with cash already below
 * zero; a no-op otherwise.
 */
export function resolveBankruptcy(state: GameState, playerId: string): { readonly state: GameState; readonly events: readonly LogEvent[] } {
  let next = state;
  const events: LogEvent[] = [];

  for (;;) {
    const player = playerById(next, playerId);
    if (player.cash >= 0) return { state: next, events };
    const asset = [...player.assets].sort(saleOrder)[0];
    if (asset === undefined) break;
    const sale = liquidate(next, playerId, asset, bankruptcyPrice(asset), 'bankruptcy');
    next = sale.state;
    events.push(...sale.events);
  }

  const shortfall = -playerById(next, playerId).cash;
  events.push({ kind: 'wentOut', shortfall });
  return {
    state: {
      ...next,
      players: next.players.map((p) => (p.id === playerId ? { ...p, cash: 0, isOut: true } : p)),
    },
    events,
  };
}
