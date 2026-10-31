import { type Action, type GameState } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { checkInvariants } from './invariants';
import { legalActions } from './legalActions';
import { reduce } from './reduce';
import { deepFreeze } from './test/deepFreeze';
import { drawn, offered, rngStateForRoll, rolledClean, twoPlayerGame, withGame, withPlayer, withZeroCashFlow } from './test/fixtures';
import { setupGame } from './test/walk';
import { apply } from './test/apply';

// Ada the Teacher (p1) is current. She starts with $2,500 cash and a Payday
// of +$740; withZeroCashFlow pins the Payday to $0 where cash boundaries matter.

const legal = (state: GameState, playerId = 'p1') => legalActions(deepFreeze(state), playerId);
const types = (actions: readonly Action[]) => actions.map((a) => a.type);
const broke = (state = twoPlayerGame()) => withZeroCashFlow(withPlayer(state, 'p1', { cash: 0 }), 'p1');

describe('legalActions: the actions the current player can take right now', () => {
  it('legalActions: before the roll the only legal action is ROLL', () => {
    expect(legal(twoPlayerGame())).toEqual([{ type: 'ROLL', playerId: 'p1' }]);
  });

  it('legalActions: a player who is not current has no legal actions', () => {
    expect(legal(twoPlayerGame(), 'p2')).toEqual([]);
  });

  it('legalActions: a finished game has no legal actions', () => {
    expect(legal(withGame(twoPlayerGame(), { phase: 'finished' }))).toEqual([]);
  });

  it('legalActions: after the roll with nothing pending, END_TURN, a $1,000 BORROW, and a REPAY per non-mortgage loan', () => {
    const state = rolledClean(twoPlayerGame());
    const actions = legal(state);
    expect(actions).toContainEqual({ type: 'END_TURN', playerId: 'p1' });
    expect(actions).toContainEqual({ type: 'BORROW', playerId: 'p1', amount: 1_000 });
    expect(types(actions)).not.toContain('ROLL');
    const loans = state.players[0]?.liabilities.filter((l) => l.kind !== 'mortgage') ?? [];
    expect(loans.length).toBeGreaterThan(0);
    for (const loan of loans) {
      const repay: Action = { type: 'REPAY', playerId: 'p1', liabilityId: loan.id };
      expect(actions.some((a) => a.type === 'REPAY' && a.liabilityId === loan.id)).toBe(reduce(state, repay).ok);
    }
  });

  it('legalActions: kids mode never offers BORROW', () => {
    const state = rolledClean(twoPlayerGame({ mode: 'kids' }));
    expect(types(legal(state))).toContain('END_TURN');
    expect(types(legal(state))).not.toContain('BORROW');
  });

  it('legalActions: an Opportunity space offers both deal sizes in standard mode', () => {
    const rolled = apply(withGame(withPlayer(twoPlayerGame(), 'p1', { position: 2 }), { rngState: rngStateForRoll(1) }), { type: 'ROLL', playerId: 'p1' });
    expect(rolled.pending.kind).toBe('chooseDealSize');
    expect(legal(rolled)).toEqual([
      { type: 'CHOOSE_DEAL_SIZE', playerId: 'p1', size: 'small' },
      { type: 'CHOOSE_DEAL_SIZE', playerId: 'p1', size: 'big' },
    ]);
  });

  it('legalActions: an affordable deal offers BUY, PASS, and BORROW', () => {
    const state = offered(twoPlayerGame(), 'small-003');
    expect(legal(state)).toEqual([
      { type: 'BUY', playerId: 'p1' },
      { type: 'PASS', playerId: 'p1' },
      { type: 'BORROW', playerId: 'p1', amount: 1_000 },
    ]);
  });

  it('legalActions: a deal the player cannot afford offers PASS and BORROW, not BUY', () => {
    expect(types(legal(offered(broke(), 'small-003')))).toEqual(['PASS', 'BORROW']);
  });

  it('legalActions: a growth deal offers BUY at the card minimum amount', () => {
    expect(legal(offered(twoPlayerGame(), 'small-008'))).toContainEqual({ type: 'BUY', playerId: 'p1', amount: 100 });
  });

  it('legalActions: a stock offers BUY of one share when one share is affordable', () => {
    expect(legal(offered(twoPlayerGame(), 'small-005', 20))).toContainEqual({ type: 'BUY', playerId: 'p1', shares: 1 });
  });

  it('legalActions: a stock held from an earlier draw offers SELL_ASSET of that lot when drawn again', () => {
    const bought = apply(offered(twoPlayerGame(), 'small-005', 20), { type: 'BUY', playerId: 'p1', shares: 10 });
    const lotId = bought.players[0]?.assets[0]?.id ?? '';
    const again = offered(withGame(apply(bought, { type: 'END_TURN', playerId: 'p1' }), { currentPlayerId: 'p1' }), 'small-005', 30);
    expect(legal(again)).toContainEqual({ type: 'SELL_ASSET', playerId: 'p1', assetId: lotId });
  });

  it('legalActions: a Life Choices card offers each option the player can pay for, plus BORROW', () => {
    expect(legal(drawn(twoPlayerGame(), 'life-002'))).toEqual([
      { type: 'CHOOSE_LIFE_OPTION', playerId: 'p1', optionId: 'stay' },
      { type: 'CHOOSE_LIFE_OPTION', playerId: 'p1', optionId: 'go' },
      { type: 'BORROW', playerId: 'p1', amount: 1_000 },
    ]);
  });

  it('legalActions: a Life Choices option the player cannot pay for is left out', () => {
    expect(legal(drawn(broke(), 'life-002'))).toEqual([
      { type: 'CHOOSE_LIFE_OPTION', playerId: 'p1', optionId: 'stay' },
      { type: 'BORROW', playerId: 'p1', amount: 1_000 },
    ]);
  });

  it('legalActions: a buyout offer with nothing to sell can be declined', () => {
    expect(types(legal(drawn(twoPlayerGame(), 'market-001')))).toContain('DECLINE_MARKET');
  });

  it('legalActions: Giving offers GIVE and SKIP_GIVE, and only SKIP_GIVE when 10 percent of cash is $0', () => {
    const onGiving = (cash: number) =>
      apply(withGame(withPlayer(withZeroCashFlow(withPlayer(twoPlayerGame(), 'p1', { cash }), 'p1'), 'p1', { position: 3 }), { rngState: rngStateForRoll(1) }), {
        type: 'ROLL',
        playerId: 'p1',
      });
    expect(legal(onGiving(400))).toEqual([
      { type: 'GIVE', playerId: 'p1' },
      { type: 'SKIP_GIVE', playerId: 'p1' },
    ]);
    expect(legal(onGiving(9))).toEqual([{ type: 'SKIP_GIVE', playerId: 'p1' }]);
  });

  it('legalActions: every action returned is accepted by reduce, and a game played only from them finishes', () => {
    for (const mode of ['standard', 'kids'] as const) {
      for (const seed of [1, 2, 3]) {
        let state = setupGame({ seed, mode, professions: [0, 5, 15] });
        let steps = 0;
        while (state.game.phase === 'playing') {
          const actions = legalActions(state, state.game.currentPlayerId);
          expect(actions.length, 'the current player always has a legal action').toBeGreaterThan(0);
          for (const action of actions) expect(reduce(state, action).ok).toBe(true);
          // Prefer anything but BORROW so the walk does not drown in loans.
          const calm = actions.filter((a) => a.type !== 'BORROW');
          const pick = calm[(seed + steps) % calm.length] ?? actions[0];
          if (pick === undefined) throw new Error('unreachable');
          const result = reduce(state, pick);
          if (!result.ok) throw new Error(`legal action ${pick.type} rejected with ${result.error}`);
          state = result.state;
          expect(checkInvariants(state)).toEqual([]);
          steps++;
          expect(steps).toBeLessThan(5_000);
        }
      }
    }
  });
});

