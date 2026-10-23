import { CARDS_BY_ID, type Asset, type LifeOption, type Player } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { assetCashFlow, cheapestOption, optionCost, passiveIncome, priciestOption } from './selectors';
import { twoPlayerGame } from './test/fixtures';

// Spec v2, Life Choices cards: each option shows two derived numbers, computed
// by an engine selector so the UI never does math: costToday (cash out, or
// cash in as negative) and monthlyChange. Growth assets: cash flow is derived
// from marketValue, never stored.

const teacher = (): Player => {
  const player = twoPlayerGame().players[0];
  if (player === undefined) throw new Error('fixture');
  return player;
};

const option = (effects: LifeOption['effects']): LifeOption => ({
  id: 'o',
  label: 'o',
  principles: ['P4'],
  kidsText: 'k',
  adultText: 'a',
  kidsOk: true,
  effects,
});

const lifeCard = (id: string) => {
  const card = CARDS_BY_ID.get(id);
  if (card?.deck !== 'lifeChoices') throw new Error(`fixture ${id} is not a Life Choices card`);
  return card;
};

describe('optionCost', () => {
  it('an option with no effects costs nothing today and changes nothing monthly', () => {
    expect(optionCost(option([]), teacher())).toEqual({ costToday: 0, monthlyChange: 0 });
  });

  it('payCash is cash out today', () => {
    expect(optionCost(option([{ kind: 'payCash', amount: 4_000 }]), teacher())).toEqual({ costToday: 4_000, monthlyChange: 0 });
  });

  it('gainCash is cash in today, shown as a negative cost', () => {
    expect(optionCost(option([{ kind: 'gainCash', amount: 2_000 }]), teacher())).toEqual({ costToday: -2_000, monthlyChange: 0 });
  });

  it('addLoan adds its stated payment every month and costs nothing today', () => {
    const effects = [{ kind: 'addLoan', loanKind: 'car', principal: 12_000, monthlyPayment: 380 }] as const;
    expect(optionCost(option([...effects]), teacher())).toEqual({ costToday: 0, monthlyChange: 380 });
  });

  it('addSubscription adds its monthly cost', () => {
    expect(optionCost(option([{ kind: 'addSubscription', monthlyCost: 60 }]), teacher())).toEqual({ costToday: 0, monthlyChange: 60 });
  });

  it('investGrowth costs the amount today and pays pct(amount, payoutPercent) a month, shown as a negative change', () => {
    const effects = [{ kind: 'investGrowth', assetType: 'index', amount: 2_000, growthPercent: 4, payoutPercent: 1 }] as const;
    expect(optionCost(option([...effects]), teacher())).toEqual({ costToday: 2_000, monthlyChange: -20 });
  });

  it('repayLargestLoan depends on the player: it costs what it pays and removes that payment', () => {
    // Teacher: student 12,000 at 120 (wins the tie with the car loan), paid down to 10,000 at 100.
    expect(optionCost(option([{ kind: 'repayLargestLoan', amount: 2_000 }]), teacher())).toEqual({ costToday: 2_000, monthlyChange: -20 });
    const debtFree: Player = { ...teacher(), liabilities: [] };
    expect(optionCost(option([{ kind: 'repayLargestLoan', amount: 2_000 }]), debtFree)).toEqual({ costToday: 0, monthlyChange: 0 });
    const small: Player = { ...teacher(), liabilities: [{ id: 'c', kind: 'credit', principal: 500, monthlyPayment: 15 }] };
    expect(optionCost(option([{ kind: 'repayLargestLoan', amount: 2_000 }]), small)).toEqual({ costToday: 500, monthlyChange: -15 });
  });

  it('effects add up: a windfall paid straight to debt nets to zero today', () => {
    const effects = [
      { kind: 'gainCash', amount: 2_000 },
      { kind: 'repayLargestLoan', amount: 2_000 },
    ] as const;
    expect(optionCost(option([...effects]), teacher())).toEqual({ costToday: 0, monthlyChange: -20 });
  });
});

describe('cheapestOption and priciestOption', () => {
  it('cheapest is the lowest monthlyChange, then the lowest costToday; priciest is the reverse', () => {
    const truck = lifeCard('life-001');
    expect(cheapestOption(truck, teacher()).id).toBe('keep');
    expect(priciestOption(truck, teacher()).id).toBe('new');
  });

  it('ties keep card order', () => {
    const refund = lifeCard('life-005');
    expect(cheapestOption(refund, teacher()).id).toBe('invest');
    expect(priciestOption(refund, teacher()).id).toBe('spend');
  });
});

describe('assetCashFlow and passiveIncome with growth assets', () => {
  const index: Asset = { id: 'i', cardId: 'life-005', type: 'index', purchasePrice: 2_000, downPaid: 2_000, marketValue: 2_550, growthPercent: 4, payoutPercent: 1 };
  const savings: Asset = { id: 's', cardId: 'life-005', type: 'savings', purchasePrice: 500, downPaid: 500, marketValue: 505, growthPercent: 1, payoutPercent: 0 };
  const duplex: Asset = { id: 'd', cardId: 'small-001', type: 'rental', purchasePrice: 50_000, downPaid: 5_000, monthlyCashFlow: 160 };

  it('a growth asset pays pct(marketValue, payoutPercent), floored', () => {
    expect(assetCashFlow(index)).toBe(25);
    expect(assetCashFlow(savings)).toBe(0);
  });

  it('other assets pay their stored monthlyCashFlow', () => {
    expect(assetCashFlow(duplex)).toBe(160);
  });

  it('passiveIncome sums both kinds', () => {
    expect(passiveIncome({ ...teacher(), assets: [index, savings, duplex] })).toBe(185);
  });
});
