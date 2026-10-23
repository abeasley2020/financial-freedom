// Test-only: a deterministic random walk through a game, driven by a list of
// choice numbers so fast-check can shrink a failing game to a short one.
// Production code never imports from src/test/.

import { CARDS_BY_ID, PROFESSIONS, type Action, type GameMode, type GameState } from '@ff/shared';

import { createGame } from '../createGame';
import { reduce, type ReduceResult } from '../reduce';
import { currentPlayer, hasRolledThisTurn } from '../selectors';

export interface WalkSetup {
  readonly seed: number;
  readonly mode: GameMode;
  /** Indexes into PROFESSIONS, one per seat (2 to 6). */
  readonly professions: readonly number[];
}

export function setupGame(setup: WalkSetup): GameState {
  return createGame({
    id: `walk-${String(setup.seed)}`,
    mode: setup.mode,
    seed: setup.seed,
    players: setup.professions.map((index, seat) => {
      const profession = PROFESSIONS[index % PROFESSIONS.length];
      if (profession === undefined) throw new Error('PROFESSIONS is empty');
      return { id: `p${String(seat + 1)}`, name: `Player ${String(seat + 1)}`, professionId: profession.id };
    }),
  });
}

const pick = <T>(items: readonly T[], choice: number): T | undefined =>
  items.length === 0 ? undefined : items[choice % items.length];

/**
 * Actions worth trying from `state`, for the current player. Most are legal;
 * a few are deliberately off (wrong size, too many shares, unknown ids) so
 * the walk also exercises rejections. `choice` picks among the alternatives.
 */
export function candidateActions(state: GameState, choice: number): readonly Action[] {
  const player = currentPlayer(state);
  const playerId = player.id;
  const pending = state.pending;
  const borrow: Action = { type: 'BORROW', playerId, amount: 1_000 * (1 + (choice % 5)) };

  switch (pending.kind) {
    case 'none': {
      if (!hasRolledThisTurn(state)) return [{ type: 'ROLL', playerId }];
      const loan = pick(
        player.liabilities.filter((l) => l.kind !== 'mortgage'),
        Math.floor(choice / 7),
      );
      const repay: Action[] = loan === undefined ? [] : [{ type: 'REPAY', playerId, liabilityId: loan.id }];
      return [{ type: 'END_TURN', playerId }, { type: 'END_TURN', playerId }, borrow, ...repay, { type: 'REPAY', playerId, liabilityId: 'nope' }];
    }
    case 'chooseDealSize':
      return [
        { type: 'CHOOSE_DEAL_SIZE', playerId, size: 'small' },
        { type: 'CHOOSE_DEAL_SIZE', playerId, size: 'big' },
      ];
    case 'buyOrPass': {
      const card = CARDS_BY_ID.get(pending.cardId);
      const actions: Action[] = [{ type: 'PASS', playerId }, borrow];
      if (card?.deck === 'smallDeals' || card?.deck === 'bigDeals') {
        if (card.type === 'stock') {
          const max = card.sharesAvailable ?? 1;
          actions.push({ type: 'BUY', playerId, shares: 1 + (Math.floor(choice / 3) % max) });
          actions.push({ type: 'BUY', playerId, shares: max + 1 });
          const lot = pick(player.assets.filter((a) => a.cardId === card.id), Math.floor(choice / 11));
          if (lot?.shares !== undefined) {
            actions.push({ type: 'SELL_ASSET', playerId, assetId: lot.id });
            actions.push({ type: 'SELL_ASSET', playerId, assetId: lot.id, shares: 1 + (Math.floor(choice / 13) % (lot.shares + 1)) });
          }
        } else {
          actions.push({ type: 'BUY', playerId }, { type: 'BUY', playerId });
        }
      }
      const any = pick(player.assets, Math.floor(choice / 17));
      if (any !== undefined) actions.push({ type: 'SELL_ASSET', playerId, assetId: any.id });
      return actions;
    }
    case 'marketChoice': {
      const asset = pick(player.assets, Math.floor(choice / 5));
      const named: Action[] = asset === undefined ? [] : [{ type: 'ACCEPT_MARKET', playerId, assetId: asset.id }];
      return [{ type: 'ACCEPT_MARKET', playerId }, { type: 'DECLINE_MARKET', playerId }, ...named];
    }
    case 'payLifestyle':
      return [
        { type: 'PAY_LIFESTYLE', playerId, method: 'cash' },
        { type: 'PAY_LIFESTYLE', playerId, method: 'loan' },
        borrow,
      ];
    case 'giveOrSkip':
      return [{ type: 'GIVE', playerId }, { type: 'SKIP_GIVE', playerId }];
  }
}

export interface WalkStep {
  readonly before: GameState;
  readonly action: Action;
  readonly result: ReduceResult;
}

/**
 * Plays one step from `state` using choice number `n`: picks a candidate, or
 * occasionally an action from the wrong player, and applies it. Returns the
 * step so callers can check what an accepted action did.
 */
export function step(state: GameState, n: number): WalkStep {
  const candidates = candidateActions(state, n);
  let action = candidates[n % candidates.length];
  if (action === undefined) throw new Error('no candidate actions');
  // Every 23rd choice comes from a player who is not current.
  if (n % 23 === 0) {
    const other = state.players.find((p) => p.id !== state.game.currentPlayerId);
    if (other !== undefined) action = { ...action, playerId: other.id };
  }
  return { before: state, action, result: reduce(state, action) };
}

/**
 * True when none of the current player's candidate actions is accepted: the
 * game can make no progress from here.
 */
export function isStuck(state: GameState): boolean {
  if (state.game.phase !== 'playing') return false;
  for (let choice = 0; choice < 40; choice++) {
    for (const action of candidateActions(state, choice)) {
      if (reduce(state, action).ok) return false;
    }
  }
  return true;
}
