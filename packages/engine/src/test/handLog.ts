// Test-only builders for hand-built game logs. The debrief reads only the
// final state and the log, so its tests write the log directly instead of
// playing a game. Production code never imports from src/test/.

import type { Action, GameState, LogEntry, LogEvent } from '@ff/shared';

/** The Teacher's totalExpenses in `twoPlayerGame()`: baseExpenses 4,000 + student 300 + car 200 + credit 60. */
export const TEACHER_TOTAL_EXPENSES = 4_560;

export function entry(action: Action, events: readonly LogEvent[], turnNumber = 0): LogEntry {
  return { turnNumber, action, events: [...events] };
}

/** A ROLL entry for `playerId` holding `events`. */
export function rollEntry(playerId: string, ...events: readonly LogEvent[]): LogEntry {
  return entry({ type: 'ROLL', playerId }, events);
}

/** An END_TURN entry by `playerId` holding `events` (a skipped seat's Payday, roundCompleted, gameEnded). */
export function endTurnEntry(playerId: string, ...events: readonly LogEvent[]): LogEntry {
  return entry({ type: 'END_TURN', playerId }, events);
}

export interface SnapshotNumbers {
  readonly passiveIncome?: number;
  readonly totalExpenses?: number;
  readonly cash?: number;
}

export function snapshot(playerId: string, round = 1, numbers: SnapshotNumbers = {}): LogEvent {
  return {
    kind: 'paydaySnapshot',
    playerId,
    passiveIncome: numbers.passiveIncome ?? 0,
    totalExpenses: numbers.totalExpenses ?? TEACHER_TOTAL_EXPENSES,
    cash: numbers.cash ?? 1_000,
    roundNumber: round,
  };
}

/** The events of one Payday: `growth` (valueChanged events) first, as creditPayday writes them, then payday and paydaySnapshot. */
export function paydayEvents(playerId: string, round = 1, growth: readonly LogEvent[] = [], numbers: SnapshotNumbers = {}): LogEvent[] {
  return [...growth, { kind: 'payday', amount: 0 }, snapshot(playerId, round, numbers)];
}

/** A ROLL entry that is only a Payday for `playerId`. */
export function paydayEntry(playerId: string, round = 1, growth: readonly LogEvent[] = [], numbers: SnapshotNumbers = {}): LogEntry {
  return rollEntry(playerId, ...paydayEvents(playerId, round, growth, numbers));
}

/** `count` Payday-only ROLL entries for `playerId`, in rounds `round`, `round + 1`, ... */
export function paydayEntries(playerId: string, count: number, round = 1): LogEntry[] {
  return Array.from({ length: count }, (_, i) => paydayEntry(playerId, round + i));
}

/** `state` finished, with exactly `log` as its log. Players keep whatever `state` gives them. */
export function withLog(state: GameState, log: readonly LogEntry[], phase: GameState['game']['phase'] = 'finished'): GameState {
  return { ...state, game: { ...state.game, phase, log: [...log] } };
}
