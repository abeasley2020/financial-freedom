// Test-only. Reads FC_NUM_RUNS without importing Node types: the engine
// tsconfig has no DOM or Node lib, and the pure-package lint keeps `process`
// out of production code. Default 1,000 runs (CLAUDE.md, Commands).

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
const parsed = Number(env?.FC_NUM_RUNS);

export const NUM_RUNS = Number.isInteger(parsed) && parsed > 0 ? parsed : 1_000;
