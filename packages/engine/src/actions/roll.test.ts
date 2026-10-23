import { BOARD, CARDS_BY_DECK, CARDS_BY_ID, type Action, type GameState, type Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { playerById } from '../selectors';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { aboutToRoll, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

// v2 board (spec, Core rules, Board; decided 2026-10-23, Q8): opportunity at
// 0, 3, 5, 8, 10, 13, 15, 18, 20, 23; lifeChoices at 1, 7, 11,
// 14, 19, 22; market at 2, 9, 16, 21; giving at 4, 17; setback at 6, 12.
// There are no Payday spaces: Payday happens at the start of every turn.
// Tests pin position and die roll with aboutToRoll so landing spaces are exact.

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

describe('ROLL: Payday every turn (spec, Core rules, turn step 1; decided 2026-10-23, Q1)', () => {
  it('ROLL: credits monthly cash flow at the start of the turn, before the die is rolled', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 2, 1), ROLL);
    expect(p1(next).position).toBe(3);
    expect(p1(next).cash).toBe(400 + TEACHER_CASH_FLOW);
  });

  it('ROLL: credits Payday on the very first turn of the game', () => {
    const next = apply(twoPlayerGame(), ROLL);
    expect(p1(next).cash).toBe(400 + TEACHER_CASH_FLOW);
  });

  it('ROLL: credits exactly one Payday per turn no matter how far the player moves', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 22, 6), ROLL);
    expect(p1(next).position).toBe(4);
    expect(p1(next).cash).toBe(400 + TEACHER_CASH_FLOW);
  });

  it('ROLL: the board has no Payday space', () => {
    expect(BOARD).not.toContain('payday');
  });

  it('ROLL: Payday includes passive income from assets', () => {
    const owner = withPlayer(twoPlayerGame(), 'p1', {
      assets: [{ id: 'a1', cardId: 'small-001', type: 'rental', purchasePrice: 50_000, downPaid: 5_000, monthlyCashFlow: 160 }],
    });
    const next = apply(aboutToRoll(owner, 2, 1), ROLL);
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
    const next = apply(aboutToRoll(indebted, 2, 1), ROLL);
    expect(p1(next).cash).toBe(400 + (700 - 1_000));
  });

  it('ROLL: logs payday and paydaySnapshot before the die, with the snapshot taken after the credit', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 2, 1), ROLL);
    expect(next.game.log[0]?.events.slice(0, 3)).toEqual([
      { kind: 'payday', amount: TEACHER_CASH_FLOW },
      { kind: 'paydaySnapshot', playerId: 'p1', passiveIncome: 0, totalExpenses: 2_600, cash: 1_100 },
      { kind: 'rolled', value: 1 },
    ]);
  });

  it('ROLL: a Payday that puts the player out ends the ROLL with no die roll, no move, and nothing pending', () => {
    const base = twoPlayerGame();
    const doomed = withPlayer(base, 'p1', {
      cash: 0,
      liabilities: [
        ...p1(base).liabilities,
        { id: 'l-truck', kind: 'lifestyle', principal: 12_000, monthlyPayment: 1_000, sourceCardId: 'life-001' },
      ],
    });
    const before = aboutToRoll(doomed, 2, 1);
    const next = apply(before, ROLL);
    expect(p1(next).isOut).toBe(true);
    expect(p1(next).cash).toBe(0);
    expect(p1(next).position).toBe(2);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.game.rngState).toBe(before.game.rngState);
    const kinds = next.game.log[0]?.events.map((e) => e.kind);
    expect(kinds).toEqual(['payday', 'paydaySnapshot', 'wentOut']);
  });

  it('ROLL: a player who went out at Payday can still END_TURN so play moves on', () => {
    const base = twoPlayerGame();
    const doomed = withPlayer(base, 'p1', {
      cash: 0,
      liabilities: [
        ...p1(base).liabilities,
        { id: 'l-truck', kind: 'lifestyle', principal: 12_000, monthlyPayment: 1_000, sourceCardId: 'life-001' },
      ],
    });
    const out = apply(aboutToRoll(doomed, 2, 1), ROLL);
    const next = apply(out, { type: 'END_TURN', playerId: 'p1' });
    expect(next.game.phase).toBe('finished');
    expect(next.game.currentPlayerId).toBe('p2');
  });
});

describe('ROLL: resolving the landed space', () => {
  it('ROLL: landing on Opportunity sets pending chooseDealSize', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 2, 1), ROLL);
    expect(BOARD[3]).toBe('opportunity');
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

  it('ROLL: landing on Life Choices draws the top Life Choices card into pending lifeChoice', () => {
    const before = twoPlayerGame();
    const [top, ...rest] = before.decks.lifeChoices.drawPile;
    const next = apply(aboutToRoll(before, 0, 1), ROLL);
    expect(BOARD[1]).toBe('lifeChoices');
    expect(next.pending).toEqual({ kind: 'lifeChoice', cardId: top });
    expect(next.decks.lifeChoices.drawPile).toEqual(rest);
  });

  it('ROLL: landing on Giving sets pending giveOrSkip', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 0, 4), ROLL);
    expect(BOARD[4]).toBe('giving');
    expect(next.pending).toEqual({ kind: 'giveOrSkip' });
  });

  it('ROLL: landing on Setback draws the top setback card, pays it, and leaves pending none (details in setback.test.ts)', () => {
    const before = twoPlayerGame();
    const [top, ...rest] = before.decks.setback.drawPile;
    const next = apply(aboutToRoll(before, 5, 1), ROLL);
    expect(BOARD[6]).toBe('setback');
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.decks.setback).toEqual({ drawPile: rest, discardPile: [top] });
    expect(p1(next).cash).toBeLessThan(400 + 700 + 4_000);
  });

  it('ROLL: in kids mode, Opportunity draws from the small deals deck into pending buyOrPass', () => {
    const kids = twoPlayerGame({ mode: 'kids' });
    const [top, ...rest] = kids.decks.smallDeals.drawPile;
    const next = apply(aboutToRoll(kids, 2, 1), ROLL);
    expect(next.pending).toEqual({ kind: 'buyOrPass', cardId: top });
    expect(next.decks.smallDeals.drawPile).toEqual(rest);
  });

  it('ROLL: in kids mode, Opportunity never produces a stock buyOrPass', () => {
    // Draw the whole kids small-deals deck, plus a full reshuffle cycle, across many seeds.
    for (let seed = 0; seed < 25; seed++) {
      let state = twoPlayerGame({ mode: 'kids', seed });
      const deckSize = state.decks.smallDeals.drawPile.length;
      expect(deckSize).toBeGreaterThan(0);
      for (let draw = 0; draw < deckSize * 2; draw++) {
        const next = apply(aboutToRoll(state, 2, 1), ROLL);
        expect(next.pending.kind).toBe('buyOrPass');
        const cardId = (next.pending as { cardId: string }).cardId;
        const card = CARDS_BY_ID.get(cardId);
        expect(card?.deck).toBe('smallDeals');
        expect(card?.deck === 'smallDeals' && card.type, cardId).not.toBe('stock');
        expect(next.pending).not.toHaveProperty('sharePrice');
        // Return the card to the discard pile and clear the turn so the next draw reshuffles when needed.
        state = {
          ...next,
          pending: { kind: 'none' },
          game: { ...next.game, log: [] },
          decks: {
            ...next.decks,
            smallDeals: {
              drawPile: next.decks.smallDeals.drawPile,
              discardPile: [...next.decks.smallDeals.discardPile, cardId],
            },
          },
        };
      }
    }
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
  it('ROLL: appends a log entry with the Payday, roll, and move events', () => {
    const next = apply(aboutToRoll(twoPlayerGame(), 2, 1), ROLL);
    expect(next.game.log).toEqual([
      {
        turnNumber: 0,
        action: ROLL,
        events: [
          { kind: 'payday', amount: TEACHER_CASH_FLOW },
          { kind: 'paydaySnapshot', playerId: 'p1', passiveIncome: 0, totalExpenses: 2_600, cash: 1_100 },
          { kind: 'rolled', value: 1 },
          { kind: 'moved', from: 2, to: 3 },
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
    { kind: 'lifeChoice', cardId: 'life-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('ROLL: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...twoPlayerGame(), pending }, ROLL)).toBe('INVALID_FOR_PENDING');
  });

  it('ROLL: rejected with ALREADY_ROLLED when the player has rolled this turn', () => {
    const rolled = apply(aboutToRoll(twoPlayerGame(), 0, 4), ROLL); // lands on Giving
    const cleared = apply(rolled, { type: 'SKIP_GIVE', playerId: 'p1' });
    expect(reject(cleared, ROLL)).toBe('ALREADY_ROLLED');
  });

  it.each(['lobby', 'finished'] as const)('ROLL: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(twoPlayerGame(), { phase }), ROLL)).toBe('GAME_NOT_PLAYING');
  });

  it('ROLL: a rejected action is not logged and credits no Payday', () => {
    const before = deepFreeze(withGame(twoPlayerGame(), { phase: 'finished' }));
    const result = reduce(before, ROLL);
    expect(result.ok).toBe(false);
    expect(before.game.log).toEqual([]);
    expect(p1(before).cash).toBe(400);
  });
});
