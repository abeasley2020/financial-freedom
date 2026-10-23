import { z } from 'zod';

import { ActionSchema, AssetIdSchema, LiabilityIdSchema, PlayerIdSchema } from './actions';
import { BOARD_SIZE } from './board';
import { CardIdSchema, DECK_IDS, DeckIdSchema, GROWTH_ASSET_TYPES, GrowthAssetTypeSchema, LIFE_LOAN_KINDS, LifeOptionIdSchema } from './cards';
import { MoneySchema, PercentSchema, SignedMoneySchema } from './money';
import { PrinciplesSchema } from './principles';
import { LiabilityKindSchema, ProfessionIdSchema } from './professions';
import type { DeepReadonly } from './readonly';

export { BOARD_SIZE };

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

// ---------------------------------------------------------------------------
// Player holdings. Facts only; see CLAUDE.md Rule 2 for what is derived.
// ---------------------------------------------------------------------------

const assetBase = {
  /** One asset per BUY. A stock bought twice is two lots with different ids. */
  id: AssetIdSchema,
  /** The card this asset came from: a deal card, or the Life Choices card whose windfall was invested. */
  cardId: CardIdSchema,
  /** What the player agreed to pay in total (down payment plus mortgage; shares × sharePrice for a stock; the amount invested for a growth asset). Market offers are a percent of this. */
  purchasePrice: MoneySchema,
  /** Cash paid at purchase. */
  downPaid: MoneySchema,
};

/** A rental, business, land, or the v1 fund: its cash flow is stored because Market cards change it. */
export const PropertyAssetSchema = z
  .object({
    ...assetBase,
    type: z.enum(['rental', 'business', 'land', 'fund']),
    /** Stored, not copied from the card, because Market cards change it. */
    monthlyCashFlow: SignedMoneySchema,
  })
  .strict();

/** One lot of a stock. Its cash flow is floor(shares × dividendPerShare), stored at purchase. */
export const StockAssetSchema = z
  .object({
    ...assetBase,
    type: z.literal('stock'),
    monthlyCashFlow: SignedMoneySchema,
    shares: z.number().int().positive(),
  })
  .strict();

/**
 * Spec v2, Growth assets: savings, CDs, and index funds. marketValue grows by
 * growthPercent at every Payday; the monthly cash flow is derived from it as
 * pct(marketValue, payoutPercent) and never stored (CLAUDE.md, Rule 2).
 */
export const GrowthAssetSchema = z
  .object({
    ...assetBase,
    type: GrowthAssetTypeSchema,
    /** Starts at the amount invested. Never below 0. */
    marketValue: MoneySchema,
    growthPercent: PercentSchema,
    payoutPercent: PercentSchema,
  })
  .strict();

export const AssetSchema = z.union([PropertyAssetSchema, StockAssetSchema, GrowthAssetSchema]);
export type Asset = DeepReadonly<z.infer<typeof AssetSchema>>;
export type GrowthAsset = DeepReadonly<z.infer<typeof GrowthAssetSchema>>;
export type StockAsset = DeepReadonly<z.infer<typeof StockAssetSchema>>;

export function isGrowthAsset(asset: Asset): asset is GrowthAsset {
  return (GROWTH_ASSET_TYPES as readonly string[]).includes(asset.type);
}

export const LiabilitySchema = z
  .object({
    /** Stable handle so REPAY can name one loan among several of the same kind. */
    id: LiabilityIdSchema,
    kind: LiabilityKindSchema,
    principal: MoneySchema,
    /** Stored because card loans and subscriptions take their payment from the option, not from a percent. Always 0 for a mortgage. */
    monthlyPayment: MoneySchema,
    /** The Life Choices card that created a lifestyle loan, a card car loan, or a subscription. */
    sourceCardId: CardIdSchema.optional(),
    /** Mortgages only: the asset this loan finances. Paid off first from that asset's sale proceeds. */
    assetId: AssetIdSchema.optional(),
  })
  .strict()
  .superRefine((liability, ctx) => {
    const fromCardOnly = liability.kind === 'lifestyle' || liability.kind === 'subscription';
    const mayBeFromCard = fromCardOnly || (LIFE_LOAN_KINDS as readonly string[]).includes(liability.kind);
    if (fromCardOnly && liability.sourceCardId === undefined) {
      ctx.addIssue({ code: 'custom', message: `a ${liability.kind} liability needs sourceCardId`, path: ['sourceCardId'] });
    }
    if (!mayBeFromCard && liability.sourceCardId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'only a lifestyle, subscription, or car liability may carry sourceCardId',
        path: ['sourceCardId'],
      });
    }
    if (liability.kind === 'subscription' && liability.principal !== 0) {
      ctx.addIssue({ code: 'custom', message: 'a subscription has principal 0: REPAY cancels it at no cost', path: ['principal'] });
    }
    const isMortgage = liability.kind === 'mortgage';
    if (isMortgage && liability.assetId === undefined) {
      ctx.addIssue({ code: 'custom', message: 'a mortgage needs assetId', path: ['assetId'] });
    }
    if (isMortgage && liability.monthlyPayment !== 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'a mortgage has monthlyPayment 0: the deal card cash flow is already net of it',
        path: ['monthlyPayment'],
      });
    }
    if (!isMortgage && liability.assetId !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'only a mortgage may carry assetId', path: ['assetId'] });
    }
  });
export type Liability = DeepReadonly<z.infer<typeof LiabilitySchema>>;

export const PlayerSchema = z
  .object({
    id: PlayerIdSchema,
    name: z.string().min(1),
    professionId: ProfessionIdSchema,
    /** Index into the board, 0-based. */
    position: z.number().int().min(0).max(BOARD_SIZE - 1),
    cash: MoneySchema,
    /** Monthly salary. Stored because Setback cards can change it. */
    salary: MoneySchema,
    assets: z.array(AssetSchema),
    liabilities: z.array(LiabilitySchema),
    favorTokens: z.number().int().nonnegative(),
    /** Bankrupt and removed from play. Set once; never cleared. */
    isOut: z.boolean(),
    /** Escaped the Grind. Set once; never cleared even if passive income later falls. */
    hasEscaped: z.boolean(),
    /** A Setback made this player sit out their next turn. Cleared when END_TURN passes over them. */
    skipsNextTurn: z.boolean(),
  })
  .strict();
export type Player = DeepReadonly<z.infer<typeof PlayerSchema>>;

// ---------------------------------------------------------------------------
// Decks, pending decision, log
// ---------------------------------------------------------------------------

export const DeckPilesSchema = z
  .object({
    drawPile: z.array(CardIdSchema),
    discardPile: z.array(CardIdSchema),
  })
  .strict();
export type DeckPiles = DeepReadonly<z.infer<typeof DeckPilesSchema>>;

const deckShape = Object.fromEntries(DECK_IDS.map((deck) => [deck, DeckPilesSchema])) as Record<
  (typeof DECK_IDS)[number],
  typeof DeckPilesSchema
>;
export const DecksSchema = z.object(deckShape).strict();
export type Decks = DeepReadonly<z.infer<typeof DecksSchema>>;

/** The one decision the current player must make before the turn can advance. */
export const PendingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }).strict(),
  z.object({ kind: z.literal('chooseDealSize') }).strict(),
  /** `sharePrice` is set when the card is a stock: the price per share rolled inside the card's priceRange at draw time. */
  z.object({ kind: z.literal('buyOrPass'), cardId: CardIdSchema, sharePrice: MoneySchema.optional() }).strict(),
  z.object({ kind: z.literal('marketChoice'), cardId: CardIdSchema }).strict(),
  z.object({ kind: z.literal('lifeChoice'), cardId: CardIdSchema }).strict(),
  z.object({ kind: z.literal('giveOrSkip') }).strict(),
]);
export type Pending = DeepReadonly<z.infer<typeof PendingSchema>>;
export type PendingKind = Pending['kind'];

/** One Life Choices option's two derived numbers at decision time (spec, Life Choices cards). */
export const OptionNumbersSchema = z
  .object({ optionId: LifeOptionIdSchema, costToday: SignedMoneySchema, monthlyChange: SignedMoneySchema })
  .strict();
export type OptionNumbers = DeepReadonly<z.infer<typeof OptionNumbersSchema>>;

/** What an accepted action did, for the scorecard and bug reports. Replay uses the action, not the events. */
export const LogEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rolled'), value: z.number().int().min(1).max(6) }).strict(),
  z.object({ kind: z.literal('moved'), from: z.number().int(), to: z.number().int() }).strict(),
  z.object({ kind: z.literal('payday'), amount: SignedMoneySchema }).strict(),
  /**
   * Spec, Decision log: the facts the debrief needs at every Payday, taken
   * after the credit. Carries playerId because END_TURN pays a skipped seat.
   */
  z
    .object({
      kind: z.literal('paydaySnapshot'),
      playerId: PlayerIdSchema,
      passiveIncome: SignedMoneySchema,
      totalExpenses: MoneySchema,
      cash: SignedMoneySchema,
    })
    .strict(),
  z.object({ kind: z.literal('drewCard'), deck: DeckIdSchema, cardId: CardIdSchema }).strict(),
  z.object({ kind: z.literal('sharePriceRolled'), cardId: CardIdSchema, sharePrice: MoneySchema }).strict(),
  /** A deal (or Market card) declined. Carries the card's principles (spec, Decision log). */
  z.object({ kind: z.literal('passed'), cardId: CardIdSchema, principles: PrinciplesSchema }).strict(),
  /** A bank loan, taken by BORROW (P5) or forced by a Setback (P1). */
  z
    .object({
      kind: z.literal('borrowed'),
      liabilityId: LiabilityIdSchema,
      amount: MoneySchema,
      monthlyPayment: MoneySchema,
      principles: PrinciplesSchema,
    })
    .strict(),
  z.object({ kind: z.literal('repaid'), liabilityId: LiabilityIdSchema, principal: MoneySchema, principles: PrinciplesSchema }).strict(),
  /**
   * Spec, Decision log: CHOOSE_LIFE_OPTION records the chosen option's two
   * numbers and the same two for the cheapest option on the card (lowest
   * monthlyChange, then lowest costToday). The priciest option is recorded
   * too so the debrief can say what choosing the cheapest option saved.
   */
  z
    .object({
      kind: z.literal('choseLifeOption'),
      cardId: CardIdSchema,
      optionId: LifeOptionIdSchema,
      principles: PrinciplesSchema,
      costToday: SignedMoneySchema,
      monthlyChange: SignedMoneySchema,
      cheapest: OptionNumbersSchema,
      priciest: OptionNumbersSchema,
    })
    .strict(),
  /** A car or lifestyle loan taken through a Life Choices option. */
  z
    .object({
      kind: z.literal('loanAdded'),
      liabilityId: LiabilityIdSchema,
      loanKind: z.enum(LIFE_LOAN_KINDS),
      principal: MoneySchema,
      monthlyPayment: MoneySchema,
    })
    .strict(),
  z.object({ kind: z.literal('subscriptionAdded'), liabilityId: LiabilityIdSchema, monthlyCost: MoneySchema }).strict(),
  /** A loan paid down but not off (a windfall's repayLargestLoan). `principal` and `monthlyPayment` are the loan's after the payment. */
  z
    .object({
      kind: z.literal('paidDown'),
      liabilityId: LiabilityIdSchema,
      amount: MoneySchema,
      principal: MoneySchema,
      monthlyPayment: MoneySchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('bought'),
      assetId: AssetIdSchema,
      cardId: CardIdSchema,
      /** Cash paid now: the down payment, or shares × sharePrice. */
      cost: MoneySchema,
      /** Stock lots only. */
      shares: z.number().int().positive().optional(),
      /** The card's principles. */
      principles: PrinciplesSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('sold'),
      assetId: AssetIdSchema,
      cardId: CardIdSchema,
      /** Gross sale price before any mortgage payoff. */
      proceeds: MoneySchema,
      /** Stock lots only. */
      shares: z.number().int().positive().optional(),
      remainingShares: z.number().int().nonnegative().optional(),
      /** Set when the sale retired a linked mortgage: how much of the proceeds went to it. */
      mortgagePaid: MoneySchema.optional(),
      /** The card's principles. */
      principles: PrinciplesSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('cashFlowChanged'),
      assetId: AssetIdSchema,
      delta: SignedMoneySchema,
      /** The asset's monthlyCashFlow after the change. */
      monthlyCashFlow: SignedMoneySchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('sharesSplit'),
      assetId: AssetIdSchema,
      ratio: z.number().int().min(2),
      /** Shares in the lot after the split. */
      shares: z.number().int().positive(),
    })
    .strict(),
  /** `favorTokens` is the player's total after the gift. */
  z
    .object({ kind: z.literal('gave'), amount: MoneySchema.positive(), favorTokens: z.number().int().positive(), principles: PrinciplesSchema })
    .strict(),
  z.object({ kind: z.literal('skippedGive'), principles: PrinciplesSchema }).strict(),
  z
    .object({
      kind: z.literal('setback'),
      cardId: CardIdSchema,
      cost: MoneySchema,
      /** Bank loan taken automatically to cover the cost; 0 when cash covered it. */
      autoBorrowed: MoneySchema,
      /** True when the card or the forced loan makes the player sit out their next turn. */
      skipsNextTurn: z.boolean(),
    })
    .strict(),
  /** Bankruptcy sales could not cover a Payday deficit; the current player is out. */
  z.object({ kind: z.literal('wentOut'), shortfall: MoneySchema.positive() }).strict(),
  /** END_TURN passed over this player because of a Setback. */
  z.object({ kind: z.literal('turnSkipped'), playerId: PlayerIdSchema }).strict(),
  z.object({ kind: z.literal('cashChanged'), delta: SignedMoneySchema, reason: z.string().min(1) }).strict(),
]);
export type LogEvent = DeepReadonly<z.infer<typeof LogEventSchema>>;

export const LogEntrySchema = z
  .object({
    turnNumber: z.number().int().nonnegative(),
    action: ActionSchema,
    events: z.array(LogEventSchema),
  })
  .strict();
export type LogEntry = DeepReadonly<z.infer<typeof LogEntrySchema>>;

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export const GameModeSchema = z.enum(['standard', 'kids']);
export type GameMode = z.infer<typeof GameModeSchema>;

export const GamePhaseSchema = z.enum(['lobby', 'playing', 'finished']);
export type GamePhase = z.infer<typeof GamePhaseSchema>;

export const GameSchema = z
  .object({
    id: z.string().min(1),
    mode: GameModeSchema,
    phase: GamePhaseSchema,
    /** Counts accepted END_TURNs. The spec calls this turnIndex. */
    turnNumber: z.number().int().nonnegative(),
    currentPlayerId: PlayerIdSchema,
    /** The seed the game started from. Never changes. */
    rngSeed: z.number().int(),
    /** The PRNG's current position. Advanced on every draw (CLAUDE.md, Rule 1.4). */
    rngState: z.number().int(),
    /** Append-only. */
    log: z.array(LogEntrySchema),
  })
  .strict();
export type Game = DeepReadonly<z.infer<typeof GameSchema>>;

export const GameStateSchema = z
  .object({
    game: GameSchema,
    players: z.array(PlayerSchema).min(1).max(MAX_PLAYERS),
    decks: DecksSchema,
    pending: PendingSchema,
  })
  .strict();
export type GameState = DeepReadonly<z.infer<typeof GameStateSchema>>;
