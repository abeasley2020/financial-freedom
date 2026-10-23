import { BOARD, CARDS_BY_DECK, type Action, type GameState, type Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { playerById } from '../selectors';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { aboutToRoll, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

// Board layout from board.json: payday 0 and 12, setback 11, opportunity 1,
// market 2, lifestyle 4, giving 6. Tests pin position and die roll with
// aboutToRoll so landing spaces are exact.

const ROLL: Action = { type: 'ROLL', playerId: 'p1' };
const p1 = (state: GameState) => playerById(state, 'p1');

/** Ada the Teacher: 3,300 salary − (2,300 base + 300 debt) = 700 per Payday. */
const TEACHER_CASH_FLOW = 700;

describe('ROLL: movement', () => {
  it('ROLL: moves the current player by the die value', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 1, 4), ROLL);
    expect(p1(next).position).toBe(5);
  });

  it('ROLL: wraps around the 24-space loop', () => {
    expect(BOARD.length).toBe(24);
    const next = apply(aboutToRoll(twoPlayerGame(), 22, 4), ROLL);
    expect(p1(next).position).toBe(2);
  });

  it('ROLL: does not move or change the other player', () => {
    const before = twoPlayerGame();
    const next = apply(aboutToRoll(before, 1, 4), ROLL);
    expect(next.players[1]).toEqual(before.players[1]);
  });
});

describe('ROLL: Payday', () => {
  it('ROLL: credits Payday cash flow when passing a Payday space', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 10, 3), ROLL);
    expect(p1(next).position).toBe(13);
    expect(p1(next).cash).toBe(400 + TEACHER_CASH_FLOW);
  });

  it('ROLL: credits Payday cash flow when landing on a Payday space and leaves pending none', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 9, 3), ROLL);
    expect(p1(next).position).toBe(12);
    expect(p1(next).cash).toBe(1_100);
    expect(next.pending).toEqual({ kind: 'none' });
  });

  it('ROLL: credits Payday when wrapping past space 0', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 22, 3), ROLL);
    expect(p1(next).position).toBe(1);
    expect(p1(next).cash).toBe(1_100);
  });

  it('ROLL: does not credit Payday when no Payday space is passed', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 1, 4), ROLL);
    expect(p1(next).cash).toBe(400);
  });

  it('ROLL: Payday includes passive income from assets', () => {
    const owner = withPlayer(twoPlayerGame(), 'p1', {
      assets: [{ cardId: 'small-001', type: 'rental', purchasePrice: 50_000, downPaid: 5_000, monthlyCashFlow: 160 }],
    });
    const next = apply(aboutToRoll(owner, 10, 3), ROLL);
    expect(p1(next).cash).toBe(400 + 700 + 160);
  });

  it('ROLL: Payday deducts a negative monthly cash flow', () => {
    const base = twoPlayerGame();
    const indebted = withPlayer(base, 'p1', {
      liabilities: [
        ...p1(base).liabilities,
        { id: 'l-truck', kind: 'lifestyle', principal: 12_000, monthlyPayment: 1_000, sourceCardId: 'life-001' },
      ],
    });
    const next = apply(aboutToRoll(indebted, 10, 3), ROLL);
    expect(p1(next).cash).toBe(400 + (700 - 1_000));
  });
});

describe('ROLL: resolving the landed space', () => {
  it('ROLL: landing on Opportunity sets pending chooseDealSize', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 0, 1), ROLL);
    expect(BOARD[1]).toBe('opportunity');
    expect(next.pending).toEqual({ kind: 'chooseDealSize' });
  });

  it('ROLL: landing on Market draws the top market card into pending marketChoice', () => {
    const before = twoPlayerGame();
    const [top, ...rest] = before.decks.market.drawPile;
    const next = apply(aboutToRoll(before, 0, 2), ROLL);
    expect(BOARD[2]).toBe('market');
    expect(next.pending).toEqual({ kind: 'marketChoice', cardId: top });
    expect(next.decks.market.drawPile).toEqual(rest);
    expect(next.decks.market.discardPile).toEqual([]);
  });

  it('ROLL: landing on Lifestyle draws the top lifestyle card into pending payLifestyle', () => {
    const before = twoPlayerGame();
    const [top, ...rest] = before.decks.lifestyle.drawPile;
    const next = apply(aboutToRoll(before, 0, 4), ROLL);
    expect(BOARD[4]).toBe('lifestyle');
    expect(next.pending).toEqual({ kind: 'payLifestyle', cardId: top });
    expect(next.decks.lifestyle.drawPile).toEqual(rest);
  });

  it('ROLL: landing on Giving sets pending giveOrSkip', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 0, 6), ROLL);
    expect(BOARD[6]).toBe('giving');
    expect(next.pending).toEqual({ kind: 'giveOrSkip' });
  });

  it('ROLL: landing on Setback leaves pending none and the setback deck untouched (spec gap 1, unresolved)', () => {
    const before = twoPlayerGame();
    const next = apply(aboutToRoll(before, 10, 1), ROLL);
    expect(BOARD[11]).toBe('setback');
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.decks.setback).toEqual(before.decks.setback);
    expect(p1(next).cash).toBe(400);
  });

  it('ROLL: in kids mode, Opportunity draws from the small deals deck into pending buyOrPass', () => {
    const kids = twoPlayerGame({ mode: 'kids' });
    const [top, ...rest] = kids.decks.smallDeals.drawPile;
    const next = apply(aboutToRoll(kids, 0, 1), ROLL);
    expect(next.pending).toEqual({ kind: 'buyOrPass', cardId: top });
    expect(next.decks.smallDeals.drawPile).toEqual(rest);
  });
});

describe('ROLL: deck piles', () => {
  it('ROLL: draws the last card in a pile without reshuffling', () => {
    const base = twoPlayerGame();
    const [last, ...others] = base.decks.market.drawPile;
    if (last === undefined) throw new Error('fixture has no market cards');
    const state: GameState = {
      ...base,
      decks: { ...base.decks, market: { drawPile: [last], discardPile: others } },
    };
    const next = apply(aboutToRoll(state, 0, 2), ROLL);
    expect(next.pending).toEqual({ kind: 'marketChoice', cardId: last });
    expect(next.decks.market.drawPile).toEqual([]);
    expect(next.decks.market.discardPile).toEqual(others);
  });

  it('ROLL: reshuffles the discard pile into the draw pile when the draw pile is empty', () => {
    const base = twoPlayerGame();
    const all = CARDS_BY_DECK.market.map((c) => c.id);
    const state: GameState = {
      ...base,
      decks: { ...base.decks, market: { drawPile: [], discardPile: all } },
    };
    const next = apply(aboutToRoll(state, 0, 2), ROLL);
    expect(next.pending.kind).toBe('marketChoice');
    const drawn = (next.pending as { cardId: string }).cardId;
    expect(all).toContain(drawn);
    expect(next.decks.market.discardPile).toEqual([]);
    expect([...next.decks.market.drawPile, drawn].sort()).toEqual([...all].sort());
  });

  it('ROLL: landing on Market with no cards in either pile leaves pending none', () => {
    const base = twoPlayerGame();
    const state: GameState = {
      ...base,
      decks: { ...base.decks, market: { drawPile: [], discardPile: [] } },
    };
    const next = apply(aboutToRoll(state, 0, 2), ROLL);
    expect(next.pending).toEqual({ kind: 'none' });
  });
});

describe('ROLL: log and determinism', () => {
  it('ROLL: appends a log entry with the roll, move, and Payday events', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 10, 3), ROLL);
    expect(next.game.log).toEqual([
      {
        turnNumber: 0,
        action: ROLL,
        events: [
          { kind: 'rolled', value: 3 },
          { kind: 'moved', from: 10, to: 13 },
          { kind: 'payday', amount: TEACHER_CASH_FLOW },
        ],
      },
    ]);
  });

  it('ROLL: logs a drewCard event when a space draws a card', () => {
    const before = twoPlayerGame();
    const next = apply(aboutToRoll(before, 0, 2), ROLL);
    expect(next.game.log[0]?.events).toContainEqual({
      kind: 'drewCard',
      deck: 'market',
      cardId: before.decks.market.drawPile[0],
    });
  });

  it('ROLL: advances rngState', () => {
    const before = aboutToRoll(twoPlayerGame(), 1, 4);
    const next = apply(before, ROLL);
    expect(next.game.rngState).not.toBe(before.game.rngState);
  });

  it('ROLL: is deterministic for the same state and action', () => {
    const before = deepFreeze(twoPlayerGame());
    const a = reduce(before, ROLL);
    const b = reduce(before, ROLL);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('ROLL: rejections', () => {
  it('ROLL: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(twoPlayerGame(), { type: 'ROLL', playerId: 'p2' })).toBe('NOT_YOUR_TURN');
  });

  const pendings: Pending[] = [
    { kind: 'chooseDealSize' },
    { kind: 'buyOrPass', cardId: 'small-001' },
    { kind: 'marketChoice', cardId: 'market-001' },
    { kind: 'payLifestyle', cardId: 'life-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('ROLL: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...twoPlayerGame(), pending }, ROLL)).toBe('INVALID_FOR_PENDING');
  });

  it('ROLL: rejected with ALREADY_ROLLED when the player has rolled this turn', () => {
    const rolled = apply(aboutToRoll(twoPlayerGame(), 11, 1), ROLL); // lands on Payday, pending none
    expect(reject(rolled, ROLL)).toBe('ALREADY_ROLLED');
  });

  it.each(['lobby', 'finished'] as const)('ROLL: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(twoPlayerGame(), { phase }), ROLL)).toBe('GAME_NOT_PLAYING');
  });

  it('ROLL: a rejected action is not logged', () => {
    const before = deepFreeze(withGame(twoPlayerGame(), { phase: 'finished' }));
    const result = reduce(before, ROLL);
    expect(result.ok).toBe(false);
    expect(before.game.log).toEqual([]);
  });
});
