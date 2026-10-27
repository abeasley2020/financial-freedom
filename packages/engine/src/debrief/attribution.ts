// Spec v2, The debrief, attribution rules. One forward pass over the log
// scores every decision a player made, from the facts each event recorded at
// the moment of the decision (spec, Decision log). Nothing is replayed.
//
// "Paydays afterward" is the player's paydaySnapshot events after the
// decision: the months it kept paying or costing. Assets, loans, and
// subscriptions are followed through the log so each snapshot adds what that
// month actually paid or cost.

import {
  CARDS_BY_ID,
  isGrowthAssetType,
  type DealCard,
  type DebriefDecision,
  type GameState,
  type LifeChoicesCard,
  type LifeOption,
  type LogEvent,
  type LogRef,
  type OptionNumbers,
  type PrincipleId,
} from '@ff/shared';

import { pct } from '../money';

/** One event the player owns, with the round it happened in. */
export interface OwnedEvent {
  readonly ref: LogRef;
  readonly event: LogEvent;
  readonly round: number;
}

/**
 * The player's events in log order. An entry's events belong to the player
 * who acted, except that END_TURN pays a skipped seat: from a turnSkipped
 * event on, the events belong to the seat it names. Round markers and game
 * endings belong to no one.
 *
 * An event's round is the player's own count of Paydays so far (at least 1).
 * Every turn a seat takes or skips starts with its Payday, and every seat
 * still in is paid once a round, so the k-th Payday opens the player's round
 * k. It equals the roundNumber each paydaySnapshot logs (the debrief property
 * suite checks this) and needs no round markers from the log.
 */
export function ownedEvents(state: GameState, playerId: string): OwnedEvent[] {
  const owned: OwnedEvent[] = [];
  let paydays = 0;
  state.game.log.forEach((entry, entryIndex) => {
    let owner = entry.action.playerId;
    entry.events.forEach((event, eventIndex) => {
      if (event.kind === 'roundCompleted' || event.kind === 'gameEnded') return;
      if (event.kind === 'turnSkipped') owner = event.playerId;
      const belongsTo = event.kind === 'paydaySnapshot' ? event.playerId : owner;
      if (belongsTo !== playerId) return;
      if (event.kind === 'paydaySnapshot') paydays++;
      owned.push({ ref: { entry: entryIndex, event: eventIndex }, event, round: Math.max(1, paydays) });
    });
  });
  return owned;
}

/** A decision with its exact dollar impact, before any reading-level rounding. */
export interface Scored {
  readonly decision: DebriefDecision;
  /** The monthly difference a suggestion turns into Freedom points (spec, Next time, try). 0 when there is none. */
  readonly monthly: number;
}

export interface Snapshot {
  readonly ref: LogRef;
  readonly round: number;
  readonly passiveIncome: number;
  readonly totalExpenses: number;
  /** What the debrief's own asset tracking says the player's assets paid at this Payday. Equal to passiveIncome when the tracking is right. */
  readonly trackedPassiveIncome: number;
}

export interface Ledger {
  /** Every helped or hurt decision, in log order. Neutral and zero-impact decisions are left out. */
  readonly decisions: readonly Scored[];
  readonly snapshots: readonly Snapshot[];
  /** The round the player went out in, if they did. */
  readonly wentOutRound?: number;
}

/** Principles the attribution table names for decisions whose dollars come from a rule, not a card. */
const PASSED_DEAL_PRINCIPLES: readonly PrincipleId[] = ['P2', 'P3'];
const BANK_LOAN_PRINCIPLES: readonly PrincipleId[] = ['P5'];
const SETBACK_LOAN_PRINCIPLES: readonly PrincipleId[] = ['P1'];
const SUBSCRIPTION_PRINCIPLES: readonly PrincipleId[] = ['P7'];
const GROWTH_PRINCIPLES: readonly PrincipleId[] = ['P8'];
const GAVE_PRINCIPLES: readonly PrincipleId[] = ['P10'];

interface Base {
  readonly ref: LogRef;
  readonly round: number;
}

interface Choice {
  readonly entry: number;
  readonly card: LifeChoicesCard;
  readonly option: LifeOption;
}

interface DealTrack extends Base {
  readonly cardId: string;
  readonly principles: readonly PrincipleId[];
  readonly cost: number;
  readonly dividendPerShare: number;
  basis: number;
  shares: number | undefined;
  cashFlow: number;
  received: number;
  months: number;
  saleResult: number | undefined;
  open: boolean;
}

interface GrowthTrack extends Base {
  readonly cardId: string;
  readonly invested: number;
  readonly payoutPercent: number;
  value: number;
  payouts: number;
  months: number;
  sold: boolean;
  open: boolean;
}

interface PaymentTrack extends Base {
  payment: number;
  paid: number;
  months: number;
  open: boolean;
}

/** Builds the outcome, impact, and dollars every decision carries; undefined for a zero impact, which is neither helped nor hurt. */
function scored(impact: number, monthly: number, build: (outcome: 'helped' | 'hurt', dollars: number) => DebriefDecision): Scored | undefined {
  if (impact === 0) return undefined;
  return { decision: build(impact > 0 ? 'helped' : 'hurt', Math.abs(impact)), monthly };
}

function lifeCard(cardId: string): LifeChoicesCard {
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'lifeChoices') throw new Error(`debrief: unknown Life Choices card "${cardId}"`);
  return card;
}

function lifeOption(card: LifeChoicesCard, optionId: string): LifeOption {
  const option = card.options.find((o) => o.id === optionId);
  if (option === undefined) throw new Error(`debrief: card "${card.id}" has no option "${optionId}"`);
  return option;
}

function dealCard(cardId: string): DealCard {
  const card = CARDS_BY_ID.get(cardId);
  if (card?.deck !== 'smallDeals' && card?.deck !== 'bigDeals') throw new Error(`debrief: unknown deal card "${cardId}"`);
  return card;
}

/**
 * An option's numbers for the Life Choices row, which counts spending, not
 * saving (STATUS.md, Questions for Andre, Stage E):
 * - today: cash paid minus cash received. Money the option invests or uses to
 *   pay down a loan is still the player's, as an asset or as debt no longer
 *   owed, so it is not spent. Cash an option tagged Generosity pays is a gift,
 *   scored on its own Gave row.
 * - monthly: the logged monthlyChange without an investment's payout, which
 *   the growth asset's own row counts. For the chosen option, its
 *   subscriptions are left out too: the Subscription row counts the months
 *   they actually ran.
 */
function spending(option: LifeOption, logged: Pick<OptionNumbers, 'monthlyChange'>, chosen: boolean): { readonly today: number; readonly monthly: number } {
  const gift = option.principles.includes('P10');
  let today = 0;
  let monthly = logged.monthlyChange;
  for (const effect of option.effects) {
    switch (effect.kind) {
      case 'payCash':
        if (!gift) today += effect.amount;
        break;
      case 'gainCash':
        today -= effect.amount;
        break;
      case 'investGrowth':
        monthly += pct(effect.amount, effect.payoutPercent);
        break;
      case 'addSubscription':
        if (chosen) monthly -= effect.monthlyCost;
        break;
      case 'addLoan':
      case 'repayLargestLoan':
        break;
    }
  }
  return { today, monthly };
}

/** The cash an option tagged Generosity gives away. */
function giftOf(option: LifeOption): number {
  if (!option.principles.includes('P10')) return 0;
  return option.effects.reduce((sum, effect) => sum + (effect.kind === 'payCash' ? effect.amount : 0), 0);
}

/** The payout percent of the growth asset a Life Choices option invested in. */
function investedPayout(option: LifeOption, amount: number): number {
  for (const effect of option.effects) {
    if (effect.kind === 'investGrowth' && effect.amount === amount) return effect.payoutPercent;
  }
  throw new Error(`debrief: option "${option.id}" invests no ${String(amount)}`);
}

/**
 * Scores every decision `playerId` made, per the spec's attribution table.
 * Readings where the table would count the same dollars twice:
 * - A growth asset, from a deal or a windfall, is scored only as a growth
 *   asset held, never as a bought deal.
 * - A Setback auto-loan is scored only on the Setback auto-loan row (P1).
 * - A Life Choices row counts spending, not saving (see `spending`).
 */
export function attribute(state: GameState, playerId: string): Ledger {
  const owned = ownedEvents(state, playerId);

  /** Builders in log order, run once the number of snapshots is known. */
  const builders: (() => Scored | undefined)[] = [];
  const snapshots: Snapshot[] = [];
  const deals = new Map<string, DealTrack>();
  const growth = new Map<string, GrowthTrack>();
  const loans = new Map<string, PaymentTrack>();
  const subscriptions = new Map<string, PaymentTrack & { cancelled: boolean }>();
  let choice: Choice | undefined;
  let wentOutRound: number | undefined;

  /** Snapshots after an event seen when `seen` snapshots had passed. */
  const afterward = (seen: number): number => snapshots.length - seen;

  for (const { ref, event, round } of owned) {
    if (choice !== undefined && choice.entry !== ref.entry) choice = undefined;

    switch (event.kind) {
      case 'paydaySnapshot': {
        let tracked = 0;
        for (const deal of deals.values()) {
          if (!deal.open) continue;
          deal.received += deal.cashFlow;
          deal.months++;
          tracked += deal.cashFlow;
        }
        for (const asset of growth.values()) {
          if (!asset.open) continue;
          const payout = pct(asset.value, asset.payoutPercent);
          asset.payouts += payout;
          asset.months++;
          tracked += payout;
        }
        for (const loan of [...loans.values(), ...subscriptions.values()]) {
          if (!loan.open) continue;
          loan.paid += loan.payment;
          loan.months++;
        }
        snapshots.push({ ref, round, passiveIncome: event.passiveIncome, totalExpenses: event.totalExpenses, trackedPassiveIncome: tracked });
        break;
      }

      case 'choseLifeOption': {
        const card = lifeCard(event.cardId);
        const option = lifeOption(card, event.optionId);
        choice = { entry: ref.entry, card, option };

        const gift = giftOf(option);
        if (gift > 0) {
          builders.push(() =>
            scored(gift, 0, (outcome, dollars) => ({
              kind: 'gave',
              ref,
              outcome,
              impact: gift,
              dollars,
              principles: [...GAVE_PRINCIPLES],
              round,
              months: 0,
              cardId: card.id,
              optionId: option.id,
            })),
          );
        }

        // Spec: the cheapest option is compared with the priciest; any other with the cheapest.
        const other = event.optionId === event.cheapest.optionId ? event.priciest : event.cheapest;
        const chosen = spending(option, event, true);
        const compared = spending(lifeOption(card, other.optionId), other, false);
        const todayDifference = compared.today - chosen.today;
        const monthlyDifference = compared.monthly - chosen.monthly;
        const seen = snapshots.length;
        builders.push(() => {
          const months = afterward(seen);
          const impact = todayDifference + monthlyDifference * months;
          return scored(impact, Math.max(0, -monthlyDifference), (outcome, dollars) => ({
            kind: 'lifeChoice',
            ref,
            outcome,
            impact,
            dollars,
            principles: [...option.principles],
            round,
            months,
            cardId: card.id,
            optionId: option.id,
            otherOptionId: other.optionId,
            todayDifference,
            monthlyDifference,
          }));
        });
        break;
      }

      case 'passed': {
        if (!event.affordable || event.monthlyCashFlow <= 0) break;
        const seen = snapshots.length;
        const { cardId, monthlyCashFlow } = event;
        builders.push(() => {
          const months = afterward(seen);
          const impact = -monthlyCashFlow * months;
          return scored(impact, monthlyCashFlow, (outcome, dollars) => ({
            kind: 'passedDeal',
            ref,
            outcome,
            impact,
            dollars,
            principles: [...PASSED_DEAL_PRINCIPLES],
            round,
            months,
            cardId,
            monthlyCashFlow,
          }));
        });
        break;
      }

      case 'bought': {
        const card = CARDS_BY_ID.get(event.cardId);
        let payoutPercent: number | undefined;
        if (card?.deck === 'lifeChoices') {
          if (choice?.card.id !== card.id) throw new Error(`debrief: windfall investment "${event.assetId}" without its Life Choices decision`);
          payoutPercent = investedPayout(choice.option, event.cost);
        } else {
          const deal = dealCard(event.cardId);
          if (isGrowthAssetType(deal.type)) payoutPercent = deal.payoutPercent ?? 0;
        }
        if (payoutPercent !== undefined) {
          const asset: GrowthTrack = {
            ref,
            round,
            cardId: event.cardId,
            invested: event.cost,
            payoutPercent,
            value: event.cost,
            payouts: 0,
            months: 0,
            sold: false,
            open: true,
          };
          growth.set(event.assetId, asset);
          builders.push(() => {
            const valueGained = asset.value - asset.invested;
            const impact = valueGained + asset.payouts;
            return scored(impact, 0, (outcome, dollars) => ({
              kind: 'growthAsset',
              ref,
              outcome,
              impact,
              dollars,
              principles: [...GROWTH_PRINCIPLES],
              round,
              months: asset.months,
              cardId: asset.cardId,
              invested: asset.invested,
              valueGained,
              payouts: asset.payouts,
              sold: asset.sold,
            }));
          });
          break;
        }

        const deal = dealCard(event.cardId);
        const dividendPerShare = deal.dividendPerShare ?? 0;
        const track: DealTrack = {
          ref,
          round,
          cardId: deal.id,
          principles: event.principles,
          cost: event.cost,
          dividendPerShare,
          basis: event.cost,
          shares: event.shares,
          cashFlow: event.shares === undefined ? deal.monthlyCashFlow : Math.floor(event.shares * dividendPerShare),
          received: 0,
          months: 0,
          saleResult: undefined,
          open: true,
        };
        deals.set(event.assetId, track);
        builders.push(() => {
          const impact = track.received + (track.saleResult ?? 0);
          return scored(impact, 0, (outcome, dollars) => ({
            kind: 'boughtDeal',
            ref,
            outcome,
            impact,
            dollars,
            principles: [...track.principles],
            round,
            months: track.months,
            cardId: track.cardId,
            cost: track.cost,
            cashFlowReceived: track.received,
            ...(track.saleResult === undefined ? {} : { saleResult: track.saleResult }),
          }));
        });
        break;
      }

      case 'cashFlowChanged': {
        const deal = deals.get(event.assetId);
        if (deal !== undefined) deal.cashFlow = event.monthlyCashFlow;
        break;
      }

      case 'sharesSplit': {
        const deal = deals.get(event.assetId);
        if (deal !== undefined) deal.shares = event.shares;
        break;
      }

      case 'valueChanged': {
        const asset = growth.get(event.assetId);
        if (asset !== undefined) asset.value = event.marketValue;
        break;
      }

      case 'sold': {
        const asset = growth.get(event.assetId);
        if (asset !== undefined) {
          asset.value = event.proceeds;
          asset.sold = true;
          asset.open = false;
          break;
        }
        const deal = deals.get(event.assetId);
        if (deal === undefined) break;
        // Spec: sale proceeds minus cash paid, where the proceeds are what the player kept after the linked mortgage.
        const kept = event.proceeds - (event.mortgagePaid ?? 0);
        const remaining = event.remainingShares ?? 0;
        if (remaining > 0 && deal.shares !== undefined) {
          // A partial stock sale keeps floor(basis × remaining / shares) of the cost, as the engine does.
          const keptBasis = Math.floor((deal.basis * remaining) / deal.shares);
          deal.saleResult = (deal.saleResult ?? 0) + kept - (deal.basis - keptBasis);
          deal.basis = keptBasis;
          deal.shares = remaining;
          deal.cashFlow = Math.floor(remaining * deal.dividendPerShare);
        } else {
          deal.saleResult = (deal.saleResult ?? 0) + kept - deal.basis;
          deal.basis = 0;
          deal.open = false;
        }
        break;
      }

      case 'borrowed': {
        if (event.purpose === 'asset') break; // neutral: the asset's own row carries the result
        const loan: PaymentTrack = { ref, round, payment: event.monthlyPayment, paid: 0, months: 0, open: true };
        loans.set(event.liabilityId, loan);
        const { amount, monthlyPayment } = event;
        if (event.purpose === 'setback') {
          const cardId = event.cardId;
          if (cardId === undefined) throw new Error(`debrief: Setback loan "${event.liabilityId}" names no card`);
          builders.push(() =>
            scored(-loan.paid, monthlyPayment, (outcome, dollars) => ({
              kind: 'setbackLoan',
              ref,
              outcome,
              impact: -loan.paid,
              dollars,
              principles: [...SETBACK_LOAN_PRINCIPLES],
              round,
              months: loan.months,
              cardId,
              amount,
              monthlyPayment,
            })),
          );
          break;
        }
        const purpose = event.purpose;
        builders.push(() =>
          scored(-loan.paid, monthlyPayment, (outcome, dollars) => ({
            kind: 'bankLoan',
            ref,
            outcome,
            impact: -loan.paid,
            dollars,
            principles: [...BANK_LOAN_PRINCIPLES],
            round,
            months: loan.months,
            purpose,
            amount,
            monthlyPayment,
          })),
        );
        break;
      }

      case 'paidDown': {
        const loan = loans.get(event.liabilityId);
        if (loan !== undefined) loan.payment = event.monthlyPayment;
        break;
      }

      case 'repaid': {
        const loan = loans.get(event.liabilityId);
        if (loan !== undefined) loan.open = false;
        const subscription = subscriptions.get(event.liabilityId);
        if (subscription !== undefined) {
          subscription.open = false;
          subscription.cancelled = true;
        }
        break;
      }

      case 'subscriptionAdded': {
        if (choice === undefined) throw new Error(`debrief: subscription "${event.liabilityId}" without its Life Choices decision`);
        const { card, option } = choice;
        const subscription = { ref, round, payment: event.monthlyCost, paid: 0, months: 0, open: true, cancelled: false };
        subscriptions.set(event.liabilityId, subscription);
        const monthlyCost = event.monthlyCost;
        builders.push(() =>
          scored(-subscription.paid, monthlyCost, (outcome, dollars) => ({
            kind: 'subscription',
            ref,
            outcome,
            impact: -subscription.paid,
            dollars,
            principles: [...SUBSCRIPTION_PRINCIPLES],
            round,
            months: subscription.months,
            cardId: card.id,
            optionId: option.id,
            monthlyCost,
            cancelled: subscription.cancelled,
          })),
        );
        break;
      }

      case 'gave': {
        const amount = event.amount;
        builders.push(() =>
          scored(amount, 0, (outcome, dollars) => ({
            kind: 'gave',
            ref,
            outcome,
            impact: amount,
            dollars,
            principles: [...GAVE_PRINCIPLES],
            round,
            months: 0,
          })),
        );
        break;
      }

      case 'wentOut':
        wentOutRound = round;
        break;

      default:
        break;
    }
  }

  const decisions = builders.map((build) => build()).filter((s): s is Scored => s !== undefined);
  return { decisions, snapshots, ...(wentOutRound === undefined ? {} : { wentOutRound }) };
}
