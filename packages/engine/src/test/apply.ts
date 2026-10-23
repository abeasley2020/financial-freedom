// Test-only wrappers around reduce. Every input is deep-frozen so a mutating
// reducer throws (CLAUDE.md, Rule 1.3).

import type { Action, GameState } from '@ff/shared';
import { expect } from 'vitest';

import type { EngineError } from '../errors';
import { reduce } from '../reduce';
import { deepFreeze } from './deepFreeze';

/** Applies an action that must be accepted and returns the new state. */
export function apply(state: GameState, action: Action): GameState {
  const result = reduce(deepFreeze(state), action);
  if (!result.ok) {
    throw new Error(`expected ${action.type} to be accepted, got ${result.error}`);
  }
  return result.state;
}

/** Applies an action that must be rejected and returns the error. */
export function reject(state: GameState, action: Action): EngineError {
  const result = reduce(deepFreeze(state), action);
  expect(result.ok, `expected ${action.type} to be rejected`).toBe(false);
  if (result.ok) throw new Error('unreachable');
  return result.error;
}
