// Derived values. Nothing here is ever stored on state (CLAUDE.md, Rule 2).

import {
  isGrowthAsset,
  LIABILITY_PAYMENT_PERCENT,
  PROFESSIONS,
  type Asset,
  type GameState,
  type Liability,
  type LifeChoicesCard,
  type LifeEffect,
  type LifeOption,
  type Player,
  type Profession,
} from '@ff/shared';

import { pct } from './money';

export function professionOf(player: Player): Profession {
  const profession = PROFESSIONS.find((p) => p.id === player.professionId);
  if (profession === undefined) {
    throw new Error(`unknown professionId "${player.professionId}" on player "${player.id}"`);
  }
  return profession;
}

/**
 * What one asset pays per month. A growth asset's cash flow is derived from
 * its marketValue (spec v2, Growth assets: pct(marketValue, payoutPercent));
 * every other asset stores its monthlyCashFlow because Market cards change it.
 */
export function assetCashFlow(asset: Asset): number {
  return isGrowthAsset(asset) ? pct(asset.marketValue, asset.payoutPercent) : asset.monthlyCashFlow;
}

/** Sum of asset cash flow. */
export function passiveIncome(player: Player): number {
  return player.assets.reduce((sum, a) => sum + assetCashFlow(a), 0);
}

/** Sum of liability monthlyPayment. */
export function debtPayments(player: Player): number {
  return player.liabilities.reduce((sum, l) => sum + l.monthlyPayment, 0);
}

/** Profession baseExpenses plus debtPayments. */
export function totalExpenses(player: Player): number {
  return professionOf(player).baseExpenses + debtPayments(player);
}

/** What one Payday credits: salary + passiveIncome − totalExpenses. May be negative. */
export function monthlyCashFlow(player: Player): number {
  return player.salary + passiveIncome(player) - totalExpenses(player);
}

/** The win condition: passive income covers every monthly cost. */
export function canEscape(player: Player): boolean {
  return passiveIncome(player) >= totalExpenses(player);
}

export function playerById(state: GameState, playerId: string): Player {
  const player = state.players.find((p) => p.id === playerId);
  if (player === undefined) {
    throw new Error(`unknown playerId "${playerId}"`);
  }
  return player;
}

export function currentPlayer(state: GameState): Player {
  return playerById(state, state.game.currentPlayerId);
}

/** True once the log holds an accepted ROLL for the current turn. Derived from the log, not stored. */
export function hasRolledThisTurn(state: GameState): boolean {
  const turn = state.game.turnNumber;
  for (let i = state.game.log.length - 1; i >= 0; i--) {
    const entry = state.game.log[i];
    if (entry?.turnNumber !== turn) break;
    if (entry.action.type === 'ROLL') return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Life Choices (spec v2, Life Choices cards)
// ---------------------------------------------------------------------------

/**
 * The loan a windfall's repayLargestLoan pays: the player's highest
 * monthlyPayment, ties to the highest principal, then holding order. Never a
 * mortgage (retired only by sale) or a subscription (no principal to pay).
 */
export function largestLoan(player: Player): Liability | undefined {
  let best: Liability | undefined;
  for (const l of player.liabilities) {
    if (l.kind === 'mortgage' || l.kind === 'subscription') continue;
    if (best === undefined || l.monthlyPayment > best.monthlyPayment || (l.monthlyPayment === best.monthlyPayment && l.principal > best.principal)) {
      best = l;
    }
  }
  return best;
}

/**
 * What one payment of `amount` does to a loan. A card loan (one with a
 * sourceCardId) keeps its stated payment while the principal shrinks; a
 * percent-based loan has its payment recomputed from the new principal.
 */
export function paidDown(loan: Liability, amount: number): { readonly paid: number; readonly principal: number; readonly monthlyPayment: number } {
  const paid = Math.min(amount, loan.principal);
  const principal = loan.principal - paid;
  if (principal === 0) return { paid, principal, monthlyPayment: 0 };
  const percent = loan.sourceCardId === undefined && loan.kind !== 'lifestyle' && loan.kind !== 'subscription' ? LIABILITY_PAYMENT_PERCENT[loan.kind] : undefined;
  return { paid, principal, monthlyPayment: percent === undefined ? loan.monthlyPayment : pct(principal, percent) };
}

export interface OptionCost {
  /** Cash out today; cash in (a windfall) is negative. */
  readonly costToday: number;
  /** Change to the player's monthly costs: a loan or subscription raises it, an investment's payout or a paid-down loan lowers it. */
  readonly monthlyChange: number;
}

/** The two numbers shown for one effect, for `player` as they stand. */
function effectCost(effect: LifeEffect, player: Player): OptionCost {
  switch (effect.kind) {
    case 'payCash':
      return { costToday: effect.amount, monthlyChange: 0 };
    case 'gainCash':
      return { costToday: -effect.amount, monthlyChange: 0 };
    case 'addLoan':
      return { costToday: 0, monthlyChange: effect.monthlyPayment };
    case 'addSubscription':
      return { costToday: 0, monthlyChange: effect.monthlyCost };
    case 'investGrowth':
      return { costToday: effect.amount, monthlyChange: -pct(effect.amount, effect.payoutPercent) };
    case 'repayLargestLoan': {
      const loan = largestLoan(player);
      if (loan === undefined) return { costToday: 0, monthlyChange: 0 };
      const after = paidDown(loan, effect.amount);
      return { costToday: after.paid, monthlyChange: after.monthlyPayment - loan.monthlyPayment };
    }
  }
}

/**
 * Spec v2, Life Choices cards: every option shows two derived numbers,
 * costToday and monthlyChange, so the UI never does math. Effects add up.
 */
export function optionCost(option: LifeOption, player: Player): OptionCost {
  return option.effects.reduce<OptionCost>(
    (sum, effect) => {
      const cost = effectCost(effect, player);
      return { costToday: sum.costToday + cost.costToday, monthlyChange: sum.monthlyChange + cost.monthlyChange };
    },
    { costToday: 0, monthlyChange: 0 },
  );
}

/** Lowest monthlyChange, then lowest costToday; ties keep card order (spec, Decision log). */
export function cheapestOption(card: LifeChoicesCard, player: Player): LifeOption {
  return rankOptions(card, player, (a, b) => a.monthlyChange - b.monthlyChange || a.costToday - b.costToday);
}

/** Highest monthlyChange, then highest costToday; ties keep card order. */
export function priciestOption(card: LifeChoicesCard, player: Player): LifeOption {
  return rankOptions(card, player, (a, b) => b.monthlyChange - a.monthlyChange || b.costToday - a.costToday);
}

function rankOptions(card: LifeChoicesCard, player: Player, compare: (a: OptionCost, b: OptionCost) => number): LifeOption {
  let best: { readonly option: LifeOption; readonly cost: OptionCost } | undefined;
  for (const option of card.options) {
    const cost = optionCost(option, player);
    if (best === undefined || compare(cost, best.cost) < 0) best = { option, cost };
  }
  if (best === undefined) throw new Error(`Life Choices card "${card.id}" has no options`);
  return best.option;
}
