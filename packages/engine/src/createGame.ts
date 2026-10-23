import {
  CARDS_BY_DECK,
  DECK_IDS,
  LIABILITY_PAYMENT_PERCENT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PROFESSIONS,
  type Card,
  type DeckId,
  type DeckPiles,
  type GameMode,
  type GameState,
  type Liability,
  type Player,
} from '@ff/shared';

import { pct } from './money';
import { shuffle } from './rng';

export interface CreateGameOptions {
  readonly id: string;
  readonly mode: GameMode;
  readonly seed: number;
  readonly players: readonly { readonly id: string; readonly name: string; readonly professionId: string }[];
}

/**
 * Which cards a mode plays with (spec v2, Kids mode): standard mode plays
 * every card; kids mode plays only cards marked kidsOk and never a single
 * stock, even if one were marked kidsOk by mistake.
 */
export function inDeckForMode(card: Card, mode: GameMode): boolean {
  if (mode === 'standard') return true;
  if (!card.kidsOk) return false;
  return !((card.deck === 'smallDeals' || card.deck === 'bigDeals') && card.type === 'stock');
}

/**
 * Builds the initial state for a game. Throws on bad setup input (unknown
 * profession, duplicate ids, wrong player count); those are programmer or
 * lobby bugs, not game moves.
 */
export function createGame(options: CreateGameOptions): GameState {
  const { id, mode, seed, players: seats } = options;

  if (seats.length < MIN_PLAYERS || seats.length > MAX_PLAYERS) {
    throw new Error(
      `a game needs ${String(MIN_PLAYERS)} to ${String(MAX_PLAYERS)} players, got ${String(seats.length)}`,
    );
  }
  const ids = new Set<string>();
  for (const seat of seats) {
    if (ids.has(seat.id)) throw new Error(`duplicate player id "${seat.id}"`);
    ids.add(seat.id);
  }

  const players: Player[] = seats.map((seat) => {
    const profession = PROFESSIONS.find((p) => p.id === seat.professionId);
    if (profession === undefined) throw new Error(`unknown professionId "${seat.professionId}"`);

    const liabilities: Liability[] = profession.startingLiabilities.map((l, index) => ({
      id: `${seat.id}-${l.kind}-${String(index)}`,
      kind: l.kind,
      principal: l.principal,
      monthlyPayment: pct(l.principal, LIABILITY_PAYMENT_PERCENT[l.kind]),
    }));

    return {
      id: seat.id,
      name: seat.name,
      professionId: profession.id,
      position: 0,
      cash: profession.startingCash,
      salary: profession.salary,
      assets: [],
      liabilities,
      favorTokens: 0,
      isOut: false,
      hasEscaped: false,
      skipsNextTurn: false,
    };
  });

  let rngState = seed;
  const decks = {} as Record<DeckId, DeckPiles>;
  for (const deck of DECK_IDS) {
    const cardIds = CARDS_BY_DECK[deck]
      .filter((card) => inDeckForMode(card, mode))
      .map((card) => card.id);
    const shuffled = shuffle(cardIds, rngState);
    rngState = shuffled.state;
    decks[deck] = { drawPile: shuffled.items, discardPile: [] };
  }

  const first = seats[0];
  if (first === undefined) throw new Error('unreachable: player count checked above');

  return {
    game: {
      id,
      mode,
      phase: 'playing',
      turnNumber: 0,
      currentPlayerId: first.id,
      rngSeed: seed,
      rngState,
      log: [],
    },
    players,
    decks,
    pending: { kind: 'none' },
  };
}
