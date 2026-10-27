// Spec v2, The debrief: the structured data debrief(state, playerId,
// readingLevel) returns for one player. The engine computes every number from
// the final state and the log; the templates in debriefText.ts turn it into
// words and never compute anything.

import type { PrincipleId } from './principles';

/** How a game ended (the gameEnded event's reason). */
export type GameEndReason = 'escape' | 'roundLimit' | 'lastStanding';
/** What a bank loan's cash was for (the borrowed event's purpose). */
export type LoanPurpose = 'asset' | 'want' | 'setback' | 'none';

export const READING_LEVELS = ['kids', 'adult'] as const;
export type ReadingLevel = (typeof READING_LEVELS)[number];

/** One row of the spec's attribution table. */
export const DECISION_KINDS = ['lifeChoice', 'passedDeal', 'boughtDeal', 'bankLoan', 'setbackLoan', 'subscription', 'growthHeld', 'gave'] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

/** Helped and hurt follow the sign of the impact; neutral rows (a loan for an asset, a zero impact) appear in no list. */
export type Verdict = 'helped' | 'hurt' | 'neutral';

export interface DebriefDecision {
  /** Stable within one debrief: `${kind}:${logIndex}:${eventIndex}`. */
  readonly id: string;
  readonly kind: DecisionKind;
  /** Where the decision is in state.game.log: the entry, and the event inside it that records the decision. */
  readonly logIndex: number;
  readonly eventIndex: number;
  /** The round the decision was made in, from the player's latest paydaySnapshot before it. */
  readonly roundNumber: number;
  readonly principles: readonly PrincipleId[];
  /** Signed dollar impact from the spec's attribution table. Rounded to $10 at the kids reading level. */
  readonly impact: number;
  /** The impact without its sign, so templates never compute. */
  readonly dollars: number;
  readonly verdict: Verdict;
  /** The player's Paydays the decision kept paying or costing. */
  readonly paydays: number;
  readonly cardId?: string;
  readonly optionId?: string;
  /** Life Choices only: the cheapest option on the card, which a hurt choice is measured against. */
  readonly cheapestOptionId?: string;
  readonly assetId?: string;
  readonly liabilityId?: string;
  /** Bank loans: what the cash was for. */
  readonly purpose?: LoanPurpose;
  /** The monthly number behind the row: a deal's or asset's cash flow, a loan payment, a subscription cost, a Life Choices monthly difference. */
  readonly monthly?: number;
  /** Bought deals and growth assets: true when the asset was sold before the game ended. */
  readonly sold?: boolean;
}

export interface DebriefSuggestion {
  /** The hurt decision this suggestion is built from. */
  readonly decisionId: string;
  readonly kind: DecisionKind;
  readonly principle: PrincipleId;
  /** Dollars the other choice would have kept. */
  readonly dollars: number;
  /** The monthly difference the other choice would have made (0 when it was a one-time cost). */
  readonly monthly: number;
  /** Spec: floor(monthly difference × 100 / final totalExpenses). */
  readonly freedomPoints: number;
  readonly cardId?: string;
  /** Life Choices only: the option that would have been cheaper. */
  readonly betterOptionId?: string;
}

export type DebriefOutcome = 'escaped' | 'won' | 'lost' | 'out' | 'inProgress';

export interface DebriefResult {
  readonly outcome: DebriefOutcome;
  /** How the game ended, when it has. */
  readonly endReason?: GameEndReason;
  /** 1 is first. Players who went out rank after everyone still in, latest out first. */
  readonly rank: number;
  readonly players: number;
  readonly freedomPercent: number;
  readonly passiveIncome: number;
  readonly totalExpenses: number;
  /** A player who went out: the round they ran out of money. */
  readonly roundOut?: number;
}

export interface MoneyStoryPoint {
  readonly roundNumber: number;
  readonly passiveIncome: number;
  readonly totalExpenses: number;
  /**
   * The last point of a finished game, from the final state rather than a
   * Payday: an escape happens at END_TURN, after the month's Payday, so
   * without it the chart would stop short of the crossing.
   */
  readonly endOfGame?: true;
}

export interface Debrief {
  readonly playerId: string;
  readonly readingLevel: ReadingLevel;
  readonly result: DebriefResult;
  /** Why you won or lost: the three helped or hurt decisions with the largest absolute impact. */
  readonly drivers: readonly DebriefDecision[];
  /** Up to three, positive impact, largest first. */
  readonly helped: readonly DebriefDecision[];
  /** Up to three, negative impact, largest first. Winners see these too. */
  readonly hurt: readonly DebriefDecision[];
  /** Up to two, from the largest hurt decisions. */
  readonly suggestions: readonly DebriefSuggestion[];
  /** passiveIncome and totalExpenses at every one of the player's paydaySnapshot events, plus an end-of-game point when the game is finished. */
  readonly moneyStory: readonly MoneyStoryPoint[];
  /** The round of the first snapshot where passiveIncome reached totalExpenses, if any. */
  readonly crossedRound?: number;
  /** Each principle tagged on at least one helped decision, in P1 to P10 order. */
  readonly principlesPracticed: readonly PrincipleId[];
}
