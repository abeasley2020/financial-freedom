// Property suite (spec, Testing strategy; CLAUDE.md, Engine invariants).
// Random games are played through the real reducer and every invariant is
// checked after every accepted action. On failure fast-check prints a seed
// and path; paste them into fc.assert's options to replay.

import { ACTION_TYPES, CARDS_BY_ID, isGrowthAsset, PROFESSIONS, type Action, type GameState } from '@ff/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { assertInvariants, checkInvariants } from './invariants';
import { reduce } from './reduce';
import { replay } from './replay';
import { roundLimit, roundNumber, winner } from './selectors';
import { deepFreeze } from './test/deepFreeze';
import { NUM_RUNS } from './test/fcConfig';
import { isStuck, setupGame, step, type WalkSetup } from './test/walk';

const setupArb = (mode: fc.Arbitrary<'standard' | 'kids'>): fc.Arbitrary<WalkSetup> =>
  fc.record({
    seed: fc.integer(),
    mode,
    professions: fc.array(fc.nat({ max: PROFESSIONS.length - 1 }), { minLength: 2, maxLength: 6 }),
  });

/** Property tests run thousands of reducer calls; under a parallel `pnpm test` they need more than the 5 s default. */
const PROPERTY_TIMEOUT_MS = 120_000;

const choicesArb = fc.array(fc.nat({ max: 1_000_000 }), { minLength: 20, maxLength: 250 });

/** Long enough for a small table to reach the 15-round limit (about 4 choices a turn, 2 to 3 players). */
const longChoicesArb = fc.array(fc.nat({ max: 1_000_000 }), { minLength: 150, maxLength: 600 });
const smallTableArb: fc.Arbitrary<WalkSetup> = fc.record({
  seed: fc.integer(),
  mode: fc.constant('standard' as const),
  professions: fc.array(fc.nat({ max: PROFESSIONS.length - 1 }), { minLength: 2, maxLength: 3 }),
});

interface Played {
  readonly initial: GameState;
  readonly final: GameState;
  readonly accepted: readonly Action[];
  readonly steps: number;
}

/** What the random walks reached, across every run of a property (spec v2: the generator must exercise every action and effect). */
const coverage = {
  actionTypes: new Set<string>(),
  lifeEffectKinds: new Set<string>(),
  marketEffectKinds: new Set<string>(),
  endings: new Set<string>(),
};

function recordCoverage(before: GameState, action: Action, after: GameState): void {
  coverage.actionTypes.add(action.type);
  if (action.type === 'CHOOSE_LIFE_OPTION' && before.pending.kind === 'lifeChoice') {
    const card = CARDS_BY_ID.get(before.pending.cardId);
    const option = card?.deck === 'lifeChoices' ? card.options.find((o) => o.id === action.optionId) : undefined;
    for (const effect of option?.effects ?? []) coverage.lifeEffectKinds.add(effect.kind);
  }
  if (action.type === 'ACCEPT_MARKET' && before.pending.kind === 'marketChoice') {
    const card = CARDS_BY_ID.get(before.pending.cardId);
    if (card?.deck === 'market') for (const effect of card.effects) coverage.marketEffectKinds.add(effect.kind);
  }
  for (const event of after.game.log.at(-1)?.events ?? []) if (event.kind === 'gameEnded') coverage.endings.add(event.reason);
}

/** Spec v2, Growth assets: marketValue only ever falls through a Market card. */
function expectGrowthMonotonic(before: GameState, action: Action, after: GameState): void {
  if (action.type === 'ACCEPT_MARKET') return;
  for (const player of after.players) {
    const was = before.players.find((p) => p.id === player.id);
    for (const asset of player.assets) {
      if (!isGrowthAsset(asset)) continue;
      const earlier = was?.assets.find((a) => a.id === asset.id);
      if (earlier !== undefined && isGrowthAsset(earlier)) {
        expect(asset.marketValue, `growth asset ${asset.id} shrank on ${action.type}`).toBeGreaterThanOrEqual(earlier.marketValue);
      }
    }
  }
}

/**
 * Plays a game from `setup` with `choices`, checking after every accepted
 * action that the invariants hold, that only the current player acted, that
 * END_TURN came with no decision pending, and that a rejection changed
 * nothing. Stops when the game finishes or the choices run out.
 */
function play(setup: WalkSetup, choices: readonly number[]): Played {
  const initial = setupGame(setup);
  assertInvariants(initial);
  let state = initial;
  const accepted: Action[] = [];
  let steps = 0;
  for (const n of choices) {
    if (state.game.phase !== 'playing') break;
    const frozen = deepFreeze(state);
    const { action, result } = step(frozen, n);
    steps++;
    if (!result.ok) continue;
    expect(action.playerId, `${action.type} accepted from a player who is not current`).toBe(frozen.game.currentPlayerId);
    if (action.type === 'END_TURN') expect(frozen.pending.kind, 'END_TURN accepted with a decision pending').toBe('none');
    expect(result.state.game.log, 'every accepted action appends exactly one log entry').toHaveLength(frozen.game.log.length + 1);
    expect(result.state.game.log.at(-1)?.action).toEqual(action);
    assertInvariants(result.state);
    recordCoverage(frozen, action, result.state);
    expectGrowthMonotonic(frozen, action, result.state);
    accepted.push(action);
    state = result.state;
  }
  return { initial, final: state, accepted, steps };
}

/** [roundNumber of each paydaySnapshot] for `playerId`, in log order. */
function snapshotRounds(state: GameState, playerId: string): number[] {
  return state.game.log.flatMap((entry) =>
    entry.events.flatMap((e) => (e.kind === 'paydaySnapshot' && e.playerId === playerId ? [e.roundNumber] : [])),
  );
}

describe('property: random games', () => {
  it('every invariant holds after every accepted action, in standard mode', () => {
    fc.assert(
      fc.property(setupArb(fc.constant('standard')), choicesArb, (setup, choices) => {
        const played = play(setup, choices);
        expect(played.steps).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS },
    );
  }, PROPERTY_TIMEOUT_MS);

  it('the random walks reach every action, every Life Choices effect, every Market effect, and a round-limit ending (spec v2: generators cover every new action and effect)', () => {
    fc.assert(
      fc.property(smallTableArb, longChoicesArb, (setup, choices) => {
        play(setup, choices);
      }),
      { numRuns: Math.max(100, Math.floor(NUM_RUNS / 2)) },
    );
    expect([...coverage.actionTypes].sort()).toEqual([...ACTION_TYPES].sort());
    expect([...coverage.lifeEffectKinds].sort()).toEqual(['addLoan', 'addSubscription', 'gainCash', 'investGrowth', 'payCash', 'repayLargestLoan']);
    expect([...coverage.marketEffectKinds].sort()).toEqual(['changeCashFlow', 'changeMarketValue', 'forceSale', 'offerBuyout', 'splitShares']);
    expect(coverage.endings).toContain('roundLimit');
  }, PROPERTY_TIMEOUT_MS);

  it('every invariant holds after every accepted action, in kids mode', () => {
    fc.assert(
      fc.property(setupArb(fc.constant('kids')), choicesArb, (setup, choices) => {
        play(setup, choices);
      }),
      { numRuns: Math.max(50, Math.floor(NUM_RUNS / 4)) },
    );
  }, PROPERTY_TIMEOUT_MS);

  it('replaying the log from the starting state rebuilds the final state exactly', () => {
    fc.assert(
      fc.property(setupArb(fc.constantFrom('standard', 'kids')), choicesArb, (setup, choices) => {
        const played = play(setup, choices);
        const logged = played.final.game.log.map((entry) => entry.action);
        expect(logged).toEqual(played.accepted);
        expect(replay(played.initial, logged)).toEqual(played.final);
      }),
      { numRuns: Math.max(50, Math.floor(NUM_RUNS / 4)) },
    );
  }, PROPERTY_TIMEOUT_MS);

  it('the same setup and choices always produce a byte-identical final state', () => {
    fc.assert(
      fc.property(setupArb(fc.constantFrom('standard', 'kids')), choicesArb, (setup, choices) => {
        expect(JSON.stringify(play(setup, choices).final)).toBe(JSON.stringify(play(setup, choices).final));
      }),
      { numRuns: Math.max(20, Math.floor(NUM_RUNS / 10)) },
    );
  }, PROPERTY_TIMEOUT_MS);

  it('every seat is paid exactly once a round, never past the limit, and each paydaySnapshot carries its own round (spec v2, Winning and game length)', () => {
    fc.assert(
      fc.property(fc.oneof(smallTableArb, setupArb(fc.constantFrom('standard', 'kids'))), longChoicesArb, (setup, choices) => {
        const final = play(setup, choices).final;
        for (const player of final.players) {
          const rounds = snapshotRounds(final, player.id);
          expect(rounds, `paydays of ${player.id}`).toEqual(rounds.map((_, i) => i + 1));
          expect(rounds.length).toBeLessThanOrEqual(roundLimit(final));
        }
      }),
      { numRuns: Math.max(50, Math.floor(NUM_RUNS / 4)) },
    );
  }, PROPERTY_TIMEOUT_MS);

  it('a standard game never gets stuck: some action is always accepted while the game is playing', () => {
    fc.assert(
      fc.property(setupArb(fc.constant('standard')), choicesArb, (setup, choices) => {
        const played = play(setup, choices);
        expect(isStuck(played.final), 'no candidate action is accepted').toBe(false);
      }),
      { numRuns: Math.max(50, Math.floor(NUM_RUNS / 4)) },
    );
  }, PROPERTY_TIMEOUT_MS);

  it('a kids game never gets stuck: every Life Choices card has a free option (spec v2, Kids mode)', () => {
    fc.assert(
      fc.property(setupArb(fc.constant('kids')), choicesArb, (setup, choices) => {
        const played = play(setup, choices);
        expect(isStuck(played.final), 'no candidate action is accepted').toBe(false);
      }),
      { numRuns: Math.max(50, Math.floor(NUM_RUNS / 4)) },
    );
  }, PROPERTY_TIMEOUT_MS);

  it('the game never runs past the round limit, and a game that ends at the limit has a winner who is still in (spec v2)', () => {
    fc.assert(
      fc.property(setupArb(fc.constantFrom('standard', 'kids')), choicesArb, (setup, choices) => {
        const played = play(setup, choices);
        const final = played.final;
        expect(roundNumber(final)).toBeLessThanOrEqual(roundLimit(final));
        const ended = final.game.log.at(-1)?.events.find((e) => e.kind === 'gameEnded');
        if (ended?.kind === 'gameEnded' && ended.reason === 'roundLimit') {
          expect(final.game.phase).toBe('finished');
          expect(roundNumber(final)).toBe(roundLimit(final));
          const w = winner(final);
          expect(w).toBeDefined();
          expect(w?.isOut).toBe(false);
          expect(final.game.currentPlayerId).toBe(w?.id);
        }
      }),
      { numRuns: Math.max(50, Math.floor(NUM_RUNS / 4)) },
    );
  }, PROPERTY_TIMEOUT_MS);

  it('an action from a player who is not current is always rejected with NOT_YOUR_TURN and changes nothing', () => {
    fc.assert(
      fc.property(setupArb(fc.constant('standard')), choicesArb, fc.nat({ max: 1_000_000 }), (setup, choices, n) => {
        const played = play(setup, choices);
        const state = deepFreeze(played.final);
        if (state.game.phase !== 'playing') return;
        const other = state.players.find((p) => p.id !== state.game.currentPlayerId);
        if (other === undefined) return;
        const { action } = step(state, n * 23 + 1);
        const result = reduce(state, { ...action, playerId: other.id });
        expect(result).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
      }),
      { numRuns: Math.max(50, Math.floor(NUM_RUNS / 4)) },
    );
  }, PROPERTY_TIMEOUT_MS);
});

describe('checkInvariants', () => {
  it('reports a sound starting state as sound', () => {
    expect(checkInvariants(setupGame({ seed: 1, mode: 'standard', professions: [0, 5] }))).toEqual([]);
  });

  it('catches negative cash on a player who is in', () => {
    const state = setupGame({ seed: 1, mode: 'standard', professions: [0, 5] });
    const broken: GameState = { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, cash: -1 } : p)) };
    expect(checkInvariants(broken).join('\n')).toMatch(/cash -1/);
  });

  it('catches a card that vanished from a deck', () => {
    const state = setupGame({ seed: 1, mode: 'standard', professions: [0, 5] });
    const broken: GameState = { ...state, decks: { ...state.decks, market: { drawPile: state.decks.market.drawPile.slice(1), discardPile: [] } } };
    expect(checkInvariants(broken).join('\n')).toMatch(/deck market/);
  });

  it('catches a card that appears twice', () => {
    const state = setupGame({ seed: 1, mode: 'standard', professions: [0, 5] });
    const [top] = state.decks.lifeChoices.drawPile;
    if (top === undefined) throw new Error('lifeChoices deck is empty');
    const broken: GameState = { ...state, decks: { ...state.decks, lifeChoices: { ...state.decks.lifeChoices, discardPile: [top] } } };
    expect(checkInvariants(broken).join('\n')).toMatch(/deck lifeChoices/);
  });

  it('catches a mortgage that finances no held asset', () => {
    const state = setupGame({ seed: 1, mode: 'standard', professions: [0, 5] });
    const broken: GameState = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0
          ? { ...p, liabilities: [...p.liabilities, { id: 'm', kind: 'mortgage', principal: 1, monthlyPayment: 0, assetId: 'ghost' }] }
          : p,
      ),
    };
    expect(checkInvariants(broken).join('\n')).toMatch(/finances no asset/);
  });

  it('catches a subscription with a principal (spec v2 invariant: every subscription has principal 0)', () => {
    const state = setupGame({ seed: 1, mode: 'standard', professions: [0, 5] });
    const broken: GameState = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, liabilities: [...p.liabilities, { id: 's', kind: 'subscription', principal: 5, monthlyPayment: 60, sourceCardId: 'life-004' }] } : p,
      ),
    };
    expect(checkInvariants(broken).join('\n')).toMatch(/subscription/);
  });

  it('catches a growth asset with a negative marketValue (spec v2 invariant)', () => {
    const state = setupGame({ seed: 1, mode: 'standard', professions: [0, 5] });
    const broken: GameState = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0
          ? { ...p, assets: [{ id: 'g', cardId: 'life-005', type: 'index', purchasePrice: 100, downPaid: 100, marketValue: -1, growthPercent: 4, payoutPercent: 1 }] }
          : p,
      ),
    };
    expect(checkInvariants(broken).join('\n')).toMatch(/marketValue/);
  });

  it('accepts a growth asset created from a Life Choices windfall: its card stays in the Life Choices deck', () => {
    const state = setupGame({ seed: 1, mode: 'standard', professions: [0, 5] });
    const invested: GameState = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0
          ? { ...p, assets: [{ id: 'g', cardId: 'life-005', type: 'index', purchasePrice: 2_000, downPaid: 2_000, marketValue: 2_000, growthPercent: 4, payoutPercent: 1 }] }
          : p,
      ),
    };
    expect(checkInvariants(invested)).toEqual([]);
  });

  it('catches a playing game that has completed as many rounds as the limit (spec v2 invariant)', () => {
    const state = setupGame({ seed: 1, mode: 'kids', professions: [0, 5] });
    const events = Array.from({ length: 10 }, (_, i) => ({
      turnNumber: i,
      action: { type: 'END_TURN' as const, playerId: 'p2' },
      events: [{ kind: 'roundCompleted' as const, round: i + 1 }],
    }));
    const broken: GameState = { ...state, game: { ...state.game, turnNumber: 10, log: events } };
    expect(checkInvariants(broken).join('\n')).toMatch(/round limit/);
  });

  it('catches a growth asset whose card is not a growth deal or an investing Life Choices option', () => {
    const state = setupGame({ seed: 1, mode: 'standard', professions: [0, 5] });
    const fromRental: GameState = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, assets: [{ id: 'g', cardId: 'small-001', type: 'index', purchasePrice: 100, downPaid: 100, marketValue: 100, growthPercent: 4, payoutPercent: 1 }] } : p,
      ),
    };
    expect(checkInvariants(fromRental).join('\n')).toMatch(/growth asset "g"/);
    const wrongType: GameState = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, assets: [{ id: 'g', cardId: 'small-004', type: 'savings', purchasePrice: 500, downPaid: 500, marketValue: 500, growthPercent: 1, payoutPercent: 0 }] } : p,
      ),
    };
    expect(checkInvariants(wrongType).join('\n')).toMatch(/growth asset "g"/);
  });

  it('catches a card liability whose source is not a Life Choices card', () => {
    const state = setupGame({ seed: 1, mode: 'standard', professions: [0, 5] });
    const broken: GameState = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, liabilities: [...p.liabilities, { id: 's', kind: 'subscription', principal: 0, monthlyPayment: 60, sourceCardId: 'market-001' }] } : p,
      ),
    };
    expect(checkInvariants(broken).join('\n')).toMatch(/sourceCardId/);
  });

  it('catches a current player who is out before rolling', () => {
    const state = setupGame({ seed: 1, mode: 'standard', professions: [0, 5] });
    const broken: GameState = { ...state, players: state.players.map((p, i) => (i === 0 ? { ...p, isOut: true } : p)) };
    expect(checkInvariants(broken).join('\n')).toMatch(/is out while the game is playing/);
  });

  it('allows a current player who went out during their own ROLL to remain current until END_TURN', () => {
    const state = setupGame({ seed: 1, mode: 'standard', professions: [0, 5] });
    const rolled = reduce(state, { type: 'ROLL', playerId: 'p1' });
    if (!rolled.ok) throw new Error('ROLL must be accepted at the start of a turn');
    const cleared: GameState = { ...rolled.state, pending: { kind: 'none' } };
    const out: GameState = { ...cleared, players: cleared.players.map((p, i) => (i === 0 ? { ...p, isOut: true, cash: 0, assets: [] } : p)) };
    expect(checkInvariants(out).filter((v) => v.includes('is out while'))).toEqual([]);
    const stillPending: GameState = { ...out, pending: { kind: 'giveOrSkip' } };
    expect(checkInvariants(stillPending).join('\n')).toMatch(/is out while the game is playing/);
  });
});
