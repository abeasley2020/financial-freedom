import { createGame, reduce, type CreateGameOptions, type EngineError } from '@ff/engine';
import type { Action, GameState } from '@ff/shared';
import { create } from 'zustand';

const SAVE_KEY = 'freedom-loop:game:v1';

interface GameStore {
  /** The engine state. Null in the lobby. */
  readonly state: GameState | null;
  /**
   * Host-side undo (spec Q7): earlier states this turn, newest last. Cleared
   * by ROLL and CHOOSE_DEAL_SIZE, so undo never goes back past a roll or a
   * card draw.
   */
  readonly undoStack: readonly GameState[];
  /** Why the last action was rejected, for the screen reader and the banner. */
  readonly lastError: EngineError | null;
  readonly start: (options: Omit<CreateGameOptions, 'id' | 'seed'>) => void;
  readonly dispatch: (action: Action) => boolean;
  readonly undo: () => void;
  readonly quit: () => void;
  readonly clearError: () => void;
}

/** Actions after which undo cannot go back: they rolled the die or drew a card. */
const UNDO_BARRIERS: ReadonlySet<Action['type']> = new Set(['ROLL', 'CHOOSE_DEAL_SIZE']);

interface Saved {
  readonly state: GameState | null;
  readonly undoStack: readonly GameState[];
}

function load(): Saved {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw === null) return { state: null, undoStack: [] };
    const saved = JSON.parse(raw) as Saved;
    return { state: saved.state, undoStack: saved.undoStack };
  } catch {
    return { state: null, undoStack: [] };
  }
}

function save(saved: Saved): void {
  try {
    if (saved.state === null) localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch {
    // Storage is a convenience: a private window simply loses the game on refresh.
  }
}

export const useGame = create<GameStore>((set, get) => ({
  ...load(),
  lastError: null,

  start: (options) => {
    const state = createGame({
      ...options,
      id: `game-${String(Date.now())}`,
      seed: Math.floor(Math.random() * 2_147_483_647),
    });
    set({ state, undoStack: [], lastError: null });
    save({ state, undoStack: [] });
  },

  dispatch: (action) => {
    const { state, undoStack } = get();
    if (state === null) return false;
    const result = reduce(state, action);
    if (!result.ok) {
      set({ lastError: result.error });
      return false;
    }
    const next = result.state;
    const stack = UNDO_BARRIERS.has(action.type) || next.game.phase !== 'playing' ? [] : [...undoStack, state];
    set({ state: next, undoStack: stack, lastError: null });
    save({ state: next, undoStack: stack });
    return true;
  },

  undo: () => {
    const { undoStack } = get();
    const previous = undoStack.at(-1);
    if (previous === undefined) return;
    const stack = undoStack.slice(0, -1);
    set({ state: previous, undoStack: stack, lastError: null });
    save({ state: previous, undoStack: stack });
  },

  quit: () => {
    set({ state: null, undoStack: [], lastError: null });
    save({ state: null, undoStack: [] });
  },

  clearError: () => {
    set({ lastError: null });
  },
}));
