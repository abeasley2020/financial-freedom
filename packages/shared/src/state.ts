import { z } from 'zod';

import { ActionSchema, AssetIdSchema, LiabilityIdSchema, PlayerIdSchema } from './actions';
import { BOARD_SIZE } from './board';
import { AssetTypeSchema, CardIdSchema, DECK_IDS, DeckIdSchema } from './cards';
import { MoneySchema, SignedMoneySchema } from './money';
import { LiabilityKindSchema, ProfessionIdSchema } from './professions';
import type { DeepReadonly } from './readonly';

export { BOARD_SIZE };

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;

// ---------------------------------------------------------------------------
// Player holdings. Facts only; see CLAUDE.md Rule 2 for what is derived.
// ---------------------------------------------------------------------------

export const AssetSchema = z
  .object({
    /** One asset per BUY. A stock bought twice is two lots with different ids. */
    id: AssetIdSchema,
    /** The deal card this asset came from. */
    cardId: CardIdSchema,
    type: AssetTypeSchema,
    /** What the player agreed to pay in total (down payment plus mortgage; shares × sharePrice for a stock). Market offers are a percent of this. */
    purchasePrice: MoneySchema,
    /** Cash paid at purchase. */
    downPaid: MoneySchema,
    /** Stored, not copied from the card, because Market cards change it. */
    monthlyCashFlow: SignedMoneySchema,
    /** Stocks only. */
    shares: z.number().int().positive().optional(),
  })
  .strict();
export type Asset = DeepReadonly<z.infer<typeof AssetSchema>>;

export const LiabilitySchema = z
  .object({
    /** Stable handle so REPAY can name one loan among several of the same kind. */
    id: LiabilityIdSchema,
    kind: LiabilityKindSchema,
    principal: MoneySchema,
    /** Stored because lifestyle loans take their payment from the card, not from a percent. Always 0 for a mortgage. */
    monthlyPayment: MoneySchema,
    /** Lifestyle loans only: the card that created the loan. */
    sourceCardId: CardIdSchema.optional(),
    /** Mortgages only: the asset this loan finances. Paid off first from that asset's sale proceeds. */
    assetId: AssetIdSchema.optional(),
  })
  .strict()
  .superRefine((liability, ctx) => {
    const isLifestyle = liability.kind === 'lifestyle';
    if (isLifestyle && liability.sourceCardId === undefined) {
      ctx.addIssue({ code: 'custom', message: 'a lifestyle liability needs sourceCardId', path: ['sourceCardId'] });
    }
    if (!isLifestyle && liability.sourceCardId !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'only a lifestyle liability may carry sourceCardId',
        path: ['sourceCardId'],
      });
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
  z.object({ kind: z.literal('payLifestyle'), cardId: CardIdSchema }).strict(),
  z.object({ kind: z.literal('giveOrSkip') }).strict(),
]);
export type Pending = DeepReadonly<z.infer<typeof PendingSchema>>;
export type PendingKind = Pending['kind'];

/** What an accepted action did, for the scorecard and bug reports. Replay uses the action, not the events. */
export const LogEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rolled'), value: z.number().int().min(1).max(6) }).strict(),
  z.object({ kind: z.literal('moved'), from: z.number().int(), to: z.number().int() }).strict(),
  z.object({ kind: z.literal('payday'), amount: SignedMoneySchema }).strict(),
  z.object({ kind: z.literal('drewCard'), deck: DeckIdSchema, cardId: CardIdSchema }).strict(),
  z.object({ kind: z.literal('sharePriceRolled'), cardId: CardIdSchema, sharePrice: MoneySchema }).strict(),
  z.object({ kind: z.literal('passed'), cardId: CardIdSchema }).strict(),
  z
    .object({
      kind: z.literal('bought'),
      assetId: AssetIdSchema,
      cardId: CardIdSchema,
      /** Cash paid now: the down payment, or shares × sharePrice. */
      cost: MoneySchema,
      /** Stock lots only. */
      shares: z.number().int().positive().optional(),
    })
    .strict(),
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
