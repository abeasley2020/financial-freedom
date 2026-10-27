import {
  PRINCIPLE_IDS,
  type Debrief,
  type DebriefDecision,
  type DebriefResult,
  type DebriefSuggestion,
  type GameState,
  type MoneyStory,
  type ReadingLevel,
} from '@ff/shared';

import { freedomPercent, passiveIncome, playerById, rankPlayers, roundNumber, totalExpenses, winner } from '../selectors';
import { attribute, type Ledger, type Scored } from './attribution';

/** Up to three decisions per list (spec, The debrief, sections 2 to 4). */
const LIST_SIZE = 3;
/** Up to two suggestions (section 5). */
const SUGGESTIONS = 2;

/**
 * Spec v2, The debrief: one player's end-of-game debrief as structured data,
 * a pure function of the final state and its log. The seven sections, in
 * order: result, why you won or lost (the three largest dollar impacts),
 * decisions that helped, decisions that hurt, next time try, money story,
 * principles practiced. Winners get the hurt decisions and suggestions too.
 * The kids reading level rounds every dollar figure to the nearest $10; the
 * choice of decisions and the Freedom points come from the exact numbers.
 * Text is not made here: templates in @ff/shared fill these numbers in.
 */
export function debrief(state: GameState, playerId: string, readingLevel: ReadingLevel): Debrief {
  const player = playerById(state, playerId);
  const ledger = attribute(state, playerId);

  // Largest absolute impact first; Array.prototype.sort is stable, so ties keep log order.
  // A kid is never shown a decision that rounds to $0: there is nothing to say about it.
  const ranked = [...ledger.decisions]
    .filter((s) => readingLevel === 'adult' || toTen(s.decision.dollars) > 0)
    .sort((a, b) => Math.abs(b.decision.impact) - Math.abs(a.decision.impact));
  const helped = ranked.filter((s) => s.decision.outcome === 'helped');
  const hurt = ranked.filter((s) => s.decision.outcome === 'hurt');
  const practiced = ledger.decisions.filter((s) => s.decision.outcome === 'helped');

  const finalTotal = totalExpenses(player);
  const suggestions = hurt.slice(0, SUGGESTIONS).map((s) => suggestion(s, finalTotal));
  const principlesPracticed = PRINCIPLE_IDS.filter((id) => practiced.some((s) => s.decision.principles.includes(id)));

  const result = resultOf(state, playerId, ledger);
  const exact: Debrief = {
    readingLevel,
    result,
    drivers: ranked.slice(0, LIST_SIZE).map((s) => s.decision),
    helped: helped.slice(0, LIST_SIZE).map((s) => s.decision),
    hurt: hurt.slice(0, LIST_SIZE).map((s) => s.decision),
    suggestions,
    moneyStory: moneyStoryOf(ledger, passiveIncome(player), finalTotal, result.rounds),
    principlesPracticed,
  };
  return readingLevel === 'kids' ? roundForKids(exact) : exact;
}

/** Spec, Next time, try: Freedom points for a monthly difference = floor(monthly × 100 / final totalExpenses). */
function suggestion(scored: Scored, finalTotal: number): DebriefSuggestion {
  const { decision, monthly } = scored;
  const principle = decision.principles[0];
  if (principle === undefined) throw new Error(`debrief: decision at ${String(decision.ref.entry)} has no principle`);
  return {
    decision,
    principle,
    dollars: decision.dollars,
    monthly,
    freedomPoints: finalTotal > 0 ? Math.floor((monthly * 100) / finalTotal) : 0,
  };
}

function resultOf(state: GameState, playerId: string, ledger: Ledger): DebriefResult {
  const player = playerById(state, playerId);
  const champion = winner(state);
  // The winner first (an escaper wins outright), then everyone still in by the ranking rule.
  const order = [...(champion === undefined ? [] : [champion]), ...rankPlayers(state).filter((p) => p.id !== champion?.id)];
  const place = order.findIndex((p) => p.id === playerId);
  const ending = lastEnding(state);
  return {
    playerId,
    professionId: player.professionId,
    freedomPercent: freedomPercent(player),
    passiveIncome: passiveIncome(player),
    totalExpenses: totalExpenses(player),
    won: champion?.id === playerId,
    escaped: player.hasEscaped,
    ...(player.isOut || place < 0 ? {} : { place: place + 1 }),
    players: state.players.length,
    ...(ending === undefined ? {} : { ending }),
    rounds: roundNumber(state),
    ...(ledger.wentOutRound === undefined ? {} : { wentOutRound: ledger.wentOutRound }),
  };
}

function lastEnding(state: GameState): DebriefResult['ending'] {
  for (let i = state.game.log.length - 1; i >= 0; i--) {
    for (const event of state.game.log[i]?.events ?? []) if (event.kind === 'gameEnded') return event.reason;
  }
  return undefined;
}

/** Spec, Money story: the two lines at every paydaySnapshot. Freedom is the first round passiveIncome reaches totalExpenses. */
function moneyStoryOf(ledger: Ledger, finalPassive: number, finalTotal: number, rounds: number): MoneyStory {
  const points = ledger.snapshots.map(({ ref, round, passiveIncome: passive, totalExpenses: total }) => ({ ref, round, passiveIncome: passive, totalExpenses: total }));
  const crossed = points.find((p) => p.passiveIncome >= p.totalExpenses)?.round ?? (finalPassive >= finalTotal ? rounds : undefined);
  return {
    points,
    final: { passiveIncome: finalPassive, totalExpenses: finalTotal },
    ...(crossed === undefined ? {} : { freedomRound: crossed }),
  };
}

/** Nearest $10, halves away from zero, so a cost and a gain of the same size round alike. Never -0. */
function toTen(amount: number): number {
  return amount < 0 ? 0 - toTen(-amount) : Math.floor((amount + 5) / 10) * 10;
}

function roundDecision(d: DebriefDecision): DebriefDecision {
  const shared = { impact: toTen(d.impact), dollars: toTen(d.dollars) };
  switch (d.kind) {
    case 'lifeChoice':
      return { ...d, ...shared, todayDifference: toTen(d.todayDifference), monthlyDifference: toTen(d.monthlyDifference) };
    case 'passedDeal':
      return { ...d, ...shared, monthlyCashFlow: toTen(d.monthlyCashFlow) };
    case 'boughtDeal':
      return {
        ...d,
        ...shared,
        cost: toTen(d.cost),
        cashFlowReceived: toTen(d.cashFlowReceived),
        ...(d.saleResult === undefined ? {} : { saleResult: toTen(d.saleResult) }),
      };
    case 'bankLoan':
    case 'setbackLoan':
      return { ...d, ...shared, amount: toTen(d.amount), monthlyPayment: toTen(d.monthlyPayment) };
    case 'subscription':
      return { ...d, ...shared, monthlyCost: toTen(d.monthlyCost) };
    case 'growthAsset':
      return { ...d, ...shared, invested: toTen(d.invested), valueGained: toTen(d.valueGained), payouts: toTen(d.payouts) };
    case 'gave':
      return { ...d, ...shared };
  }
}

/** Spec, Reading levels: kids see numbers rounded to $10. Percentages, Freedom points, months, and rounds stay exact. */
function roundForKids(d: Debrief): Debrief {
  return {
    ...d,
    result: { ...d.result, passiveIncome: toTen(d.result.passiveIncome), totalExpenses: toTen(d.result.totalExpenses) },
    drivers: d.drivers.map(roundDecision),
    helped: d.helped.map(roundDecision),
    hurt: d.hurt.map(roundDecision),
    suggestions: d.suggestions.map((s) => ({ ...s, decision: roundDecision(s.decision), dollars: toTen(s.dollars), monthly: toTen(s.monthly) })),
    moneyStory: {
      ...d.moneyStory,
      points: d.moneyStory.points.map((p) => ({ ...p, passiveIncome: toTen(p.passiveIncome), totalExpenses: toTen(p.totalExpenses) })),
      final: { passiveIncome: toTen(d.moneyStory.final.passiveIncome), totalExpenses: toTen(d.moneyStory.final.totalExpenses) },
    },
  };
}
