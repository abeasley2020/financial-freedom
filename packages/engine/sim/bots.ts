// Bot strategies for the balance simulation (spec, Testing strategy). Bots
// live outside src/ because they are not part of the engine: they only send
// actions to reduce() like a UI would. Each bot returns its moves in order
// of preference; the runner applies the first one the engine accepts.

import { CARDS_BY_ID, type Action, type GameState, type MarketCard } from '@ff/shared';

import { pct } from '../src/money';
import { currentPlayer, hasRolledThisTurn, monthlyCashFlow } from '../src/selectors';

export const STRATEGIES = ['cautious', 'balanced', 'aggressive'] as const;
export type Strategy = (typeof STRATEGIES)[number];

interface Profile {
  /** Cash the bot tries to keep on hand after any purchase or repayment. */
  readonly cushion: number;
  /** Will the bot borrow to complete a deal whose cash flow still beats the loan payment? */
  readonly borrowsForDeals: boolean;
  /** Buy a deal only if its monthly cash flow per $1,000 down is at least this. */
  readonly minReturnPerThousand: number;
  /** Cash above which the bot asks for a big deal. */
  readonly bigDealCash: number;
}

const PROFILES: Readonly<Record<Strategy, Profile>> = {
  cautious: { cushion: 2_000, borrowsForDeals: false, minReturnPerThousand: 25, bigDealCash: 20_000 },
  balanced: { cushion: 1_000, borrowsForDeals: true, minReturnPerThousand: 15, bigDealCash: 10_000 },
  aggressive: { cushion: 0, borrowsForDeals: true, minReturnPerThousand: 1, bigDealCash: 6_000 },
};

/** Smallest $1,000 multiple at or above `amount`; 0 when nothing is needed. */
function roundUpToStep(amount: number): number {
  return amount <= 0 ? 0 : Math.ceil(amount / 1_000) * 1_000;
}

/** The bot's moves for `state`, best first. */
export function decide(state: GameState, strategy: Strategy): readonly Action[] {
  const profile = PROFILES[strategy];
  const player = currentPlayer(state);
  const playerId = player.id;
  const pending = state.pending;
  const standard = state.game.mode === 'standard';

  switch (pending.kind) {
    case 'none': {
      if (!hasRolledThisTurn(state)) return [{ type: 'ROLL', playerId }];
      // Repay the most expensive loan the bot can afford while keeping its cushion.
      const repayable = player.liabilities
        .filter((l) => l.kind !== 'mortgage' && player.cash - l.principal >= profile.cushion)
        .sort((a, b) => b.monthlyPayment / Math.max(1, b.principal) - a.monthlyPayment / Math.max(1, a.principal));
      const repay: Action[] = repayable[0] === undefined ? [] : [{ type: 'REPAY', playerId, liabilityId: repayable[0].id }];
      return [...repay, { type: 'END_TURN', playerId }];
    }

    case 'chooseDealSize':
      return [{ type: 'CHOOSE_DEAL_SIZE', playerId, size: player.cash >= profile.bigDealCash ? 'big' : 'small' }];

    case 'buyOrPass': {
      const card = CARDS_BY_ID.get(pending.cardId);
      if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') return [{ type: 'PASS', playerId }];
      const pass: Action = { type: 'PASS', playerId };

      if (card.type === 'stock') {
        const price = pending.sharePrice ?? card.price;
        const lot = player.assets.find((a) => a.cardId === card.id && a.shares !== undefined);
        if (lot?.shares !== undefined) {
          const costPerShare = lot.purchasePrice / lot.shares;
          if (price >= costPerShare * 1.3) return [{ type: 'SELL_ASSET', playerId, assetId: lot.id }, pass];
        }
        const range = card.priceRange;
        const cheap = range === undefined ? true : price <= range.min + (range.max - range.min) / 3;
        const dividend = card.dividendPerShare ?? 0;
        if (!cheap && dividend === 0) return [pass];
        const affordable = Math.floor((player.cash - profile.cushion) / price);
        const shares = Math.min(affordable, card.sharesAvailable ?? 0);
        return shares > 0 ? [{ type: 'BUY', playerId, shares }, pass] : [pass];
      }

      if (card.monthlyCashFlow <= 0) return [pass];
      const returnPerThousand = (card.monthlyCashFlow * 1_000) / Math.max(1, card.downPayment);
      if (returnPerThousand < profile.minReturnPerThousand) return [pass];
      if (player.cash - card.downPayment >= profile.cushion) return [{ type: 'BUY', playerId }, pass];
      if (standard && profile.borrowsForDeals) {
        const shortfall = roundUpToStep(card.downPayment + profile.cushion - player.cash);
        // Only borrow when the deal still pays after the loan's 10%/month.
        if (shortfall > 0 && card.monthlyCashFlow > pct(shortfall, 10) && monthlyCashFlow(player) - pct(shortfall, 10) > 0) {
          return [{ type: 'BORROW', playerId, amount: shortfall }, pass];
        }
      }
      return [pass];
    }

    case 'marketChoice': {
      const card = CARDS_BY_ID.get(pending.cardId);
      if (card?.deck !== 'market') return [{ type: 'DECLINE_MARKET', playerId }];
      const qualifying = player.assets.filter((a) => card.appliesTo.includes(a.type));
      const offer = buyoutOffer(card);
      // Sell the weakest qualifying asset to a generous buyer; otherwise keep the cash flow.
      const [target] = [...qualifying].sort((a, b) => a.monthlyCashFlow - b.monthlyCashFlow);
      if (offer !== undefined && target !== undefined) {
        const generous = offer >= 150 || target.monthlyCashFlow <= 0;
        return generous
          ? [{ type: 'ACCEPT_MARKET', playerId, assetId: target.id }, { type: 'DECLINE_MARKET', playerId }]
          : [{ type: 'DECLINE_MARKET', playerId }, { type: 'ACCEPT_MARKET', playerId, assetId: target.id }];
      }
      return [{ type: 'ACCEPT_MARKET', playerId }, { type: 'DECLINE_MARKET', playerId }];
    }

    case 'payLifestyle': {
      const card = CARDS_BY_ID.get(pending.cardId);
      const cash: Action = { type: 'PAY_LIFESTYLE', playerId, method: 'cash' };
      const loan: Action = { type: 'PAY_LIFESTYLE', playerId, method: 'loan' };
      if (card?.deck !== 'lifestyle') return [cash, loan];
      const canPayCash = card.cashCost !== undefined && player.cash - card.cashCost >= profile.cushion;
      const moves: Action[] = canPayCash ? [cash, loan] : [loan, cash];
      if (standard && card.cashCost !== undefined && player.cash < card.cashCost) {
        moves.push({ type: 'BORROW', playerId, amount: roundUpToStep(card.cashCost - player.cash) });
      }
      return moves;
    }

    case 'giveOrSkip':
      return player.cash >= profile.cushion + 500
        ? [{ type: 'GIVE', playerId }, { type: 'SKIP_GIVE', playerId }]
        : [{ type: 'SKIP_GIVE', playerId }];
  }
}

/** The percent a card's single buyout offer pays, or undefined when the card is not a pure offer. */
function buyoutOffer(card: MarketCard): number | undefined {
  if (!card.effects.every((e) => e.kind === 'offerBuyout')) return undefined;
  const first = card.effects[0];
  return first?.kind === 'offerBuyout' ? first.percentOfPurchasePrice : undefined;
}
