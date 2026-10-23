import {
  BOARD,
  BOARD_SIZE,
  BORROW_STEP,
  CARDS_BY_ID,
  DECISION_PRINCIPLES,
  LIABILITY_PAYMENT_PERCENT,
  type Action,
  type GameState,
  type Liability,
  type LogEvent,
  type Pending,
  type SpaceKind,
} from '@ff/shared';

import { drawCard } from '../decks';
import { pct } from '../money';
import { creditPayday } from '../payday';
import { rejected, type ActionResult } from '../reduce';
import { rollDie } from '../rng';
import { currentPlayer, hasRolledThisTurn, playerById } from '../selectors';

/**
 * Spec, Core rules, turn steps 1 to 3: Payday first (every turn is a month,
 * decided 2026-10-23, Q1), then roll one die, move, and resolve the landed
 * space. A Payday that takes cash below zero runs the bankruptcy sales; a
 * player who goes out at Payday does not roll, move, or resolve a space, and
 * only END_TURN remains.
 */
export function roll(state: GameState, action: Extract<Action, { type: 'ROLL' }>): ActionResult {
  if (state.pending.kind !== 'none') return rejected('INVALID_FOR_PENDING');
  if (hasRolledThisTurn(state)) return rejected('ALREADY_ROLLED');

  const { playerId } = action;
  const events: LogEvent[] = [];

  // Step 1: Payday.
  const paid = creditPayday(state, playerId);
  events.push(...paid.events);
  if (playerById(paid.state, playerId).isOut) {
    return { ok: true, state: { ...paid.state, pending: { kind: 'none' } }, events };
  }

  // Step 2: roll and move.
  const die = rollDie(paid.state.game.rngState);
  events.push({ kind: 'rolled', value: die.value });
  const from = currentPlayer(paid.state).position;
  const to = (from + die.value) % BOARD_SIZE;
  events.push({ kind: 'moved', from, to });

  let next: GameState = {
    ...paid.state,
    game: { ...paid.state.game, rngState: die.state },
    players: paid.state.players.map((p) => (p.id === playerId ? { ...p, position: to } : p)),
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

const nothing = (state: GameState): Resolution => ({ state, pending: { kind: 'none' }, events: [] });

function resolveSpace(state: GameState, space: SpaceKind): Resolution {
  switch (space) {
    case 'opportunity':
      // Kids mode has one Opportunity deck (spec, Core rules): the small deals.
      if (state.game.mode === 'kids') return drawInto(state, 'smallDeals', 'buyOrPass');
      return { state, pending: { kind: 'chooseDealSize' }, events: [] };
    case 'market':
      return drawInto(state, 'market', 'marketChoice');
    case 'lifeChoices':
      return drawInto(state, 'lifeChoices', 'lifeChoice');
    case 'giving':
      return { state, pending: { kind: 'giveOrSkip' }, events: [] };
    case 'setback':
      // Kids mode has no Setback spaces (spec, Core rules, Kids mode).
      if (state.game.mode === 'kids') return nothing(state);
      return resolveSetback(state);
  }
}

function drawInto(
  state: GameState,
  deck: 'smallDeals' | 'market' | 'lifeChoices',
  kind: 'buyOrPass' | 'marketChoice' | 'lifeChoice',
): Resolution {
  const draw = drawCard(state, deck);
  if (draw.cardId === undefined) return nothing(state);
  return { state: draw.state, pending: { kind, cardId: draw.cardId }, events: draw.events };
}

/**
 * Spec, Core rules, Setback (decided 2026-10-23): draw a Setback card and pay
 * its cost at once. If cash falls short, auto-borrow the smallest number of
 * $1,000 steps that covers it and skip the next turn. Also skip when the card
 * says so. The card goes straight to the discard pile.
 */
function resolveSetback(state: GameState): Resolution {
  const draw = drawCard(state, 'setback');
  if (draw.cardId === undefined) return nothing(state);
  const card = CARDS_BY_ID.get(draw.cardId);
  if (card?.deck !== 'setback') throw new Error(`unknown setback card "${draw.cardId}"`);

  const events: LogEvent[] = [...draw.events];
  const playerId = state.game.currentPlayerId;
  const player = playerById(draw.state, playerId);
  const cost = card.cashCost;

  let cash = player.cash;
  let liabilities = player.liabilities;
  let autoBorrowed = 0;
  if (cash < cost) {
    autoBorrowed = Math.ceil((cost - cash) / BORROW_STEP) * BORROW_STEP;
    const loan: Liability = {
      id: `${playerId}-bank-${String(state.game.log.length)}`,
      kind: 'bank',
      principal: autoBorrowed,
      monthlyPayment: pct(autoBorrowed, LIABILITY_PAYMENT_PERCENT.bank),
    };
    cash += autoBorrowed;
    liabilities = [...liabilities, loan];
    events.push({ kind: 'cashChanged', delta: autoBorrowed, reason: 'borrow' });
    events.push({
      kind: 'borrowed',
      liabilityId: loan.id,
      amount: autoBorrowed,
      monthlyPayment: loan.monthlyPayment,
      principles: DECISION_PRINCIPLES.setbackLoan,
      purpose: 'setback',
      cardId: card.id,
    });
  }
  cash -= cost;
  events.push({ kind: 'cashChanged', delta: -cost, reason: 'setback' });

  const skipsNextTurn = autoBorrowed > 0 || card.skipTurn;
  events.push({ kind: 'setback', cardId: card.id, cost, autoBorrowed, skipsNextTurn });

  const piles = draw.state.decks.setback;
  return {
    state: {
      ...draw.state,
      players: draw.state.players.map((p) =>
        p.id === playerId ? { ...p, cash, liabilities, skipsNextTurn: p.skipsNextTurn || skipsNextTurn } : p,
      ),
      decks: { ...draw.state.decks, setback: { ...piles, discardPile: [...piles.discardPile, card.id] } },
    },
    pending: { kind: 'none' },
    events,
  };
}
