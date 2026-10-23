// Seeded PRNG (mulberry32). The only source of randomness in the engine
// (CLAUDE.md, Rule 1.4). Every function takes the current state and returns
// the next one; callers store it in game.rngState.

export interface Random<T> {
  readonly value: T;
  readonly state: number;
}

/** Next value in [0, 1) and the state to use for the draw after it. */
export function nextRandom(state: number): Random<number> {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  return { value, state: next };
}

/** One six-sided die. */
export function rollDie(state: number): Random<number> {
  const r = nextRandom(state);
  return { value: Math.floor(r.value * 6) + 1, state: r.state };
}

/** Fisher-Yates shuffle. Returns a new array; the input is untouched. */
export function shuffle<T>(items: readonly T[], state: number): { readonly items: readonly T[]; readonly state: number } {
  const out = [...items];
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const r = nextRandom(s);
    s = r.state;
    const j = Math.floor(r.value * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return { items: out, state: s };
}
