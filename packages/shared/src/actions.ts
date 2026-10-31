import { z } from 'zod';

import { LifeOptionIdSchema } from './cards';
import { MoneySchema } from './money';
import type { DeepReadonly } from './readonly';

export const PlayerIdSchema = z.string().min(1);
export type PlayerId = z.infer<typeof PlayerIdSchema>;

export const LiabilityIdSchema = z.string().min(1);
export type LiabilityId = z.infer<typeof LiabilityIdSchema>;

/** Declared here, not in state.ts, because state.ts imports this module. */
export const AssetIdSchema = z.string().min(1);
export type AssetId = z.infer<typeof AssetIdSchema>;

/** Bank loans come in $1,000 steps (spec, Core rules, turn step 4). */
export const BORROW_STEP = 1_000;

/**
 * Credit limit (decided by Andre 2026-10-31): BORROW may not take total bank
 * debt past this many months of salary. Setback auto-loans ignore the limit
 * so a Setback always resolves, but they count toward it.
 */
export const BANK_CREDIT_LIMIT_MONTHS = 2;

const acting = { playerId: PlayerIdSchema };

/**
 * Every action the reducer accepts (spec, Game engine design). Each carries the
 * acting playerId; the reducer rejects it unless that player is current and the
 * action fits the pending decision.
 */
export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ROLL'), ...acting }).strict(),
  z.object({ type: z.literal('CHOOSE_DEAL_SIZE'), ...acting, size: z.enum(['small', 'big']) }).strict(),
  /** `shares` applies to stock cards only; `amount` (in $100 steps, at least the card minimum) to growth assets only; other deals are all-or-nothing. */
  z
    .object({ type: z.literal('BUY'), ...acting, shares: z.number().int().positive().optional(), amount: z.number().int().optional() })
    .strict(),
  z.object({ type: z.literal('PASS'), ...acting }).strict(),
  /** Names one lot by its asset id. `shares` applies to stock lots only; other assets sell whole. */
  z
    .object({
      type: z.literal('SELL_ASSET'),
      ...acting,
      assetId: AssetIdSchema,
      shares: z.number().int().positive().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('BORROW'),
      ...acting,
      amount: MoneySchema.positive().multipleOf(BORROW_STEP),
    })
    .strict(),
  z.object({ type: z.literal('REPAY'), ...acting, liabilityId: LiabilityIdSchema }).strict(),
  /** Spec v2: picks one option on the drawn Life Choices card. Replaces PAY_LIFESTYLE. */
  z.object({ type: z.literal('CHOOSE_LIFE_OPTION'), ...acting, optionId: LifeOptionIdSchema }).strict(),
  /** `assetId` names the lot the market effect is applied to when the player owns more than one that qualifies. */
  z.object({ type: z.literal('ACCEPT_MARKET'), ...acting, assetId: AssetIdSchema.optional() }).strict(),
  z.object({ type: z.literal('DECLINE_MARKET'), ...acting }).strict(),
  z.object({ type: z.literal('GIVE'), ...acting }).strict(),
  z.object({ type: z.literal('SKIP_GIVE'), ...acting }).strict(),
  z.object({ type: z.literal('END_TURN'), ...acting }).strict(),
]);
export type Action = DeepReadonly<z.infer<typeof ActionSchema>>;
export type ActionType = Action['type'];

export const ACTION_TYPES = ActionSchema.options.map((o) => o.shape.type.value);
