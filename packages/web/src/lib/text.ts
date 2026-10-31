// Words for the screen. Formatting only: every number here comes from the
// engine (state, selectors, or log events). Nothing here decides a rule.

import type { EngineError } from '@ff/engine';
import {
  CARDS_BY_ID,
  formatMoney,
  formatSignedMoney,
  PROFESSIONS,
  type Asset,
  type Card,
  type GameMode,
  type GameState,
  type Liability,
  type LogEvent,
  type SpaceKind,
} from '@ff/shared';

export const SPACE_LABEL: Readonly<Record<SpaceKind, string>> = {
  opportunity: 'Opportunity',
  lifeChoices: 'Life Choices',
  market: 'Market',
  giving: 'Giving',
  setback: 'Setback',
};

/** Phone-width labels; the full name stays in the space's accessible name. */
export const SPACE_SHORT: Readonly<Record<SpaceKind, string>> = {
  opportunity: 'Deal',
  lifeChoices: 'Life',
  market: 'Mkt',
  giving: 'Give',
  setback: 'Oops',
};

export const SPACE_STYLE: Readonly<Record<SpaceKind, string>> = {
  opportunity: 'bg-emerald-50 border-emerald-700',
  lifeChoices: 'bg-amber-50 border-amber-700',
  market: 'bg-sky-50 border-sky-700',
  giving: 'bg-violet-50 border-violet-700',
  setback: 'bg-rose-50 border-rose-700',
};

/** Token colors for up to six seats, each with a letter so color is never the only cue. */
export const SEAT_COLORS = ['#0b5c8a', '#b42318', '#15703a', '#7a3db8', '#a15c00', '#1f2328'] as const;

export function seatColor(index: number): string {
  return SEAT_COLORS[index % SEAT_COLORS.length] ?? '#1f2328';
}

export function card(cardId: string): Card {
  const found = CARDS_BY_ID.get(cardId);
  if (found === undefined) throw new Error(`unknown card "${cardId}"`);
  return found;
}

export function cardText(c: { readonly kidsText: string; readonly adultText: string }, mode: GameMode): string {
  return mode === 'kids' ? c.kidsText : c.adultText;
}

export function professionName(professionId: string): string {
  return PROFESSIONS.find((p) => p.id === professionId)?.name ?? professionId;
}

const ASSET_TYPE_LABEL: Readonly<Record<Asset['type'], string>> = {
  rental: 'Rental',
  business: 'Business',
  land: 'Land',
  stock: 'Stock',
  savings: 'Savings',
  cd: 'CD',
  index: 'Index fund',
};

export function assetName(asset: Asset): string {
  const c = CARDS_BY_ID.get(asset.cardId);
  const title = c === undefined ? asset.cardId : c.title;
  const fromWindfall = c?.deck === 'lifeChoices';
  return fromWindfall ? `${ASSET_TYPE_LABEL[asset.type]} (from ${title})` : title;
}

export function assetTypeLabel(asset: Asset): string {
  return ASSET_TYPE_LABEL[asset.type];
}

const LIABILITY_LABEL: Readonly<Record<Liability['kind'], string>> = {
  student: 'Student loan',
  car: 'Car loan',
  credit: 'Credit card',
  mortgage: 'Mortgage',
  bank: 'Bank loan',
  lifestyle: 'Lifestyle loan',
  subscription: 'Subscription',
};

export function liabilityName(liability: Liability): string {
  const label = LIABILITY_LABEL[liability.kind];
  if (liability.sourceCardId === undefined) return label;
  const c = CARDS_BY_ID.get(liability.sourceCardId);
  return c === undefined ? label : `${label}: ${c.title}`;
}

export const ERROR_TEXT: Readonly<Record<EngineError, string>> = {
  NOT_YOUR_TURN: 'It is not your turn.',
  INVALID_FOR_PENDING: 'Finish the open decision first.',
  INSUFFICIENT_CASH: 'Not enough cash for that.',
  INVALID_SHARES: 'That number of shares is not allowed.',
  INVALID_AMOUNT: 'That amount is not allowed.',
  INVALID_LIABILITY: 'That loan cannot be repaid.',
  INVALID_OPTION: 'That option is not available.',
  INVALID_ASSET: 'Pick which asset this applies to.',
  MARKET_EFFECT_MANDATORY: 'This market card must be accepted.',
  NOT_ALLOWED_IN_KIDS_MODE: 'Not allowed in kids mode.',
  GAME_NOT_PLAYING: 'The game is over.',
  ALREADY_ROLLED: 'You already rolled this turn.',
  MUST_ROLL_FIRST: 'Roll first.',
  NOT_IMPLEMENTED: 'That is not built yet.',
};

function playerName(state: GameState, playerId: string): string {
  return state.players.find((p) => p.id === playerId)?.name ?? playerId;
}

function assetLabel(state: GameState, actorId: string, assetId: string, cardId?: string): string {
  const owned = state.players.find((p) => p.id === actorId)?.assets.find((a) => a.id === assetId);
  if (owned !== undefined) return assetName(owned);
  return cardId === undefined ? 'an asset' : (CARDS_BY_ID.get(cardId)?.title ?? 'an asset');
}

/**
 * One line per log event, or null for events that only matter to the debrief
 * (snapshots) or that another line already says.
 */
export function describeEvent(state: GameState, actorId: string, event: LogEvent): string | null {
  switch (event.kind) {
    case 'payday':
      return `Payday: ${formatSignedMoney(event.amount)} this month.`;
    case 'paydaySnapshot':
    case 'cashChanged':
    case 'sharePriceRolled':
      return null;
    case 'rolled':
      return `Rolled a ${String(event.value)}.`;
    case 'moved':
      return null;
    case 'drewCard':
      return `Drew "${card(event.cardId).title}".`;
    case 'roundCompleted':
      return `Month ${String(event.round)} is complete.`;
    case 'gameEnded':
      return event.reason === 'escape'
        ? `${playerName(state, event.winnerId)} escaped the rat race and wins!`
        : event.reason === 'roundLimit'
          ? `Time is up. ${playerName(state, event.winnerId)} wins with the highest Freedom.`
          : `${playerName(state, event.winnerId)} is the last player standing.`;
    case 'passed':
      return `Passed on "${card(event.cardId).title}".`;
    case 'declinedMarket':
      return `Declined "${card(event.cardId).title}".`;
    case 'borrowed':
      return event.purpose === 'setback'
        ? `Had to borrow ${formatMoney(event.amount)} from the bank (${formatMoney(event.monthlyPayment)}/mo).`
        : `Borrowed ${formatMoney(event.amount)} from the bank (${formatMoney(event.monthlyPayment)}/mo).`;
    case 'repaid':
      return event.principal === 0 ? 'Cancelled a subscription.' : `Paid off a loan of ${formatMoney(event.principal)}.`;
    case 'choseLifeOption': {
      const c = card(event.cardId);
      const option = c.deck === 'lifeChoices' ? c.options.find((o) => o.id === event.optionId) : undefined;
      return `Chose "${option?.label ?? event.optionId}" on "${c.title}".`;
    }
    case 'loanAdded':
      return `New loan: ${formatMoney(event.principal)} at ${formatMoney(event.monthlyPayment)}/mo.`;
    case 'subscriptionAdded':
      return `New subscription: ${formatMoney(event.monthlyCost)}/mo.`;
    case 'paidDown':
      return `Paid ${formatMoney(event.amount)} off a loan.`;
    case 'bought':
      return `Bought "${card(event.cardId).title}" for ${formatMoney(event.cost)}${event.shares === undefined ? '' : ` (${String(event.shares)} shares)`}.`;
    case 'sold':
      return `Sold ${assetLabel(state, actorId, event.assetId, event.cardId)} for ${formatMoney(event.proceeds)}${event.mortgagePaid === undefined ? '' : `, ${formatMoney(event.mortgagePaid)} went to the mortgage`}.`;
    case 'cashFlowChanged':
      return `${assetLabel(state, actorId, event.assetId)} cash flow changed by ${formatSignedMoney(event.delta)}/mo.`;
    case 'valueChanged':
      return null;
    case 'sharesSplit':
      return `Stock split ${String(event.ratio)} for 1: now ${String(event.shares)} shares.`;
    case 'gave':
      return `Gave ${formatMoney(event.amount)} and earned a Favor token.`;
    case 'skippedGive':
      return 'Skipped giving.';
    case 'setback':
      return `Setback "${card(event.cardId).title}": paid ${formatMoney(event.cost)}${event.skipsNextTurn ? ', and skips the next turn' : ''}.`;
    case 'wentOut':
      return 'Ran out of money and is out of the game.';
    case 'turnSkipped':
      return `${playerName(state, event.playerId)} sits out this turn.`;
  }
}
