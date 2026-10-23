import { z } from 'zod';

import { MoneySchema, PercentSchema, SignedMoneySchema } from './money';
import { PrinciplesSchema } from './principles';
import type { DeepReadonly } from './readonly';

// ---------------------------------------------------------------------------
// Decks and asset types
// ---------------------------------------------------------------------------

export const DECK_IDS = ['smallDeals', 'bigDeals', 'market', 'lifestyle', 'setback'] as const;
export const DeckIdSchema = z.enum(DECK_IDS);
export type DeckId = z.infer<typeof DeckIdSchema>;

export const DEAL_DECK_IDS = ['smallDeals', 'bigDeals'] as const;
export const DealDeckIdSchema = z.enum(DEAL_DECK_IDS);
export type DealDeckId = z.infer<typeof DealDeckIdSchema>;

export const ASSET_TYPES = ['stock', 'fund', 'rental', 'business', 'land'] as const;
export const AssetTypeSchema = z.enum(ASSET_TYPES);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const CardIdSchema = z.string().min(1);
export type CardId = z.infer<typeof CardIdSchema>;

/** Spec v2, Card decks: kidsText 90 characters or fewer, adultText 160 or fewer, no em dashes anywhere. */
export const KIDS_TEXT_MAX = 90;
export const ADULT_TEXT_MAX = 160;
const NO_EM_DASH = { pattern: /^[^\u2014]*$/u, message: 'no em dashes in card text' };

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
    /** Stocks only: whole dollars per share per month. Absent means 0. A lot's monthlyCashFlow is floor(shares × this). */
    dividendPerShare: MoneySchema.optional(),
  })
  .strict()
  .superRefine((card, ctx) => {
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
// Lifestyle cards
// ---------------------------------------------------------------------------

/**
 * A lifestyle card offers a cash price, a loan, or both (the player picks).
 * A loan always carries both `monthlyCost` and `loanPrincipal`.
 */
export const LifestyleCardSchema = z
  .object({
    ...cardBase,
    deck: z.literal('lifestyle'),
    cashCost: MoneySchema.optional(),
    monthlyCost: MoneySchema.optional(),
    loanPrincipal: MoneySchema.optional(),
  })
  .strict()
  .superRefine((card, ctx) => {
    const hasMonthly = card.monthlyCost !== undefined;
    const hasPrincipal = card.loanPrincipal !== undefined;
    if (hasMonthly !== hasPrincipal) {
      ctx.addIssue({
        code: 'custom',
        message: 'monthlyCost and loanPrincipal must appear together',
        path: [hasMonthly ? 'loanPrincipal' : 'monthlyCost'],
      });
    }
    if (card.cashCost === undefined && !hasMonthly) {
      ctx.addIssue({ code: 'custom', message: 'a lifestyle card needs a cashCost or a loan', path: ['cashCost'] });
    }
  });
export type LifestyleCard = DeepReadonly<z.infer<typeof LifestyleCardSchema>>;

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
  LifestyleCardSchema,
  SetbackCardSchema,
]);
export type Card = DeepReadonly<z.infer<typeof CardSchema>>;
