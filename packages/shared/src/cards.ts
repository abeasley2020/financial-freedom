import { z } from 'zod';

import { MoneySchema, PercentSchema, SignedMoneySchema } from './money';
import { PrinciplesSchema } from './principles';
import type { DeepReadonly } from './readonly';

// ---------------------------------------------------------------------------
// Decks and asset types
// ---------------------------------------------------------------------------

export const DECK_IDS = ['smallDeals', 'bigDeals', 'market', 'lifeChoices', 'setback'] as const;
export const DeckIdSchema = z.enum(DECK_IDS);
export type DeckId = z.infer<typeof DeckIdSchema>;

export const DEAL_DECK_IDS = ['smallDeals', 'bigDeals'] as const;
export const DealDeckIdSchema = z.enum(DEAL_DECK_IDS);
export type DealDeckId = z.infer<typeof DealDeckIdSchema>;

/** Growth assets (spec v2, Growth assets): bought with cash, they compound at every Payday. */
export const GROWTH_ASSET_TYPES = ['savings', 'cd', 'index'] as const;
export const GrowthAssetTypeSchema = z.enum(GROWTH_ASSET_TYPES);
export type GrowthAssetType = z.infer<typeof GrowthAssetTypeSchema>;

export const ASSET_TYPES = ['stock', 'rental', 'business', 'land', ...GROWTH_ASSET_TYPES] as const;

/** Growth assets are bought in steps of this many dollars (spec v2, Growth assets). */
export const INVEST_STEP = 100;

export function isGrowthAssetType(type: string): type is GrowthAssetType {
  return (GROWTH_ASSET_TYPES as readonly string[]).includes(type);
}
export const AssetTypeSchema = z.enum(ASSET_TYPES);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const CardIdSchema = z.string().min(1);
export type CardId = z.infer<typeof CardIdSchema>;

/** Spec v2, Card decks: kidsText 90 characters or fewer, adultText 160 or fewer, no em dashes anywhere. */
export const KIDS_TEXT_MAX = 90;
export const ADULT_TEXT_MAX = 160;
const NO_EM_DASH = { pattern: /^[^—]*$/u, message: 'no em dashes in card text' };

export const KidsTextSchema = z.string().min(1).max(KIDS_TEXT_MAX).regex(NO_EM_DASH.pattern, NO_EM_DASH.message);
export const AdultTextSchema = z.string().min(1).max(ADULT_TEXT_MAX).regex(NO_EM_DASH.pattern, NO_EM_DASH.message);

/** Fields every card carries (spec v2, Card decks). */
const cardBase = {
  id: CardIdSchema,
  title: z.string().min(1).regex(NO_EM_DASH.pattern, NO_EM_DASH.message),
  /** At least one of the ten principles the card teaches. */
  principles: PrinciplesSchema,
  /** 4th-grade reading level, shown in kids mode. */
  kidsText: KidsTextSchema,
  adultText: AdultTextSchema,
  /** Kids mode plays only with cards marked kidsOk. */
  kidsOk: z.boolean(),
};

// ---------------------------------------------------------------------------
// Deal cards (small and big decks)
// ---------------------------------------------------------------------------

/** Inclusive per-share price range the engine rolls within for a stock card. */
export const PriceRangeSchema = z
  .object({ min: MoneySchema, max: MoneySchema })
  .strict()
  .refine((r) => r.min <= r.max, { message: 'priceRange.min must not exceed priceRange.max' });
export type PriceRange = z.infer<typeof PriceRangeSchema>;

export const DealCardSchema = z
  .object({
    ...cardBase,
    deck: DealDeckIdSchema,
    type: AssetTypeSchema,
    /** Full price. For a stock this is the reference price per share; the engine rolls the real one from priceRange. */
    price: MoneySchema,
    /** Cash the buyer pays now. */
    downPayment: MoneySchema,
    /** Financed remainder. Becomes a `mortgage` liability on purchase. */
    mortgage: MoneySchema,
    /** Monthly cash flow once owned. Negative for assets that cost money to hold (land taxes). */
    monthlyCashFlow: SignedMoneySchema,
    /** Stocks only: how many shares the card offers. */
    sharesAvailable: z.number().int().positive().optional(),
    /** Stocks only: the engine rolls a price in this range on each draw. */
    priceRange: PriceRangeSchema.optional(),
    /** Stocks only: whole dollars per share per month. Absent means 0. A lot's monthlyCashFlow is floor(shares × dividendPerShare). */
    dividendPerShare: MoneySchema.optional(),
    /** Growth assets only: marketValue grows by this percent at every Payday. Spec range 1 to 6. */
    growthPercent: PercentSchema.optional(),
    /** Growth assets only: the asset pays pct(marketValue, payoutPercent) a month. Spec range 0 to 2. */
    payoutPercent: PercentSchema.optional(),
  })
  .strict()
  .superRefine((card, ctx) => {
    // Growth cards (spec v2, Growth assets): price is the minimum investment, in $100 steps; cash only; no cash flow of their own.
    const isGrowth = isGrowthAssetType(card.type);
    if (isGrowth) {
      if (card.growthPercent === undefined) ctx.addIssue({ code: 'custom', message: 'a growth card needs growthPercent', path: ['growthPercent'] });
      if (card.payoutPercent === undefined) ctx.addIssue({ code: 'custom', message: 'a growth card needs payoutPercent', path: ['payoutPercent'] });
      if (card.mortgage !== 0) ctx.addIssue({ code: 'custom', message: 'growth assets are cash only: mortgage must be 0', path: ['mortgage'] });
      if (card.monthlyCashFlow !== 0) {
        ctx.addIssue({ code: 'custom', message: 'a growth card has monthlyCashFlow 0: its cash flow is derived from marketValue', path: ['monthlyCashFlow'] });
      }
      if (card.price <= 0 || card.price % INVEST_STEP !== 0) {
        ctx.addIssue({ code: 'custom', message: `a growth card price is its minimum investment, a positive multiple of ${String(INVEST_STEP)}`, path: ['price'] });
      }
    } else {
      if (card.growthPercent !== undefined) ctx.addIssue({ code: 'custom', message: 'only a growth card may carry growthPercent', path: ['growthPercent'] });
      if (card.payoutPercent !== undefined) ctx.addIssue({ code: 'custom', message: 'only a growth card may carry payoutPercent', path: ['payoutPercent'] });
    }
    if (card.downPayment + card.mortgage !== card.price) {
      ctx.addIssue({
        code: 'custom',
        message: `downPayment (${String(card.downPayment)}) + mortgage (${String(card.mortgage)}) must equal price (${String(card.price)})`,
        path: ['price'],
      });
    }
    const isStock = card.type === 'stock';
    if (isStock && card.priceRange === undefined) {
      ctx.addIssue({ code: 'custom', message: 'a stock card needs a priceRange', path: ['priceRange'] });
    }
    if (isStock && card.sharesAvailable === undefined) {
      ctx.addIssue({ code: 'custom', message: 'a stock card needs sharesAvailable', path: ['sharesAvailable'] });
    }
    if (!isStock && card.priceRange !== undefined) {
      ctx.addIssue({ code: 'custom', message: 'only a stock card may carry a priceRange', path: ['priceRange'] });
    }
    if (!isStock && card.sharesAvailable !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'only a stock card may carry sharesAvailable',
        path: ['sharesAvailable'],
      });
    }
    if (!isStock && card.dividendPerShare !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'only a stock card may carry dividendPerShare',
        path: ['dividendPerShare'],
      });
    }
    if (isStock && card.mortgage !== 0) {
      ctx.addIssue({ code: 'custom', message: 'stocks are cash only: mortgage must be 0', path: ['mortgage'] });
    }
  });
export type DealCard = DeepReadonly<z.infer<typeof DealCardSchema>>;

// ---------------------------------------------------------------------------
// Market cards
// ---------------------------------------------------------------------------

export const MarketEffectSchema = z.discriminatedUnion('kind', [
  /** A buyer offers a percent of the asset's purchase price. The player may accept or decline. */
  z.object({ kind: z.literal('offerBuyout'), percentOfPurchasePrice: PercentSchema }).strict(),
  /** The asset's monthly cash flow moves by `delta` (a tenant leaves, rent rises). */
  z.object({ kind: z.literal('changeCashFlow'), delta: SignedMoneySchema }).strict(),
  /** The player must sell at a percent of purchase price. No choice. */
  z.object({ kind: z.literal('forceSale'), percentOfPurchasePrice: PercentSchema }).strict(),
  /** Each share becomes `ratio` shares. */
  z.object({ kind: z.literal('splitShares'), ratio: z.number().int().min(2) }).strict(),
  /** v2: each qualifying growth asset's marketValue moves by pct(marketValue, percent), never below $0. A crash is negative. */
  z.object({ kind: z.literal('changeMarketValue'), percent: z.number().int() }).strict(),
]);
export type MarketEffect = DeepReadonly<z.infer<typeof MarketEffectSchema>>;

export const MarketCardSchema = z
  .object({
    ...cardBase,
    deck: z.literal('market'),
    /** Applied in order. The spec calls this field `effect`; it is plural here because it is an array. */
    effects: z.array(MarketEffectSchema).min(1),
    /** Asset types the card can touch. A player who owns none of these simply discards it. */
    appliesTo: z.array(AssetTypeSchema).min(1),
  })
  .strict();
export type MarketCard = DeepReadonly<z.infer<typeof MarketCardSchema>>;

// ---------------------------------------------------------------------------
// Life Choices cards (spec v2; replaces the v1 Lifestyle deck)
// ---------------------------------------------------------------------------

export const LIFE_CHOICE_CATEGORIES = ['vehicle', 'clothing', 'gadget', 'subscription', 'bigLife', 'windfall'] as const;
export const LifeChoiceCategorySchema = z.enum(LIFE_CHOICE_CATEGORIES);
export type LifeChoiceCategory = z.infer<typeof LifeChoiceCategorySchema>;

/** Loan kinds a Life Choices option can add. Bank loans come only from BORROW and Setbacks. */
export const LIFE_LOAN_KINDS = ['car', 'lifestyle'] as const;

/**
 * What choosing an option does, applied in order (spec v2, Life Choices
 * cards). The spec names the loan kind `kind` and the growth type `type`;
 * they are `loanKind` and `assetType` here because `kind` is the discriminator.
 */
export const LifeEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('payCash'), amount: MoneySchema.positive() }).strict(),
  /** Windfalls. */
  z.object({ kind: z.literal('gainCash'), amount: MoneySchema.positive() }).strict(),
  z
    .object({
      kind: z.literal('addLoan'),
      loanKind: z.enum(LIFE_LOAN_KINDS),
      principal: MoneySchema.positive(),
      /** The option's stated payment, not a percent of principal. */
      monthlyPayment: MoneySchema.positive(),
    })
    .strict(),
  /** A subscription liability: principal 0, charged every Payday until REPAY cancels it. */
  z.object({ kind: z.literal('addSubscription'), monthlyCost: MoneySchema.positive() }).strict(),
  /** A windfall option that invests directly into a growth asset. */
  z
    .object({
      kind: z.literal('investGrowth'),
      assetType: GrowthAssetTypeSchema,
      amount: MoneySchema.positive(),
      growthPercent: PercentSchema,
      payoutPercent: PercentSchema,
    })
    .strict(),
  /** A windfall option that pays the player's highest-payment loan (never a mortgage or a subscription) down by up to `amount`. */
  z.object({ kind: z.literal('repayLargestLoan'), amount: MoneySchema.positive() }).strict(),
]);
export type LifeEffect = DeepReadonly<z.infer<typeof LifeEffectSchema>>;

/** True when the option adds nothing to the player's monthly costs. */
export function hasNoMonthlyCost(option: { readonly effects: readonly { readonly kind: string }[] }): boolean {
  return !option.effects.some((e) => e.kind === 'addLoan' || e.kind === 'addSubscription');
}

export const LifeOptionIdSchema = z.string().min(1);

export const LifeOptionSchema = z
  .object({
    id: LifeOptionIdSchema,
    /** Short button text. */
    label: z.string().min(1).regex(NO_EM_DASH.pattern, NO_EM_DASH.message),
    principles: PrinciplesSchema,
    kidsText: KidsTextSchema,
    adultText: AdultTextSchema,
    /** Kids mode offers only options marked kidsOk. */
    kidsOk: z.boolean(),
    /** Empty means "keep what you have". */
    effects: z.array(LifeEffectSchema),
  })
  .strict();
export type LifeOption = DeepReadonly<z.infer<typeof LifeOptionSchema>>;

export const LifeChoicesCardSchema = z
  .object({
    ...cardBase,
    deck: z.literal('lifeChoices'),
    category: LifeChoiceCategorySchema,
    /** Two or three real choices. At least one has no monthly cost: temptation is only a lesson when saying no is possible. */
    options: z.array(LifeOptionSchema).min(2).max(3),
  })
  .strict()
  .superRefine((card, ctx) => {
    const ids = new Set(card.options.map((o) => o.id));
    if (ids.size !== card.options.length) {
      ctx.addIssue({ code: 'custom', message: 'option ids must be unique within a card', path: ['options'] });
    }
    if (!card.options.some(hasNoMonthlyCost)) {
      ctx.addIssue({ code: 'custom', message: 'every Life Choices card needs an option with no monthly cost', path: ['options'] });
    }
  });
export type LifeChoicesCard = DeepReadonly<z.infer<typeof LifeChoicesCardSchema>>;

// ---------------------------------------------------------------------------
// Setback cards
// ---------------------------------------------------------------------------

export const SetbackCardSchema = z
  .object({
    ...cardBase,
    deck: z.literal('setback'),
    cashCost: MoneySchema,
    skipTurn: z.boolean(),
  })
  .strict();
export type SetbackCard = DeepReadonly<z.infer<typeof SetbackCardSchema>>;

// ---------------------------------------------------------------------------
// Any card
// ---------------------------------------------------------------------------

export const CardSchema = z.discriminatedUnion('deck', [
  DealCardSchema,
  MarketCardSchema,
  LifeChoicesCardSchema,
  SetbackCardSchema,
]);
export type Card = DeepReadonly<z.infer<typeof CardSchema>>;
