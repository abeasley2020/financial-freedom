import type { DeckId, GameState, LogEvent } from '@ff/shared';

import { shuffle } from './rng';

export interface Draw {
  readonly state: GameState;
  /** Undefined when both piles are empty. */
  readonly cardId: string | undefined;
  readonly events: readonly LogEvent[];
}

/**
 * Takes the top card off a deck's draw pile. When the draw pile is empty the
 * discard pile is shuffled (from game.rngState) into a new draw pile first.
 * The drawn card belongs to neither pile; the caller parks it in `pending`.
 */
export function drawCard(state: GameState, deck: DeckId): Draw {
  let piles = state.decks[deck];
  let rngState = state.game.rngState;

  if (piles.drawPile.length === 0 && piles.discardPile.length > 0) {
    const shuffled = shuffle(piles.discardPile, rngState);
    rngState = shuffled.state;
    piles = { drawPile: shuffled.items, discardPile: [] };
  }

  const [cardId, ...rest] = piles.drawPile;
  if (cardId === undefined) {
    return { state, cardId: undefined, events: [] };
  }

  return {
    state: {
      ...state,
      game: { ...state.game, rngState },
      decks: { ...state.decks, [deck]: { drawPile: rest, discardPile: piles.discardPile } },
    },
    cardId,
    events: [{ kind: 'drewCard', deck, cardId }],
  };
}
