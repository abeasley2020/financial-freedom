import { BOARD, type Action, type GameState, type Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { playerById } from '../selectors';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { aboutToRoll, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

// Ada the Teacher (p1) starts with 400 cash and 0 Favor tokens. Giving is space 6.

const GIVE: Action = { type: 'GIVE', playerId: 'p1' };
const p1 = (state: GameState) => playerById(state, 'p1');

/** p1 with `cash` has rolled from 0 onto Giving (6): pending giveOrSkip, no Payday crossed. */
function onGiving(cash: number, state = twoPlayerGame()): GameState {
  return apply(aboutToRoll(withPlayer(state, 'p1', { cash }), 0, 6), { type: 'ROLL', playerId: 'p1' });
}

describe('GIVE: giving 10 percent of cash', () => {
  it('GIVE: pays 10 percent of cash on hand and adds one Favor token', () => {
    const before = onGiving(400);
    expect(BOARD[6]).toBe('giving');
    expect(before.pending).toEqual({ kind: 'giveOrSkip' });
    const next = apply(before, GIVE);
    expect(p1(next).cash).toBe(360);
    expect(p1(next).favorTokens).toBe(1);
    expect(next.pending).toEqual({ kind: 'none' });
  });

  it('GIVE: floors the gift to whole dollars', () => {
    const next = apply(onGiving(1_999), GIVE);
    expect(p1(next).cash).toBe(1_800);
  });

  it('GIVE: accepts at exactly $10 cash, giving $1', () => {
    const next = apply(onGiving(10), GIVE);
    expect(p1(next).cash).toBe(9);
    expect(p1(next).favorTokens).toBe(1);
  });

  it('GIVE: rejected with INSUFFICIENT_CASH when 10 percent would be $0, so a token is never free', () => {
    const before = onGiving(9);
    expect(reject(before, GIVE)).toBe('INSUFFICIENT_CASH');
    expect(before.pending).toEqual({ kind: 'giveOrSkip' });
    expect(reject(onGiving(0), GIVE)).toBe('INSUFFICIENT_CASH');
  });

  it('GIVE: each gift adds one more token', () => {
    const first = apply(onGiving(1_000), GIVE);
    const nextTurn = withGame(apply(first, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const second = apply(aboutToRoll(nextTurn, 0, 6), { type: 'ROLL', playerId: 'p1' });
    const next = apply(second, GIVE);
    expect(p1(next).favorTokens).toBe(2);
    expect(p1(next).cash).toBe(810);
  });

  it('GIVE: works in kids mode', () => {
    const next = apply(onGiving(500, twoPlayerGame({ mode: 'kids' })), GIVE);
    expect(p1(next).cash).toBe(450);
    expect(p1(next).favorTokens).toBe(1);
  });

  it('GIVE: leaves assets, liabilities, decks, position, and the other player unchanged', () => {
    const before = onGiving(400);
    const next = apply(before, GIVE);
    expect(p1(next).assets).toEqual(p1(before).assets);
    expect(p1(next).liabilities).toEqual(p1(before).liabilities);
    expect(p1(next).position).toBe(6);
    expect(next.decks).toEqual(before.decks);
    expect(next.players[1]).toEqual(before.players[1]);
  });
});

describe('GIVE: log and determinism', () => {
  it('GIVE: appends a log entry with cashChanged and gave events', () => {
    const next = apply(onGiving(400), GIVE);
    expect(next.game.log.at(-1)).toEqual({
      turnNumber: 0,
      action: GIVE,
      events: [
        { kind: 'cashChanged', delta: -40, reason: 'give' },
        { kind: 'gave', amount: 40, favorTokens: 1 },
      ],
    });
  });

  it('GIVE: is deterministic', () => {
    const before = deepFreeze(onGiving(400));
    expect(JSON.stringify(reduce(before, GIVE))).toBe(JSON.stringify(reduce(before, GIVE)));
  });

  it('GIVE: does not touch rngState', () => {
    const before = onGiving(400);
    expect(apply(before, GIVE).game.rngState).toBe(before.game.rngState);
  });

  it('GIVE: the turn can end afterwards', () => {
    expect(reduce(deepFreeze(apply(onGiving(400), GIVE)), { type: 'END_TURN', playerId: 'p1' }).ok).toBe(true);
  });
});

describe('GIVE: rejections', () => {
  it('GIVE: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(onGiving(400), { type: 'GIVE', playerId: 'p2' })).toBe('NOT_YOUR_TURN');
  });

  const pendings: Pending[] = [
    { kind: 'none' },
    { kind: 'chooseDealSize' },
    { kind: 'buyOrPass', cardId: 'small-001' },
    { kind: 'marketChoice', cardId: 'market-001' },
    { kind: 'payLifestyle', cardId: 'life-001' },
  ];
  it.each(pendings)('GIVE: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...twoPlayerGame(), pending }, GIVE)).toBe('INVALID_FOR_PENDING');
  });

  it.each(['lobby', 'finished'] as const)('GIVE: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(onGiving(400), { phase }), GIVE)).toBe('GAME_NOT_PLAYING');
  });

  it('GIVE: a rejected gift is not logged', () => {
    const before = deepFreeze(onGiving(5));
    const logBefore = before.game.log.length;
    expect(reduce(before, GIVE).ok).toBe(false);
    expect(before.game.log).toHaveLength(logBefore);
  });
});
