import {
  CARDS_BY_ID,
  INVEST_STEP,
  isGrowthAssetType,
  type Action,
  type Asset,
  type DealCard,
  type GameState,
  type GrowthAsset,
  type Liability,
  type LogEvent,
} from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';
import { currentPlayer } from '../selectors';

/**
 * Spec, Card decks: buy the offered deal. A property deal costs its down
 * payment and, when financed, creates one mortgage liability linked to the
 * asset (Core rules, Mortgages). A stock costs shares × the rolled sharePrice
 * and creates a separate lot each time (Card decks, Stock rules). A growth
 * asset takes an `amount` in $100 steps, from the card's minimum up to the
 * player's cash, and starts at that marketValue (v2, Growth assets).
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
  if (isGrowthAssetType(card.type)) return buyGrowth(state, action, card, assetId);
  if (action.amount !== undefined) return rejected('INVALID_AMOUNT');

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

/**
 * Spec v2, Growth assets: the player chooses an amount in $100 steps between
 * the card's minimum (its price) and their cash. The asset starts at that
 * marketValue; its cash flow is derived, never stored. Like a stock card, the
 * card goes back to the discard pile so anyone can invest in it again.
 */
function buyGrowth(state: GameState, action: Extract<Action, { type: 'BUY' }>, card: DealCard, assetId: string): ActionResult {
  const { amount } = action;
  if (amount === undefined || !Number.isInteger(amount) || amount < card.price || amount % INVEST_STEP !== 0) return rejected('INVALID_AMOUNT');
  if (!isGrowthAssetType(card.type) || card.growthPercent === undefined || card.payoutPercent === undefined) {
    throw new Error(`growth card "${card.id}" is missing its percents`);
  }

  const player = currentPlayer(state);
  if (player.cash < amount) return rejected('INSUFFICIENT_CASH');

  const asset: GrowthAsset = {
    id: assetId,
    cardId: card.id,
    type: card.type,
    purchasePrice: amount,
    downPaid: amount,
    marketValue: amount,
    growthPercent: card.growthPercent,
    payoutPercent: card.payoutPercent,
  };

  const piles = state.decks[card.deck];
  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) => (p.id === player.id ? { ...p, cash: p.cash - amount, assets: [...p.assets, asset] } : p)),
      decks: { ...state.decks, [card.deck]: { ...piles, discardPile: [...piles.discardPile, card.id] } },
      pending: { kind: 'none' },
    },
    events: [
      { kind: 'cashChanged', delta: -amount, reason: 'buy' },
      { kind: 'bought', assetId, cardId: card.id, cost: amount, principles: card.principles },
    ],
  };
}
