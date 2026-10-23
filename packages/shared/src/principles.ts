import { z } from 'zod';

// Spec v2, Principles: the ten ideas the game teaches. Every card, every Life
// Choices option, and every decision log event carries one or more of these
// ids, and the debrief speaks only in them.

export const PRINCIPLE_IDS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'] as const;
export const PrincipleIdSchema = z.enum(PRINCIPLE_IDS);
export type PrincipleId = z.infer<typeof PrincipleIdSchema>;

/** At least one principle, as every card, option, and decision event carries. */
export const PrinciplesSchema = z.array(PrincipleIdSchema).min(1);

export interface Principle {
  readonly id: PrincipleId;
  readonly name: string;
  /** Full numbers and plain words for adults and teens. 160 characters or fewer. */
  readonly adultText: string;
  /** 4th-grade reading level. 90 characters or fewer. */
  readonly kidsText: string;
}

export const PRINCIPLES: readonly Principle[] = [
  {
    id: 'P1',
    name: 'Emergency fund',
    adultText: 'Cash on hand turns a surprise bill into an inconvenience instead of new debt.',
    kidsText: 'Keep money saved for surprises so they do not turn into debt.',
  },
  {
    id: 'P2',
    name: 'Assets vs. liabilities',
    adultText: 'Assets put money in your pocket every month. Liabilities take it out.',
    kidsText: 'Assets put money in your pocket. Liabilities take it out.',
  },
  {
    id: 'P3',
    name: 'Cash flow beats looking rich',
    adultText: 'Monthly cash flow decides freedom; what you own on paper does not.',
    kidsText: 'What you earn each month matters more than what you show off.',
  },
  {
    id: 'P4',
    name: 'Delayed gratification',
    adultText: 'Money not spent today can be invested to pay you every month after.',
    kidsText: 'Waiting for what you want can buy you freedom later.',
  },
  {
    id: 'P5',
    name: 'Good debt vs. bad debt',
    adultText: 'Debt that buys income can pay for itself. Debt that buys things only costs you.',
    kidsText: 'Borrow to buy things that pay you, not things that cost you.',
  },
  {
    id: 'P6',
    name: 'Things lose value',
    adultText: 'Vehicles, clothes, and gadgets lose value the day you buy them.',
    kidsText: 'Cars, clothes, and gadgets are worth less the day you buy them.',
  },
  {
    id: 'P7',
    name: 'Small costs add up',
    adultText: 'A small monthly charge runs every month until you cancel it.',
    kidsText: 'A little every month becomes a lot every year.',
  },
  {
    id: 'P8',
    name: 'Compounding and patience',
    adultText: 'Growth that earns growth gets bigger every Payday you wait.',
    kidsText: 'Money that grows keeps growing on top of itself.',
  },
  {
    id: 'P9',
    name: 'Risk and diversification',
    adultText: 'A single stock or a single big deal can swing hard. Spread your bets.',
    kidsText: 'Do not bet everything on one thing.',
  },
  {
    id: 'P10',
    name: 'Generosity',
    adultText: 'Giving is part of what money is for.',
    kidsText: 'Giving is part of what money is for.',
  },
];

/**
 * Principles the engine tags on decisions that come from a rule rather than a
 * card (spec, Decision log; debrief attribution table). Card-driven decisions
 * (BUY, PASS, SELL_ASSET, CHOOSE_LIFE_OPTION) carry the card's or option's
 * own principles instead.
 */
export const DECISION_PRINCIPLES = {
  bankLoan: ['P5'],
  setbackLoan: ['P1'],
  repayLoan: ['P5'],
  cancelSubscription: ['P7'],
  giving: ['P10'],
} as const satisfies Record<string, readonly PrincipleId[]>;
