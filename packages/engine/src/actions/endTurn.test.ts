import type { Action, GameState, Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { createGame } from '../createGame';
import { apply, reject } from '../test/apply';
import { aboutToRoll, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

const END_TURN: Action = { type: 'END_TURN', playerId: 'p1' };
const ROLL: Action = { type: 'ROLL', playerId: 'p1' };

/** p1 has rolled from 11 to 12 (Payday, pending none). Cash is 400 + 700. */
function afterRoll(state: GameState = twoPlayerGame()): GameState {
  return apply(aboutToRoll(state, 11, 1), ROLL);
}

describe('END_TURN: advancing', () => {
  it('END_TURN: advances to the next player and increments turnNumber', () => {
    const before = afterRoll();
    const next = apply(before, END_TURN);
    expect(next.game.currentPlayerId).toBe('p2');
    expect(next.game.turnNumber).toBe(1);
    expect(next.pending).toEqual({ kind: 'none' });
  });

  it('END_TURN: leaves cash, position, and holdings unchanged', () => {
    const before = afterRoll();
    const next = apply(before, END_TURN);
    expect(next.players).toEqual(before.players);
    expect(next.decks).toEqual(before.decks);
  });

  it('END_TURN: wraps from the last player to the first', () => {
    const base = withGame(twoPlayerGame(), { currentPlayerId: 'p2' });
    const rolled = apply(aboutToRoll(base, 11, 1), { type: 'ROLL', playerId: 'p2' });
    const next = apply(rolled, { type: 'END_TURN', playerId: 'p2' });
    expect(next.game.currentPlayerId).toBe('p1');
    expect(next.game.turnNumber).toBe(1);
  });

  it('END_TURN: skips players who are out', () => {
    const three = createGame({
      id: 'g3',
      mode: 'standard',
      seed: 1,
      players: [
        { id: 'p1', name: 'A', professionId: 'teacher' },
        { id: 'p2', name: 'B', professionId: 'nurse' },
        { id: 'p3', name: 'C', professionId: 'doctor' },
      ],
    });
    const before = afterRoll(withPlayer(three, 'p2', { isOut: true }));
    const next = apply(before, END_TURN);
    expect(next.game.currentPlayerId).toBe('p3');
  });
});

describe('END_TURN: win condition', () => {
  const escaping = (monthlyCashFlow: number) =>
    withPlayer(twoPlayerGame(), 'p1', {
      assets: [{ cardId: 'big-001', type: 'business', purchasePrice: 1, downPaid: 1, monthlyCashFlow }],
    });

  it('END_TURN: marks hasEscaped and finishes the game when passiveIncome equals totalExpenses', () => {
    // Teacher totalExpenses = 2,300 + 300 = 2,600
    const next = apply(afterRoll(escaping(2_600)), END_TURN);
    expect(next.players[0]?.hasEscaped).toBe(true);
    expect(next.game.phase).toBe('finished');
    expect(next.game.currentPlayerId).toBe('p1');
  });

  it('END_TURN: does not escape one dollar short and the game continues', () => {
    const next = apply(afterRoll(escaping(2_599)), END_TURN);
    expect(next.players[0]?.hasEscaped).toBe(false);
    expect(next.game.phase).toBe('playing');
    expect(next.game.currentPlayerId).toBe('p2');
  });
});

describe('END_TURN: log', () => {
  it('END_TURN: appends a log entry carrying the turn number that just ended', () => {
    const next = apply(afterRoll(), END_TURN);
    expect(next.game.log).toHaveLength(2);
    expect(next.game.log[1]).toEqual({ turnNumber: 0, action: END_TURN, events: [] });
  });
});

describe('END_TURN: rejections', () => {
  it('END_TURN: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(afterRoll(), { type: 'END_TURN', playerId: 'p2' })).toBe('NOT_YOUR_TURN');
  });

  const pendings: Pending[] = [
    { kind: 'chooseDealSize' },
    { kind: 'buyOrPass', cardId: 'small-001' },
    { kind: 'marketChoice', cardId: 'market-001' },
    { kind: 'payLifestyle', cardId: 'life-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('END_TURN: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...afterRoll(), pending }, END_TURN)).toBe('INVALID_FOR_PENDING');
  });

  it('END_TURN: rejected with MUST_ROLL_FIRST before the player has rolled', () => {
    expect(reject(twoPlayerGame(), END_TURN)).toBe('MUST_ROLL_FIRST');
  });

  it.each(['lobby', 'finished'] as const)('END_TURN: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(afterRoll(), { phase }), END_TURN)).toBe('GAME_NOT_PLAYING');
  });
});
