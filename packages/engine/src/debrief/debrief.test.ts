// Spec v2, The debrief, attribution table: one test per rule, each on a
// hand-built log. The debrief reads only the final state and the log, so the
// fixtures write log entries directly instead of playing a game.

import type { Action, GameState, LogEntry, LogEvent } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { deepFreeze } from '../test/deepFreeze';
import { twoPlayerGame, withGame, withPlayer } from '../test/fixtures';
import { debrief } from './debrief';

// Ada the Teacher (p1): totalExpenses 4,560 at the start. Grace the Doctor (p2).
const ADA = 'p1';
const GRACE = 'p2';

const endTurn = (playerId: string): Action => ({ type: 'END_TURN', playerId });

/** One log entry for `playerId`'s action, carrying `events`. */
function entry(playerId: string, events: readonly LogEvent[], action: Action = endTurn(playerId)): LogEntry {
  return { turnNumber: 0, action, events };
}

/** A Payday for `playerId` in `round`. */
function snap(playerId: string, round: number, passiveIncome = 0, totalExpenses = 4_560, cash = 1_000): LogEvent {
  return { kind: 'paydaySnapshot', playerId, passiveIncome, totalExpenses, cash, roundNumber: round };
}

/** `count` Paydays for Ada in rounds `from` onward, one entry each. */
function adaPaydays(count: number, from = 2, passiveIncome = 0): LogEntry[] {
  return Array.from({ length: count }, (_, i) => entry(ADA, [snap(ADA, from + i, passiveIncome)]));
}

const ended = (winnerId: string, reason: 'escape' | 'roundLimit' | 'lastStanding' = 'roundLimit'): LogEntry =>
  entry(winnerId, [{ kind: 'gameEnded', reason, winnerId }]);

/** A finished two-player game whose log is exactly `log`. */
function finished(log: readonly LogEntry[], patch: (state: GameState) => GameState = (s) => s): GameState {
  const base = twoPlayerGame();
  const winnerId = [...log].reverse().flatMap((e) => e.events).find((e) => e.kind === 'gameEnded');
  return deepFreeze(
    patch(
      withGame(base, {
        phase: 'finished',
        log: [...log],
        currentPlayerId: winnerId?.kind === 'gameEnded' ? winnerId.winnerId : ADA,
      }),
    ),
  );
}

const lifeOption = (cardId: string, optionId: string, chosen: [number, number], cheapest: [string, number, number], priciest: [string, number, number]): LogEvent => ({
  kind: 'choseLifeOption',
  cardId,
  optionId,
  principles: ['P4', 'P6'],
  costToday: chosen[0],
  monthlyChange: chosen[1],
  cheapest: { optionId: cheapest[0], costToday: cheapest[1], monthlyChange: cheapest[2] },
  priciest: { optionId: priciest[0], costToday: priciest[1], monthlyChange: priciest[2] },
});

// life-001 Your car is old: keep (0, 0), used (4,000 today), new (car loan, +380/mo).
const KEEP: [string, number, number] = ['keep', 0, 0];
const NEW: [string, number, number] = ['new', 0, 380];

describe('debrief: Life Choices options', () => {
  it('DEBRIEF: a pricier option hurts by the cheapest minus the chosen, today plus monthly times Paydays afterward', () => {
    const state = finished([entry(ADA, [snap(ADA, 1)]), entry(ADA, [lifeOption('life-001', 'new', [0, 380], KEEP, NEW)]), ...adaPaydays(3), ended(GRACE)]);
    const d = debrief(state, ADA, 'adult');
    expect(d.hurt).toEqual([
      expect.objectContaining({ kind: 'lifeChoice', cardId: 'life-001', optionId: 'new', cheapestOptionId: 'keep', impact: -1_140, dollars: 1_140, paydays: 3, verdict: 'hurt', principles: ['P4', 'P6'], monthly: 380, roundNumber: 1 }),
    ]);
  });

  it('DEBRIEF: the cash-today part counts once, not per Payday', () => {
    const state = finished([entry(ADA, [lifeOption('life-001', 'used', [4_000, 0], KEEP, NEW)]), ...adaPaydays(3), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt[0]).toMatchObject({ optionId: 'used', impact: -4_000, monthly: 0 });
  });

  it('DEBRIEF: choosing the cheapest option helps by what the most expensive option would have cost', () => {
    const state = finished([entry(ADA, [lifeOption('life-001', 'keep', [0, 0], KEEP, NEW)]), ...adaPaydays(3), ended(GRACE)]);
    const d = debrief(state, ADA, 'adult');
    expect(d.helped).toEqual([expect.objectContaining({ kind: 'lifeChoice', optionId: 'keep', impact: 1_140, verdict: 'helped' })]);
    expect(d.hurt).toEqual([]);
  });

  it('DEBRIEF: a windfall spent instead of invested hurts by the payout given up', () => {
    // life-005 Tax refund: spend (gain 2,000, pay 2,000), invest (-20/mo payout), payDebt (-60/mo).
    const event = lifeOption('life-005', 'spend', [0, 0], ['payDebt', 0, -60], ['spend', 0, 0]);
    const state = finished([entry(ADA, [event]), ...adaPaydays(4), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt[0]).toMatchObject({ optionId: 'spend', cheapestOptionId: 'payDebt', impact: -240 });
  });

  it('DEBRIEF: a decision made on the last Payday costs only its cash today', () => {
    const state = finished([entry(ADA, [snap(ADA, 15), lifeOption('life-001', 'new', [0, 380], KEEP, NEW)]), ended(GRACE)]);
    const d = debrief(state, ADA, 'adult');
    expect(d.hurt).toEqual([]);
    expect(d.helped).toEqual([]);
  });
});

describe('debrief: passed deals', () => {
  const passed = (monthlyCashFlow: number, affordable: boolean): LogEvent => ({
    kind: 'passed',
    cardId: 'small-003',
    principles: ['P2', 'P3'],
    monthlyCashFlow,
    downPayment: 3_000,
    affordable,
  });

  it('DEBRIEF: passing an affordable deal with positive cash flow hurts by cash flow times Paydays afterward', () => {
    const state = finished([entry(ADA, [passed(450, true)]), ...adaPaydays(5), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt).toEqual([
      expect.objectContaining({ kind: 'passedDeal', cardId: 'small-003', impact: -2_250, monthly: 450, paydays: 5, principles: ['P2', 'P3'] }),
    ]);
  });

  it('DEBRIEF: passing a deal the player could not afford, or one with no cash flow, is not scored', () => {
    const state = finished([entry(ADA, [passed(450, false)]), entry(ADA, [passed(0, true)]), entry(ADA, [passed(-50, true)]), ...adaPaydays(5), ended(GRACE)]);
    const d = debrief(state, ADA, 'adult');
    expect(d.hurt).toEqual([]);
    expect(d.drivers).toEqual([]);
  });
});

describe('debrief: bought deals', () => {
  // small-003 Lawn Care Trailer: 3,000 down, no mortgage, +450/mo.
  const bought: LogEvent = { kind: 'bought', assetId: 'a1', cardId: 'small-003', cost: 3_000, principles: ['P2', 'P3'] };

  it('DEBRIEF: a deal still held helps by the cash flow it paid across Paydays afterward', () => {
    const state = finished([entry(ADA, [bought]), ...adaPaydays(4), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').helped).toEqual([
      expect.objectContaining({ kind: 'boughtDeal', assetId: 'a1', impact: 1_800, paydays: 4, monthly: 450, sold: false, principles: ['P2', 'P3'] }),
    ]);
  });

  it('DEBRIEF: a Market change to its cash flow counts from the next Payday on', () => {
    const changed: LogEvent = { kind: 'cashFlowChanged', assetId: 'a1', delta: -100, monthlyCashFlow: 350 };
    const state = finished([entry(ADA, [bought]), ...adaPaydays(2), entry(ADA, [changed]), ...adaPaydays(2, 4), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').helped[0]).toMatchObject({ impact: 450 * 2 + 350 * 2, monthly: 350 });
  });

  it('DEBRIEF: a sold deal adds sale proceeds, less the mortgage paid off and the cash paid', () => {
    // small-001 Duplex: 5,000 down, 45,000 mortgage, +700/mo. Sold at 2x price: 100,000 gross.
    const duplex: LogEvent = { kind: 'bought', assetId: 'a2', cardId: 'small-001', cost: 5_000, principles: ['P2', 'P3', 'P5'] };
    const sold: LogEvent = { kind: 'sold', assetId: 'a2', cardId: 'small-001', proceeds: 100_000, mortgagePaid: 45_000, principles: ['P2', 'P3', 'P5'] };
    const state = finished([entry(ADA, [duplex]), ...adaPaydays(2), entry(ADA, [sold]), ...adaPaydays(3, 4), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').helped[0]).toMatchObject({ kind: 'boughtDeal', impact: 1_400 + 100_000 - 45_000 - 5_000, paydays: 2, sold: true });
  });

  it('DEBRIEF: a deal sold for less than it earned and cost hurts', () => {
    // big-003 Forty Acres: land, 12,000 down, 48,000 mortgage, -50/mo. Bankruptcy sells it at half price, 30,000.
    const land: LogEvent = { kind: 'bought', assetId: 'a3', cardId: 'big-003', cost: 12_000, principles: ['P9'] };
    const sold: LogEvent = { kind: 'sold', assetId: 'a3', cardId: 'big-003', proceeds: 30_000, mortgagePaid: 30_000, principles: ['P9'] };
    const state = finished([entry(ADA, [land]), ...adaPaydays(2), entry(ADA, [sold]), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt[0]).toMatchObject({ kind: 'boughtDeal', impact: -100 - 12_000, verdict: 'hurt' });
  });

  it('DEBRIEF: stock dividends follow the shares held, and a partial sale counts its share of the cost', () => {
    // small-007 Lakeshore Utilities: $1 dividend per share. 100 shares at 60, then 40 sold at 80.
    const stock: LogEvent = { kind: 'bought', assetId: 'a4', cardId: 'small-007', cost: 6_000, shares: 100, principles: ['P8', 'P9'] };
    const sold: LogEvent = { kind: 'sold', assetId: 'a4', cardId: 'small-007', proceeds: 3_200, shares: 40, remainingShares: 60, principles: ['P8', 'P9'] };
    const state = finished([entry(ADA, [stock]), ...adaPaydays(2), entry(ADA, [sold]), ...adaPaydays(2, 4), ended(GRACE)]);
    // Dividends 100 x 2 + 60 x 2 = 320; the 40 shares cost 2,400 and sold for 3,200.
    expect(debrief(state, ADA, 'adult').helped[0]).toMatchObject({ kind: 'boughtDeal', impact: 320 + 800, monthly: 60, sold: false });
  });
});

describe('debrief: bank loans', () => {
  const borrowed = (purpose: 'asset' | 'want' | 'none', id = 'l1', amount = 2_000): LogEvent => ({
    kind: 'borrowed',
    liabilityId: id,
    amount,
    monthlyPayment: amount / 10,
    principles: ['P5'],
    purpose,
  });

  it('DEBRIEF: a bank loan for a want hurts by the payments made', () => {
    const state = finished([entry(ADA, [borrowed('want')]), ...adaPaydays(3), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt).toEqual([
      expect.objectContaining({ kind: 'bankLoan', purpose: 'want', liabilityId: 'l1', impact: -600, monthly: 200, paydays: 3, principles: ['P5'] }),
    ]);
  });

  it('DEBRIEF: a bank loan with nothing pending hurts like a loan for a want', () => {
    const state = finished([entry(ADA, [borrowed('none')]), ...adaPaydays(2), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt[0]).toMatchObject({ kind: 'bankLoan', purpose: 'none', impact: -400 });
  });

  it('DEBRIEF: a bank loan for an asset is neutral; the asset row carries the result', () => {
    const state = finished([entry(ADA, [borrowed('asset')]), ...adaPaydays(3), ended(GRACE)]);
    const d = debrief(state, ADA, 'adult');
    expect(d.hurt).toEqual([]);
    expect(d.helped).toEqual([]);
    expect(d.drivers).toEqual([]);
  });

  it('DEBRIEF: payments stop when the loan is repaid', () => {
    const repaid: LogEvent = { kind: 'repaid', liabilityId: 'l1', principal: 2_000, principles: ['P5'] };
    const state = finished([entry(ADA, [borrowed('want')]), ...adaPaydays(2), entry(ADA, [repaid]), ...adaPaydays(3, 4), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt[0]).toMatchObject({ impact: -400, paydays: 2 });
  });

  it('DEBRIEF: a paid-down loan counts its new payment from the next Payday', () => {
    const paidDown: LogEvent = { kind: 'paidDown', liabilityId: 'l1', amount: 1_000, principal: 1_000, monthlyPayment: 100 };
    const state = finished([entry(ADA, [borrowed('want')]), ...adaPaydays(1), entry(ADA, [paidDown]), ...adaPaydays(2, 3), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt[0]).toMatchObject({ impact: -(200 + 100 + 100), paydays: 3 });
  });
});

describe('debrief: Setback loans', () => {
  it('DEBRIEF: a loan forced by a Setback hurts by the payments made on it, under P1', () => {
    const loan: LogEvent = { kind: 'borrowed', liabilityId: 'l9', amount: 3_000, monthlyPayment: 300, principles: ['P1'], purpose: 'setback', cardId: 'setback-001' };
    const state = finished([entry(ADA, [loan]), ...adaPaydays(4), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt).toEqual([
      expect.objectContaining({ kind: 'setbackLoan', cardId: 'setback-001', liabilityId: 'l9', impact: -1_200, monthly: 300, principles: ['P1'] }),
    ]);
  });
});

describe('debrief: subscriptions', () => {
  const added: LogEvent = { kind: 'subscriptionAdded', liabilityId: 's1', monthlyCost: 60 };

  it('DEBRIEF: a subscription hurts by its monthly cost times the Paydays it ran, under P7', () => {
    const state = finished([entry(ADA, [added]), ...adaPaydays(5), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt).toEqual([
      expect.objectContaining({ kind: 'subscription', liabilityId: 's1', impact: -300, monthly: 60, paydays: 5, principles: ['P7'] }),
    ]);
  });

  it('DEBRIEF: a subscription names the Life Choices card it came from', () => {
    const choice = lifeOption('life-004', 'subscribe', [0, 60], ['skip', 0, 0], ['subscribe', 0, 60]);
    const state = finished([entry(ADA, [choice, added]), ...adaPaydays(2), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt).toContainEqual(expect.objectContaining({ kind: 'subscription', cardId: 'life-004', optionId: 'subscribe' }));
  });

  it('DEBRIEF: a cancelled subscription stops costing', () => {
    const cancelled: LogEvent = { kind: 'repaid', liabilityId: 's1', principal: 0, principles: ['P7'] };
    const state = finished([entry(ADA, [added]), ...adaPaydays(2), entry(ADA, [cancelled]), ...adaPaydays(3, 4), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt[0]).toMatchObject({ impact: -120, paydays: 2 });
  });
});

describe('debrief: growth assets', () => {
  // small-004 Total Market Index Fund: grows 4% a month, pays 1% of its value.
  const bought: LogEvent = { kind: 'bought', assetId: 'g1', cardId: 'small-004', cost: 1_000, principles: ['P1', 'P8'] };
  const grow = (delta: number, marketValue: number): LogEvent => ({ kind: 'valueChanged', assetId: 'g1', delta, marketValue });

  it('DEBRIEF: a growth asset held helps by the value it gained plus the payouts it paid, under P8', () => {
    const state = finished([
      entry(ADA, [bought]),
      entry(ADA, [grow(40, 1_040), snap(ADA, 2, 10)]),
      entry(ADA, [grow(41, 1_081), snap(ADA, 3, 10)]),
      ended(GRACE),
    ]);
    expect(debrief(state, ADA, 'adult').helped).toEqual([
      expect.objectContaining({ kind: 'growthHeld', assetId: 'g1', cardId: 'small-004', impact: 81 + 10 + 10, paydays: 2, monthly: 10, principles: ['P8'], sold: false }),
    ]);
  });

  it('DEBRIEF: a sold growth asset counts its sale price as its final value', () => {
    const sold: LogEvent = { kind: 'sold', assetId: 'g1', cardId: 'small-004', proceeds: 1_040, principles: ['P1', 'P8'] };
    const state = finished([entry(ADA, [bought]), entry(ADA, [grow(40, 1_040), snap(ADA, 2, 10)]), entry(ADA, [sold]), ...adaPaydays(2, 3), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').helped[0]).toMatchObject({ impact: 40 + 10, paydays: 1, sold: true });
  });

  it('DEBRIEF: a windfall invested in an index fund pays out at the option rate', () => {
    // life-005 invest: 2,000 into an index fund at 4% growth and 1% payout.
    const choice = lifeOption('life-005', 'invest', [0, -20], ['payDebt', 0, -20], ['spend', 0, 0]);
    const windfall: LogEvent = { kind: 'bought', assetId: 'g2', cardId: 'life-005', cost: 2_000, principles: ['P4', 'P8'] };
    const state = finished([
      entry(ADA, [choice, windfall]),
      entry(ADA, [{ kind: 'valueChanged', assetId: 'g2', delta: 80, marketValue: 2_080 }, snap(ADA, 2, 20)]),
      ended(GRACE),
    ]);
    expect(debrief(state, ADA, 'adult').helped).toContainEqual(expect.objectContaining({ kind: 'growthHeld', assetId: 'g2', impact: 80 + 20 }));
  });
});

describe('debrief: giving', () => {
  it('DEBRIEF: a gift helps by the amount given, never as a loss, under P10', () => {
    const gave: LogEvent = { kind: 'gave', amount: 250, favorTokens: 1, principles: ['P10'] };
    const state = finished([entry(ADA, [gave]), ...adaPaydays(1), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').helped).toEqual([expect.objectContaining({ kind: 'gave', impact: 250, verdict: 'helped', principles: ['P10'] })]);
  });
});

describe('debrief: sections', () => {
  const sub = (id: string, cost: number): LogEvent => ({ kind: 'subscriptionAdded', liabilityId: id, monthlyCost: cost });
  const gift = (amount: number): LogEvent => ({ kind: 'gave', amount, favorTokens: 1, principles: ['P10'] });

  it('DEBRIEF: helped and hurt hold at most three each, largest first; drivers are the three largest of either', () => {
    const state = finished([
      entry(ADA, [sub('s1', 10), sub('s2', 40), sub('s3', 30), sub('s4', 20), gift(50), gift(500), gift(300), gift(100)]),
      ...adaPaydays(10),
      ended(GRACE),
    ]);
    const d = debrief(state, ADA, 'adult');
    expect(d.hurt.map((x) => x.impact)).toEqual([-400, -300, -200]);
    expect(d.helped.map((x) => x.impact)).toEqual([500, 300, 100]);
    // The 300 tie goes to the subscription, which comes first in the log.
    expect(d.drivers.map((x) => x.impact)).toEqual([500, -400, -300]);
  });

  it('DEBRIEF: ties keep log order', () => {
    const state = finished([entry(ADA, [gift(100)]), entry(ADA, [sub('s1', 10)]), ...adaPaydays(10), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').drivers.map((x) => x.kind)).toEqual(['gave', 'subscription']);
  });

  it('DEBRIEF: the winner sees hurt decisions and suggestions too', () => {
    const state = finished([entry(ADA, [sub('s1', 60)]), ...adaPaydays(5), ended(ADA)]);
    const d = debrief(state, ADA, 'adult');
    expect(d.result.outcome).toBe('won');
    expect(d.hurt).toHaveLength(1);
    expect(d.suggestions).toHaveLength(1);
  });

  it('DEBRIEF: up to two suggestions from the largest hurt decisions, with dollars and freedom points', () => {
    const state = finished([
      entry(ADA, [sub('s1', 40), sub('s2', 60), sub('s3', 50), lifeOption('life-001', 'new', [0, 380], KEEP, NEW)]),
      ...adaPaydays(5),
      ended(GRACE),
    ]);
    const d = debrief(state, ADA, 'adult');
    // Final totalExpenses is Ada's 4,560 (the fixture state keeps her starting liabilities).
    expect(d.suggestions).toEqual([
      expect.objectContaining({ kind: 'lifeChoice', principle: 'P4', dollars: 1_900, monthly: 380, freedomPoints: Math.floor((380 * 100) / 4_560), cardId: 'life-001', betterOptionId: 'keep' }),
      expect.objectContaining({ kind: 'subscription', principle: 'P7', dollars: 300, monthly: 60, freedomPoints: Math.floor((60 * 100) / 4_560) }),
    ]);
  });

  it('DEBRIEF: the result line reports freedom, passive income, and totalExpenses from the final state', () => {
    const state = finished([ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').result).toEqual({
      outcome: 'lost',
      endReason: 'roundLimit',
      rank: 2,
      players: 2,
      freedomPercent: 0,
      passiveIncome: 0,
      totalExpenses: 4_560,
    });
  });

  it('DEBRIEF: an escape is the outcome for the player who escaped', () => {
    const state = finished([ended(ADA, 'escape')], (s) => withPlayer(s, ADA, { hasEscaped: true }));
    expect(debrief(state, ADA, 'adult').result).toMatchObject({ outcome: 'escaped', endReason: 'escape', rank: 1 });
  });

  it('DEBRIEF: a player who went out sees the round they ran out of money', () => {
    const state = finished(
      [...adaPaydays(5), entry(ADA, [snap(ADA, 7, 0, 4_560, -300), { kind: 'wentOut', shortfall: 300 }]), ended(GRACE, 'lastStanding')],
      (s) => withPlayer(s, ADA, { isOut: true, cash: 0, assets: [], liabilities: [] }),
    );
    expect(debrief(state, ADA, 'adult').result).toMatchObject({ outcome: 'out', roundOut: 7, rank: 2 });
  });

  it('DEBRIEF: the money story is passive income and totalExpenses at each of the player\'s own Paydays, with the crossing round', () => {
    const state = finished([
      entry(ADA, [snap(ADA, 1, 100, 4_000)]),
      entry(GRACE, [snap(GRACE, 1, 0, 17_040)]),
      entry(ADA, [snap(ADA, 2, 4_000, 4_000)]),
      ended(GRACE),
    ]);
    const d = debrief(state, ADA, 'adult');
    expect(d.moneyStory.filter((p) => p.endOfGame !== true)).toEqual([
      { roundNumber: 1, passiveIncome: 100, totalExpenses: 4_000 },
      { roundNumber: 2, passiveIncome: 4_000, totalExpenses: 4_000 },
    ]);
    expect(d.crossedRound).toBe(2);
  });

  it('DEBRIEF: a finished game adds an end-of-game point from the final state, so an escape after the last Payday shows the crossing', () => {
    // Ada escapes at END_TURN after a purchase: her last Payday showed 100 of 4,560, the final state 4,600 of 4,560.
    const state = finished([entry(ADA, [snap(ADA, 9, 100)]), ended(ADA, 'escape')], (s) =>
      withPlayer(s, ADA, {
        hasEscaped: true,
        assets: [{ id: 'a1', cardId: 'small-003', type: 'business', purchasePrice: 3_000, downPaid: 3_000, monthlyCashFlow: 4_600 }],
      }),
    );
    const d = debrief(state, ADA, 'adult');
    expect(d.moneyStory).toEqual([
      { roundNumber: 9, passiveIncome: 100, totalExpenses: 4_560 },
      { roundNumber: 9, passiveIncome: 4_600, totalExpenses: 4_560, endOfGame: true },
    ]);
    expect(d.crossedRound).toBe(9);
  });

  it('DEBRIEF: no end-of-game point while the game is playing, for a player who went out, or when nothing changed after the last Payday', () => {
    const playing = deepFreeze(withGame(twoPlayerGame(), { log: [entry(ADA, [snap(ADA, 1, 0)])] }));
    expect(debrief(playing, ADA, 'adult').moneyStory).toHaveLength(1);
    const unchanged = finished([entry(ADA, [snap(ADA, 15, 0)]), ended(GRACE)]);
    expect(debrief(unchanged, ADA, 'adult').moneyStory).toHaveLength(1);
  });

  it('DEBRIEF: principles practiced are the tags on helped decisions, in P1 to P10 order', () => {
    const bought: LogEvent = { kind: 'bought', assetId: 'a1', cardId: 'small-003', cost: 3_000, principles: ['P3', 'P2'] };
    const state = finished([entry(ADA, [gift(100), bought, sub('s1', 10)]), ...adaPaydays(2), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').principlesPracticed).toEqual(['P2', 'P3', 'P10']);
  });
});

describe('debrief: whose events', () => {
  it('DEBRIEF: only the player\'s own decisions are scored', () => {
    const state = finished([entry(GRACE, [{ kind: 'subscriptionAdded', liabilityId: 'gs', monthlyCost: 60 }]), entry(GRACE, [snap(GRACE, 2)]), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt).toEqual([]);
    expect(debrief(state, GRACE, 'adult').hurt).toHaveLength(1);
  });

  it('DEBRIEF: a skipped seat\'s Payday and sales inside another player\'s END_TURN belong to the skipped seat', () => {
    const land: LogEvent = { kind: 'bought', assetId: 'a3', cardId: 'big-003', cost: 12_000, principles: ['P9'] };
    const state = finished([
      entry(ADA, [land]),
      entry(GRACE, [
        { kind: 'turnSkipped', playerId: ADA },
        snap(ADA, 2, -50),
        { kind: 'sold', assetId: 'a3', cardId: 'big-003', proceeds: 30_000, mortgagePaid: 30_000, principles: ['P9'] },
      ]),
      ended(GRACE),
    ]);
    expect(debrief(state, ADA, 'adult').hurt[0]).toMatchObject({ kind: 'boughtDeal', impact: -50 - 12_000, paydays: 1, sold: true });
    const paydays = (playerId: string) => debrief(state, playerId, 'adult').moneyStory.filter((p) => p.endOfGame !== true);
    expect(paydays(ADA)).toHaveLength(1);
    expect(paydays(GRACE)).toHaveLength(0);
  });
});

describe('debrief: reading levels', () => {
  it('DEBRIEF: kids numbers are rounded to $10; adult numbers are exact', () => {
    const sub: LogEvent = { kind: 'subscriptionAdded', liabilityId: 's1', monthlyCost: 33 };
    const state = finished([entry(ADA, [sub]), ...adaPaydays(5), ended(GRACE)]);
    expect(debrief(state, ADA, 'adult').hurt[0]).toMatchObject({ impact: -165, dollars: 165, monthly: 33 });
    expect(debrief(state, ADA, 'kids').hurt[0]).toMatchObject({ impact: -170, dollars: 170, monthly: 30 });
    expect(debrief(state, ADA, 'kids').readingLevel).toBe('kids');
  });

  it('DEBRIEF: every dollar figure is a whole number at both levels', () => {
    const sub: LogEvent = { kind: 'subscriptionAdded', liabilityId: 's1', monthlyCost: 33 };
    const state = finished([entry(ADA, [sub]), ...adaPaydays(5), ended(GRACE)]);
    for (const level of ['kids', 'adult'] as const) {
      const d = debrief(state, ADA, level);
      for (const x of [...d.helped, ...d.hurt, ...d.drivers]) {
        expect(Number.isInteger(x.impact)).toBe(true);
        expect(Number.isInteger(x.dollars)).toBe(true);
      }
    }
  });
});
