import { BORROW_STEP, DECISION_PRINCIPLES, LIABILITY_PAYMENT_PERCENT, type Action, type GameState, type Liability } from '@ff/shared';

import { pct } from '../money';
import { rejected, type ActionResult } from '../reduce';
import { currentPlayer, hasRolledThisTurn } from '../selectors';

/** Pending states in which borrowing is legal (spec, Core rules, turn step 4). */
const BORROW_PENDING = new Set<GameState['pending']['kind']>(['none', 'buyOrPass', 'payLifestyle']);

/**
 * Spec, Core rules, turn step 4: borrow from the bank in $1,000 increments
 * at 10 percent of principal added to monthly expenses. Legal after the roll
 * with no decision pending, or while a buyOrPass or payLifestyle decision is
 * open so a short player can raise the cash; the decision stays open. Kids
 * mode has no bank loans.
 */
export function borrow(state: GameState, action: Extract<Action, { type: 'BORROW' }>): ActionResult {
  if (!BORROW_PENDING.has(state.pending.kind)) return rejected('INVALID_FOR_PENDING');
  if (!hasRolledThisTurn(state)) return rejected('MUST_ROLL_FIRST');
  if (state.game.mode === 'kids') return rejected('NOT_ALLOWED_IN_KIDS_MODE');

  const { amount } = action;
  if (!Number.isInteger(amount) || amount <= 0 || amount % BORROW_STEP !== 0) return rejected('INVALID_AMOUNT');

  const player = currentPlayer(state);
  const loan: Liability = {
    id: `${player.id}-bank-${String(state.game.log.length)}`,
    kind: 'bank',
    principal: amount,
    monthlyPayment: pct(amount, LIABILITY_PAYMENT_PERCENT.bank),
  };

  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.id === player.id ? { ...p, cash: p.cash + amount, liabilities: [...p.liabilities, loan] } : p,
      ),
    },
    events: [
      { kind: 'cashChanged', delta: amount, reason: 'borrow' },
      { kind: 'borrowed', liabilityId: loan.id, amount, monthlyPayment: loan.monthlyPayment, principles: DECISION_PRINCIPLES.bankLoan },
    ],
  };
}
