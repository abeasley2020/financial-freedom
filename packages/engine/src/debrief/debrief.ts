// Spec v2, The debrief: a pure function of the final state and the log. It
// never replays the game. Every number comes from the spec's attribution
// table, applied by walking the log once: "Paydays afterward" are the
// player's paydaySnapshot events after the decision, which is how many months
// the decision kept paying or costing.

import {
  CARDS_BY_ID,
  isGrowthAssetType,
  PRINCIPLE_IDS,
  type Debrief,
  type DebriefDecision,
  type DebriefOutcome,
  type DebriefResult,
  type DebriefSuggestion,
  type DecisionKind,
  type GameEndReason,
  type GameState,
  type LoanPurpose,
  type LogEntry,
  type LogEvent,
  type MoneyStoryPoint,
  type OptionNumbers,
  type Player,
  type PrincipleId,
  type ReadingLevel,
} from '@ff/shared';

import { pct } from '../money';
import { freedomPercent, passiveIncome, playerById, rankPlayers, roundNumber, totalExpenses } from '../selectors';

/** Spec, attribution table: the principle column for the rows whose principles are fixed. */
const ROW_PRINCIPLES = {
  passedDeal: ['P2', 'P3'],
  bankLoan: ['P5'],
  setbackLoan: ['P1'],
  subscription: ['P7'],
  growthHeld: ['P8'],
  gave: ['P10'],
} as const satisfies Partial<Record<DecisionKind, readonly PrincipleId[]>>;

/** Where a decision's event sits in the log, and what round it was made in. */
interface Origin {
  readonly logIndex: number;
  readonly eventIndex: number;
  readonly roundNumber: number;
}

type Tracked =
  | (Origin & { readonly kind: 'lifeChoice'; readonly event: Extract<LogEvent, { kind: 'choseLifeOption' }>; paydays: number })
  | (Origin & { readonly kind: 'passedDeal'; readonly event: Extract<LogEvent, { kind: 'passed' }>; paydays: number })
  | (Origin & {
      readonly kind: 'boughtDeal';
      readonly assetId: string;
      readonly cardId: string;
      readonly principles: readonly PrincipleId[];
      /** Cash paid still counted against the asset (shrinks with a partial stock sale). */
      basis: number;
      cashFlow: number;
      shares: number | undefined;
      readonly dividend: number;
      received: number;
      saleNet: number;
      held: boolean;
      paydays: number;
    })
  | (Origin & {
      readonly kind: 'growthHeld';
      readonly assetId: string;
      readonly cardId: string;
      readonly cost: number;
      readonly payoutPercent: number;
      value: number;
      payouts: number;
      held: boolean;
      paydays: number;
    })
  | (Origin & {
      readonly kind: 'bankLoan' | 'setbackLoan';
      readonly liabilityId: string;
      readonly purpose: LoanPurpose;
      readonly cardId: string | undefined;
      payment: number;
      paid: number;
      active: boolean;
      paydays: number;
    })
  | (Origin & {
      readonly kind: 'subscription';
      readonly liabilityId: string;
      readonly cost: number;
      /** The Life Choices option that added it, from the same log entry. */
      readonly source: { readonly cardId: string; readonly optionId: string } | undefined;
      paid: number;
      active: boolean;
      paydays: number;
    })
  | (Origin & { readonly kind: 'gave'; readonly amount: number; paydays: number });

interface Walk {
  readonly tracked: readonly Tracked[];
  readonly moneyStory: readonly MoneyStoryPoint[];
  readonly roundOut: number | undefined;
  /** At each of the player's Paydays, the passive income the tracked assets add up to. The property suite checks it against the snapshot. */
  readonly trackedPassive: readonly number[];
}

/**
 * The events that belong to `playerId`, in log order. An entry's events are
 * its actor's, except that END_TURN pays a seat it skips: everything after a
 * turnSkipped event, up to the next one, belongs to the skipped seat.
 */
function* ownEvents(log: readonly LogEntry[], playerId: string): Generator<{ readonly event: LogEvent; readonly logIndex: number; readonly eventIndex: number; readonly entry: LogEntry }> {
  for (const [logIndex, entry] of log.entries()) {
    let owner = entry.action.playerId;
    for (const [eventIndex, event] of entry.events.entries()) {
      if (event.kind === 'turnSkipped') owner = event.playerId;
      if (event.kind === 'roundCompleted' || event.kind === 'gameEnded') continue;
      if (owner === playerId) yield { event, logIndex, eventIndex, entry };
    }
  }
}

/** Growth numbers for a growth asset bought from a deal card or a windfall option in the same entry. */
function growthTerms(cardId: string, entry: LogEntry): { readonly payoutPercent: number } | undefined {
  const card = CARDS_BY_ID.get(cardId);
  if (card === undefined) throw new Error(`debrief: unknown card "${cardId}" in a bought event`);
  if (card.deck === 'smallDeals' || card.deck === 'bigDeals') {
    return isGrowthAssetType(card.type) ? { payoutPercent: card.payoutPercent ?? 0 } : undefined;
  }
  if (card.deck !== 'lifeChoices') throw new Error(`debrief: card "${cardId}" cannot be bought`);
  const chose = entry.events.find((e) => e.kind === 'choseLifeOption' && e.cardId === cardId);
  const option = chose?.kind === 'choseLifeOption' ? card.options.find((o) => o.id === chose.optionId) : undefined;
  const invest = option?.effects.find((e) => e.kind === 'investGrowth');
  if (invest?.kind !== 'investGrowth') throw new Error(`debrief: no investGrowth option on "${cardId}" for a bought event`);
  return { payoutPercent: invest.payoutPercent };
}

function walk(state: GameState, playerId: string): Walk {
  const tracked: Tracked[] = [];
  const assets = new Map<string, Extract<Tracked, { kind: 'boughtDeal' | 'growthHeld' }>>();
  const liabilities = new Map<string, Extract<Tracked, { kind: 'bankLoan' | 'setbackLoan' | 'subscription' }>>();
  const moneyStory: MoneyStoryPoint[] = [];
  const trackedPassive: number[] = [];
  let round = 1;
  let roundOut: number | undefined;

  for (const { event, logIndex, eventIndex, entry } of ownEvents(state.game.log, playerId)) {
    const origin: Origin = { logIndex, eventIndex, roundNumber: round };
    switch (event.kind) {
      case 'paydaySnapshot': {
        round = event.roundNumber;
        moneyStory.push({ roundNumber: event.roundNumber, passiveIncome: event.passiveIncome, totalExpenses: event.totalExpenses });
        let passive = 0;
        for (const a of assets.values()) if (a.held) passive += a.kind === 'growthHeld' ? pct(a.value, a.payoutPercent) : a.cashFlow;
        trackedPassive.push(passive);
        for (const t of tracked) {
          switch (t.kind) {
            case 'lifeChoice':
            case 'passedDeal':
              t.paydays++;
              break;
            case 'boughtDeal':
              if (t.held) {
                t.received += t.cashFlow;
                t.paydays++;
              }
              break;
            case 'growthHeld':
              if (t.held) {
                t.payouts += pct(t.value, t.payoutPercent);
                t.paydays++;
              }
              break;
            case 'bankLoan':
            case 'setbackLoan':
              if (t.active) {
                t.paid += t.payment;
                t.paydays++;
              }
              break;
            case 'subscription':
              if (t.active) {
                t.paid += t.cost;
                t.paydays++;
              }
              break;
            case 'gave':
              break;
          }
        }
        break;
      }
      case 'choseLifeOption':
        tracked.push({ ...origin, kind: 'lifeChoice', event, paydays: 0 });
        break;
      case 'passed':
        if (event.affordable && event.monthlyCashFlow > 0) tracked.push({ ...origin, kind: 'passedDeal', event, paydays: 0 });
        break;
      case 'bought': {
        const growth = growthTerms(event.cardId, entry);
        if (growth !== undefined) {
          const t = { ...origin, kind: 'growthHeld' as const, assetId: event.assetId, cardId: event.cardId, cost: event.cost, payoutPercent: growth.payoutPercent, value: event.cost, payouts: 0, held: true, paydays: 0 };
          tracked.push(t);
          assets.set(event.assetId, t);
          break;
        }
        const card = CARDS_BY_ID.get(event.cardId);
        if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') throw new Error(`debrief: "${event.cardId}" is not a deal card`);
        const dividend = card.dividendPerShare ?? 0;
        const t = {
          ...origin,
          kind: 'boughtDeal' as const,
          assetId: event.assetId,
          cardId: event.cardId,
          principles: event.principles,
          basis: event.cost,
          cashFlow: event.shares === undefined ? card.monthlyCashFlow : Math.floor(event.shares * dividend),
          shares: event.shares,
          dividend,
          received: 0,
          saleNet: 0,
          held: true,
          paydays: 0,
        };
        tracked.push(t);
        assets.set(event.assetId, t);
        break;
      }
      case 'valueChanged': {
        const t = assets.get(event.assetId);
        if (t?.kind === 'growthHeld') t.value = event.marketValue;
        break;
      }
      case 'cashFlowChanged': {
        const t = assets.get(event.assetId);
        if (t?.kind === 'boughtDeal') t.cashFlow = event.monthlyCashFlow;
        break;
      }
      case 'sharesSplit': {
        const t = assets.get(event.assetId);
        if (t?.kind === 'boughtDeal') t.shares = event.shares;
        break;
      }
      case 'sold': {
        const t = assets.get(event.assetId);
        if (t === undefined) break;
        if (t.kind === 'growthHeld') {
          t.value = event.proceeds;
          t.held = false;
          break;
        }
        const remaining = event.remainingShares ?? 0;
        if (t.shares !== undefined && remaining > 0) {
          // A partial stock sale: the engine shrinks the cost basis in proportion (floored) and recomputes the dividend.
          const basis = Math.floor((t.basis * remaining) / t.shares);
          t.saleNet += event.proceeds - (t.basis - basis);
          t.basis = basis;
          t.shares = remaining;
          t.cashFlow = Math.floor(remaining * t.dividend);
        } else {
          t.saleNet += event.proceeds - (event.mortgagePaid ?? 0) - t.basis;
          t.basis = 0;
          t.held = false;
        }
        break;
      }
      case 'borrowed': {
        const t = {
          ...origin,
          kind: event.purpose === 'setback' ? ('setbackLoan' as const) : ('bankLoan' as const),
          liabilityId: event.liabilityId,
          purpose: event.purpose,
          cardId: event.cardId,
          payment: event.monthlyPayment,
          paid: 0,
          active: true,
          paydays: 0,
        };
        tracked.push(t);
        liabilities.set(event.liabilityId, t);
        break;
      }
      case 'paidDown': {
        const t = liabilities.get(event.liabilityId);
        if (t !== undefined && t.kind !== 'subscription') t.payment = event.monthlyPayment;
        break;
      }
      case 'repaid': {
        const t = liabilities.get(event.liabilityId);
        if (t !== undefined) t.active = false;
        break;
      }
      case 'subscriptionAdded': {
        const chose = entry.events.find((e) => e.kind === 'choseLifeOption');
        const source = chose?.kind === 'choseLifeOption' ? { cardId: chose.cardId, optionId: chose.optionId } : undefined;
        const t = { ...origin, kind: 'subscription' as const, liabilityId: event.liabilityId, cost: event.monthlyCost, source, paid: 0, active: true, paydays: 0 };
        tracked.push(t);
        liabilities.set(event.liabilityId, t);
        break;
      }
      case 'gave':
        tracked.push({ ...origin, kind: 'gave', amount: event.amount, paydays: 0 });
        break;
      case 'wentOut':
        roundOut = round;
        break;
      default:
        break;
    }
  }
  return { tracked, moneyStory, roundOut, trackedPassive };
}

/** Test seam for the property suite: what the walk tracked for `playerId`. Not exported from the package. */
export function debriefTrace(state: GameState, playerId: string): Pick<Walk, 'moneyStory' | 'trackedPassive'> {
  const { moneyStory, trackedPassive } = walk(state, playerId);
  return { moneyStory, trackedPassive };
}

/** Spec, Life Choices row: measured against the cheapest option; choosing the cheapest is credited with what the priciest would have cost. */
function lifeChoiceImpact(event: Extract<LogEvent, { kind: 'choseLifeOption' }>, paydays: number): { readonly impact: number; readonly monthly: number } {
  const versus = (a: OptionNumbers, b: OptionNumbers) => a.costToday - b.costToday + (a.monthlyChange - b.monthlyChange) * paydays;
  if (event.optionId === event.cheapest.optionId) {
    return { impact: versus(event.priciest, event.cheapest), monthly: event.priciest.monthlyChange - event.cheapest.monthlyChange };
  }
  return { impact: versus(event.cheapest, event), monthly: event.monthlyChange - event.cheapest.monthlyChange };
}

function verdictOf(impact: number, neutral = false): DebriefDecision['verdict'] {
  if (neutral || impact === 0) return 'neutral';
  return impact > 0 ? 'helped' : 'hurt';
}

/** One tracked row as a decision, at full precision. */
function toDecision(t: Tracked): DebriefDecision {
  const base = { id: `${t.kind}:${String(t.logIndex)}:${String(t.eventIndex)}`, kind: t.kind, logIndex: t.logIndex, eventIndex: t.eventIndex, roundNumber: t.roundNumber, paydays: t.paydays };
  const decision = (signed: number, rest: Omit<DebriefDecision, keyof typeof base | 'impact' | 'dollars' | 'verdict'>, neutral = false): DebriefDecision => {
    // No -0 in the output: a cost times zero Paydays is plain zero.
    const impact = signed === 0 ? 0 : signed;
    return {
    ...base,
    ...rest,
    impact,
    dollars: Math.abs(impact),
    verdict: verdictOf(impact, neutral),
    };
  };
  switch (t.kind) {
    case 'lifeChoice': {
      const { impact, monthly } = lifeChoiceImpact(t.event, t.paydays);
      return decision(impact, { principles: t.event.principles, cardId: t.event.cardId, optionId: t.event.optionId, cheapestOptionId: t.event.cheapest.optionId, monthly });
    }
    case 'passedDeal':
      return decision(-t.event.monthlyCashFlow * t.paydays, { principles: ROW_PRINCIPLES.passedDeal, cardId: t.event.cardId, monthly: t.event.monthlyCashFlow });
    case 'boughtDeal':
      return decision(t.received + t.saleNet, { principles: t.principles, cardId: t.cardId, assetId: t.assetId, monthly: t.cashFlow, sold: !t.held });
    case 'growthHeld':
      return decision(t.value - t.cost + t.payouts, {
        principles: ROW_PRINCIPLES.growthHeld,
        cardId: t.cardId,
        assetId: t.assetId,
        monthly: pct(t.value, t.payoutPercent),
        sold: !t.held,
      });
    case 'bankLoan':
      return decision(-t.paid, { principles: ROW_PRINCIPLES.bankLoan, liabilityId: t.liabilityId, purpose: t.purpose, monthly: t.payment }, t.purpose === 'asset');
    case 'setbackLoan':
      return decision(-t.paid, {
        principles: ROW_PRINCIPLES.setbackLoan,
        liabilityId: t.liabilityId,
        purpose: t.purpose,
        monthly: t.payment,
        ...(t.cardId === undefined ? {} : { cardId: t.cardId }),
      });
    case 'subscription':
      return decision(-t.paid, { principles: ROW_PRINCIPLES.subscription, liabilityId: t.liabilityId, monthly: t.cost, ...(t.source ?? {}) });
    case 'gave':
      return decision(t.amount, { principles: ROW_PRINCIPLES.gave });
  }
}

/** The monthly difference a suggestion's other choice would have made (spec, Next time, try). */
function suggestionMonthly(d: DebriefDecision): number {
  switch (d.kind) {
    case 'lifeChoice':
    case 'passedDeal':
    case 'bankLoan':
    case 'setbackLoan':
    case 'subscription':
      return Math.max(0, d.monthly ?? 0);
    case 'boughtDeal':
      return Math.max(0, -(d.monthly ?? 0));
    case 'growthHeld':
    case 'gave':
      return 0;
  }
}

const byLog = (a: DebriefDecision, b: DebriefDecision): number => a.logIndex - b.logIndex || a.eventIndex - b.eventIndex;

/** Kids reading level (spec, Reading levels): money rounded to the nearest $10, halves away from zero. */
function roundTo10(n: number): number {
  const magnitude = Math.round(Math.abs(n) / 10) * 10;
  return n < 0 && magnitude > 0 ? -magnitude : magnitude;
}

function endOf(state: GameState): { readonly reason: GameEndReason; readonly winnerId: string } | undefined {
  for (let i = state.game.log.length - 1; i >= 0; i--) {
    const ended = state.game.log[i]?.events.find((e) => e.kind === 'gameEnded');
    if (ended?.kind === 'gameEnded') return { reason: ended.reason, winnerId: ended.winnerId };
  }
  return undefined;
}

/** 1 for the winner, then everyone still in by the spec's ranking, then players who went out, latest out first. */
function rankOf(state: GameState, playerId: string, winnerId: string | undefined): number {
  const outOrder = new Map<string, number>();
  for (const [index, entry] of state.game.log.entries()) {
    let owner = entry.action.playerId;
    for (const event of entry.events) {
      if (event.kind === 'turnSkipped') owner = event.playerId;
      if (event.kind === 'wentOut') outOrder.set(owner, index);
    }
  }
  const inPlayers = rankPlayers(state).map((p) => p.id);
  const out = state.players
    .filter((p) => p.isOut)
    .map((p) => p.id)
    .sort((a, b) => (outOrder.get(b) ?? -1) - (outOrder.get(a) ?? -1));
  const order = [...(winnerId === undefined ? [] : [winnerId]), ...inPlayers.filter((id) => id !== winnerId), ...out.filter((id) => id !== winnerId)];
  return order.indexOf(playerId) + 1;
}

/**
 * The money story with an end-of-game point: an escape is checked at END_TURN,
 * after the month's Payday, so the snapshots alone stop short of the crossing.
 * Added only for a finished game, for a player still in, when the final state
 * differs from the last Payday.
 */
function withEndOfGame(state: GameState, player: Player, story: readonly MoneyStoryPoint[]): readonly MoneyStoryPoint[] {
  if (state.game.phase !== 'finished' || player.isOut) return story;
  const last = story.at(-1);
  const point: MoneyStoryPoint = {
    roundNumber: last?.roundNumber ?? roundNumber(state),
    passiveIncome: passiveIncome(player),
    totalExpenses: totalExpenses(player),
    endOfGame: true,
  };
  if (last?.passiveIncome === point.passiveIncome && last.totalExpenses === point.totalExpenses) return story;
  return [...story, point];
}

/**
 * Spec v2, The debrief: structured data for one player's end-of-game debrief.
 * Pure: reads the state and its log, never replays, never mutates. Every
 * dollar figure is a whole number; at the kids reading level money is
 * rounded to $10 after all ranking is done on exact numbers.
 */
export function debrief(state: GameState, playerId: string, readingLevel: ReadingLevel): Debrief {
  const player = playerById(state, playerId);
  const { tracked, moneyStory, roundOut } = walk(state, playerId);
  const decisions = tracked.map(toDecision);

  const helpedAll = decisions.filter((d) => d.verdict === 'helped').sort((a, b) => b.impact - a.impact || byLog(a, b));
  const hurtAll = decisions.filter((d) => d.verdict === 'hurt').sort((a, b) => a.impact - b.impact || byLog(a, b));
  const drivers = [...helpedAll, ...hurtAll].sort((a, b) => b.dollars - a.dollars || byLog(a, b)).slice(0, 3);

  const finalExpenses = totalExpenses(player);
  const suggestions: DebriefSuggestion[] = hurtAll.slice(0, 2).map((d) => {
    const monthly = suggestionMonthly(d);
    const principle = d.principles[0];
    if (principle === undefined) throw new Error(`debrief: decision ${d.id} has no principle`);
    return {
      decisionId: d.id,
      kind: d.kind,
      principle,
      dollars: d.dollars,
      monthly,
      freedomPoints: finalExpenses > 0 ? Math.floor((monthly * 100) / finalExpenses) : 0,
      ...(d.cardId === undefined ? {} : { cardId: d.cardId }),
      ...(d.kind === 'lifeChoice' && d.cheapestOptionId !== undefined ? { betterOptionId: d.cheapestOptionId } : {}),
    };
  });

  const practiced = new Set(helpedAll.flatMap((d) => d.principles));
  const end = state.game.phase === 'finished' ? endOf(state) : undefined;
  const outcome: DebriefOutcome = player.hasEscaped
    ? 'escaped'
    : player.isOut
      ? 'out'
      : end === undefined
        ? 'inProgress'
        : end.winnerId === playerId
          ? 'won'
          : 'lost';
  const result: DebriefResult = {
    outcome,
    ...(end === undefined ? {} : { endReason: end.reason }),
    rank: rankOf(state, playerId, end?.winnerId),
    players: state.players.length,
    freedomPercent: freedomPercent(player),
    passiveIncome: passiveIncome(player),
    totalExpenses: finalExpenses,
    ...(player.isOut && roundOut !== undefined ? { roundOut } : {}),
  };
  const story = withEndOfGame(state, player, moneyStory);
  const crossed = story.find((p) => p.passiveIncome >= p.totalExpenses);

  const money = readingLevel === 'kids' ? roundTo10 : (n: number) => n;
  const shown = (d: DebriefDecision): DebriefDecision => {
    const impact = money(d.impact);
    return { ...d, impact, dollars: Math.abs(impact), ...(d.monthly === undefined ? {} : { monthly: money(d.monthly) }) };
  };

  return {
    playerId,
    readingLevel,
    result: { ...result, passiveIncome: money(result.passiveIncome), totalExpenses: money(result.totalExpenses) },
    drivers: drivers.map(shown),
    helped: helpedAll.slice(0, 3).map(shown),
    hurt: hurtAll.slice(0, 3).map(shown),
    suggestions: suggestions.map((s) => ({ ...s, dollars: money(s.dollars), monthly: money(s.monthly) })),
    moneyStory: story.map((p) => ({ ...p, passiveIncome: money(p.passiveIncome), totalExpenses: money(p.totalExpenses) })),
    ...(crossed === undefined ? {} : { crossedRound: crossed.roundNumber }),
    principlesPracticed: PRINCIPLE_IDS.filter((p) => practiced.has(p)),
  };
}
