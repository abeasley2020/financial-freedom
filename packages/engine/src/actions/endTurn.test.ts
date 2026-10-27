import { ROUND_LIMIT, type Action, type GameState, type Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { createGame } from '../createGame';
import { freedomPercent, playerById, roundNumber } from '../selectors';
import { apply, reject } from '../test/apply';
import { rolledClean, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

const END_TURN: Action = { type: 'END_TURN', playerId: 'p1' };

/** p1 has rolled (Payday 700 credited) and skipped a Giving space: pending none, cash 400 + 700. */
function afterRoll(state: GameState = twoPlayerGame()): GameState {
  return rolledClean(state, 'p1');
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
    const rolled = rolledClean(twoPlayerGame(), 'p2');
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
      assets: [{ id: 'a1', cardId: 'big-001', type: 'business', purchasePrice: 1, downPaid: 1, monthlyCashFlow }],
    });

  it('END_TURN: marks hasEscaped and finishes the game when passiveIncome equals totalExpenses', () => {
    // Teacher totalExpenses = 4,000 + 560 = 4,560
    const next = apply(afterRoll(escaping(4_560)), END_TURN);
    expect(next.players[0]?.hasEscaped).toBe(true);
    expect(next.game.phase).toBe('finished');
    expect(next.game.currentPlayerId).toBe('p1');
    expect(next.game.log.at(-1)?.events).toEqual([{ kind: 'gameEnded', reason: 'escape', winnerId: 'p1' }]);
  });

  it('END_TURN: does not escape one dollar short and the game continues', () => {
    const next = apply(afterRoll(escaping(4_559)), END_TURN);
    expect(next.players[0]?.hasEscaped).toBe(false);
    expect(next.game.phase).toBe('playing');
    expect(next.game.currentPlayerId).toBe('p2');
  });
});

describe('END_TURN: log', () => {
  it('END_TURN: appends a log entry carrying the turn number that just ended', () => {
    const next = apply(afterRoll(), END_TURN);
    expect(next.game.log).toHaveLength(3);
    expect(next.game.log[2]).toEqual({ turnNumber: 0, action: END_TURN, events: [] });
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
    { kind: 'lifeChoice', cardId: 'life-001' },
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

describe('END_TURN: rounds (spec v2, Winning and game length)', () => {
  /** Plays one clean turn for `playerId` (roll onto Giving, skip) and ends it. */
  const turn = (state: GameState, playerId: string): GameState => apply(rolledClean(state, playerId), { type: 'END_TURN', playerId });

  it('END_TURN: a round completes when every seat still in has taken a turn, and is logged on the END_TURN that completes it', () => {
    const start = twoPlayerGame();
    expect(roundNumber(start)).toBe(1);
    const afterP1 = turn(start, 'p1');
    expect(afterP1.game.log.at(-1)?.events).toEqual([]);
    expect(roundNumber(afterP1)).toBe(1);
    const afterP2 = turn(afterP1, 'p2');
    expect(afterP2.game.log.at(-1)?.events).toEqual([{ kind: 'roundCompleted', round: 1 }]);
    expect(roundNumber(afterP2)).toBe(2);
    expect(afterP2.game.phase).toBe('playing');
  });

  it('END_TURN: a skipped turn counts as that seat\'s turn (decided 2026-10-23, Q3)', () => {
    const flagged = withPlayer(twoPlayerGame(), 'p2', { skipsNextTurn: true });
    const next = turn(flagged, 'p1');
    expect(next.game.currentPlayerId).toBe('p1');
    expect(next.game.log.at(-1)?.events.map((e) => e.kind)).toEqual(['turnSkipped', 'payday', 'paydaySnapshot', 'roundCompleted']);
    expect(roundNumber(next)).toBe(2);
  });

  it("END_TURN: a skipped seat's turn in the next round is paid after roundCompleted, and its paydaySnapshot carries the new round", () => {
    const flagged = withPlayer(turn(twoPlayerGame(), 'p1'), 'p1', { skipsNextTurn: true });
    const next = turn(flagged, 'p2');
    expect(next.game.log.at(-1)?.events.map((e) => e.kind)).toEqual(['roundCompleted', 'turnSkipped', 'payday', 'paydaySnapshot']);
    expect(next.game.log.at(-1)?.events.find((e) => e.kind === 'paydaySnapshot')).toMatchObject({ playerId: 'p1', roundNumber: 2 });
    expect(next.game.currentPlayerId).toBe('p2');
    expect(roundNumber(next)).toBe(2);
  });

  it('END_TURN: when every seat skips, one END_TURN can complete two rounds', () => {
    // p2 ends round 1 with both seats set to skip: round 1 completes, both skip their round-2 turns, round 2 completes, and p1 plays round 3.
    const ready = rolledClean(turn(twoPlayerGame(), 'p1'), 'p2');
    const both = withPlayer(withPlayer(ready, 'p1', { skipsNextTurn: true }), 'p2', { skipsNextTurn: true });
    const next = apply(both, { type: 'END_TURN', playerId: 'p2' });
    expect(next.game.currentPlayerId).toBe('p1');
    expect(next.game.log.at(-1)?.events.map((e) => e.kind)).toEqual([
      'roundCompleted',
      'turnSkipped',
      'payday',
      'paydaySnapshot',
      'turnSkipped',
      'payday',
      'paydaySnapshot',
      'roundCompleted',
    ]);
    expect(next.game.log.at(-1)?.events.filter((e) => e.kind === 'roundCompleted')).toEqual([
      { kind: 'roundCompleted', round: 1 },
      { kind: 'roundCompleted', round: 2 },
    ]);
    expect(roundNumber(next)).toBe(3);
  });

  it('END_TURN: a player who is out no longer needs a turn for the round to complete', () => {
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
    const p2Out = withPlayer(three, 'p2', { isOut: true });
    const afterP1 = turn(p2Out, 'p1');
    expect(afterP1.game.currentPlayerId).toBe('p3');
    expect(roundNumber(afterP1)).toBe(1);
    const afterP3 = turn(afterP1, 'p3');
    expect(afterP3.game.currentPlayerId).toBe('p1');
    expect(roundNumber(afterP3)).toBe(2);
  });

  it('END_TURN: the paydaySnapshot carries the round it was paid in', () => {
    const round2 = turn(turn(twoPlayerGame(), 'p1'), 'p2');
    const rolled = rolledClean(round2, 'p1');
    expect(rolled.game.log.at(-2)?.events).toContainEqual(expect.objectContaining({ kind: 'paydaySnapshot', playerId: 'p1', roundNumber: 2 }));
  });
});

describe('END_TURN: the round limit (spec v2: 15 rounds standard, 10 kids; winner by freedomPercent, cash, netWorth, seat)', () => {
  const turn = (state: GameState, playerId: string): GameState => apply(rolledClean(state, playerId), { type: 'END_TURN', playerId });

  /** Plays `rounds` full rounds of clean turns for both players. */
  function playRounds(state: GameState, rounds: number): GameState {
    let s = state;
    for (let r = 0; r < rounds; r++) s = turn(turn(s, 'p1'), 'p2');
    return s;
  }

  it('END_TURN: the game ends at the END_TURN that completes the final round, with the winner current and gameEnded logged', () => {
    const limit = ROUND_LIMIT.standard;
    const lastRound = playRounds(twoPlayerGame(), limit - 1);
    expect(roundNumber(lastRound)).toBe(limit);
    expect(lastRound.game.phase).toBe('playing');
    const p1Done = turn(lastRound, 'p1');
    expect(p1Done.game.phase).toBe('playing');
    const finished = turn(p1Done, 'p2');
    expect(finished.game.phase).toBe('finished');
    // Nobody has passive income: tie at 0% Freedom, so cash decides, and the Doctor has more.
    expect(playerById(finished, 'p2').cash).toBeGreaterThan(playerById(finished, 'p1').cash);
    expect(finished.game.currentPlayerId).toBe('p2');
    expect(finished.game.log.at(-1)?.events).toEqual([{ kind: 'gameEnded', reason: 'roundLimit', winnerId: 'p2' }]);
    expect(roundNumber(finished)).toBe(limit);
    expect(finished.players.every((p) => !p.hasEscaped)).toBe(true);
  });

  it('END_TURN: the END_TURN that completes the final round pays no skipped seat for a round past the limit', () => {
    const lastRound = turn(playRounds(twoPlayerGame(), ROUND_LIMIT.standard - 1), 'p1');
    const flagged = withPlayer(lastRound, 'p1', { skipsNextTurn: true });
    const cash = playerById(flagged, 'p1').cash;
    const finished = turn(flagged, 'p2');
    expect(finished.game.phase).toBe('finished');
    expect(finished.game.log.at(-1)?.events).toEqual([{ kind: 'gameEnded', reason: 'roundLimit', winnerId: 'p2' }]);
    expect(playerById(finished, 'p1').cash).toBe(cash);
  });

  it('END_TURN: a skipped seat whose final-round turn comes before the limit is still paid for it', () => {
    // Three seats: p2 ends the last round's second turn, p3 skips its final-round turn (paid), then the round and the game end.
    const three = twoPlayerGame({
      players: [
        { id: 'p1', name: 'A', professionId: 'teacher' },
        { id: 'p2', name: 'B', professionId: 'nurse' },
        { id: 'p3', name: 'C', professionId: 'doctor' },
      ],
    });
    let s = three;
    for (let r = 0; r < ROUND_LIMIT.standard - 1; r++) s = turn(turn(turn(s, 'p1'), 'p2'), 'p3');
    const flagged = withPlayer(turn(s, 'p1'), 'p3', { skipsNextTurn: true });
    const finished = turn(flagged, 'p2');
    expect(finished.game.phase).toBe('finished');
    expect(finished.game.log.at(-1)?.events.map((e) => e.kind)).toEqual(['turnSkipped', 'payday', 'paydaySnapshot', 'gameEnded']);
    expect(finished.game.log.at(-1)?.events.find((e) => e.kind === 'paydaySnapshot')).toMatchObject({ playerId: 'p3', roundNumber: ROUND_LIMIT.standard });
  });

  it('END_TURN: the higher freedomPercent wins at the limit even with less cash', () => {
    // The Teacher earns 50% Freedom from one asset; the Doctor sits on a pile of cash and 0%.
    const rich = withPlayer(
      withPlayer(twoPlayerGame(), 'p1', {
        assets: [{ id: 'a', cardId: 'big-001', type: 'business', purchasePrice: 1, downPaid: 1, monthlyCashFlow: 2_280 }],
      }),
      'p2',
      { cash: 200_000 },
    );
    const finished = playRounds(rich, ROUND_LIMIT.standard);
    expect(finished.game.phase).toBe('finished');
    expect(freedomPercent(playerById(finished, 'p1'))).toBe(50);
    expect(freedomPercent(playerById(finished, 'p2'))).toBe(0);
    expect(playerById(finished, 'p1').cash).toBeLessThan(playerById(finished, 'p2').cash);
    expect(finished.game.currentPlayerId).toBe('p1');
  });

  it('END_TURN: kids mode ends after round 10', () => {
    const kids = twoPlayerGame({ mode: 'kids' });
    const nine = playRounds(kids, ROUND_LIMIT.kids - 1);
    expect(nine.game.phase).toBe('playing');
    const finished = playRounds(nine, 1);
    expect(finished.game.phase).toBe('finished');
    expect(roundNumber(finished)).toBe(ROUND_LIMIT.kids);
  });

  it('END_TURN: nothing is accepted once the limit has ended the game', () => {
    const finished = playRounds(twoPlayerGame(), ROUND_LIMIT.standard);
    expect(reject(finished, { type: 'ROLL', playerId: finished.game.currentPlayerId })).toBe('GAME_NOT_PLAYING');
  });

  it('END_TURN: an escape still ends the game at once, before the limit', () => {
    const escaper = withPlayer(twoPlayerGame(), 'p1', {
      assets: [{ id: 'a', cardId: 'big-001', type: 'business', purchasePrice: 1, downPaid: 1, monthlyCashFlow: 4_560 }],
    });
    const next = turn(escaper, 'p1');
    expect(next.game.phase).toBe('finished');
    expect(roundNumber(next)).toBe(1);
    expect(playerById(next, 'p1').hasEscaped).toBe(true);
  });

  it('END_TURN: when bankruptcy leaves one player the game ends with gameEnded lastStanding', () => {
    const base = twoPlayerGame();
    const doomed = withPlayer(base, 'p1', {
      cash: 0,
      liabilities: [...(base.players[0]?.liabilities ?? []), { id: 'l', kind: 'lifestyle', principal: 12_000, monthlyPayment: 1_000, sourceCardId: 'life-001' }],
    });
    const out = apply(doomed, { type: 'ROLL', playerId: 'p1' });
    const next = apply(out, END_TURN);
    expect(next.game.phase).toBe('finished');
    expect(next.game.log.at(-1)?.events).toEqual([{ kind: 'gameEnded', reason: 'lastStanding', winnerId: 'p2' }]);
  });
});
