import type { Action, Asset, GameState, Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { passiveIncome, playerById } from '../selectors';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { offered, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

// Fixtures used here:
//   small-005 Birchwood Robotics: stock, 500 shares, price range 5-40, no dividend
//   small-007 Lakeshore Utilities: stock, 200 shares, price range 50-90, dividend 1/share
//   small-001 Duplex in Decatur: rental (not a stock)
// Ada the Teacher (p1) starts with 400 cash. `holding` gives her 1,000 and
// walks a real ROLL, whose Payday adds 700 plus any dividends, so cash
// assertions compare against the state before the sale.

const sell = (assetId: string, shares?: number, playerId = 'p1'): Action =>
  shares === undefined ? { type: 'SELL_ASSET', playerId, assetId } : { type: 'SELL_ASSET', playerId, assetId, shares };
const p1 = (state: GameState) => playerById(state, 'p1');

const lot = (id: string, cardId: string, shares: number, pricePaid: number, dividend = 0): Asset => ({
  id,
  cardId,
  type: 'stock',
  purchasePrice: shares * pricePaid,
  downPaid: shares * pricePaid,
  monthlyCashFlow: shares * dividend,
  shares,
});

/** p1 holds `assets` and is facing `cardId` drawn again at `sharePrice`. */
function holding(
  assets: readonly Asset[],
  cardId: string,
  sharePrice: number | undefined,
  state = twoPlayerGame(),
): GameState {
  return offered(withPlayer(state, 'p1', { assets: [...assets], cash: 1_000 }), cardId, sharePrice);
}

describe('SELL_ASSET: selling shares when the stock is drawn again', () => {
  it('SELL_ASSET: sells every share of the lot at the new price when shares is omitted', () => {
    const before = holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30);
    expect(before.pending).toEqual({ kind: 'buyOrPass', cardId: 'small-005', sharePrice: 30 });
    const next = apply(before, sell('lot-a'));
    expect(p1(next).cash).toBe(p1(before).cash + 300);
    expect(p1(next).assets).toEqual([]);
    expect(next.pending).toEqual({ kind: 'none' });
  });

  it('SELL_ASSET: sells a named number of shares and shrinks the lot in proportion', () => {
    const before = holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30);
    const next = apply(before, sell('lot-a', 4));
    expect(p1(next).cash).toBe(p1(before).cash + 120);
    expect(p1(next).assets).toEqual([
      { id: 'lot-a', cardId: 'small-005', type: 'stock', purchasePrice: 120, downPaid: 120, monthlyCashFlow: 0, shares: 6 },
    ]);
  });

  it('SELL_ASSET: a partial sale floors purchasePrice and downPaid when they do not divide evenly', () => {
    // 20 shares carrying a 250 cost basis (as after a 2-for-1 split of 10 shares bought at 25).
    const split: Asset = { ...lot('lot-a', 'small-005', 20, 0), purchasePrice: 250, downPaid: 250 };
    const before = holding([split], 'small-005', 10);
    const next = apply(before, sell('lot-a', 7));
    expect(p1(next).cash).toBe(p1(before).cash + 70);
    expect(p1(next).assets[0]).toMatchObject({ shares: 13, purchasePrice: 162, downPaid: 162 });
  });

  it('SELL_ASSET: a dividend lot keeps floor(remaining shares × dividendPerShare) as monthly cash flow', () => {
    const before = holding([lot('lot-d', 'small-007', 25, 60, 1)], 'small-007', 80);
    expect(passiveIncome(p1(before))).toBe(25);
    const next = apply(before, sell('lot-d', 10));
    expect(p1(next).cash).toBe(p1(before).cash + 800);
    expect(p1(next).assets[0]).toMatchObject({ shares: 15, monthlyCashFlow: 15, purchasePrice: 900 });
    expect(passiveIncome(p1(next))).toBe(15);
  });

  it('SELL_ASSET: selling the whole lot removes its passive income', () => {
    const next = apply(holding([lot('lot-d', 'small-007', 25, 60, 1)], 'small-007', 80), sell('lot-d', 25));
    expect(p1(next).assets).toEqual([]);
    expect(passiveIncome(p1(next))).toBe(0);
  });

  it('SELL_ASSET: sells from the named lot when the player holds two lots of the same stock', () => {
    const a = lot('lot-a', 'small-005', 10, 20);
    const b = lot('lot-b', 'small-005', 5, 30);
    const before = holding([a, b], 'small-005', 40);
    const next = apply(before, sell('lot-b'));
    expect(p1(next).assets).toEqual([a]);
    expect(p1(next).cash).toBe(p1(before).cash + 200);
  });

  it('SELL_ASSET: sells at a loss when the new price is lower', () => {
    const before = holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 5);
    const next = apply(before, sell('lot-a'));
    expect(p1(next).cash).toBe(p1(before).cash + 50);
  });

  it('SELL_ASSET: accepts shares equal to the lot and rejects one more with INVALID_SHARES', () => {
    const before = holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30);
    expect(p1(apply(before, sell('lot-a', 10))).assets).toEqual([]);
    expect(reject(before, sell('lot-a', 11))).toBe('INVALID_SHARES');
  });

  it('SELL_ASSET: sends the stock card to the discard pile so it can be drawn again', () => {
    const before = holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30);
    const next = apply(before, sell('lot-a'));
    expect(next.decks.smallDeals.drawPile).toEqual(before.decks.smallDeals.drawPile);
    expect(next.decks.smallDeals.discardPile).toEqual([...before.decks.smallDeals.discardPile, 'small-005']);
  });

  it('SELL_ASSET: a real bought lot can be sold on the next draw', () => {
    const bought = apply(offered(withPlayer(twoPlayerGame(), 'p1', { cash: 1_000 }), 'small-005', 20), {
      type: 'BUY',
      playerId: 'p1',
      shares: 10,
    });
    const lotId = p1(bought).assets[0]?.id;
    if (lotId === undefined) throw new Error('BUY must create a lot');
    const nextTurn = withGame(apply(bought, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const next = apply(offered(nextTurn, 'small-005', 35), sell(lotId));
    // Two turns, two Paydays of 700 (the lot pays no dividend).
    expect(p1(next).cash).toBe(1_000 + 700 - 200 + 700 + 350);
    expect(p1(next).assets).toEqual([]);
  });

  it('SELL_ASSET: leaves liabilities, position, and the other player unchanged', () => {
    const before = holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30);
    const next = apply(before, sell('lot-a'));
    expect(p1(next).liabilities).toEqual(p1(before).liabilities);
    expect(p1(next).position).toBe(p1(before).position);
    expect(next.players[1]).toEqual(before.players[1]);
  });
});

describe('SELL_ASSET: which assets', () => {
  it('SELL_ASSET: rejected with INVALID_ASSET for a lot of a different stock', () => {
    const before = holding([lot('lot-d', 'small-007', 5, 60, 1)], 'small-005', 30);
    expect(reject(before, sell('lot-d'))).toBe('INVALID_ASSET');
  });

  it('SELL_ASSET: rejected with INVALID_ASSET for a non-stock asset (only Market cards sell those)', () => {
    const duplex: Asset = { id: 'dup', cardId: 'small-001', type: 'rental', purchasePrice: 50_000, downPaid: 5_000, monthlyCashFlow: 160 };
    const before = holding([duplex, lot('lot-a', 'small-005', 10, 20)], 'small-005', 30);
    expect(reject(before, sell('dup'))).toBe('INVALID_ASSET');
  });

  it('SELL_ASSET: rejected with INVALID_ASSET for an unknown asset id', () => {
    expect(reject(holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30), sell('lot-z'))).toBe('INVALID_ASSET');
  });

  it("SELL_ASSET: rejected with INVALID_ASSET for another player's lot", () => {
    const base = withPlayer(twoPlayerGame(), 'p2', { assets: [lot('p2-lot', 'small-005', 10, 20)] });
    expect(reject(holding([], 'small-005', 30, base), sell('p2-lot'))).toBe('INVALID_ASSET');
  });

  it('SELL_ASSET: rejected with INVALID_FOR_PENDING when the offered card is not a stock, even for a holder', () => {
    const before = holding([lot('lot-a', 'small-005', 10, 20)], 'small-001', undefined);
    expect(before.pending).toEqual({ kind: 'buyOrPass', cardId: 'small-001' });
    expect(reject(before, sell('lot-a'))).toBe('INVALID_FOR_PENDING');
  });

  it('SELL_ASSET: is never legal in kids mode, which has no stocks', () => {
    const kids = twoPlayerGame({ mode: 'kids' });
    expect(kids.decks.smallDeals.drawPile).not.toContain('small-005');
    const before = offered(withPlayer(kids, 'p1', { assets: [lot('lot-a', 'small-005', 10, 20)] }), 'small-003');
    expect(before.pending.kind).toBe('buyOrPass');
    expect(reject(before, sell('lot-a'))).toBe('INVALID_FOR_PENDING');
  });
});

describe('SELL_ASSET: log and determinism', () => {
  it('SELL_ASSET: appends a log entry with cashChanged and sold events', () => {
    const next = apply(holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30), sell('lot-a', 4));
    expect(next.game.log.at(-1)).toEqual({
      turnNumber: 0,
      action: sell('lot-a', 4),
      events: [
        { kind: 'cashChanged', delta: 120, reason: 'sell' },
        { kind: 'sold', assetId: 'lot-a', cardId: 'small-005', proceeds: 120, shares: 4, remainingShares: 6, principles: ['P8', 'P9'] },
      ],
    });
  });

  it('SELL_ASSET: logs remainingShares 0 when the lot is sold out', () => {
    const next = apply(holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30), sell('lot-a'));
    expect(next.game.log.at(-1)?.events[1]).toMatchObject({ kind: 'sold', shares: 10, remainingShares: 0 });
  });

  it('SELL_ASSET: is deterministic', () => {
    const before = deepFreeze(holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30));
    expect(JSON.stringify(reduce(before, sell('lot-a')))).toBe(JSON.stringify(reduce(before, sell('lot-a'))));
  });

  it('SELL_ASSET: does not touch rngState', () => {
    const before = holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30);
    expect(apply(before, sell('lot-a')).game.rngState).toBe(before.game.rngState);
  });

  it('SELL_ASSET: the turn can end afterwards', () => {
    const sold = apply(holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30), sell('lot-a'));
    expect(reduce(deepFreeze(sold), { type: 'END_TURN', playerId: 'p1' }).ok).toBe(true);
  });
});

describe('SELL_ASSET: rejections', () => {
  it('SELL_ASSET: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    const before = holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30);
    expect(reject(before, sell('lot-a', undefined, 'p2'))).toBe('NOT_YOUR_TURN');
  });

  const pendings: Pending[] = [
    { kind: 'none' },
    { kind: 'chooseDealSize' },
    { kind: 'marketChoice', cardId: 'market-001' },
    { kind: 'lifeChoice', cardId: 'life-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('SELL_ASSET: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    const base = withPlayer(twoPlayerGame(), 'p1', { assets: [lot('lot-a', 'small-005', 10, 20)] });
    expect(reject({ ...base, pending }, sell('lot-a'))).toBe('INVALID_FOR_PENDING');
  });

  it.each(['lobby', 'finished'] as const)('SELL_ASSET: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    const before = holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30);
    expect(reject(withGame(before, { phase }), sell('lot-a'))).toBe('GAME_NOT_PLAYING');
  });

  it('SELL_ASSET: throws when a stock offer carries no share price (programmer bug)', () => {
    const before = holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30);
    const broken: GameState = { ...before, pending: { kind: 'buyOrPass', cardId: 'small-005' } };
    expect(() => reduce(deepFreeze(broken), sell('lot-a'))).toThrow(/sharePrice/);
  });

  it('SELL_ASSET: a rejected sale is not logged', () => {
    const before = deepFreeze(holding([lot('lot-a', 'small-005', 10, 20)], 'small-005', 30));
    const logBefore = before.game.log.length;
    expect(reduce(before, sell('lot-a', 11)).ok).toBe(false);
    expect(before.game.log).toHaveLength(logBefore);
  });
});
