// Test-only builders. Production code never imports from src/test/.

import { BOARD, CARDS_BY_ID, type DeckId, type Game, type GameState, type Player } from '@ff/shared';

import { createGame } from '../createGame';
import { reduce } from '../reduce';
import { rollDie } from '../rng';
import { passiveIncome, playerById, totalExpenses } from '../selectors';

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
 * Sets the player's salary so their monthly cash flow is exactly $0, which
 * makes every Payday credit nothing. Lets a test reason about cash boundaries
 * (a $10 gift, an exact down payment) without the Payday moving the numbers.
 */
export function withZeroCashFlow(state: GameState, playerId: string): GameState {
  const player = playerById(state, playerId);
  return withPlayer(state, playerId, { salary: totalExpenses(player) - passiveIncome(player) });
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

/** Puts `cardId` on top of `deck`'s draw pile, removing it from wherever else it was. */
export function onTopOfDeck(state: GameState, deck: DeckId, cardId: string): GameState {
  const piles = state.decks[deck];
  return {
    ...state,
    decks: {
      ...state.decks,
      [deck]: {
        drawPile: [cardId, ...piles.drawPile.filter((id) => id !== cardId)],
        discardPile: piles.discardPile.filter((id) => id !== cardId),
      },
    },
  };
}

/**
 * Rolls the current player (or `playerId`) from 3 onto Giving (space 4) and
 * skips the gift: the one way to finish a ROLL with nothing pending, no card
 * drawn, and no cash spent now that the board has no Payday spaces. Payday
 * still happens, so cash goes up by the player's monthly cash flow. Leaves
 * two log entries (ROLL, SKIP_GIVE).
 */
export function rolledClean(state: GameState, playerId = state.game.currentPlayerId): GameState {
  const turn = withGame(state, { currentPlayerId: playerId });
  const rolled = mustApply(withGame(aboutToRoll(turn, 3, 1), { currentPlayerId: playerId }), { type: 'ROLL', playerId });
  return mustApply(rolled, { type: 'SKIP_GIVE', playerId });
}

/**
 * Walks the real path to a buyOrPass decision for `cardId`: puts the card on
 * top of its deck, rolls the current player from 2 onto Opportunity (space 3),
 * and chooses that deck. For a stock, `sharePrice` overrides the rolled price
 * so a test can pin the cost. Payday happens on the way, so cash goes up by
 * the player's monthly cash flow.
 */
export function offered(state: GameState, cardId: string, sharePrice?: number): GameState {
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') {
    throw new Error(`fixture: "${cardId}" is not a deal card`);
  }
  const deck = card.deck;
  const onTop = onTopOfDeck(state, deck, cardId);
  const playerId = state.game.currentPlayerId;
  const rolled = mustApply(aboutToRoll(onTop, 2, 1), { type: 'ROLL', playerId });
  // Kids mode draws the small deal on landing, with no size to choose.
  const chosen =
    rolled.pending.kind === 'buyOrPass'
      ? rolled
      : mustApply(rolled, { type: 'CHOOSE_DEAL_SIZE', playerId, size: deck === 'smallDeals' ? 'small' : 'big' });
  if (sharePrice === undefined || chosen.pending.kind !== 'buyOrPass') return chosen;
  return { ...chosen, pending: { kind: 'buyOrPass', cardId, sharePrice } };
}

/**
 * Walks the real path to a marketChoice or payLifestyle decision for
 * `cardId`: puts the card on top of its deck and rolls the current player
 * from 0 onto the first board space of the matching kind (Lifestyle is space
 * 1, Market is space 2 on the v2 board). Payday happens on the way.
 */
export function drawn(state: GameState, cardId: string): GameState {
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'market' && card?.deck !== 'lifestyle') {
    throw new Error(`fixture: "${cardId}" is not a market or lifestyle card`);
  }
  const space = BOARD.indexOf(card.deck);
  if (space < 1 || space > 6) throw new Error(`fixture: no ${card.deck} space within one die roll of 0`);
  const onTop = onTopOfDeck(state, card.deck, cardId);
  return mustApply(aboutToRoll(onTop, 0, space), { type: 'ROLL', playerId: state.game.currentPlayerId });
}
