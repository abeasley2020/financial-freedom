import { describe, expect, it } from 'vitest';

import { deepFreeze } from './deepFreeze';

describe('deepFreeze', () => {
  it('returns the same reference', () => {
    const input = { a: 1 };
    expect(deepFreeze(input)).toBe(input);
  });

  it('freezes the top level', () => {
    const frozen = deepFreeze({ cash: 400 });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(() => {
      (frozen as { cash: number }).cash = 0;
    }).toThrow(TypeError);
  });

  it('freezes nested objects and arrays', () => {
    const frozen = deepFreeze({
      players: [{ name: 'Ada', liabilities: [{ principal: 12_000 }] }],
    });

    const player = frozen.players[0];
    expect(player).toBeDefined();
    expect(Object.isFrozen(frozen.players)).toBe(true);
    expect(Object.isFrozen(player)).toBe(true);
    expect(Object.isFrozen(player?.liabilities[0])).toBe(true);

    expect(() => {
      (frozen.players as unknown[]).push({});
    }).toThrow(TypeError);
    expect(() => {
      (player?.liabilities[0] as { principal: number }).principal = 0;
    }).toThrow(TypeError);
  });

  it('passes primitives and null through', () => {
    expect(deepFreeze(5)).toBe(5);
    expect(deepFreeze('x')).toBe('x');
    expect(deepFreeze(null)).toBeNull();
  });

  it('does not loop on cyclic references', () => {
    const node: { self?: unknown } = {};
    node.self = node;
    expect(() => deepFreeze(node)).not.toThrow();
    expect(Object.isFrozen(node)).toBe(true);
  });
});
