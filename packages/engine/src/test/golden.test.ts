// Golden games (spec, Testing strategy; CLAUDE.md, Layout). Each JSON file
// is a recorded full game: setup (seed, mode, players), the accepted action
// log, and the final state the engine produced on 2026-10-23. Replaying the
// log must rebuild that state exactly. Never regenerate these files to make
// a test pass: a difference means a rule changed, and the commit that
// changes the rule must say so and get Andre's approval first.
//
// STAGE B (v2 engine rules, 2026-10-23): the three recordings are v1 games.
// v2 changes the rules on purpose (Payday every turn, no Payday spaces, the
// v2 board, Life Choices, growth assets, the round limit), so they cannot
// replay until the end of Stage B, when they are regenerated once with
// Andre's approval and the commit names every rule change. Until then this
// suite is skipped, not deleted, so the v1 recordings stay in history.

import { ActionSchema, GameStateSchema, type Action, type GameState } from '@ff/shared';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createGame, type CreateGameOptions } from '../createGame';
import { assertInvariants } from '../invariants';
import { replay } from '../replay';
import attrition from './golden/attrition-four-players.json';
import escape from './golden/escape-two-players.json';
import kids from './golden/kids-three-players.json';

const GoldenSchema = z
  .object({
    description: z.string().min(1),
    strategies: z.array(z.string()),
    setup: z.object({
      id: z.string().min(1),
      mode: z.enum(['standard', 'kids']),
      seed: z.number().int(),
      players: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), professionId: z.string().min(1) })),
    }),
    ending: z.enum(['escape', 'lastStanding', 'finished', 'stopped']),
    actions: z.array(ActionSchema),
    expected: GameStateSchema,
  })
  .strict();

interface Golden {
  readonly description: string;
  readonly setup: CreateGameOptions;
  readonly ending: 'escape' | 'lastStanding' | 'finished' | 'stopped';
  readonly actions: readonly Action[];
  readonly expected: GameState;
}

const games: readonly [string, Golden][] = [
  ['escape-two-players', GoldenSchema.parse(escape)],
  ['attrition-four-players', GoldenSchema.parse(attrition)],
  ['kids-three-players', GoldenSchema.parse(kids)],
];

const GOLDEN_RECORDINGS_ARE_V1 = true;

describe.skipIf(GOLDEN_RECORDINGS_ARE_V1).each(games)('golden game %s', (_name, golden) => {
  it('replays its action log from the seed to exactly the recorded final state', () => {
    const final = replay(createGame(golden.setup), golden.actions);
    expect(final).toEqual(golden.expected);
  });

  it('records every accepted action in the final log, in order', () => {
    expect(golden.expected.game.log.map((entry) => entry.action)).toEqual(golden.actions);
  });

  it('ends in a state that satisfies every invariant', () => {
    expect(() => {
      assertInvariants(golden.expected);
    }).not.toThrow();
  });

  it('ends the way its description says', () => {
    const { expected } = golden;
    const escaped = expected.players.some((p) => p.hasEscaped);
    const inPlayers = expected.players.filter((p) => !p.isOut);
    switch (golden.ending) {
      case 'escape':
        expect(escaped).toBe(true);
        expect(expected.game.phase).toBe('finished');
        break;
      case 'lastStanding':
        expect(escaped).toBe(false);
        expect(expected.game.phase).toBe('finished');
        expect(inPlayers).toHaveLength(1);
        break;
      case 'finished':
        expect(expected.game.phase).toBe('finished');
        break;
      case 'stopped':
        expect(expected.game.phase).toBe('playing');
        break;
    }
  });
});

describe.skipIf(GOLDEN_RECORDINGS_ARE_V1)('golden games as a set', () => {
  it('cover both modes and both ways a Phase 1 game can end', () => {
    expect(games.map(([, g]) => g.setup.mode)).toContain('kids');
    expect(games.map(([, g]) => g.setup.mode)).toContain('standard');
    expect(games.map(([, g]) => g.ending)).toContain('escape');
    expect(games.map(([, g]) => g.ending)).toContain('lastStanding');
  });

  it('each run long enough to pass several Paydays', () => {
    for (const [, golden] of games) expect(golden.expected.game.turnNumber).toBeGreaterThan(10);
  });
});
