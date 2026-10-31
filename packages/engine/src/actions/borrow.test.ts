import { BORROW_STEP, type Action, type GameState, type Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { debtPayments, monthlyCashFlow, playerById, totalExpenses } from '../selectors';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { aboutToRoll, drawn, offered, onTopOfDeck, rolledClean, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

const borrow = (amount: number, playerId = 'p1'): Action => ({ type: 'BORROW', playerId, amount });
const p1 = (state: GameState) => playerById(state, 'p1');

/** p1 has rolled (Payday 740 credited) and skipped a Giving space: pending none, cash 2,500 + 740 = 3,240. */
function afterRoll(state: GameState = twoPlayerGame()): GameState {
  return rolledClean(state, 'p1');
}

describe('BORROW: taking a bank loan', () => {
  it('BORROW: adds the amount to cash and one bank liability at 10% of principal per month', () => {
    const before = afterRoll();
    const next = apply(before, borrow(3_000));
    expect(p1(next).cash).toBe(3_240 + 3_000);
    expect(p1(next).liabilities).toEqual([
      ...p1(before).liabilities,
      { id: expect.any(String) as string, kind: 'bank', principal: 3_000, monthlyPayment: 300 },
    ]);
  });

  it('BORROW: raises totalExpenses and lowers monthly cash flow by the payment', () => {
    const before = afterRoll();
    const next = apply(before, borrow(1_000));
    expect(debtPayments(p1(next))).toBe(debtPayments(p1(before)) + 100);
    expect(totalExpenses(p1(next))).toBe(4_560 + 100);
    expect(monthlyCashFlow(p1(next))).toBe(740 - 100);
  });

  it('BORROW: the smallest loan is one $1,000 step', () => {
    const next = apply(afterRoll(), borrow(BORROW_STEP));
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'bank', principal: 1_000, monthlyPayment: 100 });
  });

  it('BORROW: each loan is a separate liability so REPAY can retire one at a time', () => {
    const once = apply(afterRoll(), borrow(1_000));
    const twice = apply(once, borrow(2_000));
    const loans = p1(twice).liabilities.filter((l) => l.kind === 'bank');
    expect(loans.map((l) => l.principal)).toEqual([1_000, 2_000]);
    expect(loans[0]?.id).not.toBe(loans[1]?.id);
    expect(p1(twice).cash).toBe(3_240 + 3_000);
  });

  it('BORROW: works with zero cash on hand', () => {
    const broke = afterRoll(twoPlayerGame());
    const zero: GameState = {
      ...broke,
      players: broke.players.map((p) => (p.id === 'p1' ? { ...p, cash: 0 } : p)),
    };
    expect(p1(apply(zero, borrow(1_000))).cash).toBe(1_000);
  });

  it('BORROW: the next Payday reflects the new payment', () => {
    const borrowed = apply(afterRoll(), borrow(1_000));
    const nextTurn = withGame(apply(borrowed, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const paid = rolledClean(nextTurn, 'p1');
    expect(p1(paid).cash).toBe(3_240 + 1_000 + 640);
  });

  it('BORROW: leaves assets, position, decks, pending, and the other player unchanged', () => {
    const before = afterRoll();
    const next = apply(before, borrow(1_000));
    expect(p1(next).assets).toEqual(p1(before).assets);
    expect(p1(next).position).toBe(p1(before).position);
    expect(next.decks).toEqual(before.decks);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.players[1]).toEqual(before.players[1]);
  });
});

describe('BORROW: while a decision is open', () => {
  it('BORROW: allowed during buyOrPass and leaves the decision open', () => {
    const before = offered(twoPlayerGame(), 'small-001');
    const next = apply(before, borrow(5_000));
    expect(next.pending).toEqual(before.pending);
    expect(next.pending).toEqual({ kind: 'buyOrPass', cardId: 'small-001' });
    expect(p1(next).cash).toBe(p1(before).cash + 5_000);
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'bank', principal: 5_000, monthlyPayment: 500 });
    expect(next.decks).toEqual(before.decks);
  });

  it('BORROW: allowed during a stock offer and keeps the rolled share price', () => {
    const before = offered(twoPlayerGame(), 'small-005', 20);
    const next = apply(before, borrow(1_000));
    expect(next.pending).toEqual({ kind: 'buyOrPass', cardId: 'small-005', sharePrice: 20 });
  });

  it('BORROW: lets a player who was short complete BUY', () => {
    // Ada has 2,500 + 740 Payday = 3,240; the Duplex needs 5,000 down.
    const short = offered(twoPlayerGame(), 'small-001');
    expect(reject(short, { type: 'BUY', playerId: 'p1' })).toBe('INSUFFICIENT_CASH');
    const funded = apply(short, borrow(5_000));
    const bought = apply(funded, { type: 'BUY', playerId: 'p1' });
    expect(p1(bought).cash).toBe(3_240);
    expect(p1(bought).assets).toHaveLength(1);
    expect(p1(bought).assets[0]).toMatchObject({ cardId: 'small-001', downPaid: 5_000 });
    expect(p1(bought).liabilities.filter((l) => l.kind === 'bank')).toHaveLength(1);
    expect(p1(bought).liabilities.filter((l) => l.kind === 'mortgage')).toHaveLength(1);
    expect(bought.pending).toEqual({ kind: 'none' });
    expect(monthlyCashFlow(p1(bought))).toBe(740 + 700 - 500);
  });

  it('BORROW: allowed during lifeChoice and leaves the decision open (spec, turn step 4)', () => {
    const before = drawn(twoPlayerGame(), 'life-001');
    const next = apply(before, borrow(4_000));
    expect(next.pending).toEqual({ kind: 'lifeChoice', cardId: 'life-001' });
    expect(p1(next).cash).toBe(3_240 + 4_000);
  });

  it('BORROW: the deal can still be passed after borrowing', () => {
    const funded = apply(offered(twoPlayerGame(), 'small-001'), borrow(1_000));
    const passed = apply(funded, { type: 'PASS', playerId: 'p1' });
    expect(passed.pending).toEqual({ kind: 'none' });
    expect(p1(passed).cash).toBe(3_240 + 1_000);
  });
});

describe('BORROW: amount', () => {
  it.each([0, 500, 1_500, -1_000, 999])('BORROW: rejected with INVALID_AMOUNT for %d', (amount) => {
    expect(reject(afterRoll(), borrow(amount))).toBe('INVALID_AMOUNT');
  });

  it.each([1_000, 2_000, 10_000])('BORROW: accepts %d', (amount) => {
    expect(p1(apply(afterRoll(), borrow(amount))).cash).toBe(3_240 + amount);
  });
});

describe('BORROW: log and determinism', () => {
  it('BORROW: appends a log entry with cashChanged and borrowed events', () => {
    const next = apply(afterRoll(), borrow(2_000));
    const loanId = p1(next).liabilities.at(-1)?.id;
    expect(next.game.log.at(-1)).toEqual({
      turnNumber: 0,
      action: borrow(2_000),
      events: [
        { kind: 'cashChanged', delta: 2_000, reason: 'borrow' },
        { kind: 'borrowed', liabilityId: loanId, amount: 2_000, monthlyPayment: 200, principles: ['P5'], purpose: 'none' },
      ],
    });
  });

  it('BORROW: is deterministic, including the liability id', () => {
    const before = deepFreeze(afterRoll());
    expect(JSON.stringify(reduce(before, borrow(1_000)))).toBe(JSON.stringify(reduce(before, borrow(1_000))));
  });

  it('BORROW: does not touch rngState', () => {
    const before = afterRoll();
    expect(apply(before, borrow(1_000)).game.rngState).toBe(before.game.rngState);
  });

  it('BORROW: the turn can end afterwards', () => {
    const borrowed = apply(afterRoll(), borrow(1_000));
    expect(reduce(deepFreeze(borrowed), { type: 'END_TURN', playerId: 'p1' }).ok).toBe(true);
  });
});

describe('BORROW: rejections', () => {
  it('BORROW: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(afterRoll(), borrow(1_000, 'p2'))).toBe('NOT_YOUR_TURN');
  });

  it('BORROW: rejected with MUST_ROLL_FIRST before the player has rolled (optional actions come in turn step 4)', () => {
    expect(reject(twoPlayerGame(), borrow(1_000))).toBe('MUST_ROLL_FIRST');
  });

  // Spec, Core rules, turn step 4: BORROW is legal with pending none, buyOrPass,
  // or lifeChoice, and rejected in every other pending state.
  const pendings: Pending[] = [
    { kind: 'chooseDealSize' },
    { kind: 'marketChoice', cardId: 'market-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('BORROW: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...afterRoll(), pending }, borrow(1_000))).toBe('INVALID_FOR_PENDING');
  });

  it('BORROW: rejected in kids mode', () => {
    expect(reject(afterRoll(twoPlayerGame({ mode: 'kids' })), borrow(1_000))).toBe('NOT_ALLOWED_IN_KIDS_MODE');
    const kidsOffer = apply(aboutToRoll(twoPlayerGame({ mode: 'kids' }), 2, 1), { type: 'ROLL', playerId: 'p1' });
    expect(kidsOffer.pending.kind).toBe('buyOrPass');
    expect(reject(kidsOffer, borrow(1_000))).toBe('NOT_ALLOWED_IN_KIDS_MODE');
  });

  it.each(['lobby', 'finished'] as const)('BORROW: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(afterRoll(), { phase }), borrow(1_000))).toBe('GAME_NOT_PLAYING');
  });

  it('BORROW: a rejected loan is not logged', () => {
    const before = deepFreeze(afterRoll());
    const logBefore = before.game.log.length;
    expect(reduce(before, borrow(500)).ok).toBe(false);
    expect(before.game.log).toHaveLength(logBefore);
  });
});

describe('BORROW: records what the borrowed cash was for (spec, Decision log)', () => {
  it('BORROW: during buyOrPass the purpose is an asset', () => {
    const next = apply(offered(twoPlayerGame(), 'small-001'), borrow(5_000));
    expect(next.game.log.at(-1)?.events[1]).toMatchObject({ kind: 'borrowed', purpose: 'asset' });
  });

  it('BORROW: during lifeChoice the purpose is a want', () => {
    const next = apply(drawn(twoPlayerGame(), 'life-001'), borrow(4_000));
    expect(next.game.log.at(-1)?.events[1]).toMatchObject({ kind: 'borrowed', purpose: 'want' });
  });

  it('BORROW: with nothing pending the purpose is none', () => {
    const next = apply(afterRoll(), borrow(1_000));
    expect(next.game.log.at(-1)?.events[1]).toMatchObject({ kind: 'borrowed', purpose: 'none' });
    expect(next.game.log.at(-1)?.events[1]).not.toHaveProperty('cardId');
  });
});

// Credit limit (decided by Andre 2026-10-31): the bank lends up to two months
// of salary in total. Ada the Teacher earns 5,300, so her limit is 10,600.
describe('BORROW: credit limit of two months of salary', () => {
  const bankLoan = (principal: number) => ({ id: `old-${String(principal)}`, kind: 'bank' as const, principal, monthlyPayment: principal / 10 });

  it('BORROW: accepts loans up to two months of salary in total', () => {
    const next = apply(afterRoll(), borrow(10_000));
    expect(p1(next).cash).toBe(3_240 + 10_000);
  });

  it('BORROW: rejected with CREDIT_LIMIT when bank debt would pass two months of salary', () => {
    expect(reject(afterRoll(), borrow(11_000))).toBe('CREDIT_LIMIT');
    expect(reject(apply(afterRoll(), borrow(10_000)), borrow(1_000))).toBe('CREDIT_LIMIT');
  });

  it('BORROW: accepts a loan that lands exactly on the limit', () => {
    const state = withPlayer(afterRoll(), 'p1', { salary: 5_000 });
    const next = apply(apply(state, borrow(9_000)), borrow(1_000));
    expect(reject(next, borrow(1_000))).toBe('CREDIT_LIMIT');
  });

  it('BORROW: existing bank loans, including Setback loans, count toward the limit', () => {
    const state = afterRoll();
    const withOld = withPlayer(state, 'p1', { liabilities: [...p1(state).liabilities, bankLoan(8_000)] });
    expect(apply(withOld, borrow(2_000)).players[0]?.cash).toBe(3_240 + 2_000);
    expect(reject(withOld, borrow(3_000))).toBe('CREDIT_LIMIT');
  });

  it('BORROW: student loans, car loans, credit cards, and mortgages do not count toward the limit', () => {
    // Ada starts with 42,000 of non-bank debt and can still borrow the full 10,000.
    expect(apply(afterRoll(), borrow(10_000)).players[0]?.liabilities.filter((l) => l.kind === 'bank')).toHaveLength(1);
  });

  it('BORROW: repaying a bank loan frees that much credit', () => {
    const full = withPlayer(apply(afterRoll(), borrow(10_000)), 'p1', {});
    const loanId = p1(full).liabilities.find((l) => l.kind === 'bank')?.id ?? '';
    const repaid = apply(full, { type: 'REPAY', playerId: 'p1', liabilityId: loanId });
    expect(apply(repaid, borrow(10_000)).players[0]?.liabilities.filter((l) => l.kind === 'bank')).toHaveLength(1);
  });

  it('BORROW: a player at the limit still gets a Setback loan, because Setbacks always resolve', () => {
    // 1,500 cash; Payday is 740 - 1,000 = -260, leaving 1,240 against a 3,500 Furnace: auto-borrow 3,000.
    const atLimit = withPlayer(twoPlayerGame(), 'p1', { cash: 1_500, liabilities: [...p1(twoPlayerGame()).liabilities, bankLoan(10_000)] });
    const next = apply(aboutToRoll(onTopOfDeck(atLimit, 'setback', 'setback-001'), 5, 1), { type: 'ROLL', playerId: 'p1' });
    expect(p1(next).liabilities.filter((l) => l.kind === 'bank').map((l) => l.principal)).toEqual([10_000, 3_000]);
  });
});
