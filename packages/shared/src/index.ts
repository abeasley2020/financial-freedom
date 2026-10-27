// @ff/shared
//
// Types and Zod schemas for game state, cards, and actions (spec step 2), plus
// the profession, card, and board fixtures validated at load (spec step 3).

export * from './actions';
export * from './board';
export * from './cards';
export * from './data/index';
export * from './debrief';
export * from './money';
export * from './principles';
export * from './professions';
export type { DeepReadonly } from './readonly';
export * from './state';
