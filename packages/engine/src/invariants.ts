// Engine invariants (CLAUDE.md, Engine invariants). The property suite calls
// `checkInvariants` after every accepted action; `assertInvariants` throws
// with every violation listed so a failing run names the rule that broke.

import { CARDS_BY_DECK, CARDS_BY_ID, DECK_IDS, GameStateSchema, isGrowthAsset, type DeckId, type GameState } from '@ff/shared';

import { inDeckForMode } from './createGame';
import { hasRolledThisTurn, roundLimit, roundNumber } from './selectors';

/** Card ids a deck holds in this mode (CLAUDE.md: never hard-code counts). */
export function fullDeck(state: GameState, deck: DeckId): readonly string[] {
  return CARDS_BY_DECK[deck].filter((card) => inDeckForMode(card, state.game.mode)).map((card) => card.id);
}

/** Every rule that must hold of a state between actions. Returns the violations, empty when the state is sound. */
export function checkInvariants(state: GameState): readonly string[] {
  const violations: string[] = [];

  // Shape and money: integers, non-negative cash, strict objects, one pending value.
  const parsed = GameStateSchema.safeParse(state);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) violations.push(`schema: ${issue.path.join('.')}: ${issue.message}`);
  }

  // Players.
  const playerIds = new Set<string>();
  const assetIds = new Set<string>();
  for (const player of state.players) {
    if (playerIds.has(player.id)) violations.push(`duplicate player id "${player.id}"`);
    playerIds.add(player.id);
    if (!player.isOut && player.cash < 0) violations.push(`player "${player.id}" is in with cash ${String(player.cash)}`);
    if (player.isOut && player.assets.length > 0) violations.push(`player "${player.id}" is out but still holds assets`);
    if (player.isOut && player.hasEscaped) violations.push(`player "${player.id}" is both out and escaped`);
    if (player.hasEscaped && state.game.phase !== 'finished') violations.push(`player "${player.id}" escaped but the game goes on`);

    const liabilityIds = new Set<string>();
    for (const liability of player.liabilities) {
      if (liabilityIds.has(liability.id)) violations.push(`player "${player.id}" has duplicate liability id "${liability.id}"`);
      liabilityIds.add(liability.id);
      if (liability.kind === 'mortgage' && !player.assets.some((a) => a.id === liability.assetId)) {
        violations.push(`mortgage "${liability.id}" on player "${player.id}" finances no asset they hold`);
      }
      if (liability.kind === 'subscription' && liability.principal !== 0) {
        violations.push(`subscription "${liability.id}" on player "${player.id}" has principal ${String(liability.principal)}, must be 0`);
      }
      if (liability.sourceCardId !== undefined && CARDS_BY_ID.get(liability.sourceCardId)?.deck !== 'lifeChoices') {
        violations.push(`liability "${liability.id}" on player "${player.id}" has sourceCardId "${liability.sourceCardId}", which is not a Life Choices card`);
      }
    }
    for (const asset of player.assets) {
      if (assetIds.has(asset.id)) violations.push(`duplicate asset id "${asset.id}"`);
      assetIds.add(asset.id);
      const card = CARDS_BY_ID.get(asset.cardId);
      if (isGrowthAsset(asset)) {
        // A growth asset comes from a growth deal card of the same type or from a Life Choices option that invests in that type; its card never leaves its deck.
        const fromDeal = (card?.deck === 'smallDeals' || card?.deck === 'bigDeals') && card.type === asset.type;
        const fromOption =
          card?.deck === 'lifeChoices' && card.options.some((o) => o.effects.some((e) => e.kind === 'investGrowth' && e.assetType === asset.type));
        if (!fromDeal && !fromOption) violations.push(`growth asset "${asset.id}" of type ${asset.type} cannot come from card "${asset.cardId}"`);
        if (asset.marketValue < 0) violations.push(`growth asset "${asset.id}" has marketValue ${String(asset.marketValue)}`);
      } else if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') {
        violations.push(`asset "${asset.id}" references non-deal card "${asset.cardId}"`);
      } else if ((card.type === 'stock') !== (asset.type === 'stock')) {
        violations.push(`asset "${asset.id}" type does not match its card type`);
      }
    }
  }

  // Current player.
  const current = state.players.find((p) => p.id === state.game.currentPlayerId);
  if (current === undefined) violations.push(`currentPlayerId "${state.game.currentPlayerId}" is not seated`);
  else if (current.isOut && state.game.phase === 'playing' && !(hasRolledThisTurn(state) && state.pending.kind === 'none')) {
    // A player who goes out during their own ROLL stays current until their END_TURN; that is the only allowed case.
    violations.push(`current player "${current.id}" is out while the game is playing`);
  }

  // Decks: drawPile + discardPile + cards held as assets + the card awaiting a decision = the deck, with no duplicates.
  // Stock lots and growth assets never take their card out of its deck.
  const pendingCardId = 'cardId' in state.pending ? state.pending.cardId : undefined;
  for (const deck of DECK_IDS) {
    const piles = state.decks[deck];
    const held = state.players.flatMap((p) =>
      p.assets.filter((a) => a.type !== 'stock' && !isGrowthAsset(a) && CARDS_BY_ID.get(a.cardId)?.deck === deck).map((a) => a.cardId),
    );
    const pending = pendingCardId !== undefined && CARDS_BY_ID.get(pendingCardId)?.deck === deck ? [pendingCardId] : [];
    const all = [...piles.drawPile, ...piles.discardPile, ...held, ...pending];
    const expected = [...fullDeck(state, deck)].sort();
    const actual = [...all].sort();
    if (actual.length !== expected.length || actual.some((id, i) => id !== expected[i])) {
      violations.push(
        `deck ${deck}: draw ${String(piles.drawPile.length)} + discard ${String(piles.discardPile.length)} + held ${String(held.length)} + pending ${String(pending.length)} = ${String(all.length)}, deck size ${String(expected.length)} (missing ${expected.filter((id) => !actual.includes(id)).join(',') || 'none'}; extra ${actual.filter((id) => !expected.includes(id)).join(',') || 'none'})`,
      );
    }
  }

  // Pending decisions name a card of the right deck.
  const pending = state.pending;
  if (pending.kind === 'buyOrPass') {
    const card = CARDS_BY_ID.get(pending.cardId);
    if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') violations.push(`buyOrPass names non-deal card "${pending.cardId}"`);
    else if ((card.type === 'stock') !== (pending.sharePrice !== undefined)) violations.push(`buyOrPass sharePrice does not match card type for "${pending.cardId}"`);
  }
  if (pending.kind === 'marketChoice' && CARDS_BY_ID.get(pending.cardId)?.deck !== 'market') violations.push(`marketChoice names non-market card "${pending.cardId}"`);
  if (pending.kind === 'lifeChoice' && CARDS_BY_ID.get(pending.cardId)?.deck !== 'lifeChoices') violations.push(`lifeChoice names non-Life-Choices card "${pending.cardId}"`);

  // The game never runs past the round limit (spec v2 invariant).
  if (state.game.phase === 'playing' && roundNumber(state) > roundLimit(state)) {
    violations.push(`the game is in round ${String(roundNumber(state))} but the round limit is ${String(roundLimit(state))}`);
  }

  // Log turn numbers never decrease and never exceed the current turn.
  let lastTurn = 0;
  for (const entry of state.game.log) {
    if (entry.turnNumber < lastTurn) violations.push(`log turn numbers go backwards at turn ${String(entry.turnNumber)}`);
    lastTurn = entry.turnNumber;
  }
  if (lastTurn > state.game.turnNumber) violations.push(`log reaches turn ${String(lastTurn)} but the game is at turn ${String(state.game.turnNumber)}`);

  return violations;
}

/** Throws listing every violation. */
export function assertInvariants(state: GameState): void {
  const violations = checkInvariants(state);
  if (violations.length > 0) throw new Error(`invariants violated:\n  ${violations.join('\n  ')}`);
}
