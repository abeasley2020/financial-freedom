/**
 * Recursively freezes a value and everything reachable from it.
 *
 * Every engine test passes its input state through this helper before
 * calling `reduce`, so any accidental mutation throws instead of silently
 * passing (CLAUDE.md, Rule 1.3). Returns the same reference it was given.
 */
export function deepFreeze<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<string | symbol, unknown>)[key]);
  }

  return value;
}
