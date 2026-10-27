import { z } from 'zod';

import { PlayerIdSchema } from './actions';
import { CardIdSchema, LifeOptionIdSchema } from './cards';
import { MoneySchema, SignedMoneySchema } from './money';
import { PrincipleIdSchema, PrinciplesSchema } from './principles';
import { ProfessionIdSchema } from './professions';
import type { DeepReadonly } from './readonly';

// Spec v2, The debrief: the structured data `debrief(state, playerId,
// readingLevel)` returns for one player at the end of the game. The engine
// computes every number; the templates in debriefText.ts only fill them in.
// Every dollar figure is whole dollars, so the schemas below use the money
// schemas and parsing a debrief proves it.

export const READING_LEVELS = ['kids', 'adult'] as const;
export const ReadingLevelSchema = z.enum(READING_LEVELS);
export type ReadingLevel = z.infer<typeof ReadingLevelSchema>;

/** One event in the game log: `state.game.log[entry].events[event]`. Every debrief line points at the event it came from. */
export const LogRefSchema = z.object({ entry: z.number().int().nonnegative(), event: z.number().int().nonnegative() }).strict();
export type LogRef = DeepReadonly<z.infer<typeof LogRefSchema>>;

export const DEBRIEF_DECISION_KINDS = [
  'lifeChoice',
  'passedDeal',
  'boughtDeal',
  'bankLoan',
  'setbackLoan',
  'subscription',
  'growthAsset',
  'gave',
] as const;
export type DebriefDecisionKind = (typeof DEBRIEF_DECISION_KINDS)[number];

const decisionBase = {
  /** The log event the decision comes from. */
  ref: LogRefSchema,
  outcome: z.enum(['helped', 'hurt']),
  /** Signed dollar impact from the spec's attribution table: above 0 helped, below 0 hurt. */
  impact: SignedMoneySchema,
  /** The impact without its sign, for templates that say "earned" or "cost". */
  dollars: MoneySchema,
  principles: PrinciplesSchema,
  /** The round the decision was made in. */
  round: z.number().int().positive(),
  /**
   * Paydays the decision counted over: Paydays afterward for a Life Choices
   * option or a passed deal, Paydays held for an asset, Paydays a loan was
   * paid or a subscription ran. 0 for a gift.
   */
  months: z.number().int().nonnegative(),
};

export const DebriefDecisionSchema = z.discriminatedUnion('kind', [
  /**
   * A Life Choices option, compared with `otherOptionId`: the cheapest option
   * when another was chosen, the priciest when the cheapest was chosen.
   * impact = todayDifference + monthlyDifference × months, each difference
   * being the other option's number minus the chosen one's.
   */
  z
    .object({
      kind: z.literal('lifeChoice'),
      ...decisionBase,
      cardId: CardIdSchema,
      optionId: LifeOptionIdSchema,
      otherOptionId: LifeOptionIdSchema,
      todayDifference: SignedMoneySchema,
      monthlyDifference: SignedMoneySchema,
    })
    .strict(),
  /** An affordable deal with positive cash flow, passed: monthlyCashFlow × months, as a negative. */
  z.object({ kind: z.literal('passedDeal'), ...decisionBase, cardId: CardIdSchema, monthlyCashFlow: SignedMoneySchema }).strict(),
  /** A rental, business, land, or stock lot: cash flow received while held, plus the sale result once sold. */
  z
    .object({
      kind: z.literal('boughtDeal'),
      ...decisionBase,
      cardId: CardIdSchema,
      /** Cash paid: the down payment, or shares × share price. */
      cost: MoneySchema,
      cashFlowReceived: SignedMoneySchema,
      /** What the sales kept after any mortgage, minus the cash paid for what was sold. Absent while the whole asset is held. */
      saleResult: SignedMoneySchema.optional(),
    })
    .strict(),
  /** A bank loan taken with BORROW for a want, or with nothing pending: the payments made. A loan for an asset is neutral and never listed. */
  z
    .object({
      kind: z.literal('bankLoan'),
      ...decisionBase,
      purpose: z.enum(['want', 'none']),
      amount: MoneySchema,
      monthlyPayment: MoneySchema,
    })
    .strict(),
  /** A loan a Setback forced: the payments made on it. */
  z
    .object({ kind: z.literal('setbackLoan'), ...decisionBase, cardId: CardIdSchema, amount: MoneySchema, monthlyPayment: MoneySchema })
    .strict(),
  /** A subscription from a Life Choices option: monthlyCost × the Paydays it ran. */
  z
    .object({
      kind: z.literal('subscription'),
      ...decisionBase,
      cardId: CardIdSchema,
      optionId: LifeOptionIdSchema,
      monthlyCost: MoneySchema,
      cancelled: z.boolean(),
    })
    .strict(),
  /** A savings account, CD, or index fund (from a deal or a windfall): value gained plus payouts received. */
  z
    .object({
      kind: z.literal('growthAsset'),
      ...decisionBase,
      cardId: CardIdSchema,
      invested: MoneySchema,
      /** Final marketValue, or the sale price once sold, minus the amount invested. */
      valueGained: SignedMoneySchema,
      payouts: MoneySchema,
      sold: z.boolean(),
    })
    .strict(),
  /** A gift on a Giving space, or cash an option tagged Generosity gave away. Always helped. */
  z
    .object({ kind: z.literal('gave'), ...decisionBase, cardId: CardIdSchema.optional(), optionId: LifeOptionIdSchema.optional() })
    .strict(),
]);
export type DebriefDecision = DeepReadonly<z.infer<typeof DebriefDecisionSchema>>;

/**
 * Next time, try: built from one hurt decision. freedomPoints =
 * floor(monthly × 100 / final totalExpenses) (spec, The debrief), 0 when the
 * decision had no monthly difference.
 */
export const DebriefSuggestionSchema = z
  .object({
    decision: DebriefDecisionSchema,
    /** The principle whose template words the suggestion. */
    principle: PrincipleIdSchema,
    dollars: MoneySchema,
    /** The monthly difference the Freedom points come from. */
    monthly: MoneySchema,
    freedomPoints: z.number().int().nonnegative(),
  })
  .strict();
export type DebriefSuggestion = DeepReadonly<z.infer<typeof DebriefSuggestionSchema>>;

export const DebriefResultSchema = z
  .object({
    playerId: PlayerIdSchema,
    professionId: ProfessionIdSchema,
    freedomPercent: z.number().int(),
    passiveIncome: SignedMoneySchema,
    totalExpenses: MoneySchema,
    won: z.boolean(),
    escaped: z.boolean(),
    /** 1 for the winner. Absent for a player who went out. */
    place: z.number().int().positive().optional(),
    players: z.number().int().positive(),
    /** How the game ended. Absent while it is still being played. */
    ending: z.enum(['escape', 'roundLimit', 'lastStanding']).optional(),
    /** The round the game was in when it ended. */
    rounds: z.number().int().positive(),
    /** The round the player ran out of money, when they went out. */
    wentOutRound: z.number().int().positive().optional(),
  })
  .strict();
export type DebriefResult = DeepReadonly<z.infer<typeof DebriefResultSchema>>;

export const MoneyStoryPointSchema = z
  .object({ ref: LogRefSchema, round: z.number().int().positive(), passiveIncome: SignedMoneySchema, totalExpenses: MoneySchema })
  .strict();
export type MoneyStoryPoint = DeepReadonly<z.infer<typeof MoneyStoryPointSchema>>;

export const MoneyStorySchema = z
  .object({
    /** passiveIncome and totalExpenses at every one of the player's paydaySnapshot events. */
    points: z.array(MoneyStoryPointSchema),
    /** The same two numbers when the game ended, after the last Payday's decisions. */
    final: z.object({ passiveIncome: SignedMoneySchema, totalExpenses: MoneySchema }).strict(),
    /** The first round passiveIncome reached totalExpenses: where the lines cross. */
    freedomRound: z.number().int().positive().optional(),
  })
  .strict();
export type MoneyStory = DeepReadonly<z.infer<typeof MoneyStorySchema>>;

export const DebriefSchema = z
  .object({
    readingLevel: ReadingLevelSchema,
    result: DebriefResultSchema,
    /** Why you won or lost: the three decisions with the largest absolute dollar impact. */
    drivers: z.array(DebriefDecisionSchema).max(3),
    helped: z.array(DebriefDecisionSchema).max(3),
    hurt: z.array(DebriefDecisionSchema).max(3),
    suggestions: z.array(DebriefSuggestionSchema).max(2),
    moneyStory: MoneyStorySchema,
    /** Each principle tagged on at least one helped decision, in P1 to P10 order. */
    principlesPracticed: z.array(PrincipleIdSchema),
  })
  .strict();
export type Debrief = DeepReadonly<z.infer<typeof DebriefSchema>>;
