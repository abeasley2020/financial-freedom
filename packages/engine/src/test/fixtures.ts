// Test-only builders. Production code never imports from src/test/.

import type { Game, GameState, Player } from '@ff/shared';

import { createGame } from '../createGame';
import { rollDie } from '../rng';

/** A standard two-player game: p1 Ada the Teacher (current), p2 Grace the Doctor. Seed 42. */
export function twoPlayerGame(overrides: Partial<Parameters<typeof createGame>[0]> = {}): GameState {
  return createGame({
    id: 'g1',
    mode: 'standard',
    seed: 42,
    players: [
      { id: 'p1', name: 'Ada', professionId: 'teacher' },
      { id: 'p2', name: 'Grace', professionId: 'doctor' },
    ],
    ...overrides,
  });
}

export function withGame(state: GameState, patch: Partial<Game>): GameState {
  return { ...state, game: { ...state.game, ...patch } };
}

export function withPlayer(state: GameState, playerId: string, patch: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
  };
}

/**
 * Finds an rngState whose next die roll is `wanted`, searching upward from
 * `from`. Lets a test pin the roll without touching the PRNG's internals.
 */
export function rngStateForRoll(wanted: number, from = 0): number {
  for (let state = from; state < from + 10_000; state++) {
    if (rollDie(state).value === wanted) return state;
  }
  throw new Error(`no rngState near ${String(from)} rolls a ${String(wanted)}`);
}

/** Sets the current player's position and the next die roll. */
export function aboutToRoll(state: GameState, position: number, roll: number): GameState {
  return withGame(withPlayer(state, state.game.currentPlayerId, { position }), {
    rngState: rngStateForRoll(roll),
  });
}
