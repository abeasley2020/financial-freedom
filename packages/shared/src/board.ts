import { z } from 'zod';

import type { DeepReadonly } from './readonly';

/** Spaces on the inner loop (spec, Core rules). */
export const BOARD_SIZE = 24;

/** v2 (spec, Core rules, Board): there are no Payday spaces. Payday happens at the start of every turn. */
export const SPACE_KINDS = ['opportunity', 'market', 'lifeChoices', 'giving', 'setback'] as const;
export const SpaceKindSchema = z.enum(SPACE_KINDS);
export type SpaceKind = z.infer<typeof SpaceKindSchema>;

/** The inner loop in play order. Index = board position. */
export const BoardSchema = z.array(SpaceKindSchema).length(BOARD_SIZE);
export type Board = DeepReadonly<z.infer<typeof BoardSchema>>;
