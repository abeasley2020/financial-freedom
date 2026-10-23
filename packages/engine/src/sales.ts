import { CARDS_BY_ID, type Asset, type GameState, type LogEvent } from '@ff/shared';

export interface Liquidation {
  readonly state: GameState;
  readonly events: readonly LogEvent[];
}

/**
 * Sells one whole asset for `proceeds` (spec, Core rules, Mortgages): the
 * asset leaves the player, its linked mortgage is retired first (even when
 * the proceeds fall short of it), and the player keeps the remainder. A deal
 * card returns to its deck's discard pile; a stock card never left its deck,
 * so a lot simply disappears. Used by Market sales and bankruptcy.
 */
export function liquidate(state: GameState, playerId: string, asset: Asset, proceeds: number, reason: string): Liquidation {
  const player = state.players.find((p) => p.id === playerId);
  if (player === undefined) throw new Error(`unknown playerId "${playerId}"`);

  const mortgage = player.liabilities.find((l) => l.kind === 'mortgage' && l.assetId === asset.id);
  const mortgagePaid = mortgage === undefined ? 0 : Math.min(proceeds, mortgage.principal);
  const net = proceeds - mortgagePaid;

  const card = CARDS_BY_ID.get(asset.cardId);
  if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') {
    throw new Error(`asset "${asset.id}" references unknown deal card "${asset.cardId}"`);
  }

  const { principles } = card;
  const events: LogEvent[] = [
    mortgage === undefined
      ? { kind: 'sold', assetId: asset.id, cardId: asset.cardId, proceeds, principles }
      : { kind: 'sold', assetId: asset.id, cardId: asset.cardId, proceeds, mortgagePaid, principles },
  ];
  if (net > 0) events.push({ kind: 'cashChanged', delta: net, reason });

  const decks =
    asset.type === 'stock'
      ? state.decks
      : {
          ...state.decks,
          [card.deck]: { ...state.decks[card.deck], discardPile: [...state.decks[card.deck].discardPile, card.id] },
        };

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
