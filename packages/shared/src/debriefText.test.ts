import { describe, expect, it } from 'vitest';

import type { Debrief, DebriefDecision } from './debrief';
import { DEBRIEF_DECISION_KINDS, READING_LEVELS } from './debrief';
import { DEBRIEF_TEMPLATES, fillTemplate, renderDebrief } from './debriefText';
import { PRINCIPLE_IDS } from './principles';

// Spec v2, The debrief: text comes from templates keyed by principle and
// reading level. Templates fill in numbers the engine computed and never
// compute them, so no template holds a digit.

const truck: DebriefDecision = {
  kind: 'lifeChoice',
  ref: { entry: 2, event: 0 },
  outcome: 'hurt',
  impact: -5_700,
  dollars: 5_700,
  principles: ['P5', 'P6'],
  round: 1,
  months: 15,
  cardId: 'life-001',
  optionId: 'new',
  otherOptionId: 'keep',
  todayDifference: 0,
  monthlyDifference: -380,
};
const duplex: DebriefDecision = {
  kind: 'boughtDeal',
  ref: { entry: 40, event: 1 },
  outcome: 'helped',
  impact: 2_100,
  dollars: 2_100,
  principles: ['P2', 'P3', 'P5'],
  round: 12,
  months: 3,
  cardId: 'small-001',
  cost: 5_000,
  cashFlowReceived: 2_100,
};
const lawn: DebriefDecision = {
  kind: 'passedDeal',
  ref: { entry: 35, event: 0 },
  outcome: 'hurt',
  impact: -1_800,
  dollars: 1_800,
  principles: ['P2', 'P3'],
  round: 11,
  months: 4,
  cardId: 'small-003',
  monthlyCashFlow: 450,
};
const gift: DebriefDecision = {
  kind: 'gave',
  ref: { entry: 20, event: 1 },
  outcome: 'helped',
  impact: 300,
  dollars: 300,
  principles: ['P10'],
  round: 5,
  months: 0,
};

function sample(readingLevel: 'adult' | 'kids'): Debrief {
  return {
    readingLevel,
    result: {
      playerId: 'p2',
      professionId: 'teacher',
      freedomPercent: 15,
      passiveIncome: 700,
      totalExpenses: 4_560,
      won: false,
      escaped: false,
      place: 2,
      players: 3,
      ending: 'roundLimit',
      rounds: 15,
    },
    drivers: [truck, duplex, lawn],
    helped: [duplex, gift],
    hurt: [truck, lawn],
    suggestions: [
      { decision: truck, principle: 'P5', dollars: 5_700, monthly: 380, freedomPoints: 8 },
      { decision: lawn, principle: 'P2', dollars: 1_800, monthly: 450, freedomPoints: 9 },
    ],
    moneyStory: {
      points: [
        { ref: { entry: 0, event: 1 }, round: 1, passiveIncome: 0, totalExpenses: 4_560 },
        { ref: { entry: 50, event: 1 }, round: 15, passiveIncome: 700, totalExpenses: 4_560 },
      ],
      final: { passiveIncome: 700, totalExpenses: 4_560 },
    },
    principlesPracticed: ['P2', 'P3', 'P5', 'P10'],
  };
}

/** Every string anywhere in the templates. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(strings);
  return [];
}

describe('fillTemplate', () => {
  it('fillTemplate: puts each value where its name is', () => {
    expect(fillTemplate('You gave {dollars} on {card}.', { dollars: '$300', card: 'Giving' })).toBe('You gave $300 on Giving.');
  });

  it('fillTemplate: fills a name used twice both times', () => {
    expect(fillTemplate('{a} and {a}', { a: 'x' })).toBe('x and x');
  });

  it('fillTemplate: throws when a value is missing, so a template never shows a raw placeholder', () => {
    expect(() => fillTemplate('You gave {dollars}.', {})).toThrow();
  });
});

describe('DEBRIEF_TEMPLATES', () => {
  it('DEBRIEF text: no template holds a digit, so every number comes from the engine', () => {
    for (const text of strings(DEBRIEF_TEMPLATES)) expect(text, text).not.toMatch(/\d/);
  });

  it('DEBRIEF text: no em dashes, and every placeholder is a plain name in braces', () => {
    for (const text of strings(DEBRIEF_TEMPLATES)) {
      expect(text, text).not.toMatch(/—/);
      expect(text.replace(/\{[a-zA-Z]+\}/g, ''), text).not.toMatch(/[{}]/);
    }
  });

  it('DEBRIEF text: every principle has a suggestion template, and every decision kind a line and a suggestion, at both reading levels', () => {
    for (const level of READING_LEVELS) {
      const t = DEBRIEF_TEMPLATES[level];
      for (const id of PRINCIPLE_IDS) expect(t.suggestion[id], `${level} ${id}`).toContain('{action}');
      for (const kind of DEBRIEF_DECISION_KINDS) expect(t.suggestionAction[kind].length, `${level} ${kind}`).toBeGreaterThan(0);
    }
  });
});

describe('renderDebrief', () => {
  it('DEBRIEF text: renders the seven sections in the spec order at the adult level', () => {
    expect(renderDebrief(sample('adult'))).toEqual([
      {
        id: 'result',
        heading: 'Result',
        lines: ['You reached 15% Freedom. Your assets paid $700 of your $4,560 monthly bills.', 'You finished 2nd of 3.'],
      },
      {
        id: 'drivers',
        heading: 'What made the biggest difference',
        lines: [
          '-$5,700: You chose "Finance a new truck" over "Keep the old truck" on Your Truck Is Nine Years Old, which meant $380 a month more for 15 months. (Good debt vs. bad debt, Things lose value)',
          '+$2,100: You bought Duplex in Decatur. It paid you $2,100 over 3 months. (Assets vs. liabilities, Cash flow beats looking rich, Good debt vs. bad debt)',
          '-$1,800: You passed on Lawn Care Trailer, which would have paid $450 a month for 4 months. (Assets vs. liabilities, Cash flow beats looking rich)',
        ],
      },
      {
        id: 'helped',
        heading: 'Decisions that helped',
        lines: [
          '+$2,100: You bought Duplex in Decatur. It paid you $2,100 over 3 months. (Assets vs. liabilities, Cash flow beats looking rich, Good debt vs. bad debt)',
          '+$300: You gave $300 on a Giving space. (Generosity)',
        ],
      },
      {
        id: 'hurt',
        heading: 'Decisions that hurt',
        lines: [
          '-$5,700: You chose "Finance a new truck" over "Keep the old truck" on Your Truck Is Nine Years Old, which meant $380 a month more for 15 months. (Good debt vs. bad debt, Things lose value)',
          '-$1,800: You passed on Lawn Care Trailer, which would have paid $450 a month for 4 months. (Assets vs. liabilities, Cash flow beats looking rich)',
        ],
      },
      {
        id: 'nextTime',
        heading: 'Next time, try',
        lines: [
          'Borrow only for things that pay you: choose "Keep the old truck" on Your Truck Is Nine Years Old. That was worth $5,700 and 8 Freedom points.',
          'Own assets that pay you: buy Lawn Care Trailer when you can. That was worth $1,800 and 9 Freedom points.',
        ],
      },
      {
        id: 'moneyStory',
        heading: 'Money story',
        lines: [
          'Round 1: assets paid $0, bills were $4,560.',
          'Round 15: assets paid $700, bills were $4,560.',
          'At the end your assets paid $700 of your $4,560 bills. Keep growing the first number.',
        ],
      },
      {
        id: 'principles',
        heading: 'Principles practiced',
        lines: [
          'Assets vs. liabilities: Assets put money in your pocket every month. Liabilities take it out.',
          'Cash flow beats looking rich: Monthly cash flow decides freedom; what you own on paper does not.',
          'Good debt vs. bad debt: Debt that buys income can pay for itself. Debt that buys things only costs you.',
          'Generosity: Giving is part of what money is for.',
        ],
      },
    ]);
  });

  it('DEBRIEF text: renders short sentences with the same numbers at the kids level', () => {
    expect(renderDebrief(sample('kids'))).toEqual([
      {
        id: 'result',
        heading: 'How you did',
        lines: ['You reached 15% Freedom! Your assets paid $700 of your $4,560 bills each month.', 'You came in 2nd of 3.'],
      },
      {
        id: 'drivers',
        heading: 'Your biggest moves',
        lines: [
          'You picked "Finance a new truck". "Keep the old truck" would have saved you $5,700.',
          'You bought Duplex in Decatur. It paid you $2,100!',
          'You said no to Lawn Care Trailer. It would have paid you $1,800.',
        ],
      },
      {
        id: 'helped',
        heading: 'Good moves',
        lines: ['You bought Duplex in Decatur. It paid you $2,100!', 'You gave $300 to help others.'],
      },
      {
        id: 'hurt',
        heading: 'Moves that cost you',
        lines: [
          'You picked "Finance a new truck". "Keep the old truck" would have saved you $5,700.',
          'You said no to Lawn Care Trailer. It would have paid you $1,800.',
        ],
      },
      {
        id: 'nextTime',
        heading: 'Next time, try',
        lines: [
          'Borrow only for things that pay you. Next time, pick "Keep the old truck". That is worth $5,700 and 8 more Freedom points.',
          'Assets put money in your pocket. Next time, say yes to Lawn Care Trailer. That is worth $1,800 and 9 more Freedom points.',
        ],
      },
      {
        id: 'moneyStory',
        heading: 'Your money story',
        lines: ['Round 1: assets $0, bills $4,560', 'Round 15: assets $700, bills $4,560', 'Your assets paid $700 of your $4,560 bills. Keep going!'],
      },
      {
        id: 'principles',
        heading: 'What you practiced',
        lines: [
          'Assets vs. liabilities: Assets put money in your pocket. Liabilities take it out.',
          'Cash flow beats looking rich: What you earn each month matters more than what you show off.',
          'Good debt vs. bad debt: Borrow to buy things that pay you, not things that cost you.',
          'Generosity: Giving is part of what money is for.',
        ],
      },
    ]);
  });

  it('DEBRIEF text: an escaper reads the round they escaped, and a player who went out reads the round they ran out of money', () => {
    const won = renderDebrief({ ...sample('adult'), result: { ...sample('adult').result, won: true, escaped: true, place: 1, ending: 'escape', rounds: 13 } });
    expect(won[0]?.lines[1]).toBe('You escaped in round 13 and won.');
    expect(won[1]?.heading).toBe('What made the biggest difference');
    const { playerId, professionId, freedomPercent, passiveIncome, totalExpenses, players, rounds } = sample('adult').result;
    const out = renderDebrief({
      ...sample('adult'),
      result: { playerId, professionId, freedomPercent, passiveIncome, totalExpenses, won: false, escaped: false, players, rounds, wentOutRound: 9, ending: 'lastStanding' },
    });
    expect(out[0]?.lines[1]).toBe('You ran out of money in round 9.');
  });

  it('DEBRIEF text: a Life Choices line leaves out the monthly part when no Payday came after the choice', () => {
    const lastTurn: DebriefDecision = {
      ...truck,
      outcome: 'helped',
      impact: 5_000,
      dollars: 5_000,
      principles: ['P4'],
      months: 0,
      cardId: 'life-023',
      optionId: 'stay',
      otherOptionId: 'move',
      todayDifference: 5_000,
      monthlyDifference: 450,
    };
    const lines = renderDebrief({ ...sample('adult'), drivers: [lastTurn] })[1]?.lines;
    expect(lines).toEqual(['+$5,000: You chose "Stay where you are" over "Move to the bigger house" on Bigger House, which meant $5,000 less spent today. (Delayed gratification)']);
  });

  it('DEBRIEF text: empty sections still say something', () => {
    for (const level of READING_LEVELS) {
      const empty = renderDebrief({ ...sample(level), drivers: [], helped: [], hurt: [], suggestions: [], principlesPracticed: [] });
      for (const section of empty) expect(section.lines.length, `${level} ${section.id}`).toBeGreaterThan(0);
    }
  });
});
