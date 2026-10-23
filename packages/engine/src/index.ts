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
  assetCashFlow,
  assetValue,
  canEscape,
  cheapestOption,
  currentPlayer,
  debtPayments,
  hasRolledThisTurn,
  largestLoan,
  monthlyCashFlow,
  netWorth,
  optionCost,
  passiveIncome,
  playerById,
  priciestOption,
  professionOf,
  totalExpenses,
  type OptionCost,
} from './selectors';
