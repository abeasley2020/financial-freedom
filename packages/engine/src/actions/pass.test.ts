import type { Action, GameState, Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { aboutToRoll, offered, twoPlayerGame, withGame, withPlayer, withZeroCashFlow } from '../test/fixtures';

const PASS: Action = { type: 'PASS', playerId: 'p1' };

describe('PASS: declining a deal', () => {
  it('PASS: sends the card to its deck discard pile and clears pending', () => {
    const before = offered(twoPlayerGame(), 'small-001');
    const next = apply(before, PASS);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.decks.smallDeals.drawPile).toEqual(before.decks.smallDeals.drawPile);
    expect(next.decks.smallDeals.discardPile).toEqual([...before.decks.smallDeals.discardPile, 'small-001']);
  });

  it('PASS: works the same for a big deal', () => {
    const before = offered(twoPlayerGame(), 'big-001');
    const next = apply(before, PASS);
    expect(next.decks.bigDeals.discardPile).toEqual([...before.decks.bigDeals.discardPile, 'big-001']);
    expect(next.decks.smallDeals).toEqual(before.decks.smallDeals);
  });

  it('PASS: declines a stock offer, discarding the card so it can be drawn again at a new price', () => {
    const before = offered(twoPlayerGame(), 'small-005', 20);
    const next = apply(before, PASS);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.decks.smallDeals.discardPile).toContain('small-005');
    expect(next.players[0]?.assets).toEqual([]);
  });

  it('PASS: a stock holder may pass instead of buying or selling, keeping the lot', () => {
    const holder = withPlayer(twoPlayerGame(), 'p1', {
      assets: [{ id: 'lot-1', cardId: 'small-005', type: 'stock', purchasePrice: 100, downPaid: 100, monthlyCashFlow: 0, shares: 10 }],
    });
    const next = apply(offered(holder, 'small-005', 35), PASS);
    expect(next.players[0]?.assets).toEqual(holder.players[0]?.assets);
    expect(next.players[0]?.cash).toBe(2_500 + 740);
  });

  it('PASS: changes no cash, assets, liabilities, or position', () => {
    const before = offered(twoPlayerGame(), 'small-001');
    const next = apply(before, PASS);
    expect(next.players).toEqual(before.players);
  });

  it('PASS: works in kids mode', () => {
    const kids = apply(aboutToRoll(twoPlayerGame({ mode: 'kids' }), 2, 1), { type: 'ROLL', playerId: 'p1' });
    expect(kids.pending.kind).toBe('buyOrPass');
    const cardId = (kids.pending as { cardId: string }).cardId;
    const next = apply(kids, PASS);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.decks.smallDeals.discardPile).toEqual([cardId]);
  });

  it('PASS: a passed card comes back once the discard pile is reshuffled', () => {
    const passed = apply(offered(twoPlayerGame(), 'small-001'), PASS);
    // Empty the draw pile so the next small-deal draw must reshuffle the discard pile.
    const drained: GameState = {
      ...passed,
      decks: { ...passed.decks, smallDeals: { drawPile: [], discardPile: ['small-001'] } },
    };
    const nextTurn = withGame(apply(drained, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const rolled = apply(aboutToRoll(nextTurn, 2, 1), { type: 'ROLL', playerId: 'p1' });
    const chosen = apply(rolled, { type: 'CHOOSE_DEAL_SIZE', playerId: 'p1', size: 'small' });
    expect(chosen.pending).toEqual({ kind: 'buyOrPass', cardId: 'small-001' });
  });
});

describe('PASS: log and determinism', () => {
  it('PASS: appends a log entry with a passed event carrying the deal facts the debrief needs (spec, Decision log)', () => {
    // Ada holds 400 + 700 Payday = 1,100 against a 5,000 down payment: not affordable.
    const next = apply(offered(twoPlayerGame(), 'small-001'), PASS);
    expect(next.game.log.at(-1)).toEqual({
      turnNumber: 0,
      action: PASS,
      events: [
        { kind: 'passed', cardId: 'small-001', principles: ['P2', 'P3', 'P5'], monthlyCashFlow: 160, downPayment: 5_000, affordable: false },
      ],
    });
  });

  it('PASS: records affordable true when cash on hand covers the down payment, including the exact amount', () => {
    const exact = apply(offered(withZeroCashFlow(withPlayer(twoPlayerGame(), 'p1', { cash: 5_000 }), 'p1'), 'small-001'), PASS);
    expect(exact.game.log.at(-1)?.events[0]).toMatchObject({ kind: 'passed', affordable: true });
    const short = apply(offered(withZeroCashFlow(withPlayer(twoPlayerGame(), 'p1', { cash: 4_999 }), 'p1'), 'small-001'), PASS);
    expect(short.game.log.at(-1)?.events[0]).toMatchObject({ kind: 'passed', affordable: false });
  });

  it('PASS: a passed stock records the card price per share as the down payment and its card cash flow', () => {
    const next = apply(offered(twoPlayerGame(), 'small-005', 20), PASS);
    expect(next.game.log.at(-1)?.events[0]).toEqual({
      kind: 'passed',
      cardId: 'small-005',
      principles: ['P8', 'P9'],
      monthlyCashFlow: 0,
      downPayment: 20,
      affordable: true,
    });
  });

  it('PASS: does not touch rngState', () => {
    const before = offered(twoPlayerGame(), 'small-001');
    expect(apply(before, PASS).game.rngState).toBe(before.game.rngState);
  });

  it('PASS: is deterministic', () => {
    const before = deepFreeze(offered(twoPlayerGame(), 'small-001'));
    expect(JSON.stringify(reduce(before, PASS))).toBe(JSON.stringify(reduce(before, PASS)));
  });

  it('PASS: the turn can end afterwards', () => {
    const passed = apply(offered(twoPlayerGame(), 'small-001'), PASS);
    expect(reduce(deepFreeze(passed), { type: 'END_TURN', playerId: 'p1' }).ok).toBe(true);
  });
});

describe('PASS: rejections', () => {
  it('PASS: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(offered(twoPlayerGame(), 'small-001'), { type: 'PASS', playerId: 'p2' })).toBe('NOT_YOUR_TURN');
  });

  const pendings: Pending[] = [
    { kind: 'none' },
    { kind: 'chooseDealSize' },
    { kind: 'marketChoice', cardId: 'market-001' },
    { kind: 'lifeChoice', cardId: 'life-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('PASS: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...twoPlayerGame(), pending }, PASS)).toBe('INVALID_FOR_PENDING');
  });

  it.each(['lobby', 'finished'] as const)('PASS: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(offered(twoPlayerGame(), 'small-001'), { phase }), PASS)).toBe('GAME_NOT_PLAYING');
  });

  it('PASS: throws on an unknown card id in the offer (programmer bug)', () => {
    const broken: GameState = { ...twoPlayerGame(), pending: { kind: 'buyOrPass', cardId: 'small-999' } };
    expect(() => reduce(deepFreeze(broken), PASS)).toThrow(/small-999/);
  });

  it('PASS: a rejected action is not logged', () => {
    const before = deepFreeze(withGame(offered(twoPlayerGame(), 'small-001'), { phase: 'finished' }));
    const logBefore = before.game.log.length;
    expect(reduce(before, PASS).ok).toBe(false);
    expect(before.game.log).toHaveLength(logBefore);
  });
});
