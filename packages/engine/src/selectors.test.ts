import type { Player } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import {
  canEscape,
  currentPlayer,
  debtPayments,
  hasRolledThisTurn,
  monthlyCashFlow,
  netWorth,
  passiveIncome,
  totalExpenses,
} from './selectors';
import { deepFreeze } from './test/deepFreeze';
import { twoPlayerGame, withGame, withPlayer } from './test/fixtures';

const teacher = (): Player => currentPlayer(twoPlayerGame());

describe('selectors: income statement', () => {
  it('passiveIncome sums asset monthlyCashFlow and is 0 with no assets', () => {
    expect(passiveIncome(teacher())).toBe(0);
    const owner: Player = {
      ...teacher(),
      assets: [
        { id: 'a1', cardId: 'small-001', type: 'rental', purchasePrice: 50_000, downPaid: 5_000, monthlyCashFlow: 160 },
        { id: 'a2', cardId: 'big-003', type: 'land', purchasePrice: 60_000, downPaid: 12_000, monthlyCashFlow: -50 },
      ],
    };
    expect(passiveIncome(owner)).toBe(110);
  });

  it('debtPayments sums liability monthlyPayment', () => {
    // Teacher: student 12,000 @ 1% + car 6,000 @ 2% + credit 2,000 @ 3%
    expect(debtPayments(teacher())).toBe(120 + 120 + 60);
  });

  it('totalExpenses is profession baseExpenses plus debtPayments', () => {
    expect(totalExpenses(teacher())).toBe(2_300 + 300);
  });

  it('monthlyCashFlow is salary plus passiveIncome minus totalExpenses', () => {
    expect(monthlyCashFlow(teacher())).toBe(3_300 + 0 - 2_600);
  });

  it('totalExpenses throws on an unknown professionId (programmer bug)', () => {
    expect(() => totalExpenses({ ...teacher(), professionId: 'astronaut' })).toThrow(/astronaut/);
  });
});

describe('selectors: canEscape', () => {
  it('is true when passiveIncome equals totalExpenses (boundary)', () => {
    const p: Player = {
      ...teacher(),
      assets: [{ id: 'a1', cardId: 'x', type: 'business', purchasePrice: 1, downPaid: 1, monthlyCashFlow: 2_600 }],
    };
    expect(canEscape(p)).toBe(true);
  });

  it('is false one dollar below totalExpenses', () => {
    const p: Player = {
      ...teacher(),
      assets: [{ id: 'a1', cardId: 'x', type: 'business', purchasePrice: 1, downPaid: 1, monthlyCashFlow: 2_599 }],
    };
    expect(canEscape(p)).toBe(false);
  });
});

describe('selectors: turn bookkeeping', () => {
  it('currentPlayer returns the player named by game.currentPlayerId', () => {
    const state = deepFreeze(withGame(twoPlayerGame(), { currentPlayerId: 'p2' }));
    expect(currentPlayer(state).id).toBe('p2');
  });

  it('currentPlayer throws when the id is unknown (programmer bug)', () => {
    expect(() => currentPlayer(withGame(twoPlayerGame(), { currentPlayerId: 'ghost' }))).toThrow(/ghost/);
  });

  it('hasRolledThisTurn is false on a fresh turn', () => {
    expect(hasRolledThisTurn(deepFreeze(twoPlayerGame()))).toBe(false);
  });

  it('hasRolledThisTurn is true once the log holds a ROLL for the current turn', () => {
    const state = withGame(twoPlayerGame(), {
      log: [{ turnNumber: 0, action: { type: 'ROLL', playerId: 'p1' }, events: [] }],
    });
    expect(hasRolledThisTurn(deepFreeze(state))).toBe(true);
  });

  it('hasRolledThisTurn ignores ROLLs from earlier turns', () => {
    const state = withGame(twoPlayerGame(), {
      turnNumber: 1,
      log: [{ turnNumber: 0, action: { type: 'ROLL', playerId: 'p1' }, events: [] }],
    });
    expect(hasRolledThisTurn(deepFreeze(state))).toBe(false);
  });

  it('withPlayer patches one player and leaves the rest alone', () => {
    const state = withPlayer(twoPlayerGame(), 'p2', { cash: 9 });
    expect(state.players.map((p) => p.cash)).toEqual([400, 9]);
  });
});

describe('netWorth (spec v2: never stored; growth assets count at marketValue)', () => {
  it('is cash plus asset values minus every liability principal', () => {
    // Teacher: 400 cash, 20,000 of starting debt.
    expect(netWorth(teacher())).toBe(400 - 20_000);
  });

  it('counts a rental at its purchase price and subtracts its mortgage', () => {
    const owner: Player = {
      ...teacher(),
      assets: [{ id: 'd', cardId: 'small-001', type: 'rental', purchasePrice: 50_000, downPaid: 5_000, monthlyCashFlow: 160 }],
      liabilities: [...teacher().liabilities, { id: 'm', kind: 'mortgage', principal: 45_000, monthlyPayment: 0, assetId: 'd' }],
    };
    expect(netWorth(owner)).toBe(400 - 20_000 + 50_000 - 45_000);
  });

  it('counts a growth asset at marketValue and a stock lot at its cost basis', () => {
    const owner: Player = {
      ...teacher(),
      liabilities: [],
      assets: [
        { id: 'g', cardId: 'small-004', type: 'index', purchasePrice: 2_000, downPaid: 2_000, marketValue: 2_600, growthPercent: 4, payoutPercent: 1 },
        { id: 's', cardId: 'small-005', type: 'stock', purchasePrice: 200, downPaid: 200, monthlyCashFlow: 0, shares: 10 },
      ],
    };
    expect(netWorth(owner)).toBe(400 + 2_600 + 200);
  });
});
