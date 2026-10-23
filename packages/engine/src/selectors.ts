// Derived values. Nothing here is ever stored on state (CLAUDE.md, Rule 2).

import { PROFESSIONS, type GameState, type Player, type Profession } from '@ff/shared';

export function professionOf(player: Player): Profession {
  const profession = PROFESSIONS.find((p) => p.id === player.professionId);
  if (profession === undefined) {
    throw new Error(`unknown professionId "${player.professionId}" on player "${player.id}"`);
  }
  return profession;
}

/** Sum of asset monthlyCashFlow. */
export function passiveIncome(player: Player): number {
  return player.assets.reduce((sum, a) => sum + a.monthlyCashFlow, 0);
}

/** Sum of liability monthlyPayment. */
export function debtPayments(player: Player): number {
  return player.liabilities.reduce((sum, l) => sum + l.monthlyPayment, 0);
}

/** Profession baseExpenses plus debtPayments. */
export function totalExpenses(player: Player): number {
  return professionOf(player).baseExpenses + debtPayments(player);
}

/** What one Payday credits: salary + passiveIncome − totalExpenses. May be negative. */
export function monthlyCashFlow(player: Player): number {
  return player.salary + passiveIncome(player) - totalExpenses(player);
}

/** The win condition: passive income covers every monthly cost. */
export function canEscape(player: Player): boolean {
  return passiveIncome(player) >= totalExpenses(player);
}

export function playerById(state: GameState, playerId: string): Player {
  const player = state.players.find((p) => p.id === playerId);
  if (player === undefined) {
    throw new Error(`unknown playerId "${playerId}"`);
  }
  return player;
}

export function currentPlayer(state: GameState): Player {
  return playerById(state, state.game.currentPlayerId);
}

/** True once the log holds an accepted ROLL for the current turn. Derived from the log, not stored. */
export function hasRolledThisTurn(state: GameState): boolean {
  const turn = state.game.turnNumber;
  for (let i = state.game.log.length - 1; i >= 0; i--) {
    const entry = state.game.log[i];
    if (entry?.turnNumber !== turn) break;
    if (entry.action.type === 'ROLL') return true;
  }
  return false;
}
