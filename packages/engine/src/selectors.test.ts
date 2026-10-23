import { ROUND_LIMIT, type GameState, type Player } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import {
  canEscape,
  currentPlayer,
  debtPayments,
  freedomPercent,
  hasRolledThisTurn,
  monthlyCashFlow,
  netWorth,
  passiveIncome,
  playerById,
  roundLimit,
  roundNumber,
  totalExpenses,
  winner,
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

describe('freedomPercent (spec v2, Winning: floor(passiveIncome × 100 / totalExpenses), never stored)', () => {
  const withPassive = (monthlyCashFlow: number): Player => ({
    ...teacher(),
    assets: [{ id: 'a', cardId: 'big-001', type: 'business', purchasePrice: 1, downPaid: 1, monthlyCashFlow }],
  });

  it('is 0 with no passive income', () => {
    expect(freedomPercent(teacher())).toBe(0);
  });

  it('is passive income over totalExpenses, floored', () => {
    // Teacher totalExpenses 2,600.
    expect(freedomPercent(withPassive(1_300))).toBe(50);
    expect(freedomPercent(withPassive(1_299))).toBe(49);
    expect(freedomPercent(withPassive(2_599))).toBe(99);
  });

  it('reaches 100 exactly when the player can escape, and keeps counting past it', () => {
    expect(freedomPercent(withPassive(2_600))).toBe(100);
    expect(canEscape(withPassive(2_600))).toBe(true);
    expect(freedomPercent(withPassive(5_200))).toBe(200);
  });
});

describe('roundNumber and roundLimit (spec v2, Winning and game length)', () => {
  it('starts at round 1 and counts completed rounds from the log', () => {
    const state = twoPlayerGame();
    expect(roundNumber(state)).toBe(1);
    const completed: GameState = withGame(state, {
      log: [
        { turnNumber: 1, action: { type: 'END_TURN', playerId: 'p2' }, events: [{ kind: 'roundCompleted', round: 1 }] },
        { turnNumber: 3, action: { type: 'END_TURN', playerId: 'p2' }, events: [{ kind: 'roundCompleted', round: 2 }] },
      ],
    });
    expect(roundNumber(completed)).toBe(3);
  });

  it('the limit is 15 rounds in standard mode and 10 in kids mode', () => {
    expect(ROUND_LIMIT).toEqual({ standard: 15, kids: 10 });
    expect(roundLimit(twoPlayerGame())).toBe(15);
    expect(roundLimit(twoPlayerGame({ mode: 'kids' }))).toBe(10);
  });
});

describe('winner (spec v2, Winning: escape, else highest freedomPercent, then cash, then netWorth, then the earlier seat)', () => {
  const finished = (state: GameState): GameState => withGame(state, { phase: 'finished' });
  const asset = (monthlyCashFlow: number) => ({ id: `a-${String(monthlyCashFlow)}`, cardId: 'big-001', type: 'business', purchasePrice: 1, downPaid: 1, monthlyCashFlow }) as const;

  it('is undefined while the game is playing', () => {
    expect(winner(twoPlayerGame())).toBeUndefined();
  });

  it('is the player who escaped', () => {
    const state = finished(withPlayer(twoPlayerGame(), 'p2', { hasEscaped: true }));
    expect(winner(state)?.id).toBe('p2');
  });

  it('is the highest freedomPercent among players still in, even with less cash', () => {
    // Teacher: 1,300 of 2,600 = 50%. Doctor (totalExpenses 11,340): 2,268 passive = 20%.
    const state = finished(withPlayer(withPlayer(twoPlayerGame(), 'p1', { assets: [asset(1_300)], cash: 0 }), 'p2', { assets: [asset(2_268)], cash: 50_000 }));
    expect(freedomPercent(playerById(state, 'p1'))).toBe(50);
    expect(freedomPercent(playerById(state, 'p2'))).toBe(20);
    expect(winner(state)?.id).toBe('p1');
  });

  it('ties on freedomPercent go to cash, then netWorth, then the earlier seat', () => {
    const tied = twoPlayerGame();
    expect(winner(finished(withPlayer(tied, 'p2', { cash: 400 + 1 })))?.id).toBe('p2');
    // Same cash: netWorth decides (the Teacher has 20,000 of debt, the Doctor 178,000).
    expect(winner(finished(withPlayer(tied, 'p2', { cash: 400 })))?.id).toBe('p1');
    // Everything equal: the earlier seat.
    const clone = finished(withPlayer(tied, 'p2', { cash: 400, liabilities: tied.players[0]?.liabilities ?? [], professionId: 'teacher', salary: 3_300 }));
    expect(winner(clone)?.id).toBe('p1');
  });

  it('ignores players who are out', () => {
    const state = finished(withPlayer(withPlayer(twoPlayerGame(), 'p1', { isOut: true, cash: 0 }), 'p2', { cash: 0 }));
    expect(winner(state)?.id).toBe('p2');
  });
});
