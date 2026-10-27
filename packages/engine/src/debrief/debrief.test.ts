// Spec v2, The debrief: the seven sections, in order, built from the final
// state and a hand-built log. The attribution rules themselves are pinned in
// attribution.test.ts.

import type { Asset, Debrief, GameState, Liability, LogEntry, LogEvent } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { deepFreeze } from '../test/deepFreeze';
import { twoPlayerGame, withPlayer } from '../test/fixtures';
import { endTurnEntry, entry, paydayEntries, paydayEntry, paydayEvents, rollEntry, TEACHER_TOTAL_EXPENSES, withLog } from '../test/handLog';
import { debrief } from './debrief';

const base = twoPlayerGame();

const duplex: Asset = { id: 'a1', cardId: 'small-001', type: 'rental', purchasePrice: 50_000, downPaid: 5_000, monthlyCashFlow: 700 };
const duplexMortgage: Liability = { id: 'a1-mortgage', kind: 'mortgage', principal: 45_000, monthlyPayment: 0, assetId: 'a1' };

function run(state: GameState, log: readonly LogEntry[], playerId = 'p1', level: 'adult' | 'kids' = 'adult'): Debrief {
  return debrief(deepFreeze(withLog(state, log)), playerId, level);
}

const gift = (amount: number): LogEntry =>
  entry({ type: 'GIVE', playerId: 'p1' }, [
    { kind: 'cashChanged', delta: -amount, reason: 'give' },
    { kind: 'gave', amount, favorTokens: 1, principles: ['P10'] },
  ]);

const passed = (monthlyCashFlow: number, cardId = 'small-001'): LogEntry =>
  entry({ type: 'PASS', playerId: 'p1' }, [
    { kind: 'passed', cardId, principles: ['P2', 'P3', 'P5'], monthlyCashFlow, downPayment: 1_000, affordable: true },
  ]);

const borrowedForWant = (amount: number): LogEntry =>
  entry({ type: 'BORROW', playerId: 'p1', amount }, [
    { kind: 'cashChanged', delta: amount, reason: 'borrow' },
    { kind: 'borrowed', liabilityId: `p1-bank-${String(amount)}`, amount, monthlyPayment: amount / 10, principles: ['P5'], purpose: 'want' },
  ]);

const roundEnd = (round: number): LogEntry => endTurnEntry('p2', { kind: 'roundCompleted', round });
const gameEnd = (reason: 'escape' | 'roundLimit' | 'lastStanding', winnerId: string): LogEntry =>
  endTurnEntry('p2', { kind: 'gameEnded', reason, winnerId });

describe('DEBRIEF section 1: result', () => {
  it('DEBRIEF: reports freedomPercent and passiveIncome against totalExpenses from the final state', () => {
    const state = withPlayer(base, 'p1', { assets: [duplex], liabilities: [...(base.players[0]?.liabilities ?? []), duplexMortgage] });
    const d = run(state, [roundEnd(1), roundEnd(2), gameEnd('roundLimit', 'p1')]);
    expect(d.readingLevel).toBe('adult');
    // floor(700 × 100 / 4,560) = 15. The Doctor holds nothing, so the Teacher ranks first.
    expect(d.result).toEqual({
      playerId: 'p1',
      professionId: 'teacher',
      freedomPercent: 15,
      passiveIncome: 700,
      totalExpenses: TEACHER_TOTAL_EXPENSES,
      won: true,
      escaped: false,
      place: 1,
      players: 2,
      ending: 'roundLimit',
      rounds: 3,
    });
    expect(run(state, [roundEnd(1), roundEnd(2), gameEnd('roundLimit', 'p1')], 'p2').result).toMatchObject({
      playerId: 'p2',
      professionId: 'doctor',
      won: false,
      place: 2,
    });
  });

  it('DEBRIEF: a player who went out sees the round they ran out of money, and no place', () => {
    const state = withPlayer(base, 'p1', { isOut: true, cash: 0, liabilities: [] });
    const d = run(state, [
      paydayEntry('p1', 1),
      roundEnd(1),
      paydayEntry('p1', 2),
      roundEnd(2),
      rollEntry('p1', ...paydayEvents('p1', 3), { kind: 'wentOut', shortfall: 500 }),
      gameEnd('lastStanding', 'p2'),
    ]);
    expect(d.result).toEqual({
      playerId: 'p1',
      professionId: 'teacher',
      freedomPercent: 0,
      passiveIncome: 0,
      totalExpenses: 4_000,
      won: false,
      escaped: false,
      players: 2,
      ending: 'lastStanding',
      rounds: 3,
      wentOutRound: 3,
    });
  });

  it('DEBRIEF: a player who goes out at a skipped Payday ran out of money in the round that Payday opened', () => {
    const state = withPlayer(base, 'p1', { isOut: true, cash: 0, liabilities: [] });
    const d = run(state, [
      paydayEntry('p1', 1),
      endTurnEntry(
        'p2',
        { kind: 'turnSkipped', playerId: 'p1' },
        ...paydayEvents('p1', 1),
        { kind: 'wentOut', shortfall: 300 },
        { kind: 'roundCompleted', round: 1 },
      ),
      gameEnd('lastStanding', 'p2'),
    ]);
    expect(d.result.wentOutRound).toBe(2);
  });

  it('DEBRIEF: an escape is a win', () => {
    const state = withPlayer(base, 'p1', { hasEscaped: true });
    const d = run(state, [gameEnd('escape', 'p1')]);
    expect(d.result).toMatchObject({ won: true, escaped: true, place: 1, ending: 'escape' });
  });

  it('DEBRIEF: a game still being played has no ending and no winner yet', () => {
    const d = debrief(deepFreeze(withLog(base, [], 'playing')), 'p1', 'adult');
    expect(d.result.ending).toBeUndefined();
    expect(d.result.won).toBe(false);
  });

  it('DEBRIEF: throws for a player who is not in the game', () => {
    expect(() => run(base, [], 'nobody')).toThrow();
  });
});

describe('DEBRIEF sections 2 to 4: why you won or lost, helped, hurt', () => {
  it('DEBRIEF: helped and hurt list at most three each, largest first', () => {
    const d = run(base, [gift(100), gift(400), gift(200), gift(300), passed(100), passed(400), passed(200), passed(300), ...paydayEntries('p1', 1)]);
    expect(d.helped.map((x) => x.dollars)).toEqual([400, 300, 200]);
    expect(d.hurt.map((x) => x.dollars)).toEqual([400, 300, 200]);
    expect(d.hurt.map((x) => x.outcome)).toEqual(['hurt', 'hurt', 'hurt']);
  });

  it('DEBRIEF: why you won or lost lists the three decisions with the largest absolute dollar impact, helped or hurt', () => {
    const d = run(base, [gift(500), gift(100), passed(300), passed(50), ...paydayEntries('p1', 1)]);
    expect(d.drivers.map((x) => [x.kind, x.impact])).toEqual([
      ['gave', 500],
      ['passedDeal', -300],
      ['gave', 100],
    ]);
  });

  it('DEBRIEF: equal impacts keep log order', () => {
    const d = run(base, [gift(200), gift(200), passed(200), gift(50), ...paydayEntries('p1', 1)]);
    expect(d.drivers.map((x) => x.ref.entry)).toEqual([0, 1, 2]);
  });

  it("DEBRIEF: each decision carries the round it was made in, counted by the player's own Paydays", () => {
    const d = run(base, [paydayEntry('p1', 1), roundEnd(1), paydayEntry('p1', 2), roundEnd(2), paydayEntry('p1', 3), gift(200)]);
    expect(d.helped).toEqual([expect.objectContaining({ kind: 'gave', round: 3 })]);
  });

  it('DEBRIEF: a winner still sees the decisions that hurt and what to try next time', () => {
    const state = withPlayer(base, 'p1', { hasEscaped: true });
    const d = run(state, [passed(700), ...paydayEntries('p1', 2), gameEnd('escape', 'p1')]);
    expect(d.result.won).toBe(true);
    expect(d.hurt).toHaveLength(1);
    expect(d.suggestions).toHaveLength(1);
  });

  it("DEBRIEF: events after a turnSkipped belong to the skipped player, not to the one ending the turn", () => {
    const log: LogEntry[] = [
      entry({ type: 'BUY', playerId: 'p2' }, [
        { kind: 'cashChanged', delta: -5_000, reason: 'buy' },
        { kind: 'bought', assetId: 'b1', cardId: 'small-001', cost: 5_000, principles: ['P2', 'P3', 'P5'] },
      ]),
      endTurnEntry(
        'p1',
        { kind: 'turnSkipped', playerId: 'p2' },
        ...paydayEvents('p2', 1),
        { kind: 'sold', assetId: 'b1', cardId: 'small-001', proceeds: 25_000, mortgagePaid: 25_000, principles: ['P2', 'P3', 'P5'] },
      ),
    ];
    expect([...run(base, log).helped, ...run(base, log).hurt]).toEqual([]);
    expect(run(base, log, 'p2').hurt).toEqual([
      expect.objectContaining({ kind: 'boughtDeal', ref: { entry: 0, event: 1 }, cashFlowReceived: 700, saleResult: -5_000, impact: -4_300, months: 1 }),
    ]);
  });
});

describe('DEBRIEF section 5: next time, try', () => {
  it('DEBRIEF: suggests up to two changes from the largest hurt decisions, with dollars and Freedom points floor(monthly × 100 / final totalExpenses)', () => {
    const d = run(base, [
      passed(700),
      borrowedForWant(2_000),
      entry({ type: 'CHOOSE_LIFE_OPTION', playerId: 'p1', optionId: 'subscribe' }, [
        {
          kind: 'choseLifeOption',
          cardId: 'life-004',
          optionId: 'subscribe',
          principles: ['P7'],
          costToday: 0,
          monthlyChange: 60,
          cheapest: { optionId: 'skip', costToday: 0, monthlyChange: 0 },
          priciest: { optionId: 'subscribe', costToday: 0, monthlyChange: 60 },
        },
        { kind: 'subscriptionAdded', liabilityId: 'p1-life-004-2-0', monthlyCost: 60 },
      ]),
      ...paydayEntries('p1', 3),
    ]);
    expect(d.suggestions).toEqual([
      // floor(700 × 100 / 4,560) = 15; floor(200 × 100 / 4,560) = 4.
      { decision: d.hurt[0], principle: 'P2', dollars: 2_100, monthly: 700, freedomPoints: 15 },
      { decision: d.hurt[1], principle: 'P5', dollars: 600, monthly: 200, freedomPoints: 4 },
    ]);
    expect(d.suggestions.map((s) => s.decision.kind)).toEqual(['passedDeal', 'bankLoan']);
  });

  it("DEBRIEF: a Life Choices suggestion uses the monthly difference from the cheapest option and the option's first principle", () => {
    const d = run(base, [
      entry({ type: 'CHOOSE_LIFE_OPTION', playerId: 'p1', optionId: 'new' }, [
        {
          kind: 'choseLifeOption',
          cardId: 'life-001',
          optionId: 'new',
          principles: ['P5', 'P6'],
          costToday: 0,
          monthlyChange: 380,
          cheapest: { optionId: 'keep', costToday: 0, monthlyChange: 0 },
          priciest: { optionId: 'new', costToday: 0, monthlyChange: 380 },
        },
        { kind: 'loanAdded', liabilityId: 'p1-life-001-0-0', loanKind: 'car', principal: 12_000, monthlyPayment: 380 },
      ]),
      ...paydayEntries('p1', 2),
    ]);
    // floor(380 × 100 / 4,560) = 8.
    expect(d.suggestions).toEqual([{ decision: d.hurt[0], principle: 'P5', dollars: 760, monthly: 380, freedomPoints: 8 }]);
  });

  it('DEBRIEF: a one-time cost has no monthly difference, so its suggestion carries no Freedom points', () => {
    const d = run(base, [
      entry({ type: 'CHOOSE_LIFE_OPTION', playerId: 'p1', optionId: 'brands' }, [
        {
          kind: 'choseLifeOption',
          cardId: 'life-011',
          optionId: 'brands',
          principles: ['P3', 'P6'],
          costToday: 1_200,
          monthlyChange: 0,
          cheapest: { optionId: 'keep', costToday: 0, monthlyChange: 0 },
          priciest: { optionId: 'brands', costToday: 1_200, monthlyChange: 0 },
        },
      ]),
    ]);
    expect(d.suggestions).toEqual([{ decision: d.hurt[0], principle: 'P3', dollars: 1_200, monthly: 0, freedomPoints: 0 }]);
  });

  it('DEBRIEF: Freedom points divide by the final totalExpenses', () => {
    const bigLoan: Liability = { id: 'p1-bank-x', kind: 'bank', principal: 24_400, monthlyPayment: 2_440 };
    const state = withPlayer(base, 'p1', { liabilities: [...(base.players[0]?.liabilities ?? []), bigLoan] });
    const d = run(state, [passed(700), ...paydayEntries('p1', 1)]);
    // totalExpenses 4,560 + 2,440 = 7,000: floor(700 × 100 / 7,000) = 10.
    expect(d.suggestions[0]).toMatchObject({ monthly: 700, freedomPoints: 10 });
  });

  it('DEBRIEF: no hurt decisions means no suggestions', () => {
    expect(run(base, [gift(100)]).suggestions).toEqual([]);
  });
});

describe('DEBRIEF section 6: money story', () => {
  it("DEBRIEF: is passiveIncome and totalExpenses at each of the player's paydaySnapshot events, plus the final numbers", () => {
    const state = withPlayer(base, 'p1', { assets: [duplex], liabilities: [...(base.players[0]?.liabilities ?? []), duplexMortgage] });
    const d = run(state, [
      paydayEntry('p1', 1),
      paydayEntry('p2', 1, [], { totalExpenses: 16_000 }),
      roundEnd(1),
      paydayEntry('p1', 2, [], { passiveIncome: 700 }),
      roundEnd(2),
      paydayEntry('p1', 3, [], { passiveIncome: 5_000 }),
    ]);
    expect(d.moneyStory).toEqual({
      points: [
        { ref: { entry: 0, event: 1 }, round: 1, passiveIncome: 0, totalExpenses: 4_560 },
        { ref: { entry: 3, event: 1 }, round: 2, passiveIncome: 700, totalExpenses: 4_560 },
        { ref: { entry: 5, event: 1 }, round: 3, passiveIncome: 5_000, totalExpenses: 4_560 },
      ],
      final: { passiveIncome: 700, totalExpenses: 4_560 },
      freedomRound: 3,
    });
  });

  it("DEBRIEF: a skipped seat's Payday paid by an END_TURN that completes the round belongs to the new round", () => {
    // END_TURN pays a skipped seat before it logs roundCompleted, so that snapshot's own roundNumber is the round just ended.
    const d = run(base, [
      paydayEntry('p1', 1),
      endTurnEntry('p2', { kind: 'turnSkipped', playerId: 'p1' }, ...paydayEvents('p1', 1), { kind: 'roundCompleted', round: 1 }),
      roundEnd(2),
      paydayEntry('p1', 3),
    ]);
    expect(d.moneyStory.points.map((p) => p.round)).toEqual([1, 2, 3]);
  });

  it('DEBRIEF: a skipped seat paid by the END_TURN that ends the game at the round limit gets the round after the last one', () => {
    const d = run(base, [
      paydayEntry('p1', 1),
      endTurnEntry('p2', { kind: 'turnSkipped', playerId: 'p1' }, ...paydayEvents('p1', 1), { kind: 'gameEnded', reason: 'roundLimit', winnerId: 'p2' }),
    ]);
    expect(d.moneyStory.points.map((p) => p.round)).toEqual([1, 2]);
  });

  it('DEBRIEF: when one END_TURN skips every seat, including its own, each player still gets one round per Payday', () => {
    // This hand-built log has no roundCompleted where the walk passes the last seat; rounds still come from each player's Paydays.
    const log = [
      paydayEntry('p1', 1),
      paydayEntry('p2', 1),
      roundEnd(1),
      paydayEntry('p1', 2),
      endTurnEntry('p1', { kind: 'turnSkipped', playerId: 'p2' }, ...paydayEvents('p2', 2), { kind: 'turnSkipped', playerId: 'p1' }, ...paydayEvents('p1', 2)),
      paydayEntry('p2', 2),
      endTurnEntry('p2', { kind: 'roundCompleted', round: 2 }),
      paydayEntry('p1', 3),
    ];
    expect(run(base, log).moneyStory.points.map((p) => p.round)).toEqual([1, 2, 3, 4]);
    expect(run(base, log, 'p2').moneyStory.points.map((p) => p.round)).toEqual([1, 2, 3]);
  });

  it('DEBRIEF: a skipped seat after the seat ending its turn is still in the current round', () => {
    // Seat 1 ends its turn and seat 2 is skipped: that is seat 2's turn in this round, even if the same END_TURN then completes it.
    const d = run(
      base,
      [paydayEntry('p2', 1), roundEnd(1), endTurnEntry('p1', { kind: 'turnSkipped', playerId: 'p2' }, ...paydayEvents('p2', 2), { kind: 'roundCompleted', round: 2 })],
      'p2',
    );
    expect(d.moneyStory.points.map((p) => p.round)).toEqual([1, 2]);
  });

  it('DEBRIEF: when the lines cross only after the last Payday (an escape), freedom is the round the game ended in', () => {
    const rich: Asset = { ...duplex, monthlyCashFlow: 5_000 };
    const state = withPlayer(base, 'p1', { assets: [rich], hasEscaped: true });
    const d = run(state, [paydayEntry('p1', 1), roundEnd(1), paydayEntry('p1', 2), gameEnd('escape', 'p1')]);
    expect(d.moneyStory.freedomRound).toBe(2);
  });

  it('DEBRIEF: lines that never cross have no freedom round', () => {
    expect(run(base, [paydayEntry('p1', 1)]).moneyStory.freedomRound).toBeUndefined();
  });
});

describe('DEBRIEF section 7: principles practiced', () => {
  it('DEBRIEF: are the principles on any helped decision, in P1 to P10 order, including helped decisions not shown', () => {
    const fund: LogEvent[] = [
      { kind: 'cashChanged', delta: -1_000, reason: 'buy' },
      { kind: 'bought', assetId: 'g1', cardId: 'small-004', cost: 1_000, principles: ['P1', 'P8'] },
    ];
    const d = run(base, [
      gift(500),
      gift(400),
      gift(300),
      entry({ type: 'BUY', playerId: 'p1', amount: 1_000 }, fund),
      passed(100),
      paydayEntry('p1', 1, [{ kind: 'valueChanged', assetId: 'g1', delta: 40, marketValue: 1_040 }]),
    ]);
    expect(d.helped.map((x) => x.kind)).toEqual(['gave', 'gave', 'gave']);
    expect(d.principlesPracticed).toEqual(['P8', 'P10']);
  });
});

describe('DEBRIEF reading levels', () => {
  const log = [gift(345), passed(335), ...paydayEntries('p1', 1)];

  it('DEBRIEF: the kids level rounds every dollar figure to the nearest $10', () => {
    const d = run(base, [...log, paydayEntry('p1', 2, [], { passiveIncome: 4, totalExpenses: 4_565 })], 'p1', 'kids');
    expect(d.readingLevel).toBe('kids');
    expect(d.helped).toEqual([expect.objectContaining({ kind: 'gave', impact: 350, dollars: 350 })]);
    // The exact impact is rounded, not its parts: 335 × 2 Paydays = 670.
    expect(d.hurt).toEqual([expect.objectContaining({ kind: 'passedDeal', impact: -670, dollars: 670, monthlyCashFlow: 340 })]);
    expect(d.moneyStory.points[1]).toMatchObject({ passiveIncome: 0, totalExpenses: 4_570 });
    // Freedom points come from the exact numbers: floor(335 × 100 / 4,560) = 7.
    expect(d.suggestions[0]).toMatchObject({ dollars: 670, monthly: 340, freedomPoints: 7 });
  });

  it('DEBRIEF: the kids level leaves out a decision that rounds to $0, and never writes -0', () => {
    const small = [gift(300), gift(4), passed(3), ...paydayEntries('p1', 1)];
    const kids = run(base, small, 'p1', 'kids');
    expect(kids.helped.map((x) => x.dollars)).toEqual([300]);
    expect(kids.hurt).toEqual([]);
    expect(kids.principlesPracticed).toEqual(['P10']);
    expect(run(base, small).helped.map((x) => x.dollars)).toEqual([300, 4]);
    expect(run(base, small).hurt.map((x) => x.dollars)).toEqual([3]);
  });

  it('DEBRIEF: the adult level keeps full numbers, and both levels list the same decisions', () => {
    const adult = run(base, log);
    const kids = run(base, log, 'p1', 'kids');
    expect(adult.helped[0]).toMatchObject({ impact: 345 });
    expect(adult.hurt[0]).toMatchObject({ impact: -335 });
    expect(kids.drivers.map((x) => x.ref)).toEqual(adult.drivers.map((x) => x.ref));
  });
});

describe('DEBRIEF purity', () => {
  it('DEBRIEF: the same final state always gives the same debrief, and the state is never mutated', () => {
    const state = deepFreeze(withLog(base, [gift(300), passed(700), ...paydayEntries('p1', 2)]));
    expect(debrief(state, 'p1', 'adult')).toEqual(debrief(state, 'p1', 'adult'));
  });
});
