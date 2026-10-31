// @ff/engine
//
// Pure game engine. One entry point: reduce(state, action) -> ReduceResult.
// See CLAUDE.md, Rule 1.

export { createGame, type CreateGameOptions } from './createGame';
export type { EngineError } from './errors';
export { assertInvariants, checkInvariants } from './invariants';
export { legalActions } from './legalActions';
export { pct } from './money';
export { reduce, type ReduceResult } from './reduce';
export { replay } from './replay';
export { nextRandom, rollDie, shuffle } from './rng';
export {
  assetCashFlow,
  assetValue,
  bankDebt,
  canEscape,
  cheapestOption,
  creditAvailable,
  currentPlayer,
  debtPayments,
  freedomPercent,
  hasRolledThisTurn,
  largestLoan,
  monthlyCashFlow,
  netWorth,
  optionCost,
  passiveIncome,
  playerById,
  priciestOption,
  professionOf,
  rankPlayers,
  roundLimit,
  roundNumber,
  totalDebt,
  totalExpenses,
  winner,
  type OptionCost,
} from './selectors';
