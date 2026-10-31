import { BORROW_STEP, CARDS_BY_ID, type Action, type GameState } from '@ff/shared';

import { reduce } from './reduce';
import { playerById } from './selectors';

/**
 * The actions `playerId` can take right now (CLAUDE.md, Rule 1.6), so the UI
 * never re-implements a rule. Each candidate is run through `reduce` and kept
 * only if accepted, which makes this agree with the reducer by construction.
 *
 * Parameterised actions appear in their smallest form: BUY with one share for
 * a stock or the card minimum for a growth asset, and BORROW of $1,000. A
 * legal smallest form means the action is available; the UI picks the size.
 */
export function legalActions(state: GameState, playerId: string): readonly Action[] {
  if (state.game.phase !== 'playing' || state.game.currentPlayerId !== playerId) return [];
  return candidates(state, playerId).filter((action) => reduce(state, action).ok);
}

function candidates(state: GameState, playerId: string): readonly Action[] {
  const player = playerById(state, playerId);
  const borrow: Action = { type: 'BORROW', playerId, amount: BORROW_STEP };
  const pending = state.pending;

  switch (pending.kind) {
    case 'none':
      return [
        { type: 'ROLL', playerId },
        { type: 'END_TURN', playerId },
        borrow,
        ...player.liabilities.map((l): Action => ({ type: 'REPAY', playerId, liabilityId: l.id })),
        ...player.assets.map((a): Action => ({ type: 'SELL_ASSET', playerId, assetId: a.id })),
      ];
    case 'chooseDealSize':
      return [
        { type: 'CHOOSE_DEAL_SIZE', playerId, size: 'small' },
        { type: 'CHOOSE_DEAL_SIZE', playerId, size: 'big' },
      ];
    case 'buyOrPass': {
      const card = CARDS_BY_ID.get(pending.cardId);
      const buy: Action[] =
        card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals'
          ? []
          : [{ type: 'BUY', playerId }, { type: 'BUY', playerId, shares: 1 }, { type: 'BUY', playerId, amount: card.price }];
      return [
        ...buy,
        { type: 'PASS', playerId },
        ...player.assets.map((a): Action => ({ type: 'SELL_ASSET', playerId, assetId: a.id })),
        borrow,
      ];
    }
    case 'marketChoice':
      return [
        { type: 'ACCEPT_MARKET', playerId },
        ...player.assets.map((a): Action => ({ type: 'ACCEPT_MARKET', playerId, assetId: a.id })),
        { type: 'DECLINE_MARKET', playerId },
      ];
    case 'lifeChoice': {
      const card = CARDS_BY_ID.get(pending.cardId);
      const options = card?.deck === 'lifeChoices' ? card.options : [];
      return [...options.map((o): Action => ({ type: 'CHOOSE_LIFE_OPTION', playerId, optionId: o.id })), borrow];
    }
    case 'giveOrSkip':
      return [
        { type: 'GIVE', playerId },
        { type: 'SKIP_GIVE', playerId },
      ];
  }
}
