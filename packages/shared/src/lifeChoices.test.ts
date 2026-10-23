import { describe, expect, it } from 'vitest';

import { ActionSchema } from './actions';
import { CardSchema, DECK_IDS, LIFE_CHOICE_CATEGORIES, LifeChoicesCardSchema, LifeEffectSchema, LifeOptionSchema } from './cards';
import { LIABILITY_KINDS, StartingLiabilityKindSchema } from './professions';
import { LiabilitySchema, PendingSchema } from './state';

/** Copy of `obj` without the named key. */
const without = (obj: object, key: string): object => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));

// Spec v2, Card decks, Life Choices cards: Life Choices replaces Lifestyle.
// Each card is a real decision with two or three options, at least one of
// which has no monthly cost.

const keep = { id: 'keep', label: 'Keep the old truck', principles: ['P4'], kidsText: 'Keep driving it.', adultText: 'It still runs.', kidsOk: true, effects: [] };
const cash = {
  id: 'cash',
  label: 'Buy a used truck for cash',
  principles: ['P4', 'P6'],
  kidsText: 'Pay cash for a used one.',
  adultText: 'A three-year-old truck, paid in full.',
  kidsOk: true,
  effects: [{ kind: 'payCash', amount: 4_000 }],
};
const loan = {
  id: 'loan',
  label: 'Finance a new truck',
  principles: ['P5', 'P6'],
  kidsText: 'Take a loan for a new one.',
  adultText: 'Heated seats, 380 a month.',
  kidsOk: true,
  effects: [{ kind: 'addLoan', loanKind: 'car', principal: 12_000, monthlyPayment: 380 }],
};
const truck = {
  id: 'life-001',
  deck: 'lifeChoices',
  category: 'vehicle',
  title: 'Your Truck Is Nine Years Old',
  principles: ['P4', 'P5', 'P6'],
  kidsText: 'Keep it, buy used, or buy new?',
  adultText: 'Keep it, buy used, or finance new?',
  kidsOk: true,
  options: [keep, cash, loan],
};

describe('LifeChoicesCardSchema', () => {
  it('accepts a vehicle card with three options', () => {
    const result = LifeChoicesCardSchema.safeParse(truck);
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
  });

  it('is the lifeChoices deck; the lifestyle deck is gone', () => {
    expect(DECK_IDS).toContain('lifeChoices');
    expect(DECK_IDS).not.toContain('lifestyle');
    expect(CardSchema.safeParse(truck).success).toBe(true);
    expect(CardSchema.safeParse({ ...truck, deck: 'lifestyle' }).success).toBe(false);
  });

  it('requires two or three options', () => {
    expect(LifeChoicesCardSchema.safeParse({ ...truck, options: [keep] }).success).toBe(false);
    expect(LifeChoicesCardSchema.safeParse({ ...truck, options: [keep, cash] }).success).toBe(true);
    expect(LifeChoicesCardSchema.safeParse({ ...truck, options: [keep, cash, loan, { ...loan, id: 'loan2' }] }).success).toBe(false);
  });

  it('requires option ids to be unique within the card', () => {
    expect(LifeChoicesCardSchema.safeParse({ ...truck, options: [keep, { ...cash, id: 'keep' }] }).success).toBe(false);
  });

  it('requires at least one option with no monthly cost (no loan and no subscription)', () => {
    const subscription = { ...keep, id: 'sub', effects: [{ kind: 'addSubscription', monthlyCost: 60 }] };
    expect(LifeChoicesCardSchema.safeParse({ ...truck, options: [loan, subscription] }).success).toBe(false);
    expect(LifeChoicesCardSchema.safeParse({ ...truck, options: [loan, cash] }).success).toBe(true);
  });

  it('knows the six categories from the spec', () => {
    expect(LIFE_CHOICE_CATEGORIES).toEqual(['vehicle', 'clothing', 'gadget', 'subscription', 'bigLife', 'windfall']);
    expect(LifeChoicesCardSchema.safeParse({ ...truck, category: 'food' }).success).toBe(false);
  });

  it('every option carries principles, both texts, and kidsOk', () => {
    expect(LifeOptionSchema.safeParse({ ...keep, principles: [] }).success).toBe(false);
    expect(LifeOptionSchema.safeParse({ ...keep, kidsText: 'k'.repeat(91) }).success).toBe(false);
    expect(LifeOptionSchema.safeParse({ ...keep, adultText: 'a'.repeat(161) }).success).toBe(false);
    expect(LifeOptionSchema.safeParse(without(keep, 'kidsOk')).success).toBe(false);
  });
});

describe('LifeEffectSchema', () => {
  it.each([
    { kind: 'payCash', amount: 2_500 },
    { kind: 'gainCash', amount: 2_000 },
    { kind: 'addLoan', loanKind: 'car', principal: 12_000, monthlyPayment: 380 },
    { kind: 'addLoan', loanKind: 'lifestyle', principal: 1_800, monthlyPayment: 90 },
    { kind: 'addSubscription', monthlyCost: 60 },
    { kind: 'investGrowth', assetType: 'index', amount: 2_000, growthPercent: 4, payoutPercent: 1 },
    { kind: 'investGrowth', assetType: 'savings', amount: 500, growthPercent: 1, payoutPercent: 0 },
    { kind: 'repayLargestLoan', amount: 2_000 },
  ])('accepts the spec effect $kind', (effect) => {
    const result = LifeEffectSchema.safeParse(effect);
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
  });

  it('rejects an unknown effect, a zero amount, and a loan of a non-card kind', () => {
    expect(LifeEffectSchema.safeParse({ kind: 'teleport' }).success).toBe(false);
    expect(LifeEffectSchema.safeParse({ kind: 'payCash', amount: 0 }).success).toBe(false);
    expect(LifeEffectSchema.safeParse({ kind: 'addLoan', loanKind: 'bank', principal: 1_000, monthlyPayment: 100 }).success).toBe(false);
    expect(LifeEffectSchema.safeParse({ kind: 'investGrowth', assetType: 'stock', amount: 100, growthPercent: 1, payoutPercent: 0 }).success).toBe(false);
  });
});

describe('subscriptions and Life Choices loans on state', () => {
  it('subscription is a liability kind, never a starting one', () => {
    expect(LIABILITY_KINDS).toContain('subscription');
    expect(StartingLiabilityKindSchema.safeParse('subscription').success).toBe(false);
    expect(StartingLiabilityKindSchema.safeParse('lifestyle').success).toBe(false);
  });

  it('a subscription liability has principal 0 and names its source card', () => {
    const sub = { id: 's1', kind: 'subscription', principal: 0, monthlyPayment: 60, sourceCardId: 'life-004' };
    expect(LiabilitySchema.safeParse(sub).success).toBe(true);
    expect(LiabilitySchema.safeParse({ ...sub, principal: 1 }).success).toBe(false);
    expect(LiabilitySchema.safeParse(without(sub, 'sourceCardId')).success).toBe(false);
  });

  it('a car loan may name a source card (Life Choices) or not (a profession starting loan)', () => {
    const starting = { id: 'c1', kind: 'car', principal: 6_000, monthlyPayment: 120 };
    expect(LiabilitySchema.safeParse(starting).success).toBe(true);
    expect(LiabilitySchema.safeParse({ ...starting, sourceCardId: 'life-001' }).success).toBe(true);
    expect(LiabilitySchema.safeParse({ id: 's1', kind: 'student', principal: 1, monthlyPayment: 1, sourceCardId: 'life-001' }).success).toBe(false);
  });

  it('pending lifeChoice names a card and payLifestyle is gone', () => {
    expect(PendingSchema.safeParse({ kind: 'lifeChoice', cardId: 'life-001' }).success).toBe(true);
    expect(PendingSchema.safeParse({ kind: 'lifeChoice' }).success).toBe(false);
    expect(PendingSchema.safeParse({ kind: 'payLifestyle', cardId: 'life-001' }).success).toBe(false);
  });

  it('CHOOSE_LIFE_OPTION carries an optionId and PAY_LIFESTYLE is gone', () => {
    expect(ActionSchema.safeParse({ type: 'CHOOSE_LIFE_OPTION', playerId: 'p1', optionId: 'keep' }).success).toBe(true);
    expect(ActionSchema.safeParse({ type: 'CHOOSE_LIFE_OPTION', playerId: 'p1' }).success).toBe(false);
    expect(ActionSchema.safeParse({ type: 'PAY_LIFESTYLE', playerId: 'p1', method: 'cash' }).success).toBe(false);
  });
});
