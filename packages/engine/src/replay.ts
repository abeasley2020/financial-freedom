import type { Action, GameState } from '@ff/shared';

import { reduce } from './reduce';

/**
 * Re-applies `actions` to `initial`. The engine is deterministic (CLAUDE.md,
 * Rule 1.4), so replaying a game's log from its starting state must rebuild
 * the current state exactly. Throws if any action is rejected, because a
 * logged action was accepted once and must be accepted again.
 */
export function replay(initial: GameState, actions: readonly Action[]): GameState {
  let state = initial;
  actions.forEach((action, index) => {
    const result = reduce(state, action);
    if (!result.ok) {
      throw new Error(`replay: action ${String(index)} (${action.type} by ${action.playerId}) rejected with ${result.error}`);
    }
    state = result.state;
  });
  return state;
}
