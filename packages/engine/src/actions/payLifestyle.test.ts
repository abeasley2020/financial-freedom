import type { Action, GameState, Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { debtPayments, monthlyCashFlow, playerById, totalExpenses } from '../selectors';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { drawn, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

// Fixtures used here:
//   life-001 New Truck: cash 4,000, or loan 380/mo on 12,000 principal
//   life-002 Family Beach Week: cash 2,500 only
//   life-003 Big Screen: cash 1,800, or loan 90/mo on 1,800 principal
// Ada the Teacher (p1) starts with 400 cash, totalExpenses 2,600, cash flow 700.

const payCash: Action = { type: 'PAY_LIFESTYLE', playerId: 'p1', method: 'cash' };
const payLoan: Action = { type: 'PAY_LIFESTYLE', playerId: 'p1', method: 'loan' };
const p1 = (state: GameState) => playerById(state, 'p1');
const withCash = (cash: number, state = twoPlayerGame()) => withPlayer(state, 'p1', { cash });

describe('PAY_LIFESTYLE: paying cash', () => {
  it('PAY_LIFESTYLE: pays cashCost from cash and adds no liability', () => {
    const before = drawn(withCash(3_000), 'life-002');
    expect(before.pending).toEqual({ kind: 'payLifestyle', cardId: 'life-002' });
    const next = apply(before, payCash);
    expect(p1(next).cash).toBe(500);
    expect(p1(next).liabilities).toEqual(p1(before).liabilities);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(monthlyCashFlow(p1(next))).toBe(700);
  });

  it('PAY_LIFESTYLE: cash is allowed on a card that also offers a loan', () => {
    const next = apply(drawn(withCash(5_000), 'life-001'), payCash);
    expect(p1(next).cash).toBe(1_000);
    expect(p1(next).liabilities.some((l) => l.kind === 'lifestyle')).toBe(false);
  });

  it('PAY_LIFESTYLE: accepts when cash exactly equals cashCost, leaving zero cash', () => {
    expect(p1(apply(drawn(withCash(2_500), 'life-002'), payCash)).cash).toBe(0);
  });

  it('PAY_LIFESTYLE: rejected with INSUFFICIENT_CASH one dollar short, and the card stays pending', () => {
    const before = drawn(withCash(2_499), 'life-002');
    expect(reject(before, payCash)).toBe('INSUFFICIENT_CASH');
    expect(before.pending).toEqual({ kind: 'payLifestyle', cardId: 'life-002' });
  });

  it('PAY_LIFESTYLE: a short player can BORROW first and then pay cash', () => {
    const short = drawn(twoPlayerGame(), 'life-002');
    expect(reject(short, payCash)).toBe('INSUFFICIENT_CASH');
    const funded = apply(short, { type: 'BORROW', playerId: 'p1', amount: 3_000 });
    const paid = apply(funded, payCash);
    expect(p1(paid).cash).toBe(400 + 3_000 - 2_500);
    expect(paid.pending).toEqual({ kind: 'none' });
  });

  it('PAY_LIFESTYLE: sends the card to the lifestyle discard pile', () => {
    const before = drawn(withCash(3_000), 'life-002');
    const next = apply(before, payCash);
    expect(next.decks.lifestyle.drawPile).toEqual(before.decks.lifestyle.drawPile);
    expect(next.decks.lifestyle.discardPile).toEqual([...before.decks.lifestyle.discardPile, 'life-002']);
  });
});

describe('PAY_LIFESTYLE: taking the loan', () => {
  it('PAY_LIFESTYLE: adds a lifestyle liability with the card payment, principal, and sourceCardId; cash unchanged', () => {
    const before = drawn(twoPlayerGame(), 'life-001');
    const next = apply(before, payLoan);
    expect(p1(next).cash).toBe(400);
    expect(p1(next).liabilities).toEqual([
      ...p1(before).liabilities,
      {
        id: expect.any(String) as string,
        kind: 'lifestyle',
        principal: 12_000,
        monthlyPayment: 380,
        sourceCardId: 'life-001',
      },
    ]);
    expect(next.pending).toEqual({ kind: 'none' });
  });

  it('PAY_LIFESTYLE: the loan raises totalExpenses and lowers monthly cash flow by the card payment', () => {
    const before = drawn(twoPlayerGame(), 'life-001');
    const next = apply(before, payLoan);
    expect(debtPayments(p1(next))).toBe(debtPayments(p1(before)) + 380);
    expect(totalExpenses(p1(next))).toBe(2_600 + 380);
    expect(monthlyCashFlow(p1(next))).toBe(700 - 380);
  });

  it('PAY_LIFESTYLE: the loan works with zero cash on hand', () => {
    const next = apply(drawn(withCash(0), 'life-003'), payLoan);
    expect(p1(next).cash).toBe(0);
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'lifestyle', principal: 1_800, monthlyPayment: 90 });
  });

  it('PAY_LIFESTYLE: a lifestyle loan can push monthly cash flow negative', () => {
    const first = apply(drawn(twoPlayerGame(), 'life-001'), payLoan);
    const nextTurn = withGame(apply(first, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const second = apply(drawn(nextTurn, 'life-001'), payLoan);
    expect(monthlyCashFlow(p1(second))).toBe(700 - 380 - 380);
  });

  it('PAY_LIFESTYLE: two loans from the same card are separate liabilities with different ids', () => {
    const first = apply(drawn(twoPlayerGame(), 'life-001'), payLoan);
    const nextTurn = withGame(apply(first, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const second = apply(drawn(nextTurn, 'life-001'), payLoan);
    const loans = p1(second).liabilities.filter((l) => l.kind === 'lifestyle');
    expect(loans).toHaveLength(2);
    expect(loans[0]?.id).not.toBe(loans[1]?.id);
  });

  it('PAY_LIFESTYLE: rejected with INVALID_METHOD for a loan on a cash-only card', () => {
    const before = drawn(withCash(3_000), 'life-002');
    expect(reject(before, payLoan)).toBe('INVALID_METHOD');
    expect(before.pending).toEqual({ kind: 'payLifestyle', cardId: 'life-002' });
  });

  it('PAY_LIFESTYLE: the loan is allowed in kids mode (it is not a bank loan)', () => {
    const next = apply(drawn(twoPlayerGame({ mode: 'kids' }), 'life-001'), payLoan);
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'lifestyle', sourceCardId: 'life-001' });
  });

  it('PAY_LIFESTYLE: sends the card to the lifestyle discard pile', () => {
    const before = drawn(twoPlayerGame(), 'life-001');
    const next = apply(before, payLoan);
    expect(next.decks.lifestyle.discardPile).toEqual([...before.decks.lifestyle.discardPile, 'life-001']);
  });
});

describe('PAY_LIFESTYLE: log and determinism', () => {
  it('PAY_LIFESTYLE: a cash payment logs cashChanged and paidLifestyle', () => {
    const next = apply(drawn(withCash(3_000), 'life-002'), payCash);
    expect(next.game.log.at(-1)).toEqual({
      turnNumber: 0,
      action: payCash,
      events: [
        { kind: 'cashChanged', delta: -2_500, reason: 'lifestyle' },
        { kind: 'paidLifestyle', cardId: 'life-002', method: 'cash', amount: 2_500 },
      ],
    });
  });

  it('PAY_LIFESTYLE: a loan logs paidLifestyle with the new liability id and no cashChanged', () => {
    const next = apply(drawn(twoPlayerGame(), 'life-001'), payLoan);
    const liabilityId = p1(next).liabilities.at(-1)?.id;
    expect(next.game.log.at(-1)).toEqual({
      turnNumber: 0,
      action: payLoan,
      events: [
        {
          kind: 'paidLifestyle',
          cardId: 'life-001',
          method: 'loan',
          amount: 12_000,
          liabilityId,
          monthlyPayment: 380,
        },
      ],
    });
  });

  it('PAY_LIFESTYLE: is deterministic, including the liability id', () => {
    const before = deepFreeze(drawn(twoPlayerGame(), 'life-001'));
    expect(JSON.stringify(reduce(before, payLoan))).toBe(JSON.stringify(reduce(before, payLoan)));
  });

  it('PAY_LIFESTYLE: does not touch rngState', () => {
    const before = drawn(withCash(3_000), 'life-002');
    expect(apply(before, payCash).game.rngState).toBe(before.game.rngState);
  });

  it('PAY_LIFESTYLE: the turn can end afterwards', () => {
    const paid = apply(drawn(withCash(3_000), 'life-002'), payCash);
    expect(reduce(deepFreeze(paid), { type: 'END_TURN', playerId: 'p1' }).ok).toBe(true);
  });

  it('PAY_LIFESTYLE: does not touch the other player, position, or assets', () => {
    const before = drawn(withCash(3_000), 'life-002');
    const next = apply(before, payCash);
    expect(next.players[1]).toEqual(before.players[1]);
    expect(p1(next).position).toBe(p1(before).position);
    expect(p1(next).assets).toEqual(p1(before).assets);
  });
});

describe('PAY_LIFESTYLE: rejections', () => {
  it('PAY_LIFESTYLE: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(drawn(withCash(3_000), 'life-002'), { ...payCash, playerId: 'p2' })).toBe('NOT_YOUR_TURN');
  });

  const pendings: Pending[] = [
    { kind: 'none' },
    { kind: 'chooseDealSize' },
    { kind: 'buyOrPass', cardId: 'small-001' },
    { kind: 'marketChoice', cardId: 'market-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('PAY_LIFESTYLE: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...withCash(10_000), pending }, payCash)).toBe('INVALID_FOR_PENDING');
    expect(reject({ ...withCash(10_000), pending }, payLoan)).toBe('INVALID_FOR_PENDING');
  });

  it.each(['lobby', 'finished'] as const)('PAY_LIFESTYLE: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(drawn(withCash(3_000), 'life-002'), { phase }), payCash)).toBe('GAME_NOT_PLAYING');
  });

  it('PAY_LIFESTYLE: throws on an unknown card id in the decision (programmer bug)', () => {
    const broken: GameState = { ...twoPlayerGame(), pending: { kind: 'payLifestyle', cardId: 'life-999' } };
    expect(() => reduce(deepFreeze(broken), payCash)).toThrow(/life-999/);
  });

  it('PAY_LIFESTYLE: a rejected payment is not logged', () => {
    const before = deepFreeze(drawn(withCash(0), 'life-002'));
    const logBefore = before.game.log.length;
    expect(reduce(before, payCash).ok).toBe(false);
    expect(before.game.log).toHaveLength(logBefore);
  });
});
