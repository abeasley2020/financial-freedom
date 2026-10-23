import { CARDS_BY_ID, type Action, type GameState, type Liability, type Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { debtPayments, monthlyCashFlow, passiveIncome, playerById, totalExpenses } from '../selectors';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { drawn, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

// Spec v2, Card decks, Life Choices cards. Fixtures (packages/shared/src/data/cards/life-choices.json):
//   life-001 Your Truck Is Nine Years Old (vehicle): keep [] | used payCash 4,000 | new addLoan car 12,000 at 380/mo (not kidsOk)
//   life-002 Family Beach Week (bigLife):            stay [] | go payCash 2,500
//   life-003 Big Screen and Sound System (gadget):   keep [] | cash payCash 1,800 | finance addLoan lifestyle 1,800 at 90/mo
//   life-004 Streaming Bundle (subscription):        skip [] | subscribe addSubscription 60/mo
//   life-005 Tax Refund (windfall, 2,000):           spend gain 2,000 + pay 2,000 | invest gain 2,000 + investGrowth index 2,000 (4%, 1%) | payDebt gain 2,000 + repayLargestLoan 2,000
// Ada the Teacher (p1) starts with 400 cash, totalExpenses 2,600, cash flow 700; `drawn` walks a real
// ROLL onto Life Choices (space 1), so its Payday adds 700 first: she faces the card holding 1,100.

const choose = (optionId: string, playerId = 'p1'): Action => ({ type: 'CHOOSE_LIFE_OPTION', playerId, optionId });
const p1 = (state: GameState) => playerById(state, 'p1');
const withCash = (cash: number, state = twoPlayerGame()) => withPlayer(state, 'p1', { cash });

describe('CHOOSE_LIFE_OPTION: the free option', () => {
  it('CHOOSE_LIFE_OPTION: an option with no effects changes nothing but the decision and the discard pile', () => {
    const before = drawn(twoPlayerGame(), 'life-001');
    expect(before.pending).toEqual({ kind: 'lifeChoice', cardId: 'life-001' });
    const next = apply(before, choose('keep'));
    expect(next.players).toEqual(before.players);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.decks.lifeChoices.drawPile).toEqual(before.decks.lifeChoices.drawPile);
    expect(next.decks.lifeChoices.discardPile).toEqual([...before.decks.lifeChoices.discardPile, 'life-001']);
  });

  it('CHOOSE_LIFE_OPTION: the free option is always affordable, even with zero cash', () => {
    const next = apply(drawn(withCash(0), 'life-002'), choose('stay'));
    expect(p1(next).cash).toBe(700);
    expect(next.pending).toEqual({ kind: 'none' });
  });

  it('CHOOSE_LIFE_OPTION: every fixture card offers an option with no monthly cost (spec: temptation needs a no)', () => {
    for (const card of CARDS_BY_ID.values()) {
      if (card.deck !== 'lifeChoices') continue;
      const free = card.options.some((o) => !o.effects.some((e) => e.kind === 'addLoan' || e.kind === 'addSubscription'));
      expect(free, card.id).toBe(true);
    }
  });
});

describe('CHOOSE_LIFE_OPTION: paying cash', () => {
  it('CHOOSE_LIFE_OPTION: payCash takes the amount from cash and adds no liability', () => {
    const before = drawn(withCash(5_000), 'life-001');
    const next = apply(before, choose('used'));
    expect(p1(next).cash).toBe(5_700 - 4_000);
    expect(p1(next).liabilities).toEqual(p1(before).liabilities);
    expect(monthlyCashFlow(p1(next))).toBe(700);
  });

  it('CHOOSE_LIFE_OPTION: accepts when cash exactly equals the cost, leaving zero', () => {
    expect(p1(apply(drawn(withCash(1_800), 'life-002'), choose('go'))).cash).toBe(0);
  });

  it('CHOOSE_LIFE_OPTION: rejected with INSUFFICIENT_CASH one dollar short, and the card stays pending', () => {
    const before = drawn(withCash(1_799), 'life-002');
    expect(p1(before).cash).toBe(2_499);
    expect(reject(before, choose('go'))).toBe('INSUFFICIENT_CASH');
    expect(before.pending).toEqual({ kind: 'lifeChoice', cardId: 'life-002' });
  });

  it('CHOOSE_LIFE_OPTION: a short player can BORROW first and then pay (spec, turn step 4)', () => {
    const short = drawn(twoPlayerGame(), 'life-002');
    expect(reject(short, choose('go'))).toBe('INSUFFICIENT_CASH');
    const funded = apply(short, { type: 'BORROW', playerId: 'p1', amount: 2_000 });
    expect(funded.pending).toEqual({ kind: 'lifeChoice', cardId: 'life-002' });
    const paid = apply(funded, choose('go'));
    expect(p1(paid).cash).toBe(1_100 + 2_000 - 2_500);
    expect(paid.pending).toEqual({ kind: 'none' });
  });
});

describe('CHOOSE_LIFE_OPTION: loans and subscriptions', () => {
  it('CHOOSE_LIFE_OPTION: addLoan adds a car loan with the stated payment, principal, and source card; cash unchanged', () => {
    const before = drawn(twoPlayerGame(), 'life-001');
    const next = apply(before, choose('new'));
    expect(p1(next).cash).toBe(1_100);
    expect(p1(next).liabilities).toEqual([
      ...p1(before).liabilities,
      { id: expect.any(String) as string, kind: 'car', principal: 12_000, monthlyPayment: 380, sourceCardId: 'life-001' },
    ]);
    expect(totalExpenses(p1(next))).toBe(2_600 + 380);
    expect(monthlyCashFlow(p1(next))).toBe(700 - 380);
  });

  it('CHOOSE_LIFE_OPTION: addLoan of kind lifestyle works the same way', () => {
    const next = apply(drawn(twoPlayerGame(), 'life-003'), choose('finance'));
    expect(p1(next).liabilities.at(-1)).toEqual({
      id: expect.any(String) as string,
      kind: 'lifestyle',
      principal: 1_800,
      monthlyPayment: 90,
      sourceCardId: 'life-003',
    });
  });

  it('CHOOSE_LIFE_OPTION: two loans from the same card on different turns are separate liabilities', () => {
    const first = apply(drawn(twoPlayerGame(), 'life-003'), choose('finance'));
    const nextTurn = withGame(apply(first, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const second = apply(drawn(nextTurn, 'life-003'), choose('finance'));
    const loans = p1(second).liabilities.filter((l) => l.kind === 'lifestyle');
    expect(loans).toHaveLength(2);
    expect(loans[0]?.id).not.toBe(loans[1]?.id);
    expect(monthlyCashFlow(p1(second))).toBe(700 - 180);
  });

  it('CHOOSE_LIFE_OPTION: addSubscription adds a subscription liability with principal 0 and the monthly cost', () => {
    const before = drawn(twoPlayerGame(), 'life-004');
    const next = apply(before, choose('subscribe'));
    expect(p1(next).cash).toBe(1_100);
    expect(p1(next).liabilities.at(-1)).toEqual({
      id: expect.any(String) as string,
      kind: 'subscription',
      principal: 0,
      monthlyPayment: 60,
      sourceCardId: 'life-004',
    });
    expect(debtPayments(p1(next))).toBe(300 + 60);
  });

  it('CHOOSE_LIFE_OPTION: a subscription charges every Payday until cancelled', () => {
    const subscribed = apply(drawn(twoPlayerGame(), 'life-004'), choose('subscribe'));
    const nextTurn = withGame(apply(subscribed, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const paid = drawn(nextTurn, 'life-002');
    expect(p1(paid).cash).toBe(1_100 + 700 - 60);
  });

  it('CHOOSE_LIFE_OPTION: a Life Choices loan is allowed in kids mode (it is not a bank loan)', () => {
    const next = apply(drawn(twoPlayerGame({ mode: 'kids' }), 'life-003'), choose('finance'));
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'lifestyle', sourceCardId: 'life-003' });
  });

  it('CHOOSE_LIFE_OPTION: kids may take subscriptions (decided 2026-10-23, Q6)', () => {
    const next = apply(drawn(twoPlayerGame({ mode: 'kids' }), 'life-004'), choose('subscribe'));
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'subscription', monthlyPayment: 60 });
  });
});

describe('CHOOSE_LIFE_OPTION: windfalls', () => {
  it('CHOOSE_LIFE_OPTION: spending a windfall gains and pays the cash, net zero today', () => {
    const before = drawn(twoPlayerGame(), 'life-005');
    const next = apply(before, choose('spend'));
    expect(p1(next).cash).toBe(1_100);
    expect(p1(next).assets).toEqual([]);
    expect(p1(next).liabilities).toEqual(p1(before).liabilities);
  });

  it('CHOOSE_LIFE_OPTION: investGrowth turns the windfall into a growth asset at marketValue, with derived cash flow', () => {
    const next = apply(drawn(twoPlayerGame(), 'life-005'), choose('invest'));
    expect(p1(next).cash).toBe(1_100);
    expect(p1(next).assets).toEqual([
      {
        id: expect.any(String) as string,
        cardId: 'life-005',
        type: 'index',
        purchasePrice: 2_000,
        downPaid: 2_000,
        marketValue: 2_000,
        growthPercent: 4,
        payoutPercent: 1,
      },
    ]);
    expect(p1(next).assets[0]).not.toHaveProperty('monthlyCashFlow');
    expect(passiveIncome(p1(next))).toBe(20);
    expect(monthlyCashFlow(p1(next))).toBe(720);
  });

  it('CHOOSE_LIFE_OPTION: repayLargestLoan pays down the loan with the highest payment (ties: highest principal) and recomputes a percent-based payment', () => {
    // Teacher: student 12,000 at 120/mo, car 6,000 at 120/mo, credit 2,000 at 60/mo. Student wins the tie.
    const before = drawn(twoPlayerGame(), 'life-005');
    const next = apply(before, choose('payDebt'));
    expect(p1(next).cash).toBe(1_100);
    expect(p1(next).liabilities.find((l) => l.id === 'p1-student-0')).toEqual({
      id: 'p1-student-0',
      kind: 'student',
      principal: 10_000,
      monthlyPayment: 100,
    });
    expect(debtPayments(p1(next))).toBe(300 - 20);
  });

  it('CHOOSE_LIFE_OPTION: repayLargestLoan removes a loan it pays off and keeps the leftover windfall as cash', () => {
    const base = twoPlayerGame();
    const credit = p1(base).liabilities.find((l) => l.kind === 'credit');
    if (credit === undefined) throw new Error('fixture: teacher has a credit card');
    const onlyCredit = withPlayer(base, 'p1', { liabilities: [credit] });
    const next = apply(drawn(onlyCredit, 'life-005'), choose('payDebt'));
    expect(p1(next).liabilities).toEqual([]);
    // Cash flow is 700 + 240 (two loans gone) = 940 at Payday, then +2,000 windfall, −2,000 paid.
    expect(p1(next).cash).toBe(400 + 940 + 2_000 - 2_000);
  });

  it('CHOOSE_LIFE_OPTION: repayLargestLoan never targets a mortgage or a subscription', () => {
    const base = twoPlayerGame();
    const mortgage: Liability = { id: 'm', kind: 'mortgage', principal: 45_000, monthlyPayment: 0, assetId: 'dup' };
    const sub: Liability = { id: 's', kind: 'subscription', principal: 0, monthlyPayment: 900, sourceCardId: 'life-004' };
    const holder = withPlayer(base, 'p1', {
      assets: [{ id: 'dup', cardId: 'small-001', type: 'rental', purchasePrice: 50_000, downPaid: 5_000, monthlyCashFlow: 160 }],
      liabilities: [mortgage, sub, { id: 'c', kind: 'credit', principal: 500, monthlyPayment: 15 }],
    });
    const next = apply(drawn(holder, 'life-005'), choose('payDebt'));
    expect(p1(next).liabilities).toEqual([mortgage, sub]);
    expect(p1(next).cash).toBe(p1(drawn(holder, 'life-005')).cash + 2_000 - 500);
  });

  it('CHOOSE_LIFE_OPTION: repayLargestLoan keeps a stated payment when the loan came from a card and is only paid down', () => {
    const base = twoPlayerGame();
    const truck: Liability = { id: 't', kind: 'car', principal: 12_000, monthlyPayment: 380, sourceCardId: 'life-001' };
    const holder = withPlayer(base, 'p1', { liabilities: [truck] });
    const next = apply(drawn(holder, 'life-005'), choose('payDebt'));
    expect(p1(next).liabilities).toEqual([{ ...truck, principal: 10_000 }]);
  });

  it('CHOOSE_LIFE_OPTION: repayLargestLoan with no loans pays nothing and the windfall stays as cash', () => {
    const next = apply(drawn(withPlayer(twoPlayerGame(), 'p1', { liabilities: [] }), 'life-005'), choose('payDebt'));
    expect(p1(next).cash).toBe(400 + 1_000 + 2_000);
  });
});

describe('CHOOSE_LIFE_OPTION: which options', () => {
  it('CHOOSE_LIFE_OPTION: rejected with INVALID_OPTION for an id the card does not offer', () => {
    const before = drawn(twoPlayerGame(), 'life-001');
    expect(reject(before, choose('jetpack'))).toBe('INVALID_OPTION');
    expect(before.pending).toEqual({ kind: 'lifeChoice', cardId: 'life-001' });
  });

  it('CHOOSE_LIFE_OPTION: in kids mode an option that is not kidsOk is rejected with INVALID_OPTION', () => {
    const kids = drawn(twoPlayerGame({ mode: 'kids' }), 'life-001');
    const truck = CARDS_BY_ID.get('life-001');
    expect(truck?.deck === 'lifeChoices' ? truck.options.find((o) => o.id === 'new')?.kidsOk : undefined).toBe(false);
    expect(reject(kids, choose('new'))).toBe('INVALID_OPTION');
    expect(apply(kids, choose('keep')).pending).toEqual({ kind: 'none' });
  });

  it('CHOOSE_LIFE_OPTION: in standard mode the same option is allowed', () => {
    expect(apply(drawn(twoPlayerGame(), 'life-001'), choose('new')).pending).toEqual({ kind: 'none' });
  });
});

describe('CHOOSE_LIFE_OPTION: log and determinism', () => {
  it('CHOOSE_LIFE_OPTION: logs the decision with both numbers for the chosen, cheapest, and priciest options, then the effects', () => {
    const next = apply(drawn(withCash(5_000), 'life-001'), choose('used'));
    expect(next.game.log.at(-1)).toEqual({
      turnNumber: 0,
      action: choose('used'),
      events: [
        {
          kind: 'choseLifeOption',
          cardId: 'life-001',
          optionId: 'used',
          principles: ['P4', 'P6'],
          costToday: 4_000,
          monthlyChange: 0,
          cheapest: { optionId: 'keep', costToday: 0, monthlyChange: 0 },
          priciest: { optionId: 'new', costToday: 0, monthlyChange: 380 },
        },
        { kind: 'cashChanged', delta: -4_000, reason: 'lifeChoice' },
      ],
    });
  });

  it('CHOOSE_LIFE_OPTION: a loan option logs loanAdded', () => {
    const next = apply(drawn(twoPlayerGame(), 'life-001'), choose('new'));
    const liabilityId = p1(next).liabilities.at(-1)?.id;
    expect(next.game.log.at(-1)?.events).toEqual([
      expect.objectContaining({ kind: 'choseLifeOption', optionId: 'new', costToday: 0, monthlyChange: 380 }),
      { kind: 'loanAdded', liabilityId, loanKind: 'car', principal: 12_000, monthlyPayment: 380 },
    ]);
  });

  it('CHOOSE_LIFE_OPTION: a subscription option logs subscriptionAdded', () => {
    const next = apply(drawn(twoPlayerGame(), 'life-004'), choose('subscribe'));
    const liabilityId = p1(next).liabilities.at(-1)?.id;
    expect(next.game.log.at(-1)?.events.slice(1)).toEqual([{ kind: 'subscriptionAdded', liabilityId, monthlyCost: 60 }]);
  });

  it('CHOOSE_LIFE_OPTION: a windfall invested logs the gain and a bought event with the option principles', () => {
    const next = apply(drawn(twoPlayerGame(), 'life-005'), choose('invest'));
    const assetId = p1(next).assets[0]?.id;
    expect(next.game.log.at(-1)?.events.slice(1)).toEqual([
      { kind: 'cashChanged', delta: 2_000, reason: 'windfall' },
      { kind: 'cashChanged', delta: -2_000, reason: 'invest' },
      { kind: 'bought', assetId, cardId: 'life-005', cost: 2_000, principles: ['P4', 'P8'] },
    ]);
  });

  it('CHOOSE_LIFE_OPTION: a windfall used on debt logs paidDown, or repaid when the loan is cleared', () => {
    const base = twoPlayerGame();
    const partial = apply(drawn(base, 'life-005'), choose('payDebt'));
    expect(partial.game.log.at(-1)?.events.slice(1)).toEqual([
      { kind: 'cashChanged', delta: 2_000, reason: 'windfall' },
      { kind: 'cashChanged', delta: -2_000, reason: 'repay' },
      { kind: 'paidDown', liabilityId: 'p1-student-0', amount: 2_000, principal: 10_000, monthlyPayment: 100 },
    ]);
    const credit = p1(base).liabilities.find((l) => l.kind === 'credit');
    if (credit === undefined) throw new Error('fixture: teacher has a credit card');
    const full = apply(drawn(withPlayer(base, 'p1', { liabilities: [credit] }), 'life-005'), choose('payDebt'));
    expect(full.game.log.at(-1)?.events.slice(1)).toEqual([
      { kind: 'cashChanged', delta: 2_000, reason: 'windfall' },
      { kind: 'cashChanged', delta: -2_000, reason: 'repay' },
      { kind: 'repaid', liabilityId: 'p1-credit-2', principal: 2_000, principles: ['P5'] },
    ]);
  });

  it('CHOOSE_LIFE_OPTION: the cheapest option is the lowest monthlyChange, then the lowest costToday', () => {
    // life-005 for the Teacher: spend (0, 0), invest (0, -20), payDebt (0, -20). Ties keep card order, so invest.
    const next = apply(drawn(twoPlayerGame(), 'life-005'), choose('spend'));
    expect(next.game.log.at(-1)?.events[0]).toMatchObject({
      kind: 'choseLifeOption',
      cheapest: { optionId: 'invest', costToday: 0, monthlyChange: -20 },
      priciest: { optionId: 'spend', costToday: 0, monthlyChange: 0 },
    });
  });

  it('CHOOSE_LIFE_OPTION: is deterministic, including liability and asset ids', () => {
    const before = deepFreeze(drawn(twoPlayerGame(), 'life-005'));
    expect(JSON.stringify(reduce(before, choose('invest')))).toBe(JSON.stringify(reduce(before, choose('invest'))));
  });

  it('CHOOSE_LIFE_OPTION: does not touch rngState', () => {
    const before = drawn(twoPlayerGame(), 'life-001');
    expect(apply(before, choose('keep')).game.rngState).toBe(before.game.rngState);
  });

  it('CHOOSE_LIFE_OPTION: the turn can end afterwards', () => {
    const chosen = apply(drawn(twoPlayerGame(), 'life-001'), choose('keep'));
    expect(reduce(deepFreeze(chosen), { type: 'END_TURN', playerId: 'p1' }).ok).toBe(true);
  });

  it('CHOOSE_LIFE_OPTION: does not touch the other player, position, or assets', () => {
    const before = drawn(withCash(5_000), 'life-001');
    const next = apply(before, choose('used'));
    expect(next.players[1]).toEqual(before.players[1]);
    expect(p1(next).position).toBe(p1(before).position);
    expect(p1(next).assets).toEqual(p1(before).assets);
  });
});

describe('CHOOSE_LIFE_OPTION: rejections', () => {
  it('CHOOSE_LIFE_OPTION: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(drawn(twoPlayerGame(), 'life-001'), choose('keep', 'p2'))).toBe('NOT_YOUR_TURN');
  });

  const pendings: Pending[] = [
    { kind: 'none' },
    { kind: 'chooseDealSize' },
    { kind: 'buyOrPass', cardId: 'small-001' },
    { kind: 'marketChoice', cardId: 'market-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('CHOOSE_LIFE_OPTION: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...withCash(10_000), pending }, choose('keep'))).toBe('INVALID_FOR_PENDING');
  });

  it.each(['lobby', 'finished'] as const)('CHOOSE_LIFE_OPTION: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(drawn(twoPlayerGame(), 'life-001'), { phase }), choose('keep'))).toBe('GAME_NOT_PLAYING');
  });

  it('CHOOSE_LIFE_OPTION: throws on an unknown card id in the decision (programmer bug)', () => {
    const broken: GameState = { ...twoPlayerGame(), pending: { kind: 'lifeChoice', cardId: 'life-999' } };
    expect(() => reduce(deepFreeze(broken), choose('keep'))).toThrow(/life-999/);
  });

  it('CHOOSE_LIFE_OPTION: a rejected choice is not logged', () => {
    const before = deepFreeze(drawn(withCash(0), 'life-002'));
    const logBefore = before.game.log.length;
    expect(reduce(before, choose('go')).ok).toBe(false);
    expect(before.game.log).toHaveLength(logBefore);
  });
});
