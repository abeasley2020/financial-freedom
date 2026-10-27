// Debrief properties (Stage E): random games through the real reducer, then a
// debrief for every player at both reading levels. Every decision must point
// at a real event in the log, every dollar figure must be a whole number, and
// the assets the debrief tracks must add up to the passive income each
// paydaySnapshot recorded.

import { PROFESSIONS, READING_LEVELS, type DebriefDecision, type DecisionKind, type GameState, type LogEvent } from '@ff/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { deepFreeze } from '../test/deepFreeze';
import { NUM_RUNS } from '../test/fcConfig';
import { setupGame, step, type WalkSetup } from '../test/walk';
import { debrief, debriefTrace } from './debrief';

const PROPERTY_TIMEOUT_MS = 120_000;

const setupArb: fc.Arbitrary<WalkSetup> = fc.record({
  seed: fc.integer(),
  mode: fc.constantFrom('standard' as const, 'kids' as const),
  professions: fc.array(fc.nat({ max: PROFESSIONS.length - 1 }), { minLength: 2, maxLength: 4 }),
});
const choicesArb = fc.array(fc.nat({ max: 1_000_000 }), { minLength: 50, maxLength: 500 });

function play(setup: WalkSetup, choices: readonly number[]): GameState {
  let state = setupGame(setup);
  for (const n of choices) {
    if (state.game.phase !== 'playing') break;
    const { result } = step(state, n);
    if (result.ok) state = result.state;
  }
  return deepFreeze(state);
}

/** The log event that records each kind of decision. */
const SOURCE: Readonly<Record<DecisionKind, LogEvent['kind']>> = {
  lifeChoice: 'choseLifeOption',
  passedDeal: 'passed',
  boughtDeal: 'bought',
  growthHeld: 'bought',
  bankLoan: 'borrowed',
  setbackLoan: 'borrowed',
  subscription: 'subscriptionAdded',
  gave: 'gave',
};

const isWhole = (n: number | undefined): boolean => n === undefined || Number.isInteger(n);

function expectWhole(d: DebriefDecision): void {
  expect(isWhole(d.impact) && isWhole(d.dollars) && isWhole(d.monthly), `decision ${d.id} has a fractional dollar figure`).toBe(true);
  expect(d.dollars).toBe(Math.abs(d.impact));
}

describe('debrief properties', () => {
  it(
    'DEBRIEF: every decision references an event in the log, every dollar figure is an integer, and the lists keep their limits and order',
    () => {
      fc.assert(
        fc.property(setupArb, choicesArb, (setup, choices) => {
          const state = play(setup, choices);
          for (const player of state.players) {
            for (const level of READING_LEVELS) {
              const d = debrief(state, player.id, level);
              const all = [...d.drivers, ...d.helped, ...d.hurt];
              for (const decision of all) {
                const event = state.game.log[decision.logIndex]?.events[decision.eventIndex];
                expect(event?.kind, `decision ${decision.id} points at no ${SOURCE[decision.kind]} event`).toBe(SOURCE[decision.kind]);
                if (event?.kind === 'bought') expect(decision.assetId).toBe(event.assetId);
                if (event?.kind === 'borrowed' || event?.kind === 'subscriptionAdded') expect(decision.liabilityId).toBe(event.liabilityId);
                expectWhole(decision);
              }
              expect(d.helped.length).toBeLessThanOrEqual(3);
              expect(d.hurt.length).toBeLessThanOrEqual(3);
              expect(d.drivers.length).toBeLessThanOrEqual(3);
              expect(d.suggestions.length).toBeLessThanOrEqual(2);
              for (const x of d.helped) expect(x.impact).toBeGreaterThanOrEqual(0);
              for (const x of d.hurt) expect(x.impact).toBeLessThanOrEqual(0);
              for (const s of d.suggestions) {
                expect(d.hurt.map((x) => x.id)).toContain(s.decisionId);
                expect([s.dollars, s.monthly, s.freedomPoints].every(isWhole)).toBe(true);
              }
              const r = d.result;
              expect([r.freedomPercent, r.passiveIncome, r.totalExpenses, r.rank].every(isWhole)).toBe(true);
              expect(r.rank).toBeGreaterThanOrEqual(1);
              expect(r.rank).toBeLessThanOrEqual(state.players.length);
              for (const p of d.moneyStory) expect(isWhole(p.passiveIncome) && isWhole(p.totalExpenses)).toBe(true);
              if (level === 'kids') for (const x of all) expect(Math.abs(x.impact) % 10).toBe(0);
            }
          }
        }),
        { numRuns: NUM_RUNS },
      );
    },
    PROPERTY_TIMEOUT_MS,
  );

  it(
    'DEBRIEF: the assets the debrief tracks add up to the passive income at every one of the player\'s Paydays',
    () => {
      fc.assert(
        fc.property(setupArb, choicesArb, (setup, choices) => {
          const state = play(setup, choices);
          for (const player of state.players) {
            const { moneyStory, trackedPassive } = debriefTrace(state, player.id);
            expect(trackedPassive).toEqual(moneyStory.map((p) => p.passiveIncome));
          }
        }),
        { numRuns: NUM_RUNS },
      );
    },
    PROPERTY_TIMEOUT_MS,
  );

  it('DEBRIEF: the ranks of all players are 1 to N with no repeats', () => {
    fc.assert(
      fc.property(setupArb, choicesArb, (setup, choices) => {
        const state = play(setup, choices);
        const ranks = state.players.map((p) => debrief(state, p.id, 'adult').result.rank).sort((a, b) => a - b);
        expect(ranks).toEqual(state.players.map((_, i) => i + 1));
      }),
      { numRuns: Math.min(NUM_RUNS, 300) },
    );
  }, PROPERTY_TIMEOUT_MS);
});
