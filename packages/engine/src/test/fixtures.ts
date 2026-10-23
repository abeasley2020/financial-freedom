// Test-only builders. Production code never imports from src/test/.

import { CARDS_BY_ID, type Game, type GameState, type Player } from '@ff/shared';

import { createGame } from '../createGame';
import { reduce } from '../reduce';
import { rollDie } from '../rng';

/** A standard two-player game: p1 Ada the Teacher (current), p2 Grace the Doctor. Seed 42. */
export function twoPlayerGame(overrides: Partial<Parameters<typeof createGame>[0]> = {}): GameState {
  return createGame({
    id: 'g1',
    mode: 'standard',
    seed: 42,
    players: [
      { id: 'p1', name: 'Ada', professionId: 'teacher' },
      { id: 'p2', name: 'Grace', professionId: 'doctor' },
    ],
    ...overrides,
  });
}

export function withGame(state: GameState, patch: Partial<Game>): GameState {
  return { ...state, game: { ...state.game, ...patch } };
}

export function withPlayer(state: GameState, playerId: string, patch: Partial<Player>): GameState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
  };
}

/**
 * Finds an rngState whose next die roll is `wanted`, searching upward from
 * `from`. Lets a test pin the roll without touching the PRNG's internals.
 */
export function rngStateForRoll(wanted: number, from = 0): number {
  for (let state = from; state < from + 10_000; state++) {
    if (rollDie(state).value === wanted) return state;
  }
  throw new Error(`no rngState near ${String(from)} rolls a ${String(wanted)}`);
}

/** Sets the current player's position and the next die roll. */
export function aboutToRoll(state: GameState, position: number, roll: number): GameState {
  return withGame(withPlayer(state, state.game.currentPlayerId, { position }), {
    rngState: rngStateForRoll(roll),
  });
}

function mustApply(state: GameState, action: Parameters<typeof reduce>[1]): GameState {
  const result = reduce(state, action);
  if (!result.ok) throw new Error(`fixture: ${action.type} rejected with ${result.error}`);
  return result.state;
}

/**
 * Walks the real path to a buyOrPass decision for `cardId`: puts the card on
 * top of its deck, rolls the current player from 0 onto Opportunity (space 1),
 * and chooses that deck. For a stock, `sharePrice` overrides the rolled price
 * so a test can pin the cost.
 */
export function offered(state: GameState, cardId: string, sharePrice?: number): GameState {
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') {
    throw new Error(`fixture: "${cardId}" is not a deal card`);
  }
  const deck = card.deck;
  const piles = state.decks[deck];
  const onTop: GameState = {
    ...state,
    decks: {
      ...state.decks,
      [deck]: {
        drawPile: [cardId, ...piles.drawPile.filter((id) => id !== cardId)],
        discardPile: piles.discardPile.filter((id) => id !== cardId),
      },
    },
  };
  const playerId = state.game.currentPlayerId;
  const rolled = mustApply(aboutToRoll(onTop, 0, 1), { type: 'ROLL', playerId });
  const chosen = mustApply(rolled, {
    type: 'CHOOSE_DEAL_SIZE',
    playerId,
    size: deck === 'smallDeals' ? 'small' : 'big',
  });
  if (sharePrice === undefined || chosen.pending.kind !== 'buyOrPass') return chosen;
  return { ...chosen, pending: { kind: 'buyOrPass', cardId, sharePrice } };
}
