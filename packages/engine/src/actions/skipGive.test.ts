import type { Action, GameState, Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { playerById } from '../selectors';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { aboutToRoll, twoPlayerGame, withGame, withPlayer, withZeroCashFlow } from '../test/fixtures';

// Ada the Teacher (p1) starts with 400 cash and 0 Favor tokens. Giving is
// space 4. Her salary is pinned to her totalExpenses so the turn's Payday adds $0.

const SKIP: Action = { type: 'SKIP_GIVE', playerId: 'p1' };
const p1 = (state: GameState) => playerById(state, 'p1');

function onGiving(cash: number, state = twoPlayerGame()): GameState {
  return apply(aboutToRoll(withZeroCashFlow(withPlayer(state, 'p1', { cash }), 'p1'), 0, 4), { type: 'ROLL', playerId: 'p1' });
}

describe('SKIP_GIVE: declining to give', () => {
  it('SKIP_GIVE: clears the decision and changes no cash or tokens', () => {
    const before = onGiving(400);
    const next = apply(before, SKIP);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(p1(next).cash).toBe(400);
    expect(p1(next).favorTokens).toBe(0);
    expect(next.players).toEqual(before.players);
    expect(next.decks).toEqual(before.decks);
  });

  it('SKIP_GIVE: is the way out when the player cannot afford to give', () => {
    const before = onGiving(0);
    expect(reject(before, { type: 'GIVE', playerId: 'p1' })).toBe('INSUFFICIENT_CASH');
    expect(apply(before, SKIP).pending).toEqual({ kind: 'none' });
  });

  it('SKIP_GIVE: works in kids mode', () => {
    expect(apply(onGiving(400, twoPlayerGame({ mode: 'kids' })), SKIP).pending).toEqual({ kind: 'none' });
  });
});

describe('SKIP_GIVE: log and determinism', () => {
  it('SKIP_GIVE: appends a log entry with a skippedGive event', () => {
    const next = apply(onGiving(400), SKIP);
    expect(next.game.log.at(-1)).toEqual({ turnNumber: 0, action: SKIP, events: [{ kind: 'skippedGive', principles: ['P10'] }] });
  });

  it('SKIP_GIVE: is deterministic', () => {
    const before = deepFreeze(onGiving(400));
    expect(JSON.stringify(reduce(before, SKIP))).toBe(JSON.stringify(reduce(before, SKIP)));
  });

  it('SKIP_GIVE: does not touch rngState', () => {
    const before = onGiving(400);
    expect(apply(before, SKIP).game.rngState).toBe(before.game.rngState);
  });

  it('SKIP_GIVE: the turn can end afterwards', () => {
    expect(reduce(deepFreeze(apply(onGiving(400), SKIP)), { type: 'END_TURN', playerId: 'p1' }).ok).toBe(true);
  });
});

describe('SKIP_GIVE: rejections', () => {
  it('SKIP_GIVE: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(onGiving(400), { type: 'SKIP_GIVE', playerId: 'p2' })).toBe('NOT_YOUR_TURN');
  });

  const pendings: Pending[] = [
    { kind: 'none' },
    { kind: 'chooseDealSize' },
    { kind: 'buyOrPass', cardId: 'small-001' },
    { kind: 'marketChoice', cardId: 'market-001' },
    { kind: 'lifeChoice', cardId: 'life-001' },
  ];
  it.each(pendings)('SKIP_GIVE: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...twoPlayerGame(), pending }, SKIP)).toBe('INVALID_FOR_PENDING');
  });

  it.each(['lobby', 'finished'] as const)('SKIP_GIVE: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(onGiving(400), { phase }), SKIP)).toBe('GAME_NOT_PLAYING');
  });

  it('SKIP_GIVE: a rejected skip is not logged', () => {
    const before = deepFreeze(twoPlayerGame());
    const logBefore = before.game.log.length;
    expect(reduce(before, SKIP).ok).toBe(false);
    expect(before.game.log).toHaveLength(logBefore);
  });
});
