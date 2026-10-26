// Golden games (spec, Testing strategy; CLAUDE.md, Layout). Each JSON file
// is a recorded full game: setup (seed, mode, players), the accepted action
// log, and the final state the engine produced. Replaying the log must
// rebuild that state exactly. Never regenerate these files to make a test
// pass: a difference means a rule changed, and the commit that changes the
// rule must say so and get Andre's approval first.
//
// Re-recorded 2026-10-26 at the end of Stage C (16 professions, full decks at
// spec counts) by playing the sim bots through the engine, with Andre's
// approval; the recorder was deliberately not committed. Three end at the
// round limit and one with a single player left after a bankruptcy. No bot
// game escapes within 15 rounds on the Stage C content (6,000 seeds searched),
// so an escape recording waits for Stage D balance.

import { ActionSchema, GameStateSchema, type Action, type GameState } from '@ff/shared';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { createGame, type CreateGameOptions } from '../createGame';
import { assertInvariants } from '../invariants';
import { replay } from '../replay';
import { roundLimit, roundNumber } from '../selectors';
import kids from './golden/kids-three-players.json';
import lastStanding from './golden/last-standing-two-players.json';
import fourPlayers from './golden/limit-four-players.json';
import twoPlayers from './golden/limit-two-players.json';

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
    ending: z.enum(['escape', 'roundLimit', 'lastStanding']),
    actions: z.array(ActionSchema),
    expected: GameStateSchema,
  })
  .strict();

interface Golden {
  readonly description: string;
  readonly setup: CreateGameOptions;
  readonly ending: 'escape' | 'roundLimit' | 'lastStanding';
  readonly actions: readonly Action[];
  readonly expected: GameState;
}

const recordings: readonly [string, unknown][] = [
  ['limit-two-players', twoPlayers],
  ['limit-four-players', fourPlayers],
  ['kids-three-players', kids],
  ['last-standing-two-players', lastStanding],
];
const load = (data: unknown): Golden => GoldenSchema.parse(data);

describe.each(recordings)('golden game %s', (_name, data) => {
  it('replays its action log from the seed to exactly the recorded final state', () => {
    const golden = load(data);
    const final = replay(createGame(golden.setup), golden.actions);
    expect(final).toEqual(golden.expected);
  });

  it('records every accepted action in the final log, in order', () => {
    const golden = load(data);
    expect(golden.expected.game.log.map((entry) => entry.action)).toEqual(golden.actions);
  });

  it('ends in a state that satisfies every invariant', () => {
    const golden = load(data);
    expect(() => {
      assertInvariants(golden.expected);
    }).not.toThrow();
  });

  it('ends the way its description says', () => {
    const golden = load(data);
    const { expected } = golden;
    const escaped = expected.players.some((p) => p.hasEscaped);
    const inPlayers = expected.players.filter((p) => !p.isOut);
    expect(expected.game.phase).toBe('finished');
    expect(expected.game.log.at(-1)?.events.at(-1)).toMatchObject({ kind: 'gameEnded', reason: golden.ending, winnerId: expected.game.currentPlayerId });
    switch (golden.ending) {
      case 'escape':
        expect(escaped).toBe(true);
        break;
      case 'roundLimit':
        expect(escaped).toBe(false);
        expect(inPlayers.length).toBeGreaterThan(1);
        expect(roundNumber(expected)).toBe(roundLimit(expected));
        break;
      case 'lastStanding':
        expect(escaped).toBe(false);
        expect(inPlayers).toHaveLength(1);
        break;
    }
  });

  it('is a v2 game: a Payday on every turn and a round number on every snapshot', () => {
    const golden = load(data);
    const rolls = golden.actions.filter((a) => a.type === 'ROLL').length;
    const rounds = golden.expected.game.log.flatMap((e) => e.events).flatMap((e) => (e.kind === 'paydaySnapshot' ? [e.roundNumber] : []));
    expect(rounds.length).toBeGreaterThanOrEqual(rolls);
    for (const round of rounds) expect(round).toBeGreaterThanOrEqual(1);
  });
});

describe('golden games as a set', () => {
  it('cover both modes and the round-limit and last-standing endings, with two to four players', () => {
    const games = recordings.map(([, data]) => load(data));
    expect(games.map((g) => g.setup.mode)).toContain('kids');
    expect(games.map((g) => g.setup.mode)).toContain('standard');
    expect(games.map((g) => g.ending)).toContain('roundLimit');
    expect(games.map((g) => g.ending)).toContain('lastStanding');
    expect(games.map((g) => g.setup.players.length).sort()).toEqual([2, 2, 3, 4]);
  });

  it('each run long enough to pass several Paydays', () => {
    for (const [, data] of recordings) expect(load(data).expected.game.turnNumber).toBeGreaterThan(10);
  });
});
