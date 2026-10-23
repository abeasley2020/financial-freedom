import type { Action, Asset, GameState, Liability, Pending } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from '../reduce';
import { playerById } from '../selectors';
import { apply, reject } from '../test/apply';
import { deepFreeze } from '../test/deepFreeze';
import { drawn, twoPlayerGame, withGame, withPlayer } from '../test/fixtures';

// Market fixtures: market-001 Eager Buyer (offerBuyout, rentals), market-002
// Tenant Moves Out (changeCashFlow, rentals), market-003 Stock Split (stocks),
// market-004 Highway (forceSale, land).

const DECLINE: Action = { type: 'DECLINE_MARKET', playerId: 'p1' };
const p1 = (state: GameState) => playerById(state, 'p1');

const duplex: Asset = { id: 'dup', cardId: 'small-001', type: 'rental', purchasePrice: 50_000, downPaid: 5_000, monthlyCashFlow: 160 };
const duplexMortgage: Liability = { id: 'dup-mortgage', kind: 'mortgage', principal: 45_000, monthlyPayment: 0, assetId: 'dup' };
const acres: Asset = { id: 'acr', cardId: 'big-003', type: 'land', purchasePrice: 60_000, downPaid: 12_000, monthlyCashFlow: -50 };
const robotics: Asset = { id: 'rob', cardId: 'small-005', type: 'stock', purchasePrice: 200, downPaid: 200, monthlyCashFlow: 0, shares: 10 };

function facing(cardId: string, assets: readonly Asset[], mortgages: readonly Liability[] = [], state = twoPlayerGame()): GameState {
  const base = p1(state);
  return drawn(withPlayer(state, 'p1', { assets: [...assets], liabilities: [...base.liabilities, ...mortgages] }), cardId);
}

describe('DECLINE_MARKET: turning down an offer', () => {
  it('DECLINE_MARKET: discards a buyout offer and keeps the asset, mortgage, and cash', () => {
    const before = facing('market-001', [duplex], [duplexMortgage]);
    const next = apply(before, DECLINE);
    expect(next.players).toEqual(before.players);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.decks.market.drawPile).toEqual(before.decks.market.drawPile);
    expect(next.decks.market.discardPile).toEqual([...before.decks.market.discardPile, 'market-001']);
    expect(next.decks.smallDeals).toEqual(before.decks.smallDeals);
  });

  it('DECLINE_MARKET: is allowed with several qualifying assets without naming one', () => {
    const condo: Asset = { ...duplex, id: 'con', cardId: 'small-002' };
    const next = apply(facing('market-001', [duplex, condo], [duplexMortgage]), DECLINE);
    expect(p1(next).assets).toEqual([duplex, condo]);
  });

  it('DECLINE_MARKET: is allowed when the player owns nothing the card applies to', () => {
    const before = facing('market-002', [robotics]);
    const next = apply(before, DECLINE);
    expect(next.players).toEqual(before.players);
    expect(next.pending).toEqual({ kind: 'none' });
  });

  it('DECLINE_MARKET: is allowed on a forced sale when the player owns no land', () => {
    const next = apply(facing('market-004', [duplex], [duplexMortgage]), DECLINE);
    expect(p1(next).assets).toEqual([duplex]);
  });

  it('DECLINE_MARKET: is allowed with no assets at all', () => {
    const next = apply(facing('market-003', []), DECLINE);
    expect(next.pending).toEqual({ kind: 'none' });
  });

  it('DECLINE_MARKET: works in kids mode', () => {
    const next = apply(facing('market-001', [duplex], [duplexMortgage], twoPlayerGame({ mode: 'kids' })), DECLINE);
    expect(p1(next).assets).toEqual([duplex]);
  });
});

describe('DECLINE_MARKET: mandatory effects', () => {
  it('DECLINE_MARKET: rejected with MARKET_EFFECT_MANDATORY for a cash flow change that applies to an owned asset', () => {
    const before = facing('market-002', [duplex], [duplexMortgage]);
    expect(reject(before, DECLINE)).toBe('MARKET_EFFECT_MANDATORY');
    expect(before.pending).toEqual({ kind: 'marketChoice', cardId: 'market-002' });
  });

  it('DECLINE_MARKET: rejected with MARKET_EFFECT_MANDATORY for a stock split when the player holds a stock', () => {
    expect(reject(facing('market-003', [robotics]), DECLINE)).toBe('MARKET_EFFECT_MANDATORY');
  });

  it('DECLINE_MARKET: rejected with MARKET_EFFECT_MANDATORY for a forced sale of owned land', () => {
    expect(reject(facing('market-004', [acres]), DECLINE)).toBe('MARKET_EFFECT_MANDATORY');
  });

  it('DECLINE_MARKET: a mandatory card can still be resolved with ACCEPT_MARKET', () => {
    const before = facing('market-002', [duplex], [duplexMortgage]);
    expect(reject(before, DECLINE)).toBe('MARKET_EFFECT_MANDATORY');
    const next = apply(before, { type: 'ACCEPT_MARKET', playerId: 'p1' });
    expect(p1(next).assets[0]).toMatchObject({ monthlyCashFlow: 60 });
  });
});

describe('DECLINE_MARKET: log and determinism', () => {
  it('DECLINE_MARKET: appends a log entry with a passed event', () => {
    const next = apply(facing('market-001', [duplex], [duplexMortgage]), DECLINE);
    expect(next.game.log.at(-1)).toEqual({
      turnNumber: 0,
      action: DECLINE,
      events: [{ kind: 'passed', cardId: 'market-001', principles: ['P2', 'P3'] }],
    });
  });

  it('DECLINE_MARKET: is deterministic', () => {
    const before = deepFreeze(facing('market-001', [duplex], [duplexMortgage]));
    expect(JSON.stringify(reduce(before, DECLINE))).toBe(JSON.stringify(reduce(before, DECLINE)));
  });

  it('DECLINE_MARKET: does not touch rngState', () => {
    const before = facing('market-001', [duplex], [duplexMortgage]);
    expect(apply(before, DECLINE).game.rngState).toBe(before.game.rngState);
  });

  it('DECLINE_MARKET: the turn can end afterwards', () => {
    const next = apply(facing('market-001', [duplex], [duplexMortgage]), DECLINE);
    expect(reduce(deepFreeze(next), { type: 'END_TURN', playerId: 'p1' }).ok).toBe(true);
  });

  it('DECLINE_MARKET: a declined card comes back once the market discard pile is reshuffled', () => {
    const declined = apply(facing('market-001', [duplex], [duplexMortgage]), DECLINE);
    const drained: GameState = { ...declined, decks: { ...declined.decks, market: { drawPile: [], discardPile: ['market-001'] } } };
    const nextTurn = withGame(apply(drained, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' });
    const rolled = drawn(nextTurn, 'market-001');
    expect(rolled.pending).toEqual({ kind: 'marketChoice', cardId: 'market-001' });
  });
});

describe('DECLINE_MARKET: rejections', () => {
  it('DECLINE_MARKET: rejected with NOT_YOUR_TURN when a non-current player sends it', () => {
    expect(reject(facing('market-001', [duplex], [duplexMortgage]), { ...DECLINE, playerId: 'p2' })).toBe('NOT_YOUR_TURN');
  });

  const pendings: Pending[] = [
    { kind: 'none' },
    { kind: 'chooseDealSize' },
    { kind: 'buyOrPass', cardId: 'small-001' },
    { kind: 'lifeChoice', cardId: 'life-001' },
    { kind: 'giveOrSkip' },
  ];
  it.each(pendings)('DECLINE_MARKET: rejected with INVALID_FOR_PENDING when pending is $kind', (pending) => {
    expect(reject({ ...twoPlayerGame(), pending }, DECLINE)).toBe('INVALID_FOR_PENDING');
  });

  it.each(['lobby', 'finished'] as const)('DECLINE_MARKET: rejected with GAME_NOT_PLAYING when phase is %s', (phase) => {
    expect(reject(withGame(facing('market-001', [duplex], [duplexMortgage]), { phase }), DECLINE)).toBe('GAME_NOT_PLAYING');
  });

  it('DECLINE_MARKET: throws on an unknown card id in the decision (programmer bug)', () => {
    const broken: GameState = { ...twoPlayerGame(), pending: { kind: 'marketChoice', cardId: 'market-999' } };
    expect(() => reduce(deepFreeze(broken), DECLINE)).toThrow(/market-999/);
  });

  it('DECLINE_MARKET: a rejected decline is not logged', () => {
    const before = deepFreeze(facing('market-002', [duplex], [duplexMortgage]));
    const logBefore = before.game.log.length;
    expect(reduce(before, DECLINE).ok).toBe(false);
    expect(before.game.log).toHaveLength(logBefore);
  });
});
