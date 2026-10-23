import { z } from 'zod';

import { MoneySchema } from './money';
import type { DeepReadonly } from './readonly';

export const LIABILITY_KINDS = ['student', 'car', 'credit', 'mortgage', 'bank', 'lifestyle', 'subscription'] as const;
export const LiabilityKindSchema = z.enum(LIABILITY_KINDS);
export type LiabilityKind = z.infer<typeof LiabilityKindSchema>;

/** Liability kinds a profession may start with. Lifestyle loans and subscriptions only come from Life Choices cards. */
export const StartingLiabilityKindSchema = LiabilityKindSchema.exclude(['lifestyle', 'subscription']);
export type StartingLiabilityKind = z.infer<typeof StartingLiabilityKindSchema>;

/**
 * Monthly payment as a percent of principal, floored to whole dollars (spec,
 * Core rules). Lifestyle loans are absent on purpose: their payment is the
 * card's stated monthlyCost. Mortgage is 0 because a deal card's
 * monthlyCashFlow is already net of the mortgage payment.
 */
export const LIABILITY_PAYMENT_PERCENT: Readonly<Record<StartingLiabilityKind, number>> = {
  student: 1,
  car: 2,
  credit: 3,
  mortgage: 0,
  bank: 10,
};

export const ProfessionIdSchema = z.string().min(1);
export type ProfessionId = z.infer<typeof ProfessionIdSchema>;

export const ProfessionSchema = z
  .object({
    id: ProfessionIdSchema,
    name: z.string().min(1),
    /** Monthly salary at game start. Stored on the player because Setback cards can change it. */
    salary: MoneySchema,
    /** Monthly living costs before any debt. Looked up from here, never copied onto state. */
    baseExpenses: MoneySchema,
    /** One-time starting cash. */
    startingCash: MoneySchema,
    /** Principal only. The engine derives monthlyPayment from LIABILITY_PAYMENT_PERCENT at setup. */
    startingLiabilities: z.array(
      z.object({ kind: StartingLiabilityKindSchema, principal: MoneySchema.positive() }).strict(),
    ),
  })
  .strict();
export type Profession = DeepReadonly<z.infer<typeof ProfessionSchema>>;
