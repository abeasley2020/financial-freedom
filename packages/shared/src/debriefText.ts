// Spec v2, The debrief: the words. Templates are keyed by decision kind and
// reading level, and every line ends with its principle in that reading
// level's words (PRINCIPLES). Templates fill in the numbers the engine put in
// the Debrief; they never compute one. formatMoney is the one money formatter
// (CLAUDE.md, Money).

import { CARDS_BY_ID } from './data/index';
import type { Debrief, DebriefDecision, DebriefSuggestion, ReadingLevel } from './debrief';
import { PRINCIPLES, type PrincipleId } from './principles';

/** Whole dollars as `$1,234`, a negative as `-$380`. A fractional amount is a programmer bug. */
export function formatMoney(amount: number): string {
  if (!Number.isInteger(amount)) throw new Error(`formatMoney: ${String(amount)} is not whole dollars`);
  const digits = Math.abs(amount).toLocaleString('en-US');
  return amount < 0 ? `-$${digits}` : `$${digits}`;
}

export interface DebriefText {
  readonly result: string;
  readonly drivers: readonly string[];
  readonly helped: readonly string[];
  readonly hurt: readonly string[];
  readonly suggestions: readonly string[];
  readonly moneyStory: string;
  readonly principles: readonly string[];
}

const m = formatMoney;
const perMonth = (n: number | undefined): string => `${m(n ?? 0)}/mo`;
const months = (n: number): string => (n === 1 ? '1 month' : `${String(n)} months`);
const ordinal = (n: number): string => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${String(n)}th`);

function title(cardId: string | undefined): string {
  return (cardId === undefined ? undefined : CARDS_BY_ID.get(cardId)?.title) ?? 'a card';
}

function optionLabel(cardId: string | undefined, optionId: string | undefined): string {
  const card = cardId === undefined ? undefined : CARDS_BY_ID.get(cardId);
  const option = card?.deck === 'lifeChoices' ? card.options.find((o) => o.id === optionId) : undefined;
  return option?.label ?? optionId ?? 'that option';
}

function lesson(id: PrincipleId | undefined, level: ReadingLevel): string {
  const p = PRINCIPLES.find((x) => x.id === id);
  if (p === undefined) return '';
  return level === 'kids' ? p.kidsText : `${p.name}: ${p.adultText}`;
}

const LOAN_FOR: Readonly<Record<ReadingLevel, Readonly<Record<string, string>>>> = {
  adult: { want: 'a want', none: 'extra cash', asset: 'an asset', setback: 'a Setback' },
  kids: { want: 'something you wanted', none: 'extra cash', asset: 'something that pays you', setback: 'a surprise bill' },
};

/** What one decision did, before its principle. */
function decisionWords(d: DebriefDecision, level: ReadingLevel): string {
  const kids = level === 'kids';
  switch (d.kind) {
    case 'lifeChoice': {
      const chosen = optionLabel(d.cardId, d.optionId);
      if (d.verdict === 'helped') {
        return kids
          ? `You picked "${chosen}" on ${title(d.cardId)}. That saved ${m(d.dollars)}.`
          : `${title(d.cardId)}: you chose "${chosen}", the cheapest option, and kept the ${m(d.dollars)} the priciest option would have cost.`;
      }
      const cheapest = optionLabel(d.cardId, d.cheapestOptionId);
      return kids
        ? `You picked "${chosen}" on ${title(d.cardId)}. "${cheapest}" would have saved ${m(d.dollars)}.`
        : `${title(d.cardId)}: you chose "${chosen}". Over ${months(d.paydays)} it cost ${m(d.dollars)} more than "${cheapest}".`;
    }
    case 'passedDeal':
      return kids
        ? `You passed on ${title(d.cardId)} when you had the money. It would have paid you ${m(d.dollars)}.`
        : `You passed on ${title(d.cardId)} when you could afford it: ${perMonth(d.monthly)} for ${months(d.paydays)}, ${m(d.dollars)} you did not collect.`;
    case 'boughtDeal':
      if (d.verdict === 'hurt') {
        return kids ? `You bought ${title(d.cardId)}. It lost you ${m(d.dollars)}.` : `You bought ${title(d.cardId)}. Counting its cash flow${d.sold === true ? ' and the sale' : ''}, it lost ${m(d.dollars)}.`;
      }
      if (d.sold === true) {
        return kids ? `You bought ${title(d.cardId)} and sold it. It made you ${m(d.dollars)}.` : `You bought ${title(d.cardId)}. With its cash flow and the sale it made ${m(d.dollars)}.`;
      }
      return kids
        ? `You bought ${title(d.cardId)}. It paid you ${m(d.dollars)} and still pays ${perMonth(d.monthly)}.`
        : `You bought ${title(d.cardId)}. It paid ${m(d.dollars)} over ${months(d.paydays)} and still pays ${perMonth(d.monthly)}.`;
    case 'bankLoan': {
      const purpose = LOAN_FOR[level][d.purpose ?? 'none'] ?? LOAN_FOR[level].none;
      return kids
        ? `You borrowed from the bank for ${purpose ?? ''}. You paid ${m(d.dollars)} back in payments.`
        : `A bank loan for ${purpose ?? ''} cost ${m(d.dollars)} in payments (${perMonth(d.monthly)}).`;
    }
    case 'setbackLoan':
      return kids
        ? `${title(d.cardId)} made you borrow. The loan cost ${m(d.dollars)}.`
        : `${title(d.cardId)} forced a bank loan. Its payments cost ${m(d.dollars)} (${perMonth(d.monthly)}).`;
    case 'subscription': {
      const from = d.cardId === undefined ? '' : ` from ${title(d.cardId)}`;
      return kids
        ? `A ${perMonth(d.monthly)} plan${from} ran for ${months(d.paydays)}. It cost ${m(d.dollars)}.`
        : `A ${perMonth(d.monthly)} subscription${from} ran ${months(d.paydays)} and cost ${m(d.dollars)}.`;
    }
    case 'growthHeld':
      if (d.verdict === 'hurt') {
        return kids ? `${title(d.cardId)} lost ${m(d.dollars)}.` : `${title(d.cardId)} lost ${m(d.dollars)} after its growth and payouts.`;
      }
      return kids
        ? `Your money in ${title(d.cardId)} grew by ${m(d.dollars)}.`
        : `${title(d.cardId)} grew and paid out ${m(d.dollars)}${d.sold === true ? ' before you sold it' : ''}.`;
    case 'gave':
      return kids ? `You gave ${m(d.dollars)} to help someone.` : `You gave ${m(d.dollars)}.`;
  }
}

function decisionLine(d: DebriefDecision, level: ReadingLevel): string {
  return `${decisionWords(d, level)} ${lesson(d.principles[0], level)}`;
}

function suggestionLine(s: DebriefSuggestion, level: ReadingLevel): string {
  const kids = level === 'kids';
  const points = s.freedomPoints > 0 ? (kids ? ` and ${String(s.freedomPoints)} Freedom points` : `, worth ${String(s.freedomPoints)} Freedom points`) : '';
  switch (s.kind) {
    case 'lifeChoice':
      return kids
        ? `Next time, try "${optionLabel(s.cardId, s.betterOptionId)}" on ${title(s.cardId)}. You keep ${m(s.dollars)}${points}.`
        : `Next time, choose "${optionLabel(s.cardId, s.betterOptionId)}" on ${title(s.cardId)}: ${m(s.dollars)} more in your pocket${points}.`;
    case 'passedDeal':
      return kids
        ? `Next time, buy ${title(s.cardId)} if you have the money. You get ${m(s.dollars)}${points}.`
        : `Next time, buy ${title(s.cardId)} when you can afford it: ${perMonth(s.monthly)}, ${m(s.dollars)} over the game${points}.`;
    case 'bankLoan':
      return kids
        ? `Next time, wait instead of borrowing for wants. You keep ${m(s.dollars)}${points}.`
        : `Next time, skip the bank loan for wants: ${m(s.dollars)} in payments saved${points}.`;
    case 'setbackLoan':
      return kids
        ? `Next time, save some money for surprises. You skip ${m(s.dollars)} of loan payments${points}.`
        : `Next time, keep an emergency fund so a Setback does not become a loan: ${m(s.dollars)} saved${points}.`;
    case 'subscription':
      return kids
        ? `Next time, skip or cancel the ${perMonth(s.monthly)} plan. You keep ${m(s.dollars)}${points}.`
        : `Next time, skip or cancel the ${perMonth(s.monthly)} subscription: ${m(s.dollars)} saved${points}.`;
    case 'boughtDeal':
    case 'growthHeld':
      return kids
        ? `Next time, think twice about ${title(s.cardId)}. It cost you ${m(s.dollars)}.`
        : `Next time, weigh ${title(s.cardId)} more carefully: it cost ${m(s.dollars)}${points}.`;
    case 'gave':
      return '';
  }
}

function resultLine(d: Debrief): string {
  const r = d.result;
  const kids = d.readingLevel === 'kids';
  const opening =
    r.outcome === 'escaped'
      ? kids
        ? 'You escaped! '
        : 'You escaped! Your passive income covered every bill. '
      : r.outcome === 'out'
        ? `You ran out of money in round ${String(r.roundOut ?? 0)}. `
        : '';
  const core = kids
    ? `You reached ${String(r.freedomPercent)}% Freedom. Your assets paid ${m(r.passiveIncome)} of your ${m(r.totalExpenses)} bills each month.`
    : `You reached ${String(r.freedomPercent)}% Freedom. Your assets paid ${m(r.passiveIncome)} of your ${m(r.totalExpenses)} monthly bills.`;
  const place = r.outcome === 'inProgress' ? '' : ` You finished ${ordinal(r.rank)} of ${String(r.players)}.`;
  return `${opening}${core}${place}`;
}

function storyLine(d: Debrief): string {
  const first = d.moneyStory[0];
  const last = d.moneyStory.at(-1);
  if (first === undefined || last === undefined) return d.readingLevel === 'kids' ? 'No paydays yet.' : 'No Paydays were recorded.';
  const crossed = d.crossedRound === undefined ? '' : d.readingLevel === 'kids' ? ` Your lines crossed in round ${String(d.crossedRound)}. That is freedom.` : ` The lines crossed in round ${String(d.crossedRound)}: that is freedom.`;
  return d.readingLevel === 'kids'
    ? `Your money from assets went from ${perMonth(first.passiveIncome)} to ${perMonth(last.passiveIncome)}. Your bills went from ${perMonth(first.totalExpenses)} to ${perMonth(last.totalExpenses)}.${crossed}`
    : `Passive income went from ${perMonth(first.passiveIncome)} in round ${String(first.roundNumber)} to ${perMonth(last.passiveIncome)} ${last.endOfGame === true ? 'at the end of the game' : `in round ${String(last.roundNumber)}`}, against totalExpenses of ${perMonth(first.totalExpenses)} and then ${perMonth(last.totalExpenses)}.${crossed}`;
}

/** The debrief in words, section by section, at the debrief's reading level. */
export function debriefText(d: Debrief): DebriefText {
  const level = d.readingLevel;
  return {
    result: resultLine(d),
    drivers: d.drivers.map((x) => decisionLine(x, level)),
    helped: d.helped.map((x) => decisionLine(x, level)),
    hurt: d.hurt.map((x) => decisionLine(x, level)),
    suggestions: d.suggestions.map((s) => suggestionLine(s, level)).filter((line) => line.length > 0),
    moneyStory: storyLine(d),
    principles: d.principlesPracticed.map((id) => {
      const p = PRINCIPLES.find((x) => x.id === id);
      return level === 'kids' ? (p?.kidsText ?? '') : `${p?.name ?? id}: ${p?.adultText ?? ''}`;
    }),
  };
}
