import { z } from 'zod';

import { CardIdSchema } from './cards';
import { MoneySchema } from './money';
import type { DeepReadonly } from './readonly';

export const PlayerIdSchema = z.string().min(1);
export type PlayerId = z.infer<typeof PlayerIdSchema>;

export const LiabilityIdSchema = z.string().min(1);
export type LiabilityId = z.infer<typeof LiabilityIdSchema>;

/** Bank loans come in $1,000 steps (spec, Core rules, turn step 4). */
export const BORROW_STEP = 1_000;

const acting = { playerId: PlayerIdSchema };

/**
 * Every action the reducer accepts (spec, Game engine design). Each carries the
 * acting playerId; the reducer rejects it unless that player is current and the
 * action fits the pending decision.
 */
export const ActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ROLL'), ...acting }).strict(),
  z.object({ type: z.literal('CHOOSE_DEAL_SIZE'), ...acting, size: z.enum(['small', 'big']) }).strict(),
  /** `shares` applies to stock cards only; other deals are all-or-nothing. */
  z.object({ type: z.literal('BUY'), ...acting, shares: z.number().int().positive().optional() }).strict(),
  z.object({ type: z.literal('PASS'), ...acting }).strict(),
  /** Assets are keyed by the card that created them. */
  z.object({ type: z.literal('SELL_ASSET'), ...acting, cardId: CardIdSchema }).strict(),
  z
    .object({
      type: z.literal('BORROW'),
      ...acting,
      amount: MoneySchema.positive().multipleOf(BORROW_STEP),
    })
    .strict(),
  z.object({ type: z.literal('REPAY'), ...acting, liabilityId: LiabilityIdSchema }).strict(),
  z.object({ type: z.literal('PAY_LIFESTYLE'), ...acting, method: z.enum(['cash', 'loan']) }).strict(),
  /** `cardId` names the asset the market effect is applied to when the player owns more than one that qualifies. */
  z.object({ type: z.literal('ACCEPT_MARKET'), ...acting, cardId: CardIdSchema.optional() }).strict(),
  z.object({ type: z.literal('DECLINE_MARKET'), ...acting }).strict(),
  z.object({ type: z.literal('GIVE'), ...acting }).strict(),
  z.object({ type: z.literal('SKIP_GIVE'), ...acting }).strict(),
  z.object({ type: z.literal('END_TURN'), ...acting }).strict(),
]);
export type Action = DeepReadonly<z.infer<typeof ActionSchema>>;
export type ActionType = Action['type'];

export const ACTION_TYPES = ActionSchema.options.map((o) => o.shape.type.value);
