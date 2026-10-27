// Spec v2, The debrief, attribution rules: one block per row of the table,
// each on a hand-built log. "Paydays afterward" is the player's own
// paydaySnapshot events after the decision. Where the table would count the
// same dollars twice, the reading chosen is pinned here and listed in
// STATUS.md under Questions for Andre.

import type { Debrief, DebriefDecision, LogEntry, LogEvent, PrincipleId } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { deepFreeze } from '../test/deepFreeze';
import { twoPlayerGame } from '../test/fixtures';
import { endTurnEntry, entry, paydayEntries, paydayEntry, paydayEvents, rollEntry, withLog } from '../test/handLog';
import { debrief } from './debrief';

const base = twoPlayerGame();

function adult(log: readonly LogEntry[]): Debrief {
  return debrief(deepFreeze(withLog(base, log)), 'p1', 'adult');
}

/** Every decision the debrief listed, helped first. */
function listed(d: Debrief): readonly DebriefDecision[] {
  return [...d.helped, ...d.hurt];
}

const market = (...events: readonly LogEvent[]): LogEntry => entry({ type: 'ACCEPT_MARKET', playerId: 'p1' }, events);

type Numbers = readonly [optionId: string, costToday: number, monthlyChange: number];

function choseLife(cardId: string, optionId: string, principles: readonly PrincipleId[], chosen: readonly [number, number], cheapest: Numbers, priciest: Numbers): LogEvent {
  return {
    kind: 'choseLifeOption',
    cardId,
    optionId,
    principles: [...principles],
    costToday: chosen[0],
    monthlyChange: chosen[1],
    cheapest: { optionId: cheapest[0], costToday: cheapest[1], monthlyChange: cheapest[2] },
    priciest: { optionId: priciest[0], costToday: priciest[1], monthlyChange: priciest[2] },
  };
}

const lifeEntry = (optionId: string, ...events: readonly LogEvent[]): LogEntry =>
  entry({ type: 'CHOOSE_LIFE_OPTION', playerId: 'p1', optionId }, events);

describe('DEBRIEF attribution: Life Choices option', () => {
  it('DEBRIEF: an option other than the cheapest is hurt by the cheapest monthlyChange minus the chosen one, times Paydays afterward', () => {
    const d = adult([
      lifeEntry(
        'new',
        choseLife('life-001', 'new', ['P5', 'P6'], [0, 380], ['keep', 0, 0], ['new', 0, 380]),
        { kind: 'loanAdded', liabilityId: 'p1-life-001-0-0', loanKind: 'car', principal: 12_000, monthlyPayment: 380 },
      ),
      ...paydayEntries('p1', 3),
    ]);
    expect(d.hurt).toEqual([
      {
        kind: 'lifeChoice',
        ref: { entry: 0, event: 0 },
        outcome: 'hurt',
        impact: -1_140,
        dollars: 1_140,
        principles: ['P5', 'P6'],
        round: 1,
        months: 3,
        cardId: 'life-001',
        optionId: 'new',
        otherOptionId: 'keep',
        todayDifference: 0,
        monthlyDifference: -380,
      },
    ]);
    expect(d.helped).toEqual([]);
  });

  it('DEBRIEF: an option that costs more today than the cheapest is hurt by the difference in cash', () => {
    const d = adult([
      lifeEntry('brands', choseLife('life-011', 'brands', ['P3', 'P6'], [1_200, 0], ['keep', 0, 0], ['brands', 1_200, 0])),
      ...paydayEntries('p1', 2),
    ]);
    expect(d.hurt).toEqual([
      expect.objectContaining({ kind: 'lifeChoice', impact: -1_200, dollars: 1_200, months: 2, otherOptionId: 'keep', todayDifference: -1_200, monthlyDifference: 0 }),
    ]);
  });

  it('DEBRIEF: choosing the cheapest option is helped by what the most expensive option would have cost', () => {
    const d = adult([
      lifeEntry('keep', choseLife('life-001', 'keep', ['P4'], [0, 0], ['keep', 0, 0], ['new', 0, 380])),
      ...paydayEntries('p1', 2),
    ]);
    expect(d.helped).toEqual([
      {
        kind: 'lifeChoice',
        ref: { entry: 0, event: 0 },
        outcome: 'helped',
        impact: 760,
        dollars: 760,
        principles: ['P4'],
        round: 1,
        months: 2,
        cardId: 'life-001',
        optionId: 'keep',
        otherOptionId: 'new',
        todayDifference: 0,
        monthlyDifference: 380,
      },
    ]);
    expect(d.hurt).toEqual([]);
  });

  it("DEBRIEF: Paydays afterward counts only the player's own snapshots after the decision, including a Payday paid while their turn was skipped", () => {
    const d = adult([
      paydayEntry('p1', 1), // before the decision: not counted
      lifeEntry('new', choseLife('life-001', 'new', ['P5', 'P6'], [0, 380], ['keep', 0, 0], ['new', 0, 380])),
      paydayEntry('p2', 1), // another player's Payday: not counted
      endTurnEntry('p2', { kind: 'turnSkipped', playerId: 'p1' }, ...paydayEvents('p1', 2)),
      paydayEntry('p1', 3),
    ]);
    expect(d.hurt).toEqual([expect.objectContaining({ kind: 'lifeChoice', ref: { entry: 1, event: 0 }, months: 2, impact: -760 })]);
  });

  it('DEBRIEF: a decision on the last turn has no Paydays afterward', () => {
    const d = adult([lifeEntry('new', choseLife('life-001', 'new', ['P5', 'P6'], [0, 380], ['keep', 0, 0], ['new', 0, 380]))]);
    expect(listed(d)).toEqual([]);
  });

  it('DEBRIEF: money a windfall option puts in savings is not spent, so saving it is not hurt; the savings are scored as a growth asset', () => {
    const assetId = 'p1-life-029-0-1';
    const d = adult([
      lifeEntry(
        'save',
        choseLife('life-029', 'save', ['P1', 'P8'], [0, 0], ['keep', -1_000, 0], ['save', 0, 0]),
        { kind: 'cashChanged', delta: 1_000, reason: 'windfall' },
        { kind: 'cashChanged', delta: -1_000, reason: 'invest' },
        { kind: 'bought', assetId, cardId: 'life-029', cost: 1_000, principles: ['P1', 'P8'] },
      ),
      paydayEntry('p1', 1, [{ kind: 'valueChanged', assetId, delta: 10, marketValue: 1_010 }]),
      paydayEntry('p1', 2, [{ kind: 'valueChanged', assetId, delta: 10, marketValue: 1_020 }]),
    ]);
    expect(d.hurt).toEqual([]);
    expect(d.helped).toEqual([
      {
        kind: 'growthAsset',
        ref: { entry: 0, event: 3 },
        outcome: 'helped',
        impact: 20,
        dollars: 20,
        principles: ['P8'],
        round: 1,
        months: 2,
        cardId: 'life-029',
        invested: 1_000,
        valueGained: 20,
        payouts: 0,
        sold: false,
      },
    ]);
  });

  it('DEBRIEF: spending a windfall is hurt by the cash keeping it would have left', () => {
    const d = adult([
      lifeEntry(
        'spend',
        choseLife('life-029', 'spend', ['P4'], [0, 0], ['keep', -1_000, 0], ['save', 0, 0]),
        { kind: 'cashChanged', delta: 1_000, reason: 'windfall' },
        { kind: 'cashChanged', delta: -1_000, reason: 'lifeChoice' },
      ),
      ...paydayEntries('p1', 1),
    ]);
    expect(d.hurt).toEqual([
      expect.objectContaining({ kind: 'lifeChoice', impact: -1_000, otherOptionId: 'keep', todayDifference: -1_000, monthlyDifference: 0, months: 1, principles: ['P4'] }),
    ]);
  });

  it("DEBRIEF: investing a windfall is helped by the cash it kept from being spent, and the fund's growth and payouts are scored once, on its growth asset row", () => {
    const assetId = 'p1-life-005-0-1';
    const d = adult([
      lifeEntry(
        'invest',
        choseLife('life-005', 'invest', ['P4', 'P8'], [0, -20], ['invest', 0, -20], ['spend', 0, 0]),
        { kind: 'cashChanged', delta: 2_000, reason: 'windfall' },
        { kind: 'cashChanged', delta: -2_000, reason: 'invest' },
        { kind: 'bought', assetId, cardId: 'life-005', cost: 2_000, principles: ['P4', 'P8'] },
      ),
      // Index fund from the option: growth 4%, payout 1%.
      paydayEntry('p1', 1, [{ kind: 'valueChanged', assetId, delta: 80, marketValue: 2_080 }]),
      paydayEntry('p1', 2, [{ kind: 'valueChanged', assetId, delta: 83, marketValue: 2_163 }]),
    ]);
    expect(d.helped).toEqual([
      expect.objectContaining({ kind: 'lifeChoice', impact: 2_000, otherOptionId: 'spend', todayDifference: 2_000, monthlyDifference: 0, months: 2 }),
      // Payouts pct(2,080, 1) = 20 and pct(2,163, 1) = 21.
      expect.objectContaining({ kind: 'growthAsset', ref: { entry: 0, event: 3 }, impact: 204, invested: 2_000, valueGained: 163, payouts: 41, months: 2 }),
    ]);
  });
});

describe('DEBRIEF attribution: passed a deal', () => {
  const passed = (affordable: boolean, cardId = 'small-001', monthlyCashFlow = 700): LogEntry =>
    entry({ type: 'PASS', playerId: 'p1' }, [
      { kind: 'passed', cardId, principles: ['P2', 'P3', 'P5'], monthlyCashFlow, downPayment: 5_000, affordable },
    ]);

  it('DEBRIEF: passing an affordable deal with positive cash flow is hurt by monthlyCashFlow times Paydays afterward, tagged P2 and P3', () => {
    const d = adult([passed(true), ...paydayEntries('p1', 3)]);
    expect(d.hurt).toEqual([
      {
        kind: 'passedDeal',
        ref: { entry: 0, event: 0 },
        outcome: 'hurt',
        impact: -2_100,
        dollars: 2_100,
        principles: ['P2', 'P3'],
        round: 1,
        months: 3,
        cardId: 'small-001',
        monthlyCashFlow: 700,
      },
    ]);
  });

  it('DEBRIEF: passing a deal the player could not afford, or one with no positive cash flow, is not scored', () => {
    const d = adult([passed(false), passed(true, 'small-004', 0), ...paydayEntries('p1', 3)]);
    expect(listed(d)).toEqual([]);
  });
});

describe('DEBRIEF attribution: bought a deal', () => {
  const bought = (assetId = 'a1', cardId = 'small-001', cost = 5_000, shares?: number): LogEntry =>
    entry({ type: 'BUY', playerId: 'p1', ...(shares === undefined ? {} : { shares }) }, [
      { kind: 'cashChanged', delta: -cost, reason: 'buy' },
      shares === undefined
        ? { kind: 'bought', assetId, cardId, cost, principles: ['P2', 'P3', 'P5'] }
        : { kind: 'bought', assetId, cardId, cost, shares, principles: ['P8', 'P9'] },
    ]);

  it("DEBRIEF: a bought deal is helped by the cash flow it paid across Paydays afterward, tagged with the card's principles", () => {
    const d = adult([bought(), ...paydayEntries('p1', 3)]);
    expect(d.helped).toEqual([
      {
        kind: 'boughtDeal',
        ref: { entry: 0, event: 1 },
        outcome: 'helped',
        impact: 2_100,
        dollars: 2_100,
        principles: ['P2', 'P3', 'P5'],
        round: 1,
        months: 3,
        cardId: 'small-001',
        cost: 5_000,
        cashFlowReceived: 2_100,
      },
    ]);
  });

  it('DEBRIEF: a cash flow a Market card changed counts from the next Payday on', () => {
    const d = adult([
      bought(),
      paydayEntry('p1', 1),
      market({ kind: 'cashFlowChanged', assetId: 'a1', delta: -100, monthlyCashFlow: 600 }),
      ...paydayEntries('p1', 2, 2),
    ]);
    expect(d.helped).toEqual([expect.objectContaining({ kind: 'boughtDeal', cashFlowReceived: 1_900, impact: 1_900, months: 3 })]);
  });

  it('DEBRIEF: a sold deal adds what the sale kept after its mortgage, minus the cash paid, and stops counting cash flow', () => {
    const d = adult([
      bought(),
      ...paydayEntries('p1', 2),
      market(
        { kind: 'sold', assetId: 'a1', cardId: 'small-001', proceeds: 100_000, mortgagePaid: 45_000, principles: ['P2', 'P3', 'P5'] },
        { kind: 'cashChanged', delta: 55_000, reason: 'sell' },
      ),
      paydayEntry('p1', 3),
    ]);
    expect(d.helped).toEqual([
      expect.objectContaining({ kind: 'boughtDeal', cashFlowReceived: 1_400, saleResult: 50_000, impact: 51_400, months: 2 }),
    ]);
  });

  it("DEBRIEF: a stock lot sold in parts counts each sale against that part's share of the cost", () => {
    // Lakeshore Utilities pays $1 a share each month; 10 shares bought at $60.
    const d = adult([
      bought('lot', 'small-007', 600, 10),
      paydayEntry('p1', 1), // floor(10 × 1) = 10
      entry({ type: 'SELL_ASSET', playerId: 'p1', assetId: 'lot', shares: 4 }, [
        { kind: 'cashChanged', delta: 320, reason: 'sell' },
        { kind: 'sold', assetId: 'lot', cardId: 'small-007', proceeds: 320, shares: 4, remainingShares: 6, principles: ['P8', 'P9'] },
      ]),
      paydayEntry('p1', 2), // floor(6 × 1) = 6
      entry({ type: 'SELL_ASSET', playerId: 'p1', assetId: 'lot' }, [
        { kind: 'cashChanged', delta: 300, reason: 'sell' },
        { kind: 'sold', assetId: 'lot', cardId: 'small-007', proceeds: 300, shares: 6, remainingShares: 0, principles: ['P8', 'P9'] },
      ]),
      paydayEntry('p1', 3),
    ]);
    // Cost basis 600 → floor(600 × 6 / 10) = 360 kept, 240 sold: 320 − 240 = 80; then 300 − 360 = −60.
    expect(d.helped).toEqual([
      expect.objectContaining({ kind: 'boughtDeal', cost: 600, cashFlowReceived: 16, saleResult: 20, impact: 36, months: 2, principles: ['P8', 'P9'] }),
    ]);
  });

  it('DEBRIEF: a deal sold for less than it paid back is hurt', () => {
    // Bankruptcy sells the duplex at half price, 25,000, which all goes to the 45,000 mortgage.
    const d = adult([
      bought(),
      paydayEntry('p1', 1),
      rollEntry(
        'p1',
        ...paydayEvents('p1', 2),
        { kind: 'sold', assetId: 'a1', cardId: 'small-001', proceeds: 25_000, mortgagePaid: 25_000, principles: ['P2', 'P3', 'P5'] },
      ),
    ]);
    expect(d.hurt).toEqual([expect.objectContaining({ kind: 'boughtDeal', outcome: 'hurt', cashFlowReceived: 1_400, saleResult: -5_000, impact: -3_600, dollars: 3_600 })]);
  });

  it('DEBRIEF: a growth asset bought through a deal is scored once, as a growth asset held, not again as a bought deal', () => {
    const d = adult([
      entry({ type: 'BUY', playerId: 'p1', amount: 1_000 }, [
        { kind: 'cashChanged', delta: -1_000, reason: 'buy' },
        { kind: 'bought', assetId: 'g1', cardId: 'small-004', cost: 1_000, principles: ['P1', 'P8'] },
      ]),
      paydayEntry('p1', 1, [{ kind: 'valueChanged', assetId: 'g1', delta: 40, marketValue: 1_040 }]),
    ]);
    expect(listed(d)).toEqual([expect.objectContaining({ kind: 'growthAsset', impact: 50, valueGained: 40, payouts: 10 })]);
  });
});

describe('DEBRIEF attribution: bank loan', () => {
  const borrowed = (purpose: 'asset' | 'want' | 'none', amount = 2_000): LogEntry =>
    entry({ type: 'BORROW', playerId: 'p1', amount }, [
      { kind: 'cashChanged', delta: amount, reason: 'borrow' },
      { kind: 'borrowed', liabilityId: 'p1-bank-0', amount, monthlyPayment: amount / 10, principles: ['P5'], purpose },
    ]);

  it('DEBRIEF: a bank loan for a want is hurt by the payments made, tagged P5', () => {
    const d = adult([borrowed('want'), ...paydayEntries('p1', 3)]);
    expect(d.hurt).toEqual([
      {
        kind: 'bankLoan',
        ref: { entry: 0, event: 1 },
        outcome: 'hurt',
        impact: -600,
        dollars: 600,
        principles: ['P5'],
        round: 1,
        months: 3,
        purpose: 'want',
        amount: 2_000,
        monthlyPayment: 200,
      },
    ]);
  });

  it("DEBRIEF: a bank loan for an asset is neutral: the asset's own row carries the result", () => {
    const d = adult([borrowed('asset'), ...paydayEntries('p1', 3)]);
    expect(listed(d)).toEqual([]);
  });

  it('DEBRIEF: a bank loan taken with nothing pending is hurt like a loan for a want', () => {
    const d = adult([borrowed('none'), ...paydayEntries('p1', 1)]);
    expect(d.hurt).toEqual([expect.objectContaining({ kind: 'bankLoan', purpose: 'none', impact: -200, months: 1 })]);
  });

  it('DEBRIEF: a loan costs less after a paydown and stops costing once repaid', () => {
    const d = adult([
      borrowed('want'),
      paydayEntry('p1', 1), // 200
      lifeEntry('payDebt', { kind: 'paidDown', liabilityId: 'p1-bank-0', amount: 1_000, principal: 1_000, monthlyPayment: 100 }),
      paydayEntry('p1', 2), // 100
      entry({ type: 'REPAY', playerId: 'p1', liabilityId: 'p1-bank-0' }, [
        { kind: 'cashChanged', delta: -1_000, reason: 'repay' },
        { kind: 'repaid', liabilityId: 'p1-bank-0', principal: 1_000, principles: ['P5'] },
      ]),
      paydayEntry('p1', 3), // repaid: nothing
    ]);
    expect(d.hurt).toEqual([expect.objectContaining({ kind: 'bankLoan', impact: -300, months: 2 })]);
  });
});

describe('DEBRIEF attribution: Setback auto-loan', () => {
  it('DEBRIEF: a Setback auto-loan is hurt by the payments made on it, tagged P1, and is not scored again as a bank loan', () => {
    const d = adult([
      rollEntry(
        'p1',
        ...paydayEvents('p1', 1), // events 0 and 1: before the loan
        { kind: 'rolled', value: 6 },
        { kind: 'moved', from: 0, to: 6 },
        { kind: 'drewCard', deck: 'setback', cardId: 'setback-001' },
        { kind: 'cashChanged', delta: 4_000, reason: 'borrow' },
        { kind: 'borrowed', liabilityId: 'p1-bank-0', amount: 4_000, monthlyPayment: 400, principles: ['P1'], purpose: 'setback', cardId: 'setback-001' },
        { kind: 'cashChanged', delta: -3_500, reason: 'setback' },
        { kind: 'setback', cardId: 'setback-001', cost: 3_500, autoBorrowed: 4_000, skipsNextTurn: true },
      ),
      ...paydayEntries('p1', 2, 2),
    ]);
    expect(listed(d)).toEqual([
      {
        kind: 'setbackLoan',
        ref: { entry: 0, event: 6 },
        outcome: 'hurt',
        impact: -800,
        dollars: 800,
        principles: ['P1'],
        round: 1,
        months: 2,
        cardId: 'setback-001',
        amount: 4_000,
        monthlyPayment: 400,
      },
    ]);
  });
});

describe('DEBRIEF attribution: subscription', () => {
  const subscribed = (cardId: string, optionId: string, monthlyCost: number, chose: LogEvent): LogEntry =>
    lifeEntry(optionId, chose, { kind: 'subscriptionAdded', liabilityId: `p1-${cardId}-0-0`, monthlyCost });

  it('DEBRIEF: a subscription is hurt by monthlyCost times the Paydays it ran, tagged P7, and its Life Choices row does not count it again', () => {
    const d = adult([
      subscribed('life-004', 'subscribe', 60, choseLife('life-004', 'subscribe', ['P7'], [0, 60], ['skip', 0, 0], ['subscribe', 0, 60])),
      ...paydayEntries('p1', 3),
    ]);
    expect(listed(d)).toEqual([
      {
        kind: 'subscription',
        ref: { entry: 0, event: 1 },
        outcome: 'hurt',
        impact: -180,
        dollars: 180,
        principles: ['P7'],
        round: 1,
        months: 3,
        cardId: 'life-004',
        optionId: 'subscribe',
        monthlyCost: 60,
        cancelled: false,
      },
    ]);
  });

  it('DEBRIEF: a cancelled subscription stops costing at the cancel', () => {
    const d = adult([
      subscribed('life-004', 'subscribe', 60, choseLife('life-004', 'subscribe', ['P7'], [0, 60], ['skip', 0, 0], ['subscribe', 0, 60])),
      ...paydayEntries('p1', 2),
      entry({ type: 'REPAY', playerId: 'p1', liabilityId: 'p1-life-004-0-0' }, [
        { kind: 'repaid', liabilityId: 'p1-life-004-0-0', principal: 0, principles: ['P7'] },
      ]),
      ...paydayEntries('p1', 2, 3),
    ]);
    expect(d.hurt).toEqual([expect.objectContaining({ kind: 'subscription', impact: -120, months: 2, cancelled: true })]);
  });

  it('DEBRIEF: skipping a subscription is helped by what it would have cost', () => {
    const d = adult([
      lifeEntry('skip', choseLife('life-004', 'skip', ['P7'], [0, 0], ['skip', 0, 0], ['subscribe', 0, 60])),
      ...paydayEntries('p1', 3),
    ]);
    expect(d.helped).toEqual([expect.objectContaining({ kind: 'lifeChoice', impact: 180, otherOptionId: 'subscribe', monthlyDifference: 60, principles: ['P7'] })]);
  });

  it('DEBRIEF: an option with a price today and a subscription is two decisions, the subscription counted once', () => {
    const d = adult([
      subscribed('life-015', 'pass', 20, choseLife('life-015', 'pass', ['P6', 'P7'], [500, 20], ['skip', 0, 0], ['pass', 500, 20])),
      ...paydayEntries('p1', 3),
    ]);
    expect(d.hurt).toEqual([
      expect.objectContaining({ kind: 'lifeChoice', impact: -500, todayDifference: -500, monthlyDifference: 0 }),
      expect.objectContaining({ kind: 'subscription', impact: -60, monthlyCost: 20, months: 3 }),
    ]);
  });
});

describe('DEBRIEF attribution: growth asset held', () => {
  const invested = entry({ type: 'BUY', playerId: 'p1', amount: 1_000 }, [
    { kind: 'cashChanged', delta: -1_000, reason: 'buy' },
    { kind: 'bought', assetId: 'g1', cardId: 'small-004', cost: 1_000, principles: ['P1', 'P8'] },
  ]);
  // Total Market Index Fund: growth 4%, payout 1%.
  const grow = (delta: number, marketValue: number): LogEvent => ({ kind: 'valueChanged', assetId: 'g1', delta, marketValue });

  it('DEBRIEF: a growth asset held is helped by value gained plus payouts received, tagged P8', () => {
    const d = adult([invested, paydayEntry('p1', 1, [grow(40, 1_040)]), paydayEntry('p1', 2, [grow(41, 1_081)])]);
    expect(d.helped).toEqual([
      {
        kind: 'growthAsset',
        ref: { entry: 0, event: 1 },
        outcome: 'helped',
        impact: 101,
        dollars: 101,
        principles: ['P8'],
        round: 1,
        months: 2,
        cardId: 'small-004',
        invested: 1_000,
        valueGained: 81,
        payouts: 20,
        sold: false,
      },
    ]);
  });

  it('DEBRIEF: a growth asset sold counts its sale price as its final value and stops paying', () => {
    const d = adult([
      invested,
      paydayEntry('p1', 1, [grow(40, 1_040)]),
      paydayEntry('p1', 2, [grow(41, 1_081)]),
      entry({ type: 'SELL_ASSET', playerId: 'p1', assetId: 'g1' }, [
        { kind: 'cashChanged', delta: 1_081, reason: 'sell' },
        { kind: 'sold', assetId: 'g1', cardId: 'small-004', proceeds: 1_081, principles: ['P1', 'P8'] },
      ]),
      paydayEntry('p1', 3),
    ]);
    expect(d.helped).toEqual([expect.objectContaining({ kind: 'growthAsset', valueGained: 81, payouts: 20, impact: 101, sold: true, months: 2 })]);
  });

  it('DEBRIEF: a growth asset that lost value in a crash is hurt', () => {
    const d = adult([
      invested,
      paydayEntry('p1', 1, [grow(40, 1_040)]), // payout 10
      market(grow(-520, 520)),
      paydayEntry('p1', 2, [grow(20, 540)]), // payout pct(540, 1) = 5
    ]);
    expect(d.hurt).toEqual([expect.objectContaining({ kind: 'growthAsset', outcome: 'hurt', valueGained: -460, payouts: 15, impact: -445 })]);
  });
});

describe('DEBRIEF attribution: gave', () => {
  it('DEBRIEF: a gift is helped by the amount given, never a loss, tagged P10', () => {
    const d = adult([
      entry({ type: 'GIVE', playerId: 'p1' }, [
        { kind: 'cashChanged', delta: -300, reason: 'give' },
        { kind: 'gave', amount: 300, favorTokens: 1, principles: ['P10'] },
      ]),
      ...paydayEntries('p1', 2),
    ]);
    expect(d.helped).toEqual([
      { kind: 'gave', ref: { entry: 0, event: 1 }, outcome: 'helped', impact: 300, dollars: 300, principles: ['P10'], round: 1, months: 0 },
    ]);
    expect(d.hurt).toEqual([]);
  });

  it('DEBRIEF: cash a Generosity option gives away is a gift, never a Life Choices cost', () => {
    const d = adult([
      lifeEntry('give', choseLife('life-026', 'give', ['P10'], [500, 0], ['help', 0, 0], ['big', 1_500, 0]), {
        kind: 'cashChanged',
        delta: -500,
        reason: 'lifeChoice',
      }),
      ...paydayEntries('p1', 1),
    ]);
    expect(listed(d)).toEqual([
      {
        kind: 'gave',
        ref: { entry: 0, event: 0 },
        outcome: 'helped',
        impact: 500,
        dollars: 500,
        principles: ['P10'],
        round: 1,
        months: 0,
        cardId: 'life-026',
        optionId: 'give',
      },
    ]);
  });
});
