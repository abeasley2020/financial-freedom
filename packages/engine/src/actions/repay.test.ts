import type { Action, GameState, Liability, Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { debtPayments, monthlyCashFlow, playerById, totalExpenses } from '../selectors';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { offered, rolledClean, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

// Ada the Teacher (p1) starts with 2,500 cash, salary 5,300, baseExpenses 4,000 and
// three loans: p1-student-0 (30,000 at 1% = 300/mo), p1-car-1 (10,000 at 2% = 200/mo),
// p1-credit-2 (2,000 at 3% = 60/mo). totalExpenses 4,560, monthly cash flow 740.

const repay = (liabilityId: string, playerId = 'p1'): Action => ({ type: 'REPAY', playerId, liabilityId });
const p1 = (state: GameState) => playerById(state, 'p1');

/** p1 with `cash` has rolled (Payday 740 credited) and skipped a Giving space: pending none, cash + 740. */
function afterRoll(state: GameState = twoPlayerGame(), cash = 5_000): GameState {
  return rolledClean(withPlayer(state, 'p1', { cash }), 'p1');
}

describe('REPAY: paying off a loan in full', () => {
  it('REPAY: pays the principal from cash and removes the liability', () => {
    const before = afterRoll();
    expect(p1(before).cash).toBe(5_740);
    const next = apply(before, repay('p1-credit-2'));
    expect(p1(next).cash).toBe(5_740 - 2_000);
    expect(p1(next).liabilities).toEqual(p1(before).liabilities.filter((l) => l.id !== 'p1-credit-2'));
    expect(p1(next).liabilities.map((l) => l.id)).toEqual(['p1-student-0', 'p1-car-1']);
  });

  it('REPAY: lowers totalExpenses and raises monthly cash flow by the loan payment', () => {
    const next = apply(afterRoll(), repay('p1-credit-2'));
    expect(debtPayments(p1(next))).toBe(500);
    expect(totalExpenses(p1(next))).toBe(4_000 + 500);
    expect(monthlyCashFlow(p1(next))).toBe(800);
  });

  it('REPAY: can retire a bank loan taken this turn', () => {
    const before = afterRoll();
    const borrowed = apply(before, { type: 'BORROW', playerId: 'p1', amount: 1_000 });
    const loanId = p1(borrowed).liabilities.at(-1)?.id;
    if (loanId === undefined) throw new Error('BORROW must add a liability');
    const next = apply(borrowed, repay(loanId));
    expect(p1(next).cash).toBe(5_740);
    expect(p1(next).liabilities).toEqual(p1(before).liabilities);
  });

  it('REPAY: can retire a lifestyle loan', () => {
    const truck: Liability = {
      id: 'p1-lifestyle-truck',
      kind: 'lifestyle',
      principal: 12_000,
      monthlyPayment: 380,
      sourceCardId: 'life-001',
    };
    const fresh = twoPlayerGame();
    const base = withPlayer(fresh, 'p1', { liabilities: [...p1(fresh).liabilities, truck] });
    const before = afterRoll(base, 20_000);
    const next = apply(before, repay('p1-lifestyle-truck'));
    expect(p1(next).cash).toBe(p1(before).cash - 12_000);
    expect(p1(next).liabilities.find((l) => l.id === 'p1-lifestyle-truck')).toBeUndefined();
    expect(debtPayments(p1(next))).toBe(560);
  });

  it('REPAY: removes only the named loan when several share a kind', () => {
    const once = apply(afterRoll(), { type: 'BORROW', playerId: 'p1', amount: 1_000 });
    const twice = apply(once, { type: 'BORROW', playerId: 'p1', amount: 2_000 });
    const [first, second] = p1(twice).liabilities.filter((l) => l.kind === 'bank');
    if (first === undefined || second === undefined) throw new Error('two bank loans expected');
    const next = apply(twice, repay(first.id));
    const banks = p1(next).liabilities.filter((l) => l.kind === 'bank');
    expect(banks).toEqual([second]);
    expect(p1(next).cash).toBe(5_740 + 3_000 - 1_000);
  });

  it('REPAY: accepts when cash exactly equals the principal, leaving zero cash', () => {
    // 1,260 + 740 Payday = 2,000, the credit card principal.
    const next = apply(afterRoll(twoPlayerGame(), 1_260), repay('p1-credit-2'));
    expect(p1(next).cash).toBe(0);
  });

  it('REPAY: rejected with INSUFFICIENT_CASH one dollar short, and the loan stays', () => {
    const before = afterRoll(twoPlayerGame(), 1_259);
    expect(p1(before).cash).toBe(1_999);
    expect(reject(before, repay('p1-credit-2'))).toBe('INSUFFICIENT_CASH');
  });

  it('REPAY: works in kids mode (only BORROW is barred there)', () => {
    const next = apply(afterRoll(twoPlayerGame({ mode: 'kids' })), repay('p1-credit-2'));
    expect(p1(next).liabilities.map((l) => l.id)).toEqual(['p1-student-0', 'p1-car-1']);
  });

  it('REPAY: leaves assets, position, decks, pending, and the other player unchanged', () => {
    const before = afterRoll();
    const next = apply(before, repay('p1-credit-2'));
    expect(p1(next).assets).toEqual(p1(before).assets);
    expect(p1(next).position).toBe(p1(before).position);
    expect(next.decks).toEqual(before.decks);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.players[1]).toEqual(before.players[1]);
  });
});

describe('REPAY: cancelling a subscription (spec v2, Life Choices: REPAY removes a subscription at no cost)', () => {
  const sub: Liability = { id: 'p1-sub', kind: 'subscription', principal: 0, monthlyPayment: 60, sourceCardId: 'life-004' };
  const subscribed = (cash = 0) => {
    const fresh = twoPlayerGame();
    return afterRoll(withPlayer(fresh, 'p1', { liabilities: [...p1(fresh).liabilities, sub] }), cash);
  };

  it('REPAY: removes the subscription and charges nothing, even with zero cash', () => {
    const before = subscribed(0);
    expect(p1(before).cash).toBe(740 - 60);
    const next = apply(before, repay('p1-sub'));
    expect(p1(next).cash).toBe(p1(before).cash);
    expect(p1(next).liabilities.find((l) => l.id === 'p1-sub')).toBeUndefined();
    expect(debtPayments(p1(next))).toBe(560);
  });

  it('REPAY: logs the cancellation with principal 0 under P7, small costs add up', () => {
    const next = apply(subscribed(), repay('p1-sub'));
    expect(next.game.log.at(-1)?.events).toEqual([{ kind: 'repaid', liabilityId: 'p1-sub', principal: 0, principles: ['P7'] }]);
  });

  it('REPAY: works in kids mode, so a kid can cancel too', () => {
    const fresh = twoPlayerGame({ mode: 'kids' });
    const before = afterRoll(withPlayer(fresh, 'p1', { liabilities: [...p1(fresh).liabilities, sub] }));
    expect(p1(apply(before, repay('p1-sub'))).liabilities.some((l) => l.kind === 'subscription')).toBe(false);
  });
});

describe('REPAY: which loans', () => {
  it('REPAY: rejected with INVALID_LIABILITY for a mortgage (Core rules, Mortgages: retired only by sale)', () => {
    const bought = apply(offered(withPlayer(twoPlayerGame(), 'p1', { cash: 100_000 }), 'small-001'), {
      type: 'BUY',
      playerId: 'p1',
    });
    const mortgage = p1(bought).liabilities.find((l) => l.kind === 'mortgage');
    if (mortgage === undefined) throw new Error('BUY must add a mortgage');
    expect(bought.pending).toEqual({ kind: 'none' });
    expect(reject(bought, repay(mortgage.id))).toBe('INVALID_LIABILITY');
    expect(p1(bought).cash).toBeGreaterThan(mortgage.principal);
  });

  it('REPAY: rejected with INVALID_LIABILITY for an id the player does not hold', () => {
    expect(reject(afterRoll(), repay('p1-bank-999'))).toBe('INVALID_LIABILITY');
  });

  it("REPAY: rejected with INVALID_LIABILITY for another player's loan", () => {
    const before = afterRoll(twoPlayerGame(), 500_000);
    expect(before.players[1]?.liabilities.map((l) => l.id)).toContain('p2-credit-2');
    expect(reject(before, repay('p2-credit-2'))).toBe('INVALID_LIABILITY');
  });
});

describe('REPAY: log and determinism', () => {
  it('REPAY: appends a log entry with cashChanged and repaid events', () => {
    const next = apply(afterRoll(), repay('p1-credit-2'));
    expect(next.game.log.at(-1)).toEqual({
      turnNumber: 0,
      action: repay('p1-credit-2'),
      events: [
        { kind: 'cashChanged', delta: -2_000, reason: 'repay' },
        { kind: 'repaid', liabilityId: 'p1-credit-2', principal: 2_000, principles: ['P5'] },
      ],
    });
  });

  it('REPAY: is deterministic', () => {
    const before = deepFreeze(afterRoll());
    expect(JSON.stringify(reduce(before, repay('p1-car-1')))).toBe(JSON.stringify(reduce(before, repay('p1-car-1'))));
  });

  it('REPAY: does not touch rngState', () => {
    const before = afterRoll();
    expect(apply(before, repay('p1-credit-2')).game.rngState).toBe(before.game.rngState);
  });

  it('REPAY: the turn can end afterwards', () => {
    const repaid = apply(afterRoll(), repay('p1-credit-2'));
    expect(reduce(deepFreeze(repaid), { type: 'END_TURN', playerId: 'p1' }).ok).toBe(true);
  });
});

describe('REPAY: rejections', () => {
  it('REPAY: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(afterRoll(), repay('p2-credit-2', 'p2'))).toBe('NOT_YOUR_TURN');
  });

  it('REPAY: rejected with MUST_ROLL_FIRST before the player has rolled (optional actions come in turn step 4)', () => {
    expect(reject(withPlayer(twoPlayerGame(), 'p1', { cash: 5_000 }), repay('p1-credit-2'))).toBe('MUST_ROLL_FIRST');
  });

  // Spec, Core rules, turn step 4: REPAY is legal only when no decision is pending.
  const pendings: Pending[] = [
    { kind: 'chooseDealSize' },
    { kind: 'buyOrPass', cardId: 'small-001' },
    { kind: 'buyOrPass', cardId: 'small-005', sharePrice: 20 },
    { kind: 'marketChoice', cardId: 'market-001' },
    { kind: 'lifeChoice', cardId: 'life-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('REPAY: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...afterRoll(), pending }, repay('p1-credit-2'))).toBe('INVALID_FOR_PENDING');
  });

  it.each(['lobby', 'finished'] as const)('REPAY: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(afterRoll(), { phase }), repay('p1-credit-2'))).toBe('GAME_NOT_PLAYING');
  });

  it('REPAY: a rejected repayment is not logged', () => {
    const before = deepFreeze(afterRoll(twoPlayerGame(), 0));
    const logBefore = before.game.log.length;
    expect(reduce(before, repay('p1-credit-2')).ok).toBe(false);
    expect(before.game.log).toHaveLength(logBefore);
  });
});
