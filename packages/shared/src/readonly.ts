/**
 * Recursively marks every property and array as readonly.
 *
 * Zod infers mutable types. The engine never mutates its input (CLAUDE.md,
 * Rule 1.3), so the exported state types are wrapped in this so the compiler
 * catches a stray assignment before deepFreeze does at runtime.
 */
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
