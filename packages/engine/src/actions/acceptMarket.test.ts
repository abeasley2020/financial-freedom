import type { Action, Asset, GameState, Liability, Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { passiveIncome, playerById } from '../selectors';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { drawn, offered, twoPlayerGame, withGame, withPlayer, withZeroCashFlow } from '../test/fixtures';

// Market fixtures:
//   market-001 Eager Buyer:      offerBuyout 200% of purchase price, rentals
//   market-002 Tenant Moves Out: changeCashFlow -100, rentals
//   market-003 Stock Split:      splitShares ×2, stocks
//   market-004 Highway:          forceSale 150% of purchase price, land
// Deal fixtures: small-001 Duplex (rental 50,000, mortgage 45,000, +160),
//   small-002 Condo (rental 45,000, mortgage 41,000, +120), big-003 Forty Acres
//   (land 60,000, mortgage 48,000, -50), small-005 Birchwood (stock).
// Ada the Teacher (p1) starts with 400 cash. `facing` pins her salary to her
// totalExpenses so the Payday that opens the turn adds $0 and the sale math
// below reads straight off the card.

const ACCEPT: Action = { type: 'ACCEPT_MARKET', playerId: 'p1' };
const acceptAsset = (assetId: string): Action => ({ type: 'ACCEPT_MARKET', playerId: 'p1', assetId });
const p1 = (state: GameState) => playerById(state, 'p1');

const duplex: Asset = { id: 'dup', cardId: 'small-001', type: 'rental', purchasePrice: 50_000, downPaid: 5_000, monthlyCashFlow: 160 };
const duplexMortgage: Liability = { id: 'dup-mortgage', kind: 'mortgage', principal: 45_000, monthlyPayment: 0, assetId: 'dup' };
const condo: Asset = { id: 'con', cardId: 'small-002', type: 'rental', purchasePrice: 45_000, downPaid: 4_000, monthlyCashFlow: 120 };
const condoMortgage: Liability = { id: 'con-mortgage', kind: 'mortgage', principal: 41_000, monthlyPayment: 0, assetId: 'con' };
const acres: Asset = { id: 'acr', cardId: 'big-003', type: 'land', purchasePrice: 60_000, downPaid: 12_000, monthlyCashFlow: -50 };
const acresMortgage: Liability = { id: 'acr-mortgage', kind: 'mortgage', principal: 48_000, monthlyPayment: 0, assetId: 'acr' };
const robotics: Asset = { id: 'rob', cardId: 'small-005', type: 'stock', purchasePrice: 200, downPaid: 200, monthlyCashFlow: 0, shares: 10 };
const utilities: Asset = { id: 'uti', cardId: 'small-007', type: 'stock', purchasePrice: 1_500, downPaid: 1_500, monthlyCashFlow: 25, shares: 25 };

/** p1 holds `assets` (plus the matching mortgages), has a Payday of $0, and has just drawn `cardId`. */
function facing(cardId: string, assets: readonly Asset[], mortgages: readonly Liability[] = [], state = twoPlayerGame()): GameState {
  const base = p1(state);
  return drawn(
    withZeroCashFlow(withPlayer(state, 'p1', { assets: [...assets], liabilities: [...base.liabilities, ...mortgages] }), 'p1'),
    cardId,
  );
}

describe('ACCEPT_MARKET: a buyout offer', () => {
  it('ACCEPT_MARKET: sells the only qualifying asset at the offered percent, pays its mortgage, and keeps the rest', () => {
    const before = facing('market-001', [duplex], [duplexMortgage]);
    expect(before.pending).toEqual({ kind: 'marketChoice', cardId: 'market-001' });
    const next = apply(before, ACCEPT);
    // 200% of 50,000 = 100,000; minus the 45,000 mortgage = 55,000 kept.
    expect(p1(next).cash).toBe(400 + 55_000);
    expect(p1(next).assets).toEqual([]);
    expect(p1(next).liabilities.find((l) => l.id === 'dup-mortgage')).toBeUndefined();
    expect(p1(next).liabilities).toHaveLength(3);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(passiveIncome(p1(next))).toBe(0);
  });

  it('ACCEPT_MARKET: returns the sold deal card to its deck discard pile and the market card to the market discard pile', () => {
    const before = facing('market-001', [duplex], [duplexMortgage]);
    const next = apply(before, ACCEPT);
    expect(next.decks.smallDeals.discardPile).toEqual([...before.decks.smallDeals.discardPile, 'small-001']);
    expect(next.decks.market.drawPile).toEqual(before.decks.market.drawPile);
    expect(next.decks.market.discardPile).toEqual([...before.decks.market.discardPile, 'market-001']);
  });

  it('ACCEPT_MARKET: an unmortgaged asset pays the whole price to the player', () => {
    const paidOff: Asset = { ...duplex, downPaid: 50_000 };
    const next = apply(facing('market-001', [paidOff]), ACCEPT);
    expect(p1(next).cash).toBe(400 + 100_000);
  });

  it('ACCEPT_MARKET: the mortgage is retired even when the proceeds fall short of it; the player keeps nothing', () => {
    // A 50% offer on the Duplex: 25,000 gross against a 45,000 mortgage.
    const underwater: Liability = { ...duplexMortgage, principal: 60_000 };
    const before = facing('market-001', [duplex], [underwater]);
    // market-001 pays 200% = 100,000, so make the mortgage larger than that instead.
    const bigger: Liability = { ...duplexMortgage, principal: 120_000 };
    const next = apply(facing('market-001', [duplex], [bigger]), ACCEPT);
    expect(p1(next).cash).toBe(400);
    expect(p1(next).assets).toEqual([]);
    expect(p1(next).liabilities.some((l) => l.kind === 'mortgage')).toBe(false);
    expect(before.pending.kind).toBe('marketChoice');
  });

  it('ACCEPT_MARKET: with two qualifying assets, assetId picks the one to sell', () => {
    const before = facing('market-001', [duplex, condo], [duplexMortgage, condoMortgage]);
    const next = apply(before, acceptAsset('con'));
    // 200% of 45,000 = 90,000; minus 41,000 = 49,000.
    expect(p1(next).cash).toBe(400 + 49_000);
    expect(p1(next).assets).toEqual([duplex]);
    expect(p1(next).liabilities.map((l) => l.id)).toContain('dup-mortgage');
    expect(p1(next).liabilities.map((l) => l.id)).not.toContain('con-mortgage');
  });

  it('ACCEPT_MARKET: rejected with INVALID_ASSET when two assets qualify and none is named', () => {
    const before = facing('market-001', [duplex, condo], [duplexMortgage, condoMortgage]);
    expect(reject(before, ACCEPT)).toBe('INVALID_ASSET');
  });

  it('ACCEPT_MARKET: rejected with INVALID_ASSET when assetId names an asset the card does not apply to', () => {
    const before = facing('market-001', [duplex, robotics], [duplexMortgage]);
    expect(reject(before, acceptAsset('rob'))).toBe('INVALID_ASSET');
  });

  it('ACCEPT_MARKET: rejected with INVALID_ASSET for an unknown assetId', () => {
    expect(reject(facing('market-001', [duplex], [duplexMortgage]), acceptAsset('nope'))).toBe('INVALID_ASSET');
  });

  it('ACCEPT_MARKET: naming the only qualifying asset is allowed', () => {
    const next = apply(facing('market-001', [duplex], [duplexMortgage]), acceptAsset('dup'));
    expect(p1(next).assets).toEqual([]);
  });

  it('ACCEPT_MARKET: with no qualifying asset the card is simply discarded', () => {
    const before = facing('market-001', [robotics]);
    const next = apply(before, ACCEPT);
    expect(next.players).toEqual(before.players);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.decks.market.discardPile).toEqual([...before.decks.market.discardPile, 'market-001']);
    expect(next.game.log.at(-1)?.events).toEqual([]);
  });

  it('ACCEPT_MARKET: a deal bought through BUY can be sold to a buyer on a later turn', () => {
    const bought = apply(offered(withPlayer(twoPlayerGame(), 'p1', { cash: 10_000 }), 'small-001'), { type: 'BUY', playerId: 'p1' });
    const nextTurn = withGame(apply(bought, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const next = apply(drawn(nextTurn, 'market-001'), ACCEPT);
    // 10,000 + 700 Payday - 5,000 down, then a second Payday of 700 + 160 rent, then the sale.
    expect(p1(next).cash).toBe(10_700 - 5_000 + 860 + 55_000);
    expect(p1(next).assets).toEqual([]);
    expect(p1(next).liabilities.some((l) => l.kind === 'mortgage')).toBe(false);
    expect(next.decks.smallDeals.discardPile).toContain('small-001');
  });
});

describe('ACCEPT_MARKET: cash flow changes', () => {
  it('ACCEPT_MARKET: changeCashFlow moves every qualifying asset by delta and leaves others alone', () => {
    const before = facing('market-002', [duplex, condo, robotics], [duplexMortgage, condoMortgage]);
    expect(passiveIncome(p1(before))).toBe(280);
    const next = apply(before, ACCEPT);
    expect(p1(next).assets).toEqual([
      { ...duplex, monthlyCashFlow: 60 },
      { ...condo, monthlyCashFlow: 20 },
      robotics,
    ]);
    expect(passiveIncome(p1(next))).toBe(80);
    expect(p1(next).cash).toBe(400);
    expect(p1(next).liabilities).toEqual(p1(before).liabilities);
  });

  it('ACCEPT_MARKET: changeCashFlow can take an asset negative', () => {
    const next = apply(facing('market-002', [{ ...duplex, monthlyCashFlow: 40 }]), ACCEPT);
    expect(p1(next).assets[0]?.monthlyCashFlow).toBe(-60);
  });

  it('ACCEPT_MARKET: changeCashFlow with no qualifying asset changes nothing', () => {
    const before = facing('market-002', [robotics]);
    const next = apply(before, ACCEPT);
    expect(next.players).toEqual(before.players);
  });
});

describe('ACCEPT_MARKET: stock splits', () => {
  it('ACCEPT_MARKET: splitShares multiplies the shares of every stock lot and keeps purchasePrice and cash flow', () => {
    const before = facing('market-003', [robotics, utilities, duplex], [duplexMortgage]);
    const next = apply(before, ACCEPT);
    expect(p1(next).assets).toEqual([{ ...robotics, shares: 20 }, { ...utilities, shares: 50 }, duplex]);
    expect(passiveIncome(p1(next))).toBe(passiveIncome(p1(before)));
    expect(p1(next).cash).toBe(400);
  });

  it('ACCEPT_MARKET: split shares can be sold later at the new count', () => {
    const split = apply(facing('market-003', [robotics]), ACCEPT);
    const nextTurn = withGame(apply(split, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const sold = apply(offered(nextTurn, 'small-005', 10), { type: 'SELL_ASSET', playerId: 'p1', assetId: 'rob' });
    expect(p1(sold).cash).toBe(400 + 200);
    expect(p1(sold).assets).toEqual([]);
  });
});

describe('ACCEPT_MARKET: forced sales', () => {
  it('ACCEPT_MARKET: forceSale sells every qualifying asset at the percent, paying each mortgage first', () => {
    const before = facing('market-004', [acres, duplex], [acresMortgage, duplexMortgage]);
    const next = apply(before, ACCEPT);
    // 150% of 60,000 = 90,000; minus 48,000 mortgage = 42,000.
    expect(p1(next).cash).toBe(400 + 42_000);
    expect(p1(next).assets).toEqual([duplex]);
    expect(p1(next).liabilities.map((l) => l.id)).toEqual(['p1-student-0', 'p1-car-1', 'p1-credit-2', 'dup-mortgage']);
    expect(next.decks.bigDeals.discardPile).toEqual([...before.decks.bigDeals.discardPile, 'big-003']);
  });

  it('ACCEPT_MARKET: forceSale with two qualifying assets sells both without naming either', () => {
    const second: Asset = { ...acres, id: 'acr2', purchasePrice: 20_000, downPaid: 20_000 };
    const next = apply(facing('market-004', [acres, second], [acresMortgage]), ACCEPT);
    expect(p1(next).assets).toEqual([]);
    expect(p1(next).cash).toBe(400 + 42_000 + 30_000);
  });
});

describe('ACCEPT_MARKET: log and determinism', () => {
  it('ACCEPT_MARKET: a buyout logs sold and cashChanged events', () => {
    const next = apply(facing('market-001', [duplex], [duplexMortgage]), ACCEPT);
    expect(next.game.log.at(-1)).toEqual({
      turnNumber: 0,
      action: ACCEPT,
      events: [
        { kind: 'sold', assetId: 'dup', cardId: 'small-001', proceeds: 100_000, mortgagePaid: 45_000, principles: ['P2', 'P3', 'P5'] },
        { kind: 'cashChanged', delta: 55_000, reason: 'sell' },
      ],
    });
  });

  it('ACCEPT_MARKET: a sale that pays only the mortgage logs sold without cashChanged', () => {
    const bigger: Liability = { ...duplexMortgage, principal: 120_000 };
    const next = apply(facing('market-001', [duplex], [bigger]), ACCEPT);
    expect(next.game.log.at(-1)?.events).toEqual([
      { kind: 'sold', assetId: 'dup', cardId: 'small-001', proceeds: 100_000, mortgagePaid: 100_000, principles: ['P2', 'P3', 'P5'] },
    ]);
  });

  it('ACCEPT_MARKET: a cash flow change logs one cashFlowChanged per asset', () => {
    const next = apply(facing('market-002', [duplex, condo], [duplexMortgage, condoMortgage]), ACCEPT);
    expect(next.game.log.at(-1)?.events).toEqual([
      { kind: 'cashFlowChanged', assetId: 'dup', delta: -100, monthlyCashFlow: 60 },
      { kind: 'cashFlowChanged', assetId: 'con', delta: -100, monthlyCashFlow: 20 },
    ]);
  });

  it('ACCEPT_MARKET: a split logs one sharesSplit per lot', () => {
    const next = apply(facing('market-003', [robotics]), ACCEPT);
    expect(next.game.log.at(-1)?.events).toEqual([{ kind: 'sharesSplit', assetId: 'rob', ratio: 2, shares: 20 }]);
  });

  it('ACCEPT_MARKET: is deterministic', () => {
    const before = deepFreeze(facing('market-001', [duplex], [duplexMortgage]));
    expect(JSON.stringify(reduce(before, ACCEPT))).toBe(JSON.stringify(reduce(before, ACCEPT)));
  });

  it('ACCEPT_MARKET: does not touch rngState', () => {
    const before = facing('market-001', [duplex], [duplexMortgage]);
    expect(apply(before, ACCEPT).game.rngState).toBe(before.game.rngState);
  });

  it('ACCEPT_MARKET: the turn can end afterwards', () => {
    const next = apply(facing('market-001', [duplex], [duplexMortgage]), ACCEPT);
    expect(reduce(deepFreeze(next), { type: 'END_TURN', playerId: 'p1' }).ok).toBe(true);
  });

  it('ACCEPT_MARKET: does not touch the other player or position', () => {
    const before = facing('market-001', [duplex], [duplexMortgage]);
    const next = apply(before, ACCEPT);
    expect(next.players[1]).toEqual(before.players[1]);
    expect(p1(next).position).toBe(2);
  });

  it('ACCEPT_MARKET: works in kids mode', () => {
    const next = apply(facing('market-002', [duplex], [duplexMortgage], twoPlayerGame({ mode: 'kids' })), ACCEPT);
    expect(p1(next).assets[0]?.monthlyCashFlow).toBe(60);
  });
});

describe('ACCEPT_MARKET: rejections', () => {
  it('ACCEPT_MARKET: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(facing('market-001', [duplex], [duplexMortgage]), { ...ACCEPT, playerId: 'p2' })).toBe('NOT_YOUR_TURN');
  });

  const pendings: Pending[] = [
    { kind: 'none' },
    { kind: 'chooseDealSize' },
    { kind: 'buyOrPass', cardId: 'small-001' },
    { kind: 'payLifestyle', cardId: 'life-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('ACCEPT_MARKET: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...withPlayer(twoPlayerGame(), 'p1', { assets: [duplex] }), pending }, ACCEPT)).toBe('INVALID_FOR_PENDING');
  });

  it.each(['lobby', 'finished'] as const)('ACCEPT_MARKET: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(facing('market-001', [duplex], [duplexMortgage]), { phase }), ACCEPT)).toBe('GAME_NOT_PLAYING');
  });

  it('ACCEPT_MARKET: throws on an unknown card id in the decision (programmer bug)', () => {
    const broken: GameState = { ...twoPlayerGame(), pending: { kind: 'marketChoice', cardId: 'market-999' } };
    expect(() => reduce(deepFreeze(broken), ACCEPT)).toThrow(/market-999/);
  });

  it('ACCEPT_MARKET: a rejected acceptance is not logged', () => {
    const before = deepFreeze(facing('market-001', [duplex, condo], [duplexMortgage, condoMortgage]));
    const logBefore = before.game.log.length;
    expect(reduce(before, ACCEPT).ok).toBe(false);
    expect(before.game.log).toHaveLength(logBefore);
  });
});
