// @ff/engine
//
// Pure game engine. One entry point: reduce(state, action) -> ReduceResult.
// See CLAUDE.md, Rule 1.

export { createGame, type CreateGameOptions } from './createGame';
export type { EngineError } from './errors';
export { assertInvariants, checkInvariants } from './invariants';
export { pct } from './money';
export { reduce, type ReduceResult } from './reduce';
export { replay } from './replay';
export { nextRandom, rollDie, shuffle } from './rng';
export {
  canEscape,
  currentPlayer,
  debtPayments,
  hasRolledThisTurn,
  monthlyCashFlow,
  passiveIncome,
  playerById,
  professionOf,
  totalExpenses,
} from './selectors';
