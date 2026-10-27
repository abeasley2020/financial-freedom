import { BOARD, type Action, type GameState } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { debtPayments, monthlyCashFlow, playerById, roundNumber } from '../selectors';
import { apply } from '../test/apply';
import { aboutToRoll, onTopOfDeck, rolledClean, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

// Setback is space 6 (and 12) on the v2 board. Setback fixtures: setback-001
// Furnace Dies (3,500, no skip), setback-002 Car Repair (900, no skip),
// setback-003 Job Loss (2,000, skip). Ada the Teacher (p1) starts with 2,500
// cash and 740/mo cash flow, and every ROLL credits that Payday before the
// die, so a player who starts the turn with `cash` meets the Setback holding
// cash + 740. Spec, Core rules, Setback (decided 2026-10-23).

const ROLL: Action = { type: 'ROLL', playerId: 'p1' };
const p1 = (state: GameState) => playerById(state, 'p1');

/** p1 starting the turn with `cash` rolls from 5 onto Setback (6) with `cardId` on top of the setback deck. */
function hitSetback(cash: number, cardId: string, state = twoPlayerGame()): GameState {
  return apply(aboutToRoll(onTopOfDeck(withPlayer(state, 'p1', { cash }), 'setback', cardId), 5, 1), ROLL);
}

describe('ROLL: landing on Setback', () => {
  it('ROLL: Setback draws the top card and pays its cost at once, with nothing pending', () => {
    const before = twoPlayerGame();
    const next = hitSetback(5_000, 'setback-002', before);
    expect(BOARD[6]).toBe('setback');
    expect(p1(next).cash).toBe(5_000 + 740 - 900);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(p1(next).liabilities).toEqual(p1(before).liabilities);
    expect(p1(next).skipsNextTurn).toBe(false);
  });

  it('ROLL: Setback sends the card to the setback discard pile', () => {
    const before = onTopOfDeck(twoPlayerGame(), 'setback', 'setback-002');
    const next = apply(aboutToRoll(withPlayer(before, 'p1', { cash: 5_000 }), 5, 1), ROLL);
    expect(next.decks.setback.drawPile).toEqual(before.decks.setback.drawPile.slice(1));
    expect(next.decks.setback.discardPile).toEqual(['setback-002']);
  });

  it('ROLL: Setback accepts cash exactly equal to the cost, leaving zero and no loan', () => {
    const next = hitSetback(2_760, 'setback-001');
    expect(p1(next).cash).toBe(0);
    expect(p1(next).liabilities.some((l) => l.kind === 'bank')).toBe(false);
    expect(p1(next).skipsNextTurn).toBe(false);
  });

  it('ROLL: Setback auto-borrows the smallest $1,000 multiple that covers the shortfall and skips the next turn', () => {
    // 400 + 740 Payday = 1,140 against 3,500: shortfall 2,360 → borrow 3,000.
    const before = twoPlayerGame();
    const next = hitSetback(400, 'setback-001', before);
    expect(p1(next).cash).toBe(1_140 + 3_000 - 3_500);
    expect(p1(next).liabilities).toEqual([
      ...p1(before).liabilities,
      { id: expect.any(String) as string, kind: 'bank', principal: 3_000, monthlyPayment: 300 },
    ]);
    expect(p1(next).skipsNextTurn).toBe(true);
    expect(debtPayments(p1(next))).toBe(560 + 300);
    expect(monthlyCashFlow(p1(next))).toBe(740 - 300);
  });

  it('ROLL: Setback borrows exactly the shortfall when it is a whole number of steps', () => {
    // 1,760 + 740 = 2,500 against 3,500: exactly one step.
    const next = hitSetback(1_760, 'setback-001');
    expect(p1(next).cash).toBe(0);
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'bank', principal: 1_000, monthlyPayment: 100 });
  });

  it('ROLL: Setback one dollar short borrows one step', () => {
    const next = hitSetback(2_759, 'setback-001');
    expect(p1(next).cash).toBe(999);
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'bank', principal: 1_000 });
    expect(p1(next).skipsNextTurn).toBe(true);
  });

  it('ROLL: Setback with less cash than the cost borrows one step', () => {
    // 0 + 740 against 900: shortfall 160 → borrow 1,000.
    const next = hitSetback(0, 'setback-002');
    expect(p1(next).cash).toBe(840);
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'bank', principal: 1_000 });
  });

  it('ROLL: a skipTurn card skips the next turn even when cash covers it', () => {
    const next = hitSetback(5_000, 'setback-003');
    expect(p1(next).cash).toBe(3_740);
    expect(p1(next).skipsNextTurn).toBe(true);
    expect(p1(next).liabilities.some((l) => l.kind === 'bank')).toBe(false);
  });

  it('ROLL: a skipTurn card that also forces a loan does both', () => {
    // 100 + 740 = 840 against 2,000: borrow 2,000.
    const next = hitSetback(100, 'setback-003');
    expect(p1(next).cash).toBe(840 + 2_000 - 2_000);
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'bank', principal: 2_000 });
    expect(p1(next).skipsNextTurn).toBe(true);
  });

  it('ROLL: the auto-borrowed loan shows up in the next Payday', () => {
    const hit = hitSetback(400, 'setback-001'); // cash 640, new 300/mo payment
    const nextTurn = withGame(apply(hit, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const unskipped = withPlayer(nextTurn, 'p1', { skipsNextTurn: false });
    const paid = rolledClean(unskipped, 'p1');
    expect(p1(paid).cash).toBe(640 + (740 - 300));
  });

  it('ROLL: Setback in kids mode does nothing beyond the Payday (the spec gives kids mode no Setback spaces)', () => {
    const before = twoPlayerGame({ mode: 'kids' });
    const next = apply(aboutToRoll(withPlayer(before, 'p1', { cash: 400 }), 5, 1), ROLL);
    expect(p1(next).cash).toBe(400 + 740);
    expect(next.decks.setback).toEqual(before.decks.setback);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(p1(next).skipsNextTurn).toBe(false);
  });

  it('ROLL: Setback with no cards in either pile does nothing beyond the Payday', () => {
    const empty: GameState = {
      ...twoPlayerGame(),
      decks: { ...twoPlayerGame().decks, setback: { drawPile: [], discardPile: [] } },
    };
    const next = apply(aboutToRoll(withPlayer(empty, 'p1', { cash: 400 }), 5, 1), ROLL);
    expect(p1(next).cash).toBe(400 + 740);
    expect(next.pending).toEqual({ kind: 'none' });
  });

  it('ROLL: Setback reshuffles the discard pile when the draw pile is empty', () => {
    const drained: GameState = {
      ...twoPlayerGame(),
      decks: { ...twoPlayerGame().decks, setback: { drawPile: [], discardPile: ['setback-002'] } },
    };
    const next = apply(aboutToRoll(withPlayer(drained, 'p1', { cash: 5_000 }), 5, 1), ROLL);
    expect(p1(next).cash).toBe(5_740 - 900);
    expect(next.decks.setback).toEqual({ drawPile: [], discardPile: ['setback-002'] });
  });

  it('ROLL: Setback does not touch the other player', () => {
    const before = twoPlayerGame();
    const next = hitSetback(400, 'setback-001', before);
    expect(next.players[1]).toEqual(before.players[1]);
  });
});

describe('ROLL: Setback log', () => {
  it('ROLL: a covered Setback logs Payday, roll, move, drewCard, cashChanged, and setback events', () => {
    const next = hitSetback(5_000, 'setback-002');
    expect(next.game.log.at(-1)?.events).toEqual([
      { kind: 'payday', amount: 740 },
      { kind: 'paydaySnapshot', playerId: 'p1', passiveIncome: 0, totalExpenses: 4_560, cash: 5_740, roundNumber: 1 },
      { kind: 'rolled', value: 1 },
      { kind: 'moved', from: 5, to: 6 },
      { kind: 'drewCard', deck: 'setback', cardId: 'setback-002' },
      { kind: 'cashChanged', delta: -900, reason: 'setback' },
      { kind: 'setback', cardId: 'setback-002', cost: 900, autoBorrowed: 0, skipsNextTurn: false },
    ]);
  });

  it('ROLL: a Setback that forces a loan logs the loan before the payment', () => {
    const next = hitSetback(400, 'setback-001');
    const loanId = p1(next).liabilities.at(-1)?.id;
    expect(next.game.log.at(-1)?.events.slice(4)).toEqual([
      { kind: 'drewCard', deck: 'setback', cardId: 'setback-001' },
      { kind: 'cashChanged', delta: 3_000, reason: 'borrow' },
      { kind: 'borrowed', liabilityId: loanId, amount: 3_000, monthlyPayment: 300, principles: ['P1'], purpose: 'setback', cardId: 'setback-001' },
      { kind: 'cashChanged', delta: -3_500, reason: 'setback' },
      { kind: 'setback', cardId: 'setback-001', cost: 3_500, autoBorrowed: 3_000, skipsNextTurn: true },
    ]);
  });
});

describe('END_TURN: skipped turns', () => {
  const kinds = (state: GameState) => state.game.log.at(-1)?.events.map((e) => e.kind);
  /** [playerId, roundNumber] for each paydaySnapshot in the last log entry. */
  const snapshotRounds = (state: GameState) =>
    state.game.log.at(-1)?.events.flatMap((e) => (e.kind === 'paydaySnapshot' ? [[e.playerId, e.roundNumber] as const] : []));

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
    // p2's END_TURN completes round 1 first; p1's skipped turn is its round-2 turn.
    expect(next.game.log.at(-1)?.events.slice(0, 2)).toEqual([
      { kind: 'roundCompleted', round: 1 },
      { kind: 'turnSkipped', playerId: 'p1' },
    ]);
  });

  it('END_TURN: the skip lasts one turn only', () => {
    const hit = hitSetback(5_000, 'setback-003');
    const p2Turn = apply(hit, { type: 'END_TURN', playerId: 'p1' });
    const p2Done = apply(rolledClean(p2Turn, 'p2'), { type: 'END_TURN', playerId: 'p2' });
    expect(p2Done.game.currentPlayerId).toBe('p2');
    const again = apply(rolledClean(p2Done, 'p2'), { type: 'END_TURN', playerId: 'p2' });
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
    const p3Turn = apply(rolledClean(flagged, 'p2'), { type: 'END_TURN', playerId: 'p2' });
    expect(p3Turn.game.currentPlayerId).toBe('p3');
    const next = apply(rolledClean(p3Turn, 'p3'), { type: 'END_TURN', playerId: 'p3' });
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
    const next = apply(rolledClean(base, 'p1'), { type: 'END_TURN', playerId: 'p1' });
    expect(next.game.currentPlayerId).toBe('p1');
    expect(playerById(next, 'p2').skipsNextTurn).toBe(true);
    expect(playerById(next, 'p3').skipsNextTurn).toBe(false);
    // p1 ends, p2 is out, p3 is skipped, so the turn comes back to p1 and the round is complete.
    expect(kinds(next)).toEqual(['turnSkipped', 'payday', 'paydaySnapshot', 'roundCompleted']);
    expect(next.game.log.at(-1)?.events[0]).toEqual({ kind: 'turnSkipped', playerId: 'p3' });
  });

  it('END_TURN: when every player must skip, each skip is consumed once in seat order, the round completes as the turn passes the last seat, and play resumes', () => {
    // p1 ends; p2 skips its round-1 turn, round 1 completes, p1 skips its round-2 turn, and p2 plays round 2.
    const both = withPlayer(withPlayer(twoPlayerGame(), 'p1', { skipsNextTurn: true }), 'p2', { skipsNextTurn: true });
    const next = apply(rolledClean(both, 'p1'), { type: 'END_TURN', playerId: 'p1' });
    expect(next.game.currentPlayerId).toBe('p2');
    expect(p1(next).skipsNextTurn).toBe(false);
    expect(playerById(next, 'p2').skipsNextTurn).toBe(false);
    expect(kinds(next)).toEqual(['turnSkipped', 'payday', 'paydaySnapshot', 'roundCompleted', 'turnSkipped', 'payday', 'paydaySnapshot']);
    expect(roundNumber(next)).toBe(2);
    expect(snapshotRounds(next)).toEqual([
      ['p2', 1],
      ['p1', 2],
    ]);
    expect(next.game.log.at(-1)?.events.filter((e) => e.kind === 'turnSkipped')).toEqual([
      { kind: 'turnSkipped', playerId: 'p2' },
      { kind: 'turnSkipped', playerId: 'p1' },
    ]);
  });
});

describe('END_TURN: a skipped seat still gets its Payday (spec, Core rules, turn step 1)', () => {
  it('END_TURN: credits the skipped player their monthly cash flow and logs payday and paydaySnapshot for them', () => {
    const flagged = withPlayer(withPlayer(twoPlayerGame(), 'p1', { skipsNextTurn: true, cash: 1_000 }), 'p2', { cash: 5_000 });
    const next = apply(rolledClean(flagged, 'p2'), { type: 'END_TURN', playerId: 'p2' });
    expect(next.game.currentPlayerId).toBe('p2');
    expect(p1(next).cash).toBe(1_000 + 740);
    expect(p1(next).skipsNextTurn).toBe(false);
    expect(next.game.log.at(-1)?.events).toEqual([
      // p2's END_TURN completes round 1; p1's skipped turn is its round-2 turn, paid after the marker, and p2 plays round 2.
      { kind: 'roundCompleted', round: 1 },
      { kind: 'turnSkipped', playerId: 'p1' },
      { kind: 'payday', amount: 740 },
      { kind: 'paydaySnapshot', playerId: 'p1', passiveIncome: 0, totalExpenses: 4_560, cash: 1_740, roundNumber: 2 },
    ]);
  });

  it('END_TURN: a skipped player whose Payday is negative and unpayable goes out, and the game ends when one player is left', () => {
    const base = twoPlayerGame();
    const doomed = withPlayer(base, 'p1', {
      skipsNextTurn: true,
      cash: 0,
      liabilities: [...p1(base).liabilities, { id: 'l-truck', kind: 'lifestyle', principal: 12_000, monthlyPayment: 1_000, sourceCardId: 'life-001' }],
    });
    const next = apply(rolledClean(withPlayer(doomed, 'p2', { cash: 5_000 }), 'p2'), { type: 'END_TURN', playerId: 'p2' });
    expect(p1(next).isOut).toBe(true);
    expect(p1(next).cash).toBe(0);
    expect(next.game.phase).toBe('finished');
    expect(next.game.currentPlayerId).toBe('p2');
    expect(next.game.log.at(-1)?.events.map((e) => e.kind)).toEqual(['roundCompleted', 'turnSkipped', 'payday', 'paydaySnapshot', 'wentOut', 'gameEnded']);
  });

  it('END_TURN: with three players, a skipped seat that goes out at Payday is passed and play continues', () => {
    const three = twoPlayerGame({
      players: [
        { id: 'p1', name: 'A', professionId: 'teacher' },
        { id: 'p2', name: 'B', professionId: 'nurse' },
        { id: 'p3', name: 'C', professionId: 'doctor' },
      ],
    });
    const doomed = withPlayer(three, 'p2', {
      skipsNextTurn: true,
      cash: 0,
      liabilities: [...playerById(three, 'p2').liabilities, { id: 'l-truck', kind: 'lifestyle', principal: 12_000, monthlyPayment: 5_000, sourceCardId: 'life-001' }],
    });
    const next = apply(rolledClean(doomed, 'p1'), { type: 'END_TURN', playerId: 'p1' });
    expect(playerById(next, 'p2').isOut).toBe(true);
    expect(next.game.phase).toBe('playing');
    expect(next.game.currentPlayerId).toBe('p3');
    expect(next.game.turnNumber).toBe(1);
  });
});
