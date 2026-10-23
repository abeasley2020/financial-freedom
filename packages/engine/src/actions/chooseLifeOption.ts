import {
  CARDS_BY_ID,
  DECISION_PRINCIPLES,
  type Action,
  type GameState,
  type GrowthAsset,
  type Liability,
  type LifeEffect,
  type LogEvent,
  type Player,
  type PrincipleId,
} from '@ff/shared';

import { rejected, type ActionResult } from '../reduce';
import { cheapestOption, currentPlayer, largestLoan, optionCost, paidDown, priciestOption } from '../selectors';

/**
 * Spec v2, Card decks, Life Choices cards: pick one option on the drawn card
 * and apply its effects in order. An option the player cannot afford in cash
 * is rejected (in standard mode they may BORROW first); in kids mode only
 * options marked kidsOk may be chosen. The decision event records the two
 * numbers for the chosen, cheapest, and priciest options (spec, Decision log).
 * The card then goes to the discard pile.
 */
export function chooseLifeOption(state: GameState, action: Extract<Action, { type: 'CHOOSE_LIFE_OPTION' }>): ActionResult {
  if (state.pending.kind !== 'lifeChoice') return rejected('INVALID_FOR_PENDING');

  const { cardId } = state.pending;
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'lifeChoices') throw new Error(`unknown Life Choices card "${cardId}" in pending lifeChoice`);

  const option = card.options.find((o) => o.id === action.optionId);
  if (option === undefined) return rejected('INVALID_OPTION');
  if (state.game.mode === 'kids' && !option.kidsOk) return rejected('INVALID_OPTION');

  const before = currentPlayer(state);
  const cost = optionCost(option, before);
  if (before.cash < cost.costToday) return rejected('INSUFFICIENT_CASH');

  const numbers = (o: typeof option) => ({ optionId: o.id, ...optionCost(o, before) });
  const events: LogEvent[] = [
    {
      kind: 'choseLifeOption',
      cardId,
      optionId: option.id,
      principles: option.principles,
      costToday: cost.costToday,
      monthlyChange: cost.monthlyChange,
      cheapest: numbers(cheapestOption(card, before)),
      priciest: numbers(priciestOption(card, before)),
    },
  ];

  const idBase = `${before.id}-${cardId}-${String(state.game.log.length)}`;
  let player: Player = before;
  option.effects.forEach((effect, index) => {
    const applied = applyEffect(player, effect, `${idBase}-${String(index)}`, cardId, option.principles);
    player = applied.player;
    events.push(...applied.events);
  });

  const piles = state.decks.lifeChoices;
  return {
    ok: true,
    state: {
      ...state,
      players: state.players.map((p) => (p.id === player.id ? player : p)),
      decks: { ...state.decks, lifeChoices: { ...piles, discardPile: [...piles.discardPile, cardId] } },
      pending: { kind: 'none' },
    },
    events,
  };
}

interface Applied {
  readonly player: Player;
  readonly events: readonly LogEvent[];
}

function applyEffect(player: Player, effect: LifeEffect, id: string, cardId: string, principles: readonly PrincipleId[]): Applied {
  switch (effect.kind) {
    case 'payCash':
      return { player: { ...player, cash: player.cash - effect.amount }, events: [{ kind: 'cashChanged', delta: -effect.amount, reason: 'lifeChoice' }] };

    case 'gainCash':
      return { player: { ...player, cash: player.cash + effect.amount }, events: [{ kind: 'cashChanged', delta: effect.amount, reason: 'windfall' }] };

    case 'addLoan': {
      const loan: Liability = {
        id,
        kind: effect.loanKind,
        principal: effect.principal,
        monthlyPayment: effect.monthlyPayment,
        sourceCardId: cardId,
      };
      return {
        player: { ...player, liabilities: [...player.liabilities, loan] },
        events: [{ kind: 'loanAdded', liabilityId: id, loanKind: effect.loanKind, principal: effect.principal, monthlyPayment: effect.monthlyPayment }],
      };
    }

    case 'addSubscription': {
      const subscription: Liability = { id, kind: 'subscription', principal: 0, monthlyPayment: effect.monthlyCost, sourceCardId: cardId };
      return {
        player: { ...player, liabilities: [...player.liabilities, subscription] },
        events: [{ kind: 'subscriptionAdded', liabilityId: id, monthlyCost: effect.monthlyCost }],
      };
    }

    case 'investGrowth': {
      const asset: GrowthAsset = {
        id,
        cardId,
        type: effect.assetType,
        purchasePrice: effect.amount,
        downPaid: effect.amount,
        marketValue: effect.amount,
        growthPercent: effect.growthPercent,
        payoutPercent: effect.payoutPercent,
      };
      return {
        player: { ...player, cash: player.cash - effect.amount, assets: [...player.assets, asset] },
        events: [
          { kind: 'cashChanged', delta: -effect.amount, reason: 'invest' },
          { kind: 'bought', assetId: id, cardId, cost: effect.amount, principles },
        ],
      };
    }

    case 'repayLargestLoan': {
      const loan = largestLoan(player);
      if (loan === undefined) return { player, events: [] };
      const after = paidDown(loan, effect.amount);
      const cash = player.cash - after.paid;
      const events: LogEvent[] = [{ kind: 'cashChanged', delta: -after.paid, reason: 'repay' }];
      if (after.principal === 0) {
        events.push({ kind: 'repaid', liabilityId: loan.id, principal: after.paid, principles: DECISION_PRINCIPLES.repayLoan });
        return { player: { ...player, cash, liabilities: player.liabilities.filter((l) => l.id !== loan.id) }, events };
      }
      events.push({ kind: 'paidDown', liabilityId: loan.id, amount: after.paid, principal: after.principal, monthlyPayment: after.monthlyPayment });
      return {
        player: {
          ...player,
          cash,
          liabilities: player.liabilities.map((l) => (l.id === loan.id ? { ...l, principal: after.principal, monthlyPayment: after.monthlyPayment } : l)),
        },
        events,
      };
    }
  }
}
