import { CARDS_BY_ID, type Action, type GameState, type Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { debtPayments, monthlyCashFlow, passiveIncome, playerById } from '../selectors';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { offered, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

// Fixtures used here:
//   small-001 Duplex in Decatur: rental, price 50,000, down 5,000, mortgage 45,000, +160/mo
//   small-003 Lawn Care Trailer: business, price 3,000, down 3,000, mortgage 0, +150/mo
//   big-001   Laundromat: business, price 120,000, down 30,000, mortgage 90,000, +1,400/mo
//   small-005 Birchwood Robotics: stock, 500 shares, price range 5-40, no dividend
//   small-007 Lakeshore Utilities: stock, 200 shares, price range 50-90, dividend 1/share
// Ada the Teacher starts with 400 cash and 700/mo cash flow.

const BUY: Action = { type: 'BUY', playerId: 'p1' };
const buyShares = (shares: number): Action => ({ type: 'BUY', playerId: 'p1', shares });
const p1 = (state: GameState) => playerById(state, 'p1');
const withCash = (cash: number) => withPlayer(twoPlayerGame(), 'p1', { cash });

describe('BUY: a financed deal', () => {
  it('BUY: pays the down payment and adds the asset with the card numbers', () => {
    const next = apply(offered(withCash(10_000), 'small-001'), BUY);
    expect(p1(next).cash).toBe(5_000);
    expect(p1(next).assets).toEqual([
      {
        id: expect.any(String) as string,
        cardId: 'small-001',
        type: 'rental',
        purchasePrice: 50_000,
        downPaid: 5_000,
        monthlyCashFlow: 160,
      },
    ]);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(passiveIncome(p1(next))).toBe(160);
    expect(monthlyCashFlow(p1(next))).toBe(700 + 160);
  });

  it('BUY: adds one mortgage liability linked to the asset, with no monthly payment', () => {
    const before = offered(withCash(10_000), 'small-001');
    const next = apply(before, BUY);
    const asset = p1(next).assets[0];
    expect(p1(next).liabilities).toEqual([
      ...p1(before).liabilities,
      { id: expect.any(String) as string, kind: 'mortgage', principal: 45_000, monthlyPayment: 0, assetId: asset?.id },
    ]);
    expect(debtPayments(p1(next))).toBe(debtPayments(p1(before)));
  });

  it('BUY: adds no mortgage when the card is paid in full', () => {
    const before = offered(withCash(3_000), 'small-003');
    const next = apply(before, BUY);
    expect(p1(next).cash).toBe(0);
    expect(p1(next).liabilities).toEqual(p1(before).liabilities);
    expect(p1(next).assets[0]).toMatchObject({ cardId: 'small-003', purchasePrice: 3_000, downPaid: 3_000 });
  });

  it('BUY: works the same for a big deal', () => {
    const next = apply(offered(withCash(40_000), 'big-001'), BUY);
    expect(p1(next).cash).toBe(10_000);
    expect(p1(next).assets[0]).toMatchObject({ cardId: 'big-001', type: 'business', purchasePrice: 120_000, monthlyCashFlow: 1_400 });
    expect(p1(next).liabilities.at(-1)).toMatchObject({ kind: 'mortgage', principal: 90_000, monthlyPayment: 0 });
  });

  it('BUY: keeps the card as the asset, in neither pile', () => {
    const next = apply(offered(withCash(10_000), 'small-001'), BUY);
    expect(next.decks.smallDeals.drawPile).not.toContain('small-001');
    expect(next.decks.smallDeals.discardPile).not.toContain('small-001');
  });

  it('BUY: accepts when cash exactly equals the down payment, leaving zero cash', () => {
    const next = apply(offered(withCash(5_000), 'small-001'), BUY);
    expect(p1(next).cash).toBe(0);
  });

  it('BUY: rejected with INSUFFICIENT_CASH one dollar short, and the offer stays pending', () => {
    const before = offered(withCash(4_999), 'small-001');
    expect(reject(before, BUY)).toBe('INSUFFICIENT_CASH');
    expect(before.pending).toEqual({ kind: 'buyOrPass', cardId: 'small-001' });
  });

  it('BUY: rejected with INVALID_SHARES when shares are named for a non-stock deal', () => {
    expect(reject(offered(withCash(10_000), 'small-001'), buyShares(10))).toBe('INVALID_SHARES');
  });

  it('BUY: does not touch the other player', () => {
    const before = offered(withCash(10_000), 'small-001');
    const next = apply(before, BUY);
    expect(next.players[1]).toEqual(before.players[1]);
  });
});

describe('BUY: a stock', () => {
  it('BUY: costs shares × the rolled share price and creates a lot with no liability', () => {
    const before = offered(withCash(400), 'small-005', 20);
    const next = apply(before, buyShares(10));
    expect(p1(next).cash).toBe(200);
    expect(p1(next).assets).toEqual([
      {
        id: expect.any(String) as string,
        cardId: 'small-005',
        type: 'stock',
        purchasePrice: 200,
        downPaid: 200,
        monthlyCashFlow: 0,
        shares: 10,
      },
    ]);
    expect(p1(next).liabilities).toEqual(p1(before).liabilities);
    expect(next.pending).toEqual({ kind: 'none' });
  });

  it('BUY: a lot earns floor(shares × dividendPerShare) per month', () => {
    const card = CARDS_BY_ID.get('small-007');
    if (card?.deck !== 'smallDeals' || card.type !== 'stock') throw new Error('fixture small-007 must be a stock');
    expect(card.dividendPerShare).toBe(1);
    const next = apply(offered(withCash(5_000), 'small-007', 60), buyShares(25));
    expect(p1(next).cash).toBe(5_000 - 1_500);
    expect(p1(next).assets[0]).toMatchObject({ cardId: 'small-007', shares: 25, monthlyCashFlow: 25 });
    expect(passiveIncome(p1(next))).toBe(25);
  });

  it('BUY: a stock with no dividend earns nothing', () => {
    const next = apply(offered(withCash(400), 'small-005', 20), buyShares(10));
    expect(p1(next).assets[0]?.monthlyCashFlow).toBe(0);
  });

  it('BUY: accepts at exactly shares × price and rejects one dollar short', () => {
    expect(p1(apply(offered(withCash(200), 'small-005', 20), buyShares(10))).cash).toBe(0);
    expect(reject(offered(withCash(199), 'small-005', 20), buyShares(10))).toBe('INSUFFICIENT_CASH');
  });

  it('BUY: rejected with INVALID_SHARES when a stock purchase names no shares', () => {
    expect(reject(offered(withCash(400), 'small-005', 20), BUY)).toBe('INVALID_SHARES');
  });

  it('BUY: accepts all of sharesAvailable and rejects one more', () => {
    expect(p1(apply(offered(withCash(10_000), 'small-005', 20), buyShares(500))).assets[0]?.shares).toBe(500);
    expect(reject(offered(withCash(20_000), 'small-005', 20), buyShares(501))).toBe('INVALID_SHARES');
  });

  it('BUY: returns the stock card to the discard pile so it can be drawn again', () => {
    const next = apply(offered(withCash(400), 'small-005', 20), buyShares(1));
    expect(next.decks.smallDeals.drawPile).not.toContain('small-005');
    expect(next.decks.smallDeals.discardPile).toContain('small-005');
  });

  it('BUY: buying the same stock again creates a separate lot', () => {
    const first = apply(offered(withCash(1_000), 'small-005', 20), buyShares(10));
    // End the turn, then hand it straight back to p1 so the log stays append-only.
    const nextTurn = withGame(apply(first, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const second = apply(offered(nextTurn, 'small-005', 30), buyShares(5));
    const lots = p1(second).assets;
    expect(lots).toHaveLength(2);
    expect(lots.map((a) => a.cardId)).toEqual(['small-005', 'small-005']);
    expect(lots[0]?.id).not.toBe(lots[1]?.id);
    expect(lots[1]).toMatchObject({ shares: 5, purchasePrice: 150 });
    expect(p1(second).cash).toBe(1_000 - 200 - 150);
  });

  it('BUY: throws when a stock offer carries no share price (programmer bug)', () => {
    const before = offered(withCash(400), 'small-005');
    const broken: GameState = { ...before, pending: { kind: 'buyOrPass', cardId: 'small-005' } };
    expect(() => reduce(deepFreeze(broken), buyShares(1))).toThrow(/sharePrice/);
  });
});

describe('BUY: log and determinism', () => {
  it('BUY: appends a log entry with cashChanged and bought events', () => {
    const next = apply(offered(withCash(10_000), 'small-001'), BUY);
    const entry = next.game.log.at(-1);
    const assetId = p1(next).assets[0]?.id;
    expect(entry).toEqual({
      turnNumber: 0,
      action: BUY,
      events: [
        { kind: 'cashChanged', delta: -5_000, reason: 'buy' },
        { kind: 'bought', assetId, cardId: 'small-001', cost: 5_000 },
      ],
    });
  });

  it('BUY: logs the share count for a stock lot', () => {
    const next = apply(offered(withCash(400), 'small-005', 20), buyShares(10));
    expect(next.game.log.at(-1)?.events[1]).toMatchObject({ kind: 'bought', cardId: 'small-005', cost: 200, shares: 10 });
  });

  it('BUY: is deterministic, including the asset id', () => {
    const before = deepFreeze(offered(withCash(10_000), 'small-001'));
    expect(JSON.stringify(reduce(before, BUY))).toBe(JSON.stringify(reduce(before, BUY)));
  });

  it('BUY: does not touch rngState', () => {
    const before = offered(withCash(10_000), 'small-001');
    expect(apply(before, BUY).game.rngState).toBe(before.game.rngState);
  });

  it('BUY: the turn can end afterwards', () => {
    const bought = apply(offered(withCash(10_000), 'small-001'), BUY);
    expect(reduce(deepFreeze(bought), { type: 'END_TURN', playerId: 'p1' }).ok).toBe(true);
  });
});

describe('BUY: rejections', () => {
  it('BUY: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(offered(withCash(10_000), 'small-001'), { type: 'BUY', playerId: 'p2' })).toBe('NOT_YOUR_TURN');
  });

  const pendings: Pending[] = [
    { kind: 'none' },
    { kind: 'chooseDealSize' },
    { kind: 'marketChoice', cardId: 'market-001' },
    { kind: 'payLifestyle', cardId: 'life-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('BUY: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...withCash(10_000), pending }, BUY)).toBe('INVALID_FOR_PENDING');
  });

  it.each(['lobby', 'finished'] as const)('BUY: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(offered(withCash(10_000), 'small-001'), { phase }), BUY)).toBe('GAME_NOT_PLAYING');
  });

  it('BUY: throws on an unknown card id in the offer (programmer bug)', () => {
    const broken: GameState = { ...twoPlayerGame(), pending: { kind: 'buyOrPass', cardId: 'small-999' } };
    expect(() => reduce(deepFreeze(broken), BUY)).toThrow(/small-999/);
  });

  it('BUY: a rejected purchase is not logged', () => {
    const before = deepFreeze(offered(withCash(4_999), 'small-001'));
    const logBefore = before.game.log.length;
    expect(reduce(before, BUY).ok).toBe(false);
    expect(before.game.log).toHaveLength(logBefore);
  });
});
