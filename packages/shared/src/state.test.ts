import { describe, expect, it } from 'vitest';

import { ActionSchema } from './actions';
import { LIABILITY_PAYMENT_PERCENT, ProfessionSchema } from './professions';
import { BOARD_SIZE, GameStateSchema, type GameState, PendingSchema, type Player, PlayerSchema } from './state';

const player: Player = {
  id: 'p1',
  name: 'Ada',
  professionId: 'teacher',
  position: 0,
  cash: 400,
  salary: 3_300,
  assets: [],
  liabilities: [{ id: 'l1', kind: 'student', principal: 12_000, monthlyPayment: 120 }],
  favorTokens: 0,
  isOut: false,
  hasEscaped: false,
  skipsNextTurn: false,
};

const emptyPile = { drawPile: [], discardPile: [] };

const state: GameState = {
  game: {
    id: 'g1',
    mode: 'standard',
    phase: 'playing',
    turnNumber: 0,
    currentPlayerId: 'p1',
    rngSeed: 42,
    rngState: 42,
    log: [],
  },
  players: [player],
  decks: {
    smallDeals: emptyPile,
    bigDeals: emptyPile,
    market: emptyPile,
    lifestyle: emptyPile,
    setback: emptyPile,
  },
  pending: { kind: 'none' },
};

describe('GameStateSchema', () => {
  it('accepts a minimal playing state', () => {
    expect(GameStateSchema.safeParse(state).success).toBe(true);
  });

  it('rejects a non-integer cash balance', () => {
    const bad = { ...state, players: [{ ...player, cash: 400.25 }] };
    expect(GameStateSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects negative cash', () => {
    const bad = { ...state, players: [{ ...player, cash: -1 }] };
    expect(GameStateSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a stored derived value such as passiveIncome', () => {
    const bad = { ...state, players: [{ ...player, passiveIncome: 0 }] };
    expect(GameStateSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a board position outside the inner loop', () => {
    expect(PlayerSchema.safeParse({ ...player, position: BOARD_SIZE }).success).toBe(false);
    expect(PlayerSchema.safeParse({ ...player, position: BOARD_SIZE - 1 }).success).toBe(true);
  });

  it('requires every deck to be present', () => {
    const missing = Object.fromEntries(Object.entries(state.decks).filter(([deck]) => deck !== 'setback'));
    expect(GameStateSchema.safeParse({ ...state, decks: missing }).success).toBe(false);
  });

  it('requires a lifestyle liability to name its source card', () => {
    const withLifestyle = {
      ...player,
      liabilities: [{ id: 'l2', kind: 'lifestyle', principal: 12_000, monthlyPayment: 380 }],
    };
    expect(PlayerSchema.safeParse(withLifestyle).success).toBe(false);
    expect(
      PlayerSchema.safeParse({
        ...withLifestyle,
        liabilities: [{ ...withLifestyle.liabilities[0], sourceCardId: 'life-001' }],
      }).success,
    ).toBe(true);
  });

  it('requires a mortgage liability to name its asset and carry a zero monthly payment', () => {
    const mortgage = { id: 'm1', kind: 'mortgage', principal: 45_000, monthlyPayment: 0, assetId: 'a1' };
    expect(PlayerSchema.safeParse({ ...player, liabilities: [mortgage] }).success).toBe(true);
    const noAsset = Object.fromEntries(Object.entries(mortgage).filter(([k]) => k !== 'assetId'));
    expect(PlayerSchema.safeParse({ ...player, liabilities: [noAsset] }).success).toBe(false);
    expect(PlayerSchema.safeParse({ ...player, liabilities: [{ ...mortgage, monthlyPayment: 450 }] }).success).toBe(
      false,
    );
  });

  it('rejects assetId on a non-mortgage liability', () => {
    const bad = { ...player, liabilities: [{ id: 'l1', kind: 'car', principal: 6_000, monthlyPayment: 120, assetId: 'a1' }] };
    expect(PlayerSchema.safeParse(bad).success).toBe(false);
  });

  it('every asset has its own id so two lots of one stock can coexist', () => {
    const lot = (id: string, shares: number) => ({
      id,
      cardId: 'small-005',
      type: 'stock',
      purchasePrice: shares * 10,
      downPaid: shares * 10,
      monthlyCashFlow: 0,
      shares,
    });
    expect(PlayerSchema.safeParse({ ...player, assets: [lot('a1', 10), lot('a2', 5)] }).success).toBe(true);
    const withoutId = Object.fromEntries(Object.entries(lot('a1', 10)).filter(([k]) => k !== 'id'));
    expect(PlayerSchema.safeParse({ ...player, assets: [withoutId] }).success).toBe(false);
  });
});

describe('PendingSchema', () => {
  it('accepts every pending kind from the spec', () => {
    const kinds = [
      { kind: 'none' },
      { kind: 'chooseDealSize' },
      { kind: 'buyOrPass', cardId: 'small-001' },
      { kind: 'buyOrPass', cardId: 'small-005', sharePrice: 17 },
      { kind: 'marketChoice', cardId: 'market-001' },
      { kind: 'payLifestyle', cardId: 'life-001' },
      { kind: 'giveOrSkip' },
    ];
    for (const pending of kinds) {
      expect(PendingSchema.safeParse(pending).success, pending.kind).toBe(true);
    }
  });

  it('requires a card id on card-backed decisions', () => {
    expect(PendingSchema.safeParse({ kind: 'buyOrPass' }).success).toBe(false);
  });
});

describe('ActionSchema', () => {
  it('accepts every action type from the spec, each carrying playerId', () => {
    const actions = [
      { type: 'ROLL', playerId: 'p1' },
      { type: 'CHOOSE_DEAL_SIZE', playerId: 'p1', size: 'small' },
      { type: 'BUY', playerId: 'p1' },
      { type: 'BUY', playerId: 'p1', shares: 100 },
      { type: 'PASS', playerId: 'p1' },
      { type: 'SELL_ASSET', playerId: 'p1', assetId: 'a1' },
      { type: 'SELL_ASSET', playerId: 'p1', assetId: 'a1', shares: 25 },
      { type: 'BORROW', playerId: 'p1', amount: 1_000 },
      { type: 'REPAY', playerId: 'p1', liabilityId: 'l1' },
      { type: 'PAY_LIFESTYLE', playerId: 'p1', method: 'cash' },
      { type: 'ACCEPT_MARKET', playerId: 'p1' },
      { type: 'ACCEPT_MARKET', playerId: 'p1', assetId: 'a1' },
      { type: 'DECLINE_MARKET', playerId: 'p1' },
      { type: 'GIVE', playerId: 'p1' },
      { type: 'SKIP_GIVE', playerId: 'p1' },
      { type: 'END_TURN', playerId: 'p1' },
    ];
    for (const action of actions) {
      const result = ActionSchema.safeParse(action);
      expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
    }
  });

  it('rejects an action without a playerId', () => {
    expect(ActionSchema.safeParse({ type: 'ROLL' }).success).toBe(false);
  });

  it('rejects an unknown action type', () => {
    expect(ActionSchema.safeParse({ type: 'CHEAT', playerId: 'p1' }).success).toBe(false);
  });

  it('rejects BORROW amounts that are not positive $1,000 steps', () => {
    expect(ActionSchema.safeParse({ type: 'BORROW', playerId: 'p1', amount: 500 }).success).toBe(false);
    expect(ActionSchema.safeParse({ type: 'BORROW', playerId: 'p1', amount: 0 }).success).toBe(false);
    expect(ActionSchema.safeParse({ type: 'BORROW', playerId: 'p1', amount: 3_000 }).success).toBe(true);
  });

  it('SELL_ASSET names a lot by assetId, not by card', () => {
    expect(ActionSchema.safeParse({ type: 'SELL_ASSET', playerId: 'p1', cardId: 'small-001' }).success).toBe(false);
    expect(ActionSchema.safeParse({ type: 'SELL_ASSET', playerId: 'p1', assetId: 'a1', shares: 0 }).success).toBe(false);
  });
});

describe('ProfessionSchema', () => {
  it('rejects a profession whose starting liability is a lifestyle loan', () => {
    const result = ProfessionSchema.safeParse({
      id: 'x',
      name: 'X',
      salary: 1,
      baseExpenses: 1,
      startingCash: 1,
      startingLiabilities: [{ kind: 'lifestyle', principal: 1 }],
    });
    expect(result.success).toBe(false);
  });

  it('publishes the fixed payment percent per liability kind from the spec', () => {
    // Mortgage is 0: the deal card's monthlyCashFlow is already net of the mortgage payment.
    expect(LIABILITY_PAYMENT_PERCENT).toEqual({ student: 1, car: 2, credit: 3, mortgage: 0, bank: 10 });
  });
});
