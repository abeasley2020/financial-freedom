import { describe, expect, it } from 'vitest';

import { nextRandom, rollDie, shuffle } from './rng';

describe('rng (mulberry32)', () => {
  it('is deterministic: same state gives the same value and next state', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42));
  });

  it('returns a value in [0, 1) and a different next state', () => {
    const { value, state } = nextRandom(42);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
    expect(state).not.toBe(42);
    expect(Number.isInteger(state)).toBe(true);
  });

  it('produces a different sequence from a different seed', () => {
    const a = [nextRandom(1), nextRandom(nextRandom(1).state)].map((r) => r.value);
    const b = [nextRandom(2), nextRandom(nextRandom(2).state)].map((r) => r.value);
    expect(a).not.toEqual(b);
  });

  it('rollDie returns 1 to 6 and advances the state', () => {
    let state = 7;
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const roll = rollDie(state);
      expect(roll.value).toBeGreaterThanOrEqual(1);
      expect(roll.value).toBeLessThanOrEqual(6);
      expect(roll.state).not.toBe(state);
      seen.add(roll.value);
      state = roll.state;
    }
    expect(seen.size).toBe(6);
  });

  it('shuffle returns a permutation without touching the input', () => {
    const input = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    const { items, state } = shuffle(input, 99);
    expect([...items].sort()).toEqual([...input].sort());
    expect(items).not.toEqual(input);
    expect(state).not.toBe(99);
  });

  it('shuffle is deterministic for a given state', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    expect(shuffle(input, 5)).toEqual(shuffle(input, 5));
  });

  it('shuffle of an empty list returns an empty list and leaves the state unchanged', () => {
    expect(shuffle([], 3)).toEqual({ items: [], state: 3 });
  });
});
