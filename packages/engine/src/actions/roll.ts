import { BOARD, BOARD_SIZE, type Action, type GameState, type LogEvent, type Pending, type SpaceKind } from '@ff/shared';

import { drawCard } from '../decks';
import { rejected, type ActionResult } from '../reduce';
import { rollDie } from '../rng';
import { currentPlayer, hasRolledThisTurn, monthlyCashFlow } from '../selectors';

/**
 * Spec, Core rules, turn steps 1 to 3: roll one die, move, credit each Payday
 * passed or landed on, then resolve the landed space.
 */
export function roll(state: GameState, action: Extract<Action, { type: 'ROLL' }>): ActionResult {
  if (state.pending.kind !== 'none') return rejected('INVALID_FOR_PENDING');
  if (hasRolledThisTurn(state)) return rejected('ALREADY_ROLLED');

  const events: LogEvent[] = [];
  const die = rollDie(state.game.rngState);
  events.push({ kind: 'rolled', value: die.value });

  const player = currentPlayer(state);
  const from = player.position;
  const to = (from + die.value) % BOARD_SIZE;
  events.push({ kind: 'moved', from, to });

  // Step 2: one Payday credit per Payday space passed or landed on.
  let cash = player.cash;
  for (let step = 1; step <= die.value; step++) {
    if (BOARD[(from + step) % BOARD_SIZE] === 'payday') {
      const amount = monthlyCashFlow(player);
      cash += amount;
      events.push({ kind: 'payday', amount });
    }
  }

  let next: GameState = {
    ...state,
    game: { ...state.game, rngState: die.state },
    players: state.players.map((p) => (p.id === action.playerId ? { ...p, position: to, cash } : p)),
  };

  // Step 3: resolve the landed space.
  const space = BOARD[to];
  if (space === undefined) throw new Error(`no board space at position ${String(to)}`);
  const resolved = resolveSpace(next, space);
  next = { ...resolved.state, pending: resolved.pending };
  events.push(...resolved.events);

  return { ok: true, state: next, events };
}

interface Resolution {
  readonly state: GameState;
  readonly pending: Pending;
  readonly events: readonly LogEvent[];
}

function resolveSpace(state: GameState, space: SpaceKind): Resolution {
  switch (space) {
    case 'opportunity':
      // Kids mode has one Opportunity deck (spec, Core rules): the small deals.
      if (state.game.mode === 'kids') return drawInto(state, 'smallDeals', 'buyOrPass');
      return { state, pending: { kind: 'chooseDealSize' }, events: [] };
    case 'market':
      return drawInto(state, 'market', 'marketChoice');
    case 'lifestyle':
      return drawInto(state, 'lifestyle', 'payLifestyle');
    case 'giving':
      return { state, pending: { kind: 'giveOrSkip' }, events: [] };
    case 'payday':
      // Already credited in step 2.
      return { state, pending: { kind: 'none' }, events: [] };
    case 'setback':
      // Resolution is blocked on CLAUDE.md spec gap 1. Landing here does nothing yet.
      return { state, pending: { kind: 'none' }, events: [] };
  }
}

function drawInto(
  state: GameState,
  deck: 'smallDeals' | 'market' | 'lifestyle',
  kind: 'buyOrPass' | 'marketChoice' | 'payLifestyle',
): Resolution {
  const draw = drawCard(state, deck);
  if (draw.cardId === undefined) {
    return { state, pending: { kind: 'none' }, events: [] };
  }
  return { state: draw.state, pending: { kind, cardId: draw.cardId }, events: draw.events };
}
