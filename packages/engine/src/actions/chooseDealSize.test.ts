import { CARDS_BY_ID, type Action, type GameState, type Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { aboutToRoll, twoPlayerGame, withGame } from '../test/fixtures';

const SMALL: Action = { type: 'CHOOSE_DEAL_SIZE', playerId: 'p1', size: 'small' };
const BIG: Action = { type: 'CHOOSE_DEAL_SIZE', playerId: 'p1', size: 'big' };

/** p1 has rolled from 2 to 3 (Opportunity), so pending is chooseDealSize. */
function onOpportunity(state: GameState = twoPlayerGame()): GameState {
  const next = apply(aboutToRoll(state, 2, 1), { type: 'ROLL', playerId: 'p1' });
  expect(next.pending).toEqual({ kind: 'chooseDealSize' });
  return next;
}

/** Puts the named cards on top of a deck's draw pile. */
function withDrawPile(state: GameState, deck: 'smallDeals' | 'bigDeals', drawPile: string[], discardPile: string[] = []): GameState {
  return { ...state, decks: { ...state.decks, [deck]: { drawPile, discardPile } } };
}

describe('CHOOSE_DEAL_SIZE: drawing', () => {
  it('CHOOSE_DEAL_SIZE: small draws the top small deal into pending buyOrPass', () => {
    const before = onOpportunity(withDrawPile(twoPlayerGame(), 'smallDeals', ['small-001', 'small-002']));
    const next = apply(before, SMALL);
    expect(next.pending).toEqual({ kind: 'buyOrPass', cardId: 'small-001' });
    expect(next.decks.smallDeals.drawPile).toEqual(['small-002']);
    expect(next.decks.bigDeals).toEqual(before.decks.bigDeals);
  });

  it('CHOOSE_DEAL_SIZE: big draws the top big deal into pending buyOrPass', () => {
    const before = onOpportunity(withDrawPile(twoPlayerGame(), 'bigDeals', ['big-004', 'big-001']));
    const next = apply(before, BIG);
    expect(next.pending).toEqual({ kind: 'buyOrPass', cardId: 'big-004' });
    expect(next.decks.bigDeals.drawPile).toEqual(['big-001']);
    expect(next.decks.smallDeals).toEqual(before.decks.smallDeals);
  });

  it('CHOOSE_DEAL_SIZE: leaves cash, position, and the other player unchanged', () => {
    const before = onOpportunity();
    const next = apply(before, SMALL);
    expect(next.players).toEqual(before.players);
  });

  it('CHOOSE_DEAL_SIZE: draws the last card in a pile without reshuffling', () => {
    const before = onOpportunity(withDrawPile(twoPlayerGame(), 'bigDeals', ['big-002'], ['big-001', 'big-003']));
    const next = apply(before, BIG);
    expect(next.pending).toEqual({ kind: 'buyOrPass', cardId: 'big-002' });
    expect(next.decks.bigDeals).toEqual({ drawPile: [], discardPile: ['big-001', 'big-003'] });
  });

  it('CHOOSE_DEAL_SIZE: reshuffles the discard pile when the draw pile is empty', () => {
    const before = onOpportunity(withDrawPile(twoPlayerGame(), 'bigDeals', [], ['big-001', 'big-002', 'big-003']));
    const next = apply(before, BIG);
    expect(next.pending.kind).toBe('buyOrPass');
    const drawn = (next.pending as { cardId: string }).cardId;
    expect([...next.decks.bigDeals.drawPile, drawn].sort()).toEqual(['big-001', 'big-002', 'big-003']);
    expect(next.decks.bigDeals.discardPile).toEqual([]);
  });

  it('CHOOSE_DEAL_SIZE: with no cards in either pile leaves pending none', () => {
    const before = onOpportunity(withDrawPile(twoPlayerGame(), 'bigDeals', []));
    const next = apply(before, BIG);
    expect(next.pending).toEqual({ kind: 'none' });
  });

  it('CHOOSE_DEAL_SIZE: throws on a card id that is not in the fixtures (programmer bug)', () => {
    const before = onOpportunity(withDrawPile(twoPlayerGame(), 'smallDeals', ['small-999']));
    expect(() => reduce(deepFreeze(before), SMALL)).toThrow(/small-999/);
  });
});

describe('CHOOSE_DEAL_SIZE: stock price', () => {
  const stock = CARDS_BY_ID.get('small-005');
  if (stock?.deck !== 'smallDeals' || stock.type !== 'stock' || stock.priceRange === undefined) {
    throw new Error('fixture small-005 must be a stock with a priceRange');
  }
  const { min, max } = stock.priceRange;

  it('CHOOSE_DEAL_SIZE: rolls a share price inside the stock card priceRange', () => {
    const before = onOpportunity(withDrawPile(twoPlayerGame(), 'smallDeals', ['small-005']));
    const next = apply(before, SMALL);
    expect(next.pending.kind).toBe('buyOrPass');
    const pending = next.pending as { cardId: string; sharePrice?: number };
    expect(pending.cardId).toBe('small-005');
    expect(pending.sharePrice).toBeGreaterThanOrEqual(min);
    expect(pending.sharePrice).toBeLessThanOrEqual(max);
    expect(Number.isInteger(pending.sharePrice)).toBe(true);
  });

  it('CHOOSE_DEAL_SIZE: the price range is inclusive at both ends', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 400; seed++) {
      const before = withGame(onOpportunity(withDrawPile(twoPlayerGame(), 'smallDeals', ['small-005'])), {
        rngState: seed,
      });
      const next = apply(before, SMALL);
      seen.add((next.pending as { sharePrice: number }).sharePrice);
    }
    expect(seen.has(min)).toBe(true);
    expect(seen.has(max)).toBe(true);
    expect(Math.min(...seen)).toBe(min);
    expect(Math.max(...seen)).toBe(max);
  });

  it('CHOOSE_DEAL_SIZE: advances rngState when rolling a share price', () => {
    const before = onOpportunity(withDrawPile(twoPlayerGame(), 'smallDeals', ['small-005']));
    const next = apply(before, SMALL);
    expect(next.game.rngState).not.toBe(before.game.rngState);
  });

  it('CHOOSE_DEAL_SIZE: does not roll a price or touch rngState for a non-stock deal', () => {
    const before = onOpportunity(withDrawPile(twoPlayerGame(), 'smallDeals', ['small-001']));
    const next = apply(before, SMALL);
    expect(next.pending).toEqual({ kind: 'buyOrPass', cardId: 'small-001' });
    expect(next.game.rngState).toBe(before.game.rngState);
  });

  it('CHOOSE_DEAL_SIZE: logs drewCard and sharePriceRolled events', () => {
    const before = onOpportunity(withDrawPile(twoPlayerGame(), 'smallDeals', ['small-005']));
    const next = apply(before, SMALL);
    const entry = next.game.log.at(-1);
    expect(entry?.action).toEqual(SMALL);
    expect(entry?.events[0]).toEqual({ kind: 'drewCard', deck: 'smallDeals', cardId: 'small-005' });
    expect(entry?.events[1]).toMatchObject({ kind: 'sharePriceRolled', cardId: 'small-005' });
    expect(entry?.events).toHaveLength(2);
  });
});

describe('CHOOSE_DEAL_SIZE: log and determinism', () => {
  it('CHOOSE_DEAL_SIZE: appends a log entry with the drewCard event', () => {
    const before = onOpportunity(withDrawPile(twoPlayerGame(), 'bigDeals', ['big-001']));
    const next = apply(before, BIG);
    expect(next.game.log).toHaveLength(2);
    expect(next.game.log[1]).toEqual({
      turnNumber: 0,
      action: BIG,
      events: [{ kind: 'drewCard', deck: 'bigDeals', cardId: 'big-001' }],
    });
  });

  it('CHOOSE_DEAL_SIZE: is deterministic for the same state and action', () => {
    const before = deepFreeze(onOpportunity(withDrawPile(twoPlayerGame(), 'smallDeals', ['small-005'])));
    expect(JSON.stringify(reduce(before, SMALL))).toBe(JSON.stringify(reduce(before, SMALL)));
  });
});

describe('CHOOSE_DEAL_SIZE: rejections', () => {
  it('CHOOSE_DEAL_SIZE: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(onOpportunity(), { type: 'CHOOSE_DEAL_SIZE', playerId: 'p2', size: 'small' })).toBe('NOT_YOUR_TURN');
  });

  const pendings: Pending[] = [
    { kind: 'none' },
    { kind: 'buyOrPass', cardId: 'small-001' },
    { kind: 'marketChoice', cardId: 'market-001' },
    { kind: 'payLifestyle', cardId: 'life-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('CHOOSE_DEAL_SIZE: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...onOpportunity(), pending }, SMALL)).toBe('INVALID_FOR_PENDING');
  });

  it('CHOOSE_DEAL_SIZE: in kids mode Opportunity never asks for a size, so it is rejected', () => {
    const kids = apply(aboutToRoll(twoPlayerGame({ mode: 'kids' }), 2, 1), { type: 'ROLL', playerId: 'p1' });
    expect(kids.pending.kind).toBe('buyOrPass');
    expect(reject(kids, SMALL)).toBe('INVALID_FOR_PENDING');
  });

  it.each(['lobby', 'finished'] as const)('CHOOSE_DEAL_SIZE: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(onOpportunity(), { phase }), SMALL)).toBe('GAME_NOT_PLAYING');
  });

  it('CHOOSE_DEAL_SIZE: a rejected action is not logged and leaves the deck untouched', () => {
    const before = deepFreeze({ ...onOpportunity(), pending: { kind: 'none' } as const });
    const result = reduce(before, SMALL);
    expect(result.ok).toBe(false);
    expect(before.game.log).toHaveLength(1);
  });
});
