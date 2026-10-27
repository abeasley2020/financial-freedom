// Bot strategies for the balance simulation (spec, Testing strategy). Bots
// live outside src/ because they are not part of the engine: they only send
// actions to reduce() like a UI would. Each bot returns its moves in order
// of preference; the runner applies the first one the engine accepts.

import { CARDS_BY_ID, INVEST_STEP, isGrowthAsset, isGrowthAssetType, type Action, type GameState, type MarketCard, type Player } from '@ff/shared';

import { pct } from '../src/money';
import { assetCashFlow, cheapestOption, currentPlayer, hasRolledThisTurn, monthlyCashFlow, optionCost, priciestOption, totalExpenses } from '../src/selectors';

export const STRATEGIES = ['cautious', 'balanced', 'aggressive', 'wealthBuilder', 'bigSpender'] as const;
export type Strategy = (typeof STRATEGIES)[number];

/** Report names for the strategies. */
export const STRATEGY_NAMES: Readonly<Record<Strategy, string>> = {
  cautious: 'Cautious',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
  wealthBuilder: 'Wealth Builder',
  bigSpender: 'Big Spender',
};

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

const PROFILES: Readonly<Record<'cautious' | 'balanced' | 'aggressive', Profile>> = {
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
  if (strategy === 'wealthBuilder') return wealthBuilder(state);
  if (strategy === 'bigSpender') return bigSpender(state);
  return simpleBot(state, PROFILES[strategy], strategy === 'aggressive');
}

function simpleBot(state: GameState, profile: Profile, aggressive: boolean): readonly Action[] {
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
        const lot = player.assets.find((a) => a.cardId === card.id && a.type === 'stock');
        if (lot?.type === 'stock') {
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

      if (isGrowthAssetType(card.type)) {
        // v2 growth assets: invest what is left above the cushion, in $100 steps, if that meets the card minimum.
        const spare = Math.floor((player.cash - profile.cushion) / INVEST_STEP) * INVEST_STEP;
        return spare >= card.price ? [{ type: 'BUY', playerId, amount: spare }, pass] : [pass];
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

    case 'marketChoice':
      return marketMoves(state, player);

    case 'lifeChoice': {
      // v2 Life Choices: cautious and balanced bots take the option with the smallest monthly change
      // (then the smallest cost today); the aggressive bot takes the priciest option it can afford.
      const card = CARDS_BY_ID.get(pending.cardId);
      if (card?.deck !== 'lifeChoices') return [];
      const ranked = card.options
        .filter((o) => state.game.mode === 'standard' || o.kidsOk)
        .map((o) => ({ o, cost: optionCost(o, player) }))
        .sort((a, b) => a.cost.monthlyChange - b.cost.monthlyChange || a.cost.costToday - b.cost.costToday);
      const affordable = ranked.filter(({ cost }) => cost.costToday <= player.cash - (aggressive ? 0 : profile.cushion));
      const order = aggressive ? [...affordable].reverse() : affordable;
      const moves: Action[] = order.map(({ o }) => ({ type: 'CHOOSE_LIFE_OPTION', playerId, optionId: o.id }));
      for (const { o } of ranked) moves.push({ type: 'CHOOSE_LIFE_OPTION', playerId, optionId: o.id });
      return moves;
    }

    case 'giveOrSkip':
      return player.cash >= profile.cushion + 500
        ? [{ type: 'GIVE', playerId }, { type: 'SKIP_GIVE', playerId }]
        : [{ type: 'SKIP_GIVE', playerId }];
  }
}

/** Market decisions shared by every bot: sell the weakest qualifying asset to a generous buyer, otherwise keep the cash flow. */
function marketMoves(state: GameState, player: Player): readonly Action[] {
  const playerId = player.id;
  const pending = state.pending;
  const card = pending.kind === 'marketChoice' ? CARDS_BY_ID.get(pending.cardId) : undefined;
  if (card?.deck !== 'market') return [{ type: 'DECLINE_MARKET', playerId }];
  const qualifying = player.assets.filter((a) => card.appliesTo.includes(a.type));
  const offer = buyoutOffer(card);
  const [target] = [...qualifying].sort((a, b) => assetCashFlow(a) - assetCashFlow(b));
  if (offer !== undefined && target !== undefined) {
    const generous = offer >= 150 || assetCashFlow(target) <= 0;
    return generous
      ? [{ type: 'ACCEPT_MARKET', playerId, assetId: target.id }, { type: 'DECLINE_MARKET', playerId }]
      : [{ type: 'DECLINE_MARKET', playerId }, { type: 'ACCEPT_MARKET', playerId, assetId: target.id }];
  }
  return [{ type: 'ACCEPT_MARKET', playerId }, { type: 'DECLINE_MARKET', playerId }];
}

/** Cash plus what the player's growth assets would sell for today. */
function liquid(player: Player): number {
  return player.cash + player.assets.reduce((sum, a) => sum + (isGrowthAsset(a) ? a.marketValue : 0), 0);
}

/** Stock decisions shared by the two named bots: sell a lot at 30% over cost, otherwise buy up to `budget`. */
function stockMoves(player: Player, cardId: string, sharePrice: number | undefined, budget: number, wantsShares: (dividendPerShare: number, price: number) => boolean): readonly Action[] {
  const playerId = player.id;
  const pass: Action = { type: 'PASS', playerId };
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') return [pass];
  const price = sharePrice ?? card.price;
  const lot = player.assets.find((a) => a.cardId === card.id && a.type === 'stock');
  if (lot?.type === 'stock' && price >= (lot.purchasePrice / lot.shares) * 1.3) return [{ type: 'SELL_ASSET', playerId, assetId: lot.id }, pass];
  if (!wantsShares(card.dividendPerShare ?? 0, price)) return [pass];
  const shares = Math.min(Math.floor(budget / price), card.sharesAvailable ?? 0);
  return shares > 0 ? [{ type: 'BUY', playerId, shares }, pass] : [pass];
}

/**
 * Wealth Builder (spec v2, Engineering practices): keeps three months of
 * totalExpenses as an emergency fund, takes the Life Choices option with no
 * monthly cost, buys deals by cash flow per $1,000 down, and borrows only for
 * an asset. The fund counts cash plus growth assets, which sell at
 * marketValue any time after the roll, so the bot holds its fund in growth
 * assets and keeps one month of bills in cash for Setbacks. It borrows for a
 * deal in two cases: the deal's cash flow beats the loan payment, or the
 * money is already there in growth assets (a one-month bridge, repaid by
 * selling them on the next turn).
 */
function wealthBuilder(state: GameState): readonly Action[] {
  const player = currentPlayer(state);
  const playerId = player.id;
  const pending = state.pending;
  const bills = totalExpenses(player);
  const fund = 3 * bills;
  const growth = player.assets.filter(isGrowthAsset);
  /** Money above the fund, in cash or growth assets: what the bot may put into an income deal. */
  const free = Math.max(0, liquid(player) - fund);
  const pass: Action = { type: 'PASS', playerId };

  switch (pending.kind) {
    case 'none': {
      if (!hasRolledThisTurn(state)) return [{ type: 'ROLL', playerId }];
      // Pay off the dearest loan (highest payment per dollar owed) when the fund stays whole.
      // Paying a loan lowers totalExpenses, so the fund it must leave shrinks by three payments.
      const [loan] = player.liabilities
        .filter((l) => l.kind !== 'mortgage' && (l.kind === 'subscription' || l.principal <= free + 3 * l.monthlyPayment))
        .sort((a, b) => b.monthlyPayment / Math.max(1, b.principal) - a.monthlyPayment / Math.max(1, a.principal));
      if (loan === undefined) return [{ type: 'END_TURN', playerId }];
      if (loan.principal > player.cash) {
        // Raise the cash from the growth asset that pays the least.
        const [sell] = [...growth].sort((a, b) => a.payoutPercent + a.growthPercent - (b.payoutPercent + b.growthPercent));
        return sell === undefined ? [{ type: 'END_TURN', playerId }] : [{ type: 'SELL_ASSET', playerId, assetId: sell.id }, { type: 'END_TURN', playerId }];
      }
      return [{ type: 'REPAY', playerId, liabilityId: loan.id }, { type: 'END_TURN', playerId }];
    }

    case 'chooseDealSize':
      return [{ type: 'CHOOSE_DEAL_SIZE', playerId, size: free >= WB_BIG_DEAL_CASH ? 'big' : 'small' }];

    case 'buyOrPass': {
      const card = CARDS_BY_ID.get(pending.cardId);
      if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') return [pass];
      if (card.type === 'stock') {
        return stockMoves(player, card.id, pending.sharePrice, Math.min(free, player.cash), (dividend, price) => (dividend * 1_000) / price >= WB_MIN_RETURN_PER_THOUSAND);
      }
      if (isGrowthAssetType(card.type)) {
        // Hold the fund in growth assets that pay out, keeping one month of bills in cash.
        const spare = Math.floor((player.cash - bills) / INVEST_STEP) * INVEST_STEP;
        return (card.payoutPercent ?? 0) > 0 && spare >= card.price ? [{ type: 'BUY', playerId, amount: spare }, pass] : [pass];
      }
      if (card.monthlyCashFlow <= 0) return [pass];
      if ((card.monthlyCashFlow * 1_000) / Math.max(1, card.downPayment) < WB_MIN_RETURN_PER_THOUSAND) return [pass];
      if (player.cash >= card.downPayment && free >= card.downPayment) return [{ type: 'BUY', playerId }, pass];
      if (state.game.mode !== 'standard') return [pass];
      // Borrow whatever the cash above the fund does not cover; worth it only when the deal pays more than the loan costs.
      const pays = roundUpToStep(card.downPayment - Math.min(player.cash, free));
      const bridge = free >= card.downPayment ? roundUpToStep(card.downPayment - player.cash) : 0;
      if (bridge > 0) return [{ type: 'BORROW', playerId, amount: bridge }, pass];
      if (pays > 0 && card.monthlyCashFlow > pct(pays, 10)) return [{ type: 'BORROW', playerId, amount: pays }, pass];
      return [pass];
    }

    case 'marketChoice':
      return marketMoves(state, player);

    case 'lifeChoice': {
      const card = CARDS_BY_ID.get(pending.cardId);
      if (card?.deck !== 'lifeChoices') return [];
      const options = card.options.filter((o) => state.game.mode === 'standard' || o.kidsOk);
      const best = cheapestOption({ ...card, options }, player);
      return [best, ...options].map((o) => ({ type: 'CHOOSE_LIFE_OPTION', playerId, optionId: o.id }));
    }

    case 'giveOrSkip':
      return free >= pct(player.cash, 10) ? [{ type: 'GIVE', playerId }, { type: 'SKIP_GIVE', playerId }] : [{ type: 'SKIP_GIVE', playerId }];
  }
}

const WB_MIN_RETURN_PER_THOUSAND = 20;
const WB_BIG_DEAL_CASH = 12_000;

/**
 * Big Spender (spec v2, Engineering practices): takes the most expensive Life
 * Choices option, borrowing for it when cash is short, and buys deals only
 * with the cash left over after a month of spending money, never borrowing
 * for them. Never repays a loan early and never saves in savings or CDs.
 */
function bigSpender(state: GameState): readonly Action[] {
  const player = currentPlayer(state);
  const playerId = player.id;
  const pending = state.pending;
  const leftover = Math.max(0, player.cash - totalExpenses(player));
  const pass: Action = { type: 'PASS', playerId };

  switch (pending.kind) {
    case 'none':
      return hasRolledThisTurn(state) ? [{ type: 'END_TURN', playerId }] : [{ type: 'ROLL', playerId }];

    case 'chooseDealSize':
      return [{ type: 'CHOOSE_DEAL_SIZE', playerId, size: leftover >= 20_000 ? 'big' : 'small' }];

    case 'buyOrPass': {
      const card = CARDS_BY_ID.get(pending.cardId);
      if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') return [pass];
      if (card.type === 'stock') return stockMoves(player, card.id, pending.sharePrice, leftover, () => true);
      if (isGrowthAssetType(card.type)) {
        const spare = Math.floor(leftover / INVEST_STEP) * INVEST_STEP;
        return card.type === 'index' && spare >= card.price ? [{ type: 'BUY', playerId, amount: spare }, pass] : [pass];
      }
      return card.monthlyCashFlow > 0 && leftover >= card.downPayment ? [{ type: 'BUY', playerId }, pass] : [pass];
    }

    case 'marketChoice':
      return marketMoves(state, player);

    case 'lifeChoice': {
      const card = CARDS_BY_ID.get(pending.cardId);
      if (card?.deck !== 'lifeChoices') return [];
      const standard = state.game.mode === 'standard';
      const options = card.options.filter((o) => standard || o.kidsOk);
      const ranked = [...options].sort((a, b) => {
        const ca = optionCost(a, player);
        const cb = optionCost(b, player);
        return cb.monthlyChange - ca.monthlyChange || cb.costToday - ca.costToday;
      });
      const top = priciestOption({ ...card, options }, player);
      const short = optionCost(top, player).costToday - player.cash;
      const moves: Action[] = [];
      if (standard && short > 0) moves.push({ type: 'BORROW', playerId, amount: roundUpToStep(short) });
      for (const o of [top, ...ranked]) moves.push({ type: 'CHOOSE_LIFE_OPTION', playerId, optionId: o.id });
      return moves;
    }

    case 'giveOrSkip':
      return player.cash >= 500 ? [{ type: 'GIVE', playerId }, { type: 'SKIP_GIVE', playerId }] : [{ type: 'SKIP_GIVE', playerId }];
  }
}

/** The percent a card's single buyout offer pays, or undefined when the card is not a pure offer. */
function buyoutOffer(card: MarketCard): number | undefined {
  if (!card.effects.every((e) => e.kind === 'offerBuyout')) return undefined;
  const first = card.effects[0];
  return first?.kind === 'offerBuyout' ? first.percentOfPurchasePrice : undefined;
}
