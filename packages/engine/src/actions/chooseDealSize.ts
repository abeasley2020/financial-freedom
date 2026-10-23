import { CARDS_BY_ID, type Action, type GameState, type LogEvent, type Pending } from '@ff/shared';

import { drawCard } from '../decks';
import { rejected, type ActionResult } from '../reduce';
import { nextRandom } from '../rng';

/**
 * Spec, Card decks: an Opportunity space offers a small or big deal. The
 * chosen deck's top card becomes the buyOrPass decision. A stock card gets
 * its share price rolled inside the card's priceRange now, so the player
 * sees the price before deciding.
 */
export function chooseDealSize(state: GameState, action: Extract<Action, { type: 'CHOOSE_DEAL_SIZE' }>): ActionResult {
  if (state.pending.kind !== 'chooseDealSize') return rejected('INVALID_FOR_PENDING');

  const deck = action.size === 'small' ? 'smallDeals' : 'bigDeals';
  const draw = drawCard(state, deck);
  if (draw.cardId === undefined) {
    return { ok: true, state: { ...state, pending: { kind: 'none' } }, events: [] };
  }

  const card = CARDS_BY_ID.get(draw.cardId);
  if (card?.deck !== deck) {
    throw new Error(`unknown card id "${draw.cardId}" in deck ${deck}`);
  }

  const events: LogEvent[] = [...draw.events];
  let next = draw.state;
  let pending: Pending = { kind: 'buyOrPass', cardId: card.id };

  if (card.type === 'stock' && card.priceRange !== undefined) {
    const { min, max } = card.priceRange;
    const r = nextRandom(next.game.rngState);
    const sharePrice = min + Math.floor(r.value * (max - min + 1));
    next = { ...next, game: { ...next.game, rngState: r.state } };
    pending = { kind: 'buyOrPass', cardId: card.id, sharePrice };
    events.push({ kind: 'sharePriceRolled', cardId: card.id, sharePrice });
  }

  return { ok: true, state: { ...next, pending }, events };
}
