import { CARDS_BY_ID, type Action, type Asset, type DealCard, type GameState, type Liability, type LogEvent } from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';
import { currentPlayer } from '../selectors';

/**
 * Spec, Card decks: buy the offered deal. A non-stock deal costs its down
 * payment and, when financed, creates one mortgage liability linked to the
 * asset (Core rules, Mortgages). A stock costs shares × the rolled sharePrice
 * and creates a separate lot each time (Card decks, Stock rules).
 */
export function buy(state: GameState, action: Extract<Action, { type: 'BUY' }>): ActionResult {
  if (state.pending.kind !== 'buyOrPass') return rejected('INVALID_FOR_PENDING');

  const { cardId, sharePrice } = state.pending;
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') {
    throw new Error(`unknown deal card "${cardId}" in pending buyOrPass`);
  }

  const player = currentPlayer(state);
  // Deterministic and unique: the log only grows, and no two accepted actions share a length.
  const assetId = `${player.id}-${card.id}-${String(state.game.log.length)}`;

  if (card.type === 'stock') return buyStock(state, action, card, sharePrice, assetId);
  if (action.shares !== undefined) return rejected('INVALID_SHARES');

  const cost = card.downPayment;
  if (player.cash < cost) return rejected('INSUFFICIENT_CASH');

  const asset: Asset = {
    id: assetId,
    cardId: card.id,
    type: card.type,
    purchasePrice: card.price,
    downPaid: cost,
    monthlyCashFlow: card.monthlyCashFlow,
  };
  const mortgage: Liability | undefined =
    card.mortgage > 0
      ? { id: `${assetId}-mortgage`, kind: 'mortgage', principal: card.mortgage, monthlyPayment: 0, assetId }
      : undefined;

  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === player.id
          ? {
              ...p,
              cash: p.cash - cost,
              assets: [...p.assets, asset],
              liabilities: mortgage === undefined ? p.liabilities : [...p.liabilities, mortgage],
            }
          : p,
      ),
      pending: { kind: 'none' },
    },
    events: [
      { kind: 'cashChanged', delta: -cost, reason: 'buy' },
      { kind: 'bought', assetId, cardId: card.id, cost, principles: card.principles },
    ],
  };
}

function buyStock(
  state: GameState,
  action: Extract<Action, { type: 'BUY' }>,
  card: DealCard,
  sharePrice: number | undefined,
  assetId: string,
): ActionResult {
  const shares = action.shares;
  if (shares === undefined) return rejected('INVALID_SHARES');
  if (card.sharesAvailable === undefined || shares > card.sharesAvailable) return rejected('INVALID_SHARES');
  if (sharePrice === undefined) {
    throw new Error(`stock "${card.id}" offered without a sharePrice in pending buyOrPass`);
  }

  const player = currentPlayer(state);
  const cost = shares * sharePrice;
  if (player.cash < cost) return rejected('INSUFFICIENT_CASH');

  const lot: Asset = {
    id: assetId,
    cardId: card.id,
    type: 'stock',
    purchasePrice: cost,
    downPaid: cost,
    monthlyCashFlow: Math.floor(shares * (card.dividendPerShare ?? 0)),
    shares,
  };

  // The card stays in its deck so it can be drawn again at a new price.
  const piles = state.decks[card.deck];
  const events: LogEvent[] = [
    { kind: 'cashChanged', delta: -cost, reason: 'buy' },
    { kind: 'bought', assetId, cardId: card.id, cost, shares, principles: card.principles },
  ];

  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === player.id ? { ...p, cash: p.cash - cost, assets: [...p.assets, lot] } : p,
      ),
      decks: { ...state.decks, [card.deck]: { ...piles, discardPile: [...piles.discardPile, card.id] } },
      pending: { kind: 'none' },
    },
    events,
  };
}
