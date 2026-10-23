import { CARDS_BY_ID, isGrowthAsset, type Asset, type GameState, type LogEvent } from '@ff/shared';

export interface Liquidation {
  readonly state: GameState;
  readonly events: readonly LogEvent[];
}

/**
 * Sells one whole asset for `proceeds` (spec, Core rules, Mortgages): the
 * asset leaves the player, its linked mortgage is retired first (even when
 * the proceeds fall short of it), and the player keeps the remainder. A deal
 * card returns to its deck's discard pile; a stock card never left its deck,
 * and a growth asset's card (a deal or a Life Choices windfall) never left
 * either, so a lot or a growth asset simply disappears. Used by Market
 * sales, bankruptcy, and growth asset sales.
 */
export function liquidate(state: GameState, playerId: string, asset: Asset, proceeds: number, reason: string): Liquidation {
  const player = state.players.find((p) => p.id === playerId);
  if (player === undefined) throw new Error(`unknown playerId "${playerId}"`);

  const mortgage = player.liabilities.find((l) => l.kind === 'mortgage' && l.assetId === asset.id);
  const mortgagePaid = mortgage === undefined ? 0 : Math.min(proceeds, mortgage.principal);
  const net = proceeds - mortgagePaid;

  const card = CARDS_BY_ID.get(asset.cardId);
  if (card === undefined) throw new Error(`asset "${asset.id}" references unknown card "${asset.cardId}"`);
  const returnsCard = asset.type !== 'stock' && !isGrowthAsset(asset);
  if (returnsCard && card.deck !== 'smallDeals' && card.deck !== 'bigDeals') {
    throw new Error(`asset "${asset.id}" references non-deal card "${asset.cardId}"`);
  }

  const { principles } = card;
  const events: LogEvent[] = [
    mortgage === undefined
      ? { kind: 'sold', assetId: asset.id, cardId: asset.cardId, proceeds, principles }
      : { kind: 'sold', assetId: asset.id, cardId: asset.cardId, proceeds, mortgagePaid, principles },
  ];
  if (net > 0) events.push({ kind: 'cashChanged', delta: net, reason });

  const decks = returnsCard
    ? {
        ...state.decks,
        [card.deck]: { ...state.decks[card.deck], discardPile: [...state.decks[card.deck].discardPile, card.id] },
      }
    : state.decks;

  return {
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              cash: p.cash + net,
              assets: p.assets.filter((a) => a.id !== asset.id),
              liabilities: mortgage === undefined ? p.liabilities : p.liabilities.filter((l) => l.id !== mortgage.id),
            }
          : p,
      ),
      decks,
    },
    events,
  };
}
