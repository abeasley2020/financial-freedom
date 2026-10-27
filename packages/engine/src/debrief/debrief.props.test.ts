// Property suite for the debrief (spec v2, The debrief; plan Stage E): on
// random games played through the real reducer, every debrief references
// only events in the log that belong to its player, every dollar figure is
// an integer, and the numbers obey the attribution table. The recorded
// golden games are checked the same way, so escapes and bankruptcies are
// always covered.

import {
  DebriefSchema,
  GameStateSchema,
  PROFESSIONS,
  READING_LEVELS,
  type Debrief,
  type DebriefDecision,
  type DebriefDecisionKind,
  type GameState,
  type LogEvent,
  type ReadingLevel,
} from '@ff/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { deepFreeze } from '../test/deepFreeze';
import { NUM_RUNS } from '../test/fcConfig';
import escape from '../test/golden/escape-three-players.json';
import kids from '../test/golden/kids-three-players.json';
import lastStanding from '../test/golden/last-standing-two-players.json';
import fourPlayers from '../test/golden/limit-four-players.json';
import twoPlayers from '../test/golden/limit-two-players.json';
import { setupGame, step, type WalkSetup } from '../test/walk';
import { attribute, ownedEvents } from './attribution';
import { debrief } from './debrief';

const PROPERTY_TIMEOUT_MS = 120_000;

/** The log event kinds each decision kind may point at. */
const SOURCE_EVENTS: Readonly<Record<DebriefDecisionKind, readonly LogEvent['kind'][]>> = {
  lifeChoice: ['choseLifeOption'],
  passedDeal: ['passed'],
  boughtDeal: ['bought'],
  bankLoan: ['borrowed'],
  setbackLoan: ['borrowed'],
  subscription: ['subscriptionAdded'],
  growthAsset: ['bought'],
  gave: ['gave', 'choseLifeOption'],
};

const key = (ref: { readonly entry: number; readonly event: number }): string => `${String(ref.entry)}:${String(ref.event)}`;

/** Every number anywhere in `value`. */
function numbersIn(value: unknown): number[] {
  if (typeof value === 'number') return [value];
  if (Array.isArray(value)) return value.flatMap(numbersIn);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(numbersIn);
  return [];
}

/** The money figures a reading level rounds. */
function moneyOf(d: DebriefDecision): number[] {
  const base = [d.impact, d.dollars];
  switch (d.kind) {
    case 'lifeChoice':
      return [...base, d.todayDifference, d.monthlyDifference];
    case 'passedDeal':
      return [...base, d.monthlyCashFlow];
    case 'boughtDeal':
      return [...base, d.cost, d.cashFlowReceived, ...(d.saleResult === undefined ? [] : [d.saleResult])];
    case 'bankLoan':
    case 'setbackLoan':
      return [...base, d.amount, d.monthlyPayment];
    case 'subscription':
      return [...base, d.monthlyCost];
    case 'growthAsset':
      return [...base, d.invested, d.valueGained, d.payouts];
    case 'gave':
      return base;
  }
}

/** The attribution table's arithmetic, on the exact (adult) numbers. */
function expectArithmetic(d: DebriefDecision): void {
  switch (d.kind) {
    case 'lifeChoice':
      expect(d.impact).toBe(d.todayDifference + d.monthlyDifference * d.months);
      break;
    case 'passedDeal':
      expect(d.impact).toBe(-d.monthlyCashFlow * d.months);
      expect(d.monthlyCashFlow).toBeGreaterThan(0);
      break;
    case 'boughtDeal':
      expect(d.impact).toBe(d.cashFlowReceived + (d.saleResult ?? 0));
      break;
    case 'bankLoan':
    case 'setbackLoan':
      expect(d.outcome).toBe('hurt');
      break;
    case 'subscription':
      expect(d.impact).toBe(-d.monthlyCost * d.months);
      break;
    case 'growthAsset':
      expect(d.impact).toBe(d.valueGained + d.payouts);
      break;
    case 'gave':
      expect(d.outcome).toBe('helped');
      break;
  }
}

function expectSound(state: GameState, playerId: string, level: ReadingLevel): Debrief {
  const d = debrief(state, playerId, level);
  DebriefSchema.parse(d);
  for (const n of numbersIn(d)) expect(Number.isInteger(n) && !Object.is(n, -0), `${String(n)} is not a whole number`).toBe(true);

  const owned = new Set(ownedEvents(state.game.log, playerId).map((o) => key(o.ref)));
  const decisions = [...d.drivers, ...d.helped, ...d.hurt, ...d.suggestions.map((s) => s.decision)];
  for (const x of decisions) {
    const event = state.game.log[x.ref.entry]?.events[x.ref.event];
    expect(event, `${x.kind} points outside the log`).toBeDefined();
    expect(SOURCE_EVENTS[x.kind]).toContain(event?.kind);
    expect(owned.has(key(x.ref)), `${x.kind} points at another player's event`).toBe(true);
    expect(x.dollars).toBe(Math.abs(x.impact));
    expect(x.outcome).toBe(x.impact > 0 ? 'helped' : 'hurt');
    expect(x.impact).not.toBe(0);
    if (level === 'kids') {
      for (const m of moneyOf(x)) expect(m % 10 === 0, `${x.kind} kids figure ${String(m)}`).toBe(true);
      expect(x.dollars, 'a kid is never shown a $0 decision').toBeGreaterThan(0);
    }
    else expectArithmetic(x);
  }
  for (const p of d.moneyStory.points) {
    const event = state.game.log[p.ref.entry]?.events[p.ref.event];
    expect(event?.kind).toBe('paydaySnapshot');
    expect(event?.kind === 'paydaySnapshot' ? event.playerId : undefined).toBe(playerId);
    if (level === 'kids') expect(p.passiveIncome % 10 === 0 && p.totalExpenses % 10 === 0, 'kids money story in $10 steps').toBe(true);
  }

  expect(d.helped.every((x) => x.outcome === 'helped')).toBe(true);
  expect(d.hurt.every((x) => x.outcome === 'hurt')).toBe(true);
  for (const list of [d.drivers, d.helped, d.hurt]) {
    const dollars = list.map((x) => x.dollars);
    expect(dollars).toEqual([...dollars].sort((a, b) => b - a));
  }
  const shown = new Set([...d.helped, ...d.hurt].map((x) => key(x.ref)));
  for (const x of d.drivers) expect(shown.has(key(x.ref)), 'a driver is missing from helped or hurt').toBe(true);
  expect(d.suggestions.map((s) => key(s.decision.ref))).toEqual(d.hurt.slice(0, 2).map((x) => key(x.ref)));
  // Principles practiced: exactly the principles on the player's helped decisions, shown or not.
  const helpedPrinciples = new Set(
    attribute(state, playerId)
      .decisions.filter((s) => s.decision.outcome === 'helped')
      .flatMap((s) => s.decision.principles),
  );
  expect(new Set(d.principlesPracticed)).toEqual(helpedPrinciples);
  return d;
}

/** The debrief's own tracking of each asset agrees with the engine at every Payday. */
function expectTracking(state: GameState, playerId: string): void {
  for (const s of attribute(state, playerId).snapshots) {
    expect(s.trackedPassiveIncome, `passive income at log entry ${String(s.ref.entry)}`).toBe(s.passiveIncome);
  }
}

function checkAll(state: GameState): void {
  const frozen = deepFreeze(state);
  for (const player of frozen.players) {
    expectTracking(frozen, player.id);
    for (const level of READING_LEVELS) expectSound(frozen, player.id, level);
  }
}

function play(setup: WalkSetup, choices: readonly number[]): GameState {
  let state = setupGame(setup);
  for (const n of choices) {
    if (state.game.phase !== 'playing') break;
    const { result } = step(state, n);
    if (result.ok) state = result.state;
  }
  return state;
}

const tableArb = (mode: 'standard' | 'kids'): fc.Arbitrary<WalkSetup> =>
  fc.record({
    seed: fc.integer(),
    mode: fc.constant(mode),
    professions: fc.array(fc.nat({ max: PROFESSIONS.length - 1 }), { minLength: 2, maxLength: 4 }),
  });
const choicesArb = fc.array(fc.nat({ max: 1_000_000 }), { minLength: 50, maxLength: 600 });

describe('property: debriefs of random games', () => {
  it('DEBRIEF: every debrief references only its own player\'s events in the log, and every dollar figure is an integer (standard)', () => {
    fc.assert(
      fc.property(tableArb('standard'), choicesArb, (setup, choices) => {
        checkAll(play(setup, choices));
      }),
      { numRuns: Math.max(100, Math.floor(NUM_RUNS / 4)) },
    );
  }, PROPERTY_TIMEOUT_MS);

  it('DEBRIEF: every debrief references only its own player\'s events in the log, and every dollar figure is an integer (kids)', () => {
    fc.assert(
      fc.property(tableArb('kids'), choicesArb, (setup, choices) => {
        checkAll(play(setup, choices));
      }),
      { numRuns: Math.max(50, Math.floor(NUM_RUNS / 10)) },
    );
  }, PROPERTY_TIMEOUT_MS);
});

describe('DEBRIEF on the golden games', () => {
  const recordings: readonly [string, unknown][] = [
    ['limit-two-players', twoPlayers],
    ['limit-four-players', fourPlayers],
    ['kids-three-players', kids],
    ['last-standing-two-players', lastStanding],
    ['escape-three-players', escape],
  ];

  for (const [name, raw] of recordings) {
    it(`DEBRIEF: ${name} debriefs soundly for every player at both reading levels`, () => {
      const final = GameStateSchema.parse((raw as { expected: unknown }).expected);
      checkAll(final);
    });
  }
});
