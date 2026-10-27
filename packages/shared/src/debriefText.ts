import { CARDS_BY_ID } from './data/index';
import type { Debrief, DebriefDecision, DebriefDecisionKind, ReadingLevel } from './debrief';
import { formatMoney } from './money';
import { PRINCIPLES, type PrincipleId } from './principles';

// Spec v2, The debrief: templates keyed by principle and reading level turn
// the engine's structured debrief into words. A template is a plain string
// with {name} placeholders; it fills in numbers the engine computed and
// never computes one. No template holds a digit (debriefText.test.ts).

export type SectionId = 'result' | 'drivers' | 'helped' | 'hurt' | 'nextTime' | 'moneyStory' | 'principles';

export interface DebriefSection {
  readonly id: SectionId;
  readonly heading: string;
  readonly lines: readonly string[];
}

interface DecisionTemplates {
  /** The line around a decision's own text: amount and principles for adults, the bare sentence for kids. */
  readonly line: string;
  readonly signedHelped: string;
  readonly signedHurt: string;
  readonly months: string;
  readonly oneMonth: string;
  readonly lifeChoice: { readonly helped: string; readonly hurt: string };
  readonly lifeDifference: {
    readonly todayMore: string;
    readonly todayLess: string;
    readonly monthlyMore: string;
    readonly monthlyLess: string;
    readonly joiner: string;
  };
  readonly passedDeal: string;
  readonly boughtDeal: { readonly helped: string; readonly hurt: string; readonly noPaydays: string };
  readonly sale: { readonly gain: string; readonly loss: string; readonly even: string };
  readonly bankLoan: { readonly want: string; readonly none: string };
  readonly setbackLoan: string;
  readonly subscription: { readonly running: string; readonly cancelled: string };
  readonly growthAsset: { readonly helped: string; readonly hurt: string };
  readonly growthName: { readonly deal: string; readonly windfall: string };
  readonly growthChange: { readonly grew: string; readonly lost: string; readonly flat: string };
  readonly growthSold: string;
  readonly gave: { readonly space: string; readonly card: string };
}

export interface LevelTemplates {
  /** Section 2 lists the largest dollar impacts, helped or hurt, so its heading does not say won or lost: a winner's biggest decision can be a mistake. */
  readonly headings: Readonly<Record<SectionId, string>>;
  readonly result: {
    readonly freedom: string;
    readonly escaped: string;
    readonly won: string;
    readonly place: string;
    readonly out: string;
  };
  readonly decision: DecisionTemplates;
  readonly empty: Readonly<Record<Exclude<SectionId, 'result' | 'moneyStory'>, string>>;
  /** Next time, try, keyed by principle. {action} comes from `suggestionAction`. */
  readonly suggestion: Readonly<Record<PrincipleId, string>>;
  readonly suggestionAction: Readonly<Record<DebriefDecisionKind, string>>;
  readonly freedomPoints: string;
  readonly moneyStory: { readonly point: string; readonly crossed: string; readonly notCrossed: string };
  readonly principle: string;
}

const ADULT: LevelTemplates = {
  headings: {
    result: 'Result',
    drivers: 'What made the biggest difference',
    helped: 'Decisions that helped',
    hurt: 'Decisions that hurt',
    nextTime: 'Next time, try',
    moneyStory: 'Money story',
    principles: 'Principles practiced',
  },
  result: {
    freedom: 'You reached {percent}% Freedom. Your assets paid {passive} of your {total} monthly bills.',
    escaped: 'You escaped in round {round} and won.',
    won: 'You won after {round} rounds.',
    place: 'You finished {place} of {players}.',
    out: 'You ran out of money in round {round}.',
  },
  decision: {
    line: '{signed}: {text} ({principles})',
    signedHelped: '+{dollars}',
    signedHurt: '-{dollars}',
    months: '{count} months',
    oneMonth: 'one month',
    lifeChoice: {
      helped: 'You chose "{option}" over "{other}" on {card}, which meant {difference}.',
      hurt: 'You chose "{option}" over "{other}" on {card}, which meant {difference}.',
    },
    lifeDifference: {
      todayMore: '{amount} more spent today',
      todayLess: '{amount} less spent today',
      monthlyMore: '{amount} a month more for {months}',
      monthlyLess: '{amount} a month less for {months}',
      joiner: ' and ',
    },
    passedDeal: 'You passed on {card}, which would have paid {monthly} a month for {months}.',
    boughtDeal: {
      helped: 'You bought {card}. It paid you {received} over {months}{sale}.',
      hurt: 'You bought {card}. It paid you {received} over {months}{sale}.',
      noPaydays: 'You bought {card}{sale}.',
    },
    sale: {
      gain: ', and selling it made {amount}',
      loss: ', and selling it lost {amount}',
      even: ', and you sold it for what you paid',
    },
    bankLoan: {
      want: 'You borrowed {amount} for something you wanted. The payments cost {dollars} over {months}.',
      none: 'You borrowed {amount} with nothing to buy. The payments cost {dollars} over {months}.',
    },
    setbackLoan: '{card} forced a {amount} bank loan. Its payments cost {dollars} over {months}.',
    subscription: {
      running: '"{option}" on {card} cost {monthly} a month for {months}.',
      cancelled: '"{option}" on {card} cost {monthly} a month for {months}, until you cancelled it.',
    },
    growthAsset: {
      helped: '{asset} {change} and paid you {payouts} over {months}{sold}.',
      hurt: '{asset} {change} and paid you {payouts} over {months}{sold}.',
    },
    growthName: { deal: 'Your {card}', windfall: 'The money you invested from {card}' },
    growthChange: { grew: 'grew {amount}', lost: 'lost {amount}', flat: 'held its value' },
    growthSold: ' before you sold it',
    gave: { space: 'You gave {dollars} on a Giving space.', card: 'You gave {dollars} on {card}.' },
  },
  empty: {
    drivers: 'No single decision moved your money much.',
    helped: 'No decision paid off this game.',
    hurt: 'Nothing you chose cost you money.',
    nextTime: 'Keep doing what you did.',
    principles: 'None this game. Try one of the ideas above.',
  },
  suggestion: {
    P1: 'Keep an emergency fund: {action}. That was worth {dollars}{points}.',
    P2: 'Own assets that pay you: {action}. That was worth {dollars}{points}.',
    P3: 'Pick cash flow over looking rich: {action}. That was worth {dollars}{points}.',
    P4: 'Wait for what you want: {action}. That was worth {dollars}{points}.',
    P5: 'Borrow only for things that pay you: {action}. That was worth {dollars}{points}.',
    P6: 'Skip things that lose value: {action}. That was worth {dollars}{points}.',
    P7: 'Watch the small monthly costs: {action}. That was worth {dollars}{points}.',
    P8: 'Give your money time to grow: {action}. That was worth {dollars}{points}.',
    P9: 'Spread your bets: {action}. That was worth {dollars}{points}.',
    P10: 'Keep giving: {action}. That was worth {dollars}{points}.',
  },
  suggestionAction: {
    lifeChoice: 'choose "{other}" on {card}',
    passedDeal: 'buy {card} when you can',
    boughtDeal: 'put less into one deal like {card}',
    bankLoan: 'skip the {amount} loan',
    setbackLoan: 'keep {amount} saved for a surprise like {card}',
    subscription: 'skip "{option}", or cancel it sooner',
    growthAsset: 'spread your money so one drop like the one in {card} hurts less',
    gave: 'give again',
  },
  freedomPoints: ' and {points} Freedom points',
  moneyStory: {
    point: 'Round {round}: assets paid {passive}, bills were {total}.',
    crossed: 'Your assets passed your bills in round {round}. That is freedom.',
    notCrossed: 'At the end your assets paid {passive} of your {total} bills. Keep growing the first number.',
  },
  principle: '{name}: {text}',
};

const KIDS: LevelTemplates = {
  headings: {
    result: 'How you did',
    drivers: 'Your biggest moves',
    helped: 'Good moves',
    hurt: 'Moves that cost you',
    nextTime: 'Next time, try',
    moneyStory: 'Your money story',
    principles: 'What you practiced',
  },
  result: {
    freedom: 'You reached {percent}% Freedom! Your assets paid {passive} of your {total} bills each month.',
    escaped: 'You got free in round {round} and won!',
    won: 'You won!',
    place: 'You came in {place} of {players}.',
    out: 'You ran out of money in round {round}.',
  },
  decision: {
    line: '{text}',
    signedHelped: '+{dollars}',
    signedHurt: '-{dollars}',
    months: '{count} months',
    oneMonth: 'one month',
    lifeChoice: {
      helped: 'You picked "{option}" instead of "{other}". You kept {dollars}!',
      hurt: 'You picked "{option}". "{other}" would have saved you {dollars}.',
    },
    lifeDifference: { todayMore: '', todayLess: '', monthlyMore: '', monthlyLess: '', joiner: '' },
    passedDeal: 'You said no to {card}. It would have paid you {dollars}.',
    boughtDeal: {
      helped: 'You bought {card}. It paid you {dollars}!',
      hurt: 'You bought {card}, but it cost you {dollars} in the end.',
      noPaydays: 'You bought {card}. It paid you {dollars}!',
    },
    sale: { gain: '', loss: '', even: '' },
    bankLoan: {
      want: 'You borrowed {amount}. Paying for the loan cost you {dollars}.',
      none: 'You borrowed {amount}. Paying for the loan cost you {dollars}.',
    },
    setbackLoan: '{card} made you borrow money. The loan cost you {dollars}.',
    subscription: {
      running: '"{option}" cost {monthly} every month. That added up to {dollars}.',
      cancelled: '"{option}" cost {monthly} every month until you stopped it. That added up to {dollars}.',
    },
    growthAsset: { helped: '{asset} grew and paid you {dollars}!', hurt: '{asset} went down by {dollars}.' },
    growthName: { deal: 'Your {card}', windfall: 'The money you saved from {card}' },
    growthChange: { grew: '', lost: '', flat: '' },
    growthSold: '',
    gave: { space: 'You gave {dollars} to help others.', card: 'You gave {dollars} to help others.' },
  },
  empty: {
    drivers: 'Nothing big happened this game.',
    helped: 'No good moves to show this time.',
    hurt: 'Nothing cost you money. Great job!',
    nextTime: 'Keep doing what you did!',
    principles: 'Try one of the ideas above next game!',
  },
  suggestion: {
    P1: 'Save money for surprises. Next time, {action}. That is worth {dollars}{points}.',
    P2: 'Assets put money in your pocket. Next time, {action}. That is worth {dollars}{points}.',
    P3: 'Money each month beats showing off. Next time, {action}. That is worth {dollars}{points}.',
    P4: 'Waiting can buy you freedom. Next time, {action}. That is worth {dollars}{points}.',
    P5: 'Borrow only for things that pay you. Next time, {action}. That is worth {dollars}{points}.',
    P6: 'Things lose value fast. Next time, {action}. That is worth {dollars}{points}.',
    P7: 'A little every month adds up. Next time, {action}. That is worth {dollars}{points}.',
    P8: 'Money that grows keeps growing. Next time, {action}. That is worth {dollars}{points}.',
    P9: 'Do not bet everything on one thing. Next time, {action}. That is worth {dollars}{points}.',
    P10: 'Giving is part of what money is for. Next time, {action}. That is worth {dollars}{points}.',
  },
  suggestionAction: {
    lifeChoice: 'pick "{other}"',
    passedDeal: 'say yes to {card}',
    boughtDeal: 'do not put all your money in one thing',
    bankLoan: 'try not to borrow',
    setbackLoan: 'keep some money saved for surprises',
    subscription: 'skip "{option}"',
    growthAsset: 'spread your money around',
    gave: 'give again',
  },
  freedomPoints: ' and {points} more Freedom points',
  moneyStory: {
    point: 'Round {round}: assets {passive}, bills {total}',
    crossed: 'In round {round} your assets paid all your bills. You were free!',
    notCrossed: 'Your assets paid {passive} of your {total} bills. Keep going!',
  },
  principle: '{name}: {text}',
};

export const DEBRIEF_TEMPLATES: Readonly<Record<ReadingLevel, LevelTemplates>> = { adult: ADULT, kids: KIDS };

type Values = Readonly<Record<string, string>>;

/**
 * Puts each value where its {name} is. Values arrive already formatted
 * (formatMoney, counts); nothing here computes a number. A missing value
 * throws, so a reader never sees a raw placeholder.
 */
export function fillTemplate(template: string, values: Values): string {
  return template.replace(/\{([a-zA-Z]+)\}/g, (_match, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`debrief template is missing "${name}": ${template}`);
    return value;
  });
}

/** 1st, 2nd, 3rd, 4th: a word for a place, not arithmetic on it. */
function ordinal(place: number): string {
  const suffix = place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th';
  return `${String(place)}${suffix}`;
}

function cardTitle(cardId: string): string {
  const card = CARDS_BY_ID.get(cardId);
  if (card === undefined) throw new Error(`debrief text: unknown card "${cardId}"`);
  return card.title;
}

function optionLabel(cardId: string, optionId: string): string {
  const card = CARDS_BY_ID.get(cardId);
  const option = card?.deck === 'lifeChoices' ? card.options.find((o) => o.id === optionId) : undefined;
  if (option === undefined) throw new Error(`debrief text: card "${cardId}" has no option "${optionId}"`);
  return option.label;
}

function principleText(id: PrincipleId, level: ReadingLevel): { readonly name: string; readonly text: string } {
  const principle = PRINCIPLES.find((p) => p.id === id);
  if (principle === undefined) throw new Error(`debrief text: unknown principle "${id}"`);
  return { name: principle.name, text: level === 'kids' ? principle.kidsText : principle.adultText };
}

/** Every value a decision's templates may use, already formatted. Signs are dropped where the wording carries the direction. */
function decisionValues(d: DebriefDecision, t: DecisionTemplates): Values {
  const months = d.months === 1 ? t.oneMonth : fillTemplate(t.months, { count: String(d.months) });
  const common = { dollars: formatMoney(d.dollars), months };
  switch (d.kind) {
    case 'lifeChoice': {
      const parts: string[] = [];
      if (d.todayDifference < 0) parts.push(fillTemplate(t.lifeDifference.todayMore, { amount: formatMoney(-d.todayDifference) }));
      if (d.todayDifference > 0) parts.push(fillTemplate(t.lifeDifference.todayLess, { amount: formatMoney(d.todayDifference) }));
      // With no Payday after the choice, the monthly difference never happened.
      if (d.months > 0 && d.monthlyDifference < 0) parts.push(fillTemplate(t.lifeDifference.monthlyMore, { amount: formatMoney(-d.monthlyDifference), months }));
      if (d.months > 0 && d.monthlyDifference > 0) parts.push(fillTemplate(t.lifeDifference.monthlyLess, { amount: formatMoney(d.monthlyDifference), months }));
      return {
        ...common,
        card: cardTitle(d.cardId),
        option: optionLabel(d.cardId, d.optionId),
        other: optionLabel(d.cardId, d.otherOptionId),
        difference: parts.join(t.lifeDifference.joiner),
      };
    }
    case 'passedDeal':
      return { ...common, card: cardTitle(d.cardId), monthly: formatMoney(d.monthlyCashFlow) };
    case 'boughtDeal': {
      const sale =
        d.saleResult === undefined
          ? ''
          : d.saleResult > 0
            ? fillTemplate(t.sale.gain, { amount: formatMoney(d.saleResult) })
            : d.saleResult < 0
              ? fillTemplate(t.sale.loss, { amount: formatMoney(-d.saleResult) })
              : t.sale.even;
      return { ...common, card: cardTitle(d.cardId), received: formatMoney(d.cashFlowReceived), sale };
    }
    case 'bankLoan':
      return { ...common, amount: formatMoney(d.amount) };
    case 'setbackLoan':
      return { ...common, card: cardTitle(d.cardId), amount: formatMoney(d.amount) };
    case 'subscription':
      return { ...common, card: cardTitle(d.cardId), option: optionLabel(d.cardId, d.optionId), monthly: formatMoney(d.monthlyCost) };
    case 'growthAsset': {
      const card = cardTitle(d.cardId);
      const fromWindfall = CARDS_BY_ID.get(d.cardId)?.deck === 'lifeChoices';
      const change =
        d.valueGained > 0
          ? fillTemplate(t.growthChange.grew, { amount: formatMoney(d.valueGained) })
          : d.valueGained < 0
            ? fillTemplate(t.growthChange.lost, { amount: formatMoney(-d.valueGained) })
            : t.growthChange.flat;
      return {
        ...common,
        card,
        asset: fillTemplate(fromWindfall ? t.growthName.windfall : t.growthName.deal, { card }),
        change,
        payouts: formatMoney(d.payouts),
        sold: d.sold ? t.growthSold : '',
      };
    }
    case 'gave':
      return { ...common, ...(d.cardId === undefined ? {} : { card: cardTitle(d.cardId) }) };
  }
}

function decisionText(d: DebriefDecision, t: DecisionTemplates, values: Values): string {
  const side = d.outcome;
  switch (d.kind) {
    case 'lifeChoice':
      return fillTemplate(t.lifeChoice[side], values);
    case 'passedDeal':
      return fillTemplate(t.passedDeal, values);
    case 'boughtDeal':
      return fillTemplate(d.months === 0 ? t.boughtDeal.noPaydays : t.boughtDeal[side], values);
    case 'bankLoan':
      return fillTemplate(t.bankLoan[d.purpose], values);
    case 'setbackLoan':
      return fillTemplate(t.setbackLoan, values);
    case 'subscription':
      return fillTemplate(d.cancelled ? t.subscription.cancelled : t.subscription.running, values);
    case 'growthAsset':
      return fillTemplate(t.growthAsset[side], values);
    case 'gave':
      return fillTemplate(d.cardId === undefined ? t.gave.space : t.gave.card, values);
  }
}

function decisionLine(d: DebriefDecision, level: ReadingLevel): string {
  const t = DEBRIEF_TEMPLATES[level].decision;
  const values = decisionValues(d, t);
  const dollars = formatMoney(d.dollars);
  return fillTemplate(t.line, {
    signed: fillTemplate(d.outcome === 'helped' ? t.signedHelped : t.signedHurt, { dollars }),
    text: decisionText(d, t, values),
    principles: d.principles.map((id) => principleText(id, level).name).join(', '),
  });
}

function orEmpty(lines: readonly string[], empty: string): readonly string[] {
  return lines.length === 0 ? [empty] : lines;
}

/**
 * Spec v2, The debrief: the seven sections in order, as headings and lines
 * of text at the debrief's reading level. Every number shown is one the
 * engine put in the debrief, formatted by formatMoney.
 */
export function renderDebrief(debrief: Debrief): readonly DebriefSection[] {
  const level = debrief.readingLevel;
  const t = DEBRIEF_TEMPLATES[level];
  const r = debrief.result;

  const outcome =
    r.wentOutRound !== undefined
      ? fillTemplate(t.result.out, { round: String(r.wentOutRound) })
      : r.won && r.escaped
        ? fillTemplate(t.result.escaped, { round: String(r.rounds) })
        : r.won
          ? fillTemplate(t.result.won, { round: String(r.rounds) })
          : r.place === undefined
            ? undefined
            : fillTemplate(t.result.place, { place: ordinal(r.place), players: String(r.players) });
  const result = [
    fillTemplate(t.result.freedom, { percent: String(r.freedomPercent), passive: formatMoney(r.passiveIncome), total: formatMoney(r.totalExpenses) }),
    ...(outcome === undefined ? [] : [outcome]),
  ];

  const suggestions = debrief.suggestions.map((s) => {
    const values = decisionValues(s.decision, t.decision);
    return fillTemplate(t.suggestion[s.principle], {
      action: fillTemplate(t.suggestionAction[s.decision.kind], values),
      dollars: formatMoney(s.dollars),
      points: s.freedomPoints > 0 ? fillTemplate(t.freedomPoints, { points: String(s.freedomPoints) }) : '',
    });
  });

  const story = debrief.moneyStory;
  const storyLines = [
    ...story.points.map((p) =>
      fillTemplate(t.moneyStory.point, { round: String(p.round), passive: formatMoney(p.passiveIncome), total: formatMoney(p.totalExpenses) }),
    ),
    story.freedomRound === undefined
      ? fillTemplate(t.moneyStory.notCrossed, { passive: formatMoney(story.final.passiveIncome), total: formatMoney(story.final.totalExpenses) })
      : fillTemplate(t.moneyStory.crossed, { round: String(story.freedomRound) }),
  ];

  return [
    { id: 'result', heading: t.headings.result, lines: result },
    {
      id: 'drivers',
      heading: t.headings.drivers,
      lines: orEmpty(debrief.drivers.map((d) => decisionLine(d, level)), t.empty.drivers),
    },
    { id: 'helped', heading: t.headings.helped, lines: orEmpty(debrief.helped.map((d) => decisionLine(d, level)), t.empty.helped) },
    { id: 'hurt', heading: t.headings.hurt, lines: orEmpty(debrief.hurt.map((d) => decisionLine(d, level)), t.empty.hurt) },
    { id: 'nextTime', heading: t.headings.nextTime, lines: orEmpty(suggestions, t.empty.nextTime) },
    { id: 'moneyStory', heading: t.headings.moneyStory, lines: storyLines },
    {
      id: 'principles',
      heading: t.headings.principles,
      lines: orEmpty(
        debrief.principlesPracticed.map((id) => fillTemplate(t.principle, principleText(id, level))),
        t.empty.principles,
      ),
    },
  ];
}
