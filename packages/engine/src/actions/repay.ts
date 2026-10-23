import type { Action, GameState } from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';
import { currentPlayer, hasRolledThisTurn } from '../selectors';

/**
 * Spec, Core rules, turn step 4: repay a loan in full. Legal only after the
 * roll with no decision pending. Pays the liability's principal from cash and
 * removes it. A mortgage is never repaid this way (Core rules, Mortgages); it
 * is retired only by selling the asset it finances.
 */
export function repay(state: GameState, action: Extract<Action, { type: 'REPAY' }>): ActionResult {
  if (state.pending.kind !== 'none') return rejected('INVALID_FOR_PENDING');
  if (!hasRolledThisTurn(state)) return rejected('MUST_ROLL_FIRST');

  const player = currentPlayer(state);
  const loan = player.liabilities.find((l) => l.id === action.liabilityId);
  if (loan === undefined || loan.kind === 'mortgage') return rejected('INVALID_LIABILITY');
  if (player.cash < loan.principal) return rejected('INSUFFICIENT_CASH');

  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === player.id
          ? { ...p, cash: p.cash - loan.principal, liabilities: p.liabilities.filter((l) => l.id !== loan.id) }
          : p,
      ),
    },
    events: [
      { kind: 'cashChanged', delta: -loan.principal, reason: 'repay' },
      { kind: 'repaid', liabilityId: loan.id, principal: loan.principal },
    ],
  };
}
