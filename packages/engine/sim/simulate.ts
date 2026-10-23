// Plays whole games with bots and aggregates the numbers the spec asks for:
// game length, win rate by profession, bankruptcy rate.

import { PROFESSIONS, type GameMode, type GameState } from '@ff/shared';

import { createGame } from '../src/createGame';
import { reduce } from '../src/reduce';
import { nextRandom } from '../src/rng';
import { decide, STRATEGIES, type Strategy } from './bots';

export interface SimOptions {
  readonly games: number;
  readonly seed: number;
  readonly mode: GameMode;
  /** Turns (accepted END_TURNs) after which a game is abandoned as a draw. */
  readonly maxTurns: number;
  readonly minPlayers: number;
  readonly maxPlayers: number;
}

export interface GameRecord {
  readonly seed: number;
  readonly players: number;
  readonly seats: readonly { readonly professionId: string; readonly strategy: Strategy; readonly out: boolean; readonly won: boolean }[];
  readonly turns: number;
  readonly ending: 'escape' | 'lastStanding' | 'capped';
  readonly actions: number;
}

export interface Tally {
  readonly seats: number;
  readonly wins: number;
  readonly outs: number;
}

export interface SimReport {
  readonly options: SimOptions;
  readonly games: readonly GameRecord[];
  readonly endings: Readonly<Record<GameRecord['ending'], number>>;
  readonly turns: { readonly mean: number; readonly median: number; readonly p90: number; readonly max: number };
  readonly roundsPerGame: { readonly mean: number; readonly median: number };
  readonly byProfession: ReadonlyMap<string, Tally>;
  readonly byStrategy: ReadonlyMap<Strategy, Tally>;
  readonly byPlayerCount: ReadonlyMap<number, { readonly games: number; readonly medianTurns: number }>;
  /** Share of seats that went bankrupt, and share of games with at least one bankruptcy. */
  readonly bankruptcy: { readonly seatRate: number; readonly gameRate: number };
}

/** Deterministic picks for seating, from the engine's own PRNG so a report is reproducible. */
function drawInt(state: number, max: number): { value: number; state: number } {
  const r = nextRandom(state);
  return { value: Math.floor(r.value * max), state: r.state };
}

export function playGame(seed: number, options: SimOptions): GameRecord {
  let rng = seed ^ 0x5bd1e995;
  const count = drawInt(rng, options.maxPlayers - options.minPlayers + 1);
  rng = count.state;
  const players = options.minPlayers + count.value;

  const seats: { professionId: string; strategy: Strategy }[] = [];
  for (let i = 0; i < players; i++) {
    const p = drawInt(rng, PROFESSIONS.length);
    rng = p.state;
    const s = drawInt(rng, STRATEGIES.length);
    rng = s.state;
    const profession = PROFESSIONS[p.value];
    const strategy = STRATEGIES[s.value];
    if (profession === undefined || strategy === undefined) throw new Error('empty profession or strategy list');
    seats.push({ professionId: profession.id, strategy });
  }

  let state: GameState = createGame({
    id: `sim-${String(seed)}`,
    mode: options.mode,
    seed,
    players: seats.map((seat, i) => ({ id: `p${String(i + 1)}`, name: `Bot ${String(i + 1)}`, professionId: seat.professionId })),
  });

  let actions = 0;
  while (state.game.phase === 'playing' && state.game.turnNumber < options.maxTurns) {
    const seatIndex = state.players.findIndex((p) => p.id === state.game.currentPlayerId);
    const strategy = seats[seatIndex]?.strategy;
    if (strategy === undefined) throw new Error(`no seat for ${state.game.currentPlayerId}`);
    let moved = false;
    for (const action of decide(state, strategy)) {
      const result = reduce(state, action);
      if (result.ok) {
        state = result.state;
        actions++;
        moved = true;
        break;
      }
    }
    if (!moved) {
      throw new Error(
        `bot ${strategy} has no accepted move at turn ${String(state.game.turnNumber)} with pending ${state.pending.kind} (seed ${String(seed)})`,
      );
    }
  }

  const escaped = state.players.find((p) => p.hasEscaped);
  const inPlayers = state.players.filter((p) => !p.isOut);
  const ending: GameRecord['ending'] =
    escaped !== undefined ? 'escape' : state.game.phase === 'finished' && inPlayers.length === 1 ? 'lastStanding' : 'capped';
  const winnerId = escaped?.id ?? (ending === 'lastStanding' ? inPlayers[0]?.id : undefined);

  return {
    seed,
    players,
    seats: seats.map((seat, i) => {
      const player = state.players[i];
      return { ...seat, out: player?.isOut ?? false, won: player?.id === winnerId };
    }),
    turns: state.game.turnNumber,
    ending,
    actions,
  };
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
  return sorted[index] ?? 0;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

export function simulate(options: SimOptions, onGame?: (index: number) => void): SimReport {
  const games: GameRecord[] = [];
  for (let i = 0; i < options.games; i++) {
    games.push(playGame(options.seed + i, options));
    onGame?.(i);
  }

  const endings = { escape: 0, lastStanding: 0, capped: 0 };
  const byProfession = new Map<string, { seats: number; wins: number; outs: number }>();
  const byStrategy = new Map<Strategy, { seats: number; wins: number; outs: number }>();
  const byCount = new Map<number, number[]>();
  let seatsOut = 0;
  let seatsTotal = 0;
  let gamesWithOut = 0;

  for (const game of games) {
    endings[game.ending]++;
    byCount.set(game.players, [...(byCount.get(game.players) ?? []), game.turns]);
    let anyOut = false;
    for (const seat of game.seats) {
      seatsTotal++;
      const p = byProfession.get(seat.professionId) ?? { seats: 0, wins: 0, outs: 0 };
      p.seats++;
      if (seat.won) p.wins++;
      if (seat.out) p.outs++;
      byProfession.set(seat.professionId, p);
      const s = byStrategy.get(seat.strategy) ?? { seats: 0, wins: 0, outs: 0 };
      s.seats++;
      if (seat.won) s.wins++;
      if (seat.out) s.outs++;
      byStrategy.set(seat.strategy, s);
      if (seat.out) {
        seatsOut++;
        anyOut = true;
      }
    }
    if (anyOut) gamesWithOut++;
  }

  const turns = games.map((g) => g.turns).sort((a, b) => a - b);
  const rounds = games.map((g) => g.turns / g.players).sort((a, b) => a - b);

  return {
    options,
    games,
    endings,
    turns: { mean: mean(turns), median: quantile(turns, 0.5), p90: quantile(turns, 0.9), max: turns.at(-1) ?? 0 },
    roundsPerGame: { mean: mean(rounds), median: quantile(rounds, 0.5) },
    byProfession,
    byStrategy,
    byPlayerCount: new Map(
      [...byCount.entries()].sort(([a], [b]) => a - b).map(([count, list]) => [count, { games: list.length, medianTurns: quantile([...list].sort((a, b) => a - b), 0.5) }]),
    ),
    bankruptcy: { seatRate: seatsTotal === 0 ? 0 : seatsOut / seatsTotal, gameRate: games.length === 0 ? 0 : gamesWithOut / games.length },
  };
}
