import { BOARD, type Action, type GameState } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { debtPayments, monthlyCashFlow, playerById } from '../selectors';
import { apply } from '../test/apply';
import { aboutToRoll, onTopOfDeck, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

// Setback is space 11. Setback fixtures: setback-001 Furnace Dies (3,500, no
// skip), setback-002 Car Repair (900, no skip), setback-003 Job Loss (2,000,
// skip). Ada the Teacher (p1) starts with 400 cash and 700/mo cash flow.
// Spec, Core rules, Setback (decided 2026-10-23).

const ROLL: Action = { type: 'ROLL', playerId: 'p1' };
const p1 = (state: GameState) => playerById(state, 'p1');

/** p1 with `cash` rolls from 10 onto Setback (11) with `cardId` on top of the setback deck. */
function hitSetback(cash: number, cardId: string, state = twoPlayerGame()): GameState {
  return apply(aboutToRoll(onTopOfDeck(withPlayer(state, 'p1', { cash }), 'setback', cardId), 10, 1), ROLL);
}

describe('ROLL: landing on Setback', () => {
  it('ROLL: Setback draws the top card and pays its cost at once, with nothing pending', () => {
    const before = twoPlayerGame();
    const next = hitSetback(5_000, 'setback-002', before);
    expect(BOARD[11]).toBe('setback');
    expect(p1(next).cash).toBe(5_000 - 900);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(p1(next).liabilities).toEqual(p1(before).liabilities);
    expect(p1(next).skipsNextTurn).toBe(false);
  });

  it('ROLL: Setback sends the card to the setback discard pile', () => {
    const before = onTopOfDeck(twoPlayerGame(), 'setback', 'setback-002');
    const next = apply(aboutToRoll(withPlayer(before, 'p1', { cash: 5_000 }), 10, 1), ROLL);
    expect(next.decks.setback.drawPile).toEqual(before.decks.setback.drawPile.slice(1));
    expect(next.decks.setback.discardPile).toEqual(['setback-002']);
  });

  it('ROLL: Setback accepts cash exactly equal to the cost, leaving zero and no loan', () => {
    const next = hitSetback(3_500, 'setback-001');
    expect(p1(next).cash).toBe(0);
    expect(p1(next).liabilities.some((l) => l.kind === 'bank')).toBe(false);
    expect(p1(next).skipsNextTurn).toBe(false);
  });

  it('ROLL: Setback auto-borrows the smallest $1,000 multiple that covers the shortfall and skips the next turn', () => {
    // 400 cash against 3,500: shortfall 3,100 → borrow 4,000.
    const before = twoPlayerGame();
    const next = hitSetback(400, 'setback-001', before);
    expect(p1(next).cash).toBe(400 + 4_000 - 3_500);
    expect(p1(next).liabilities).toEqual([
      ...p1(before).liabilities,
      { id: expect.any(String) as string, kind: 'bank', principal: 4_000, monthlyPayment: 400 },
    ]);
    expect(p1(next).skipsNextTurn).toBe(true);
    expect(debtPayments(p1(next))).toBe(300 + 400);
    expect(monthlyCashFlow(p1(next))).toBe(700 - 400);
  });

  it('ROLL: Setback borrows exactly the shortfall when it is a whole number of steps', () => {
    const next = hitSetback(500, 'setback-001');
    expect(p1(next).cash).toBe(0);
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'bank', principal: 3_000, monthlyPayment: 300 });
  });

  it('ROLL: Setback one dollar short borrows one step', () => {
    const next = hitSetback(3_499, 'setback-001');
    expect(p1(next).cash).toBe(999);
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'bank', principal: 1_000 });
    expect(p1(next).skipsNextTurn).toBe(true);
  });

  it('ROLL: Setback with zero cash borrows the full cost', () => {
    const next = hitSetback(0, 'setback-002');
    expect(p1(next).cash).toBe(100);
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'bank', principal: 1_000 });
  });

  it('ROLL: a skipTurn card skips the next turn even when cash covers it', () => {
    const next = hitSetback(5_000, 'setback-003');
    expect(p1(next).cash).toBe(3_000);
    expect(p1(next).skipsNextTurn).toBe(true);
    expect(p1(next).liabilities.some((l) => l.kind === 'bank')).toBe(false);
  });

  it('ROLL: a skipTurn card that also forces a loan does both', () => {
    const next = hitSetback(100, 'setback-003');
    expect(p1(next).cash).toBe(100 + 2_000 - 2_000);
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'bank', principal: 2_000 });
    expect(p1(next).skipsNextTurn).toBe(true);
  });

  it('ROLL: the auto-borrowed loan shows up in the next Payday', () => {
    const hit = hitSetback(400, 'setback-001');
    const nextTurn = withGame(apply(hit, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const unskipped = withPlayer(nextTurn, 'p1', { skipsNextTurn: false });
    const paid = apply(aboutToRoll(unskipped, 11, 1), ROLL);
    expect(p1(paid).cash).toBe(900 + 300);
  });

  it('ROLL: Setback in kids mode does nothing (the spec gives kids mode no Setback spaces)', () => {
    const before = twoPlayerGame({ mode: 'kids' });
    const next = apply(aboutToRoll(withPlayer(before, 'p1', { cash: 400 }), 10, 1), ROLL);
    expect(p1(next).cash).toBe(400);
    expect(next.decks.setback).toEqual(before.decks.setback);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(p1(next).skipsNextTurn).toBe(false);
  });

  it('ROLL: Setback with no cards in either pile does nothing', () => {
    const empty: GameState = {
      ...twoPlayerGame(),
      decks: { ...twoPlayerGame().decks, setback: { drawPile: [], discardPile: [] } },
    };
    const next = apply(aboutToRoll(withPlayer(empty, 'p1', { cash: 400 }), 10, 1), ROLL);
    expect(p1(next).cash).toBe(400);
    expect(next.pending).toEqual({ kind: 'none' });
  });

  it('ROLL: Setback reshuffles the discard pile when the draw pile is empty', () => {
    const drained: GameState = {
      ...twoPlayerGame(),
      decks: { ...twoPlayerGame().decks, setback: { drawPile: [], discardPile: ['setback-002'] } },
    };
    const next = apply(aboutToRoll(withPlayer(drained, 'p1', { cash: 5_000 }), 10, 1), ROLL);
    expect(p1(next).cash).toBe(4_100);
    expect(next.decks.setback).toEqual({ drawPile: [], discardPile: ['setback-002'] });
  });

  it('ROLL: Setback does not touch the other player', () => {
    const before = twoPlayerGame();
    const next = hitSetback(400, 'setback-001', before);
    expect(next.players[1]).toEqual(before.players[1]);
  });
});

describe('ROLL: Setback log', () => {
  it('ROLL: a covered Setback logs drewCard, cashChanged, and setback events', () => {
    const next = hitSetback(5_000, 'setback-002');
    expect(next.game.log.at(-1)?.events).toEqual([
      { kind: 'rolled', value: 1 },
      { kind: 'moved', from: 10, to: 11 },
      { kind: 'drewCard', deck: 'setback', cardId: 'setback-002' },
      { kind: 'cashChanged', delta: -900, reason: 'setback' },
      { kind: 'setback', cardId: 'setback-002', cost: 900, autoBorrowed: 0, skipsNextTurn: false },
    ]);
  });

  it('ROLL: a Setback that forces a loan logs the loan before the payment', () => {
    const next = hitSetback(400, 'setback-001');
    const loanId = p1(next).liabilities.at(-1)?.id;
    expect(next.game.log.at(-1)?.events.slice(2)).toEqual([
      { kind: 'drewCard', deck: 'setback', cardId: 'setback-001' },
      { kind: 'cashChanged', delta: 4_000, reason: 'borrow' },
      { kind: 'borrowed', liabilityId: loanId, amount: 4_000, monthlyPayment: 400 },
      { kind: 'cashChanged', delta: -3_500, reason: 'setback' },
      { kind: 'setback', cardId: 'setback-001', cost: 3_500, autoBorrowed: 4_000, skipsNextTurn: true },
    ]);
  });
});

describe('END_TURN: skipped turns', () => {
  const roll = (state: GameState, playerId: string, from: number, die: number) =>
    apply(withGame(aboutToRoll(withGame(state, { currentPlayerId: playerId }), from, die), { currentPlayerId: playerId }), {
      type: 'ROLL',
      playerId,
    });

  it('END_TURN: passes over a player who must skip, clears the flag, and logs the skip', () => {
    // p1 hits Job Loss, then p2 plays; p2's END_TURN skips p1 and comes back to p2.
    const hit = hitSetback(5_000, 'setback-003');
    const p2Turn = apply(hit, { type: 'END_TURN', playerId: 'p1' });
    expect(p2Turn.game.currentPlayerId).toBe('p2');
    const p2Rolled = apply(aboutToRoll(p2Turn, 1, 1), { type: 'ROLL', playerId: 'p2' });
    expect(p2Rolled.pending.kind).toBe('marketChoice');
    const p2Done = apply(p2Rolled, { type: 'DECLINE_MARKET', playerId: 'p2' });
    const next = apply(p2Done, { type: 'END_TURN', playerId: 'p2' });
    expect(next.game.currentPlayerId).toBe('p2');
    expect(next.game.turnNumber).toBe(2);
    expect(p1(next).skipsNextTurn).toBe(false);
    expect(next.game.log.at(-1)?.events).toEqual([{ kind: 'turnSkipped', playerId: 'p1' }]);
  });

  it('END_TURN: the skip lasts one turn only', () => {
    const hit = hitSetback(5_000, 'setback-003');
    const p2Turn = apply(hit, { type: 'END_TURN', playerId: 'p1' });
    const p2Done = apply(roll(p2Turn, 'p2', 11, 1), { type: 'END_TURN', playerId: 'p2' });
    expect(p2Done.game.currentPlayerId).toBe('p2');
    const again = apply(roll(p2Done, 'p2', 11, 1), { type: 'END_TURN', playerId: 'p2' });
    expect(again.game.currentPlayerId).toBe('p1');
  });

  it('END_TURN: with three players the skipped seat is passed over in order', () => {
    const three = twoPlayerGame({
      players: [
        { id: 'p1', name: 'A', professionId: 'teacher' },
        { id: 'p2', name: 'B', professionId: 'nurse' },
        { id: 'p3', name: 'C', professionId: 'doctor' },
      ],
    });
    const flagged = withPlayer(three, 'p1', { skipsNextTurn: true });
    const p2Turn = withGame(flagged, { currentPlayerId: 'p2' });
    const p3Turn = apply(roll(p2Turn, 'p2', 11, 1), { type: 'END_TURN', playerId: 'p2' });
    expect(p3Turn.game.currentPlayerId).toBe('p3');
    const next = apply(roll(p3Turn, 'p3', 11, 1), { type: 'END_TURN', playerId: 'p3' });
    expect(next.game.currentPlayerId).toBe('p2');
    expect(p1(next).skipsNextTurn).toBe(false);
  });

  it('END_TURN: a player who is out is passed over without touching any skip flag', () => {
    const three = twoPlayerGame({
      players: [
        { id: 'p1', name: 'A', professionId: 'teacher' },
        { id: 'p2', name: 'B', professionId: 'nurse' },
        { id: 'p3', name: 'C', professionId: 'doctor' },
      ],
    });
    const base = withPlayer(withPlayer(three, 'p2', { isOut: true, skipsNextTurn: true }), 'p3', { skipsNextTurn: true });
    const next = apply(roll(base, 'p1', 11, 1), { type: 'END_TURN', playerId: 'p1' });
    expect(next.game.currentPlayerId).toBe('p1');
    expect(playerById(next, 'p2').skipsNextTurn).toBe(true);
    expect(playerById(next, 'p3').skipsNextTurn).toBe(false);
    expect(next.game.log.at(-1)?.events).toEqual([{ kind: 'turnSkipped', playerId: 'p3' }]);
  });

  it('END_TURN: when every player must skip, each skip is consumed once in seat order and play resumes', () => {
    // p1 ends; p2 is skipped, then p1 (wrapping) is skipped, then p2 is next.
    const both = withPlayer(withPlayer(twoPlayerGame(), 'p1', { skipsNextTurn: true }), 'p2', { skipsNextTurn: true });
    const next = apply(roll(both, 'p1', 11, 1), { type: 'END_TURN', playerId: 'p1' });
    expect(next.game.currentPlayerId).toBe('p2');
    expect(p1(next).skipsNextTurn).toBe(false);
    expect(playerById(next, 'p2').skipsNextTurn).toBe(false);
    expect(next.game.log.at(-1)?.events).toEqual([
      { kind: 'turnSkipped', playerId: 'p2' },
      { kind: 'turnSkipped', playerId: 'p1' },
    ]);
  });
});
