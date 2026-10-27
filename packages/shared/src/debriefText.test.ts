import { describe, expect, it } from 'vitest';

import type { Debrief, DebriefDecision } from './debrief';
import { debriefText, formatMoney } from './debriefText';
import { PRINCIPLES } from './principles';

describe('formatMoney (CLAUDE.md, Money)', () => {
  it('formatMoney: whole dollars with thousands separators and no decimals', () => {
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(1_234)).toBe('$1,234');
    expect(formatMoney(1_000_000)).toBe('$1,000,000');
  });

  it('formatMoney: a negative amount carries its sign before the dollar sign', () => {
    expect(formatMoney(-380)).toBe('-$380');
  });

  it('formatMoney: a fractional amount is a programmer bug and throws', () => {
    expect(() => formatMoney(1.5)).toThrow();
  });
});

const base: Debrief = {
  playerId: 'p1',
  readingLevel: 'adult',
  result: { outcome: 'lost', endReason: 'roundLimit', rank: 2, players: 3, freedomPercent: 72, passiveIncome: 2_160, totalExpenses: 3_000 },
  drivers: [],
  helped: [],
  hurt: [],
  suggestions: [],
  moneyStory: [],
  principlesPracticed: [],
};

const decision = (patch: Partial<DebriefDecision> & Pick<DebriefDecision, 'kind' | 'impact'>): DebriefDecision => ({
  id: `${patch.kind}:1:0`,
  logIndex: 1,
  eventIndex: 0,
  roundNumber: 3,
  principles: ['P7'],
  dollars: Math.abs(patch.impact),
  verdict: patch.impact > 0 ? 'helped' : 'hurt',
  paydays: 5,
  ...patch,
});

describe('debriefText: templates fill in the numbers the engine computed', () => {
  it('DEBRIEF TEXT: the result line from the spec', () => {
    expect(debriefText(base).result).toBe('You reached 72% Freedom. Your assets paid $2,160 of your $3,000 monthly bills. You finished 2nd of 3.');
  });

  it('DEBRIEF TEXT: a player who went out sees the round they ran out of money', () => {
    const d: Debrief = { ...base, result: { ...base.result, outcome: 'out', roundOut: 7, rank: 3 } };
    expect(debriefText(d).result).toContain('You ran out of money in round 7.');
  });

  it('DEBRIEF TEXT: an escape says so', () => {
    const d: Debrief = { ...base, result: { ...base.result, outcome: 'escaped', endReason: 'escape', rank: 1, freedomPercent: 104 } };
    expect(debriefText(d).result).toMatch(/^You escaped!/);
  });

  it('DEBRIEF TEXT: each decision line ends with its principle in the reading level\'s words', () => {
    const sub = decision({ kind: 'subscription', impact: -300, monthly: 60, cardId: 'life-004', optionId: 'subscribe' });
    const adult = debriefText({ ...base, hurt: [sub] }).hurt[0];
    const kids = debriefText({ ...base, readingLevel: 'kids', hurt: [sub] }).hurt[0];
    const p7 = PRINCIPLES.find((p) => p.id === 'P7');
    expect(adult).toContain('$300');
    expect(adult).toContain('$60');
    expect(adult?.endsWith(`Small costs add up: ${p7?.adultText ?? ''}`)).toBe(true);
    expect(kids?.endsWith(p7?.kidsText ?? '')).toBe(true);
  });

  it('DEBRIEF TEXT: a Life Choices line names the chosen and the cheapest option', () => {
    const lc = decision({ kind: 'lifeChoice', impact: -1_140, monthly: 380, cardId: 'life-001', optionId: 'new', cheapestOptionId: 'keep', principles: ['P6'] });
    const line = debriefText({ ...base, hurt: [lc] }).hurt[0] ?? '';
    expect(line).toContain('$1,140');
    expect(line).toMatch(/new/i);
  });

  it('DEBRIEF TEXT: a suggestion gives the dollars and the Freedom points', () => {
    const d: Debrief = {
      ...base,
      suggestions: [{ decisionId: 'subscription:1:0', kind: 'subscription', principle: 'P7', dollars: 300, monthly: 60, freedomPoints: 2, cardId: 'life-004' }],
    };
    const line = debriefText(d).suggestions[0] ?? '';
    expect(line).toContain('$300');
    expect(line).toContain('2 Freedom points');
  });

  it('DEBRIEF TEXT: every kind of decision has a line at both reading levels, with no em dashes', () => {
    const all: DebriefDecision[] = [
      decision({ kind: 'lifeChoice', impact: -100, monthly: 20, cardId: 'life-001', optionId: 'new', cheapestOptionId: 'keep' }),
      decision({ kind: 'lifeChoice', impact: 100, monthly: 20, cardId: 'life-001', optionId: 'keep', cheapestOptionId: 'keep' }),
      decision({ kind: 'passedDeal', impact: -900, monthly: 450, cardId: 'small-003' }),
      decision({ kind: 'boughtDeal', impact: 900, monthly: 450, cardId: 'small-003', sold: false }),
      decision({ kind: 'boughtDeal', impact: -900, monthly: -50, cardId: 'big-003', sold: true }),
      decision({ kind: 'bankLoan', impact: -600, monthly: 200, purpose: 'want' }),
      decision({ kind: 'bankLoan', impact: -600, monthly: 200, purpose: 'none' }),
      decision({ kind: 'setbackLoan', impact: -1_200, monthly: 300, cardId: 'setback-001', purpose: 'setback' }),
      decision({ kind: 'subscription', impact: -300, monthly: 60 }),
      decision({ kind: 'growthHeld', impact: 101, monthly: 10, cardId: 'small-004', sold: false }),
      decision({ kind: 'growthHeld', impact: 101, monthly: 0, cardId: 'life-005', sold: true }),
      decision({ kind: 'gave', impact: 250, principles: ['P10'] }),
    ];
    for (const readingLevel of ['kids', 'adult'] as const) {
      const text = debriefText({ ...base, readingLevel, drivers: all, helped: all, hurt: all, principlesPracticed: ['P1', 'P10'] });
      for (const line of [text.result, ...text.drivers, ...text.helped, ...text.hurt, ...text.principles, text.moneyStory]) {
        expect(line.length).toBeGreaterThan(0);
        expect(line).not.toContain('—');
        expect(line).not.toContain('undefined');
      }
      expect(text.principles).toHaveLength(2);
    }
  });

  it('DEBRIEF TEXT: the money story names the first and last months and the crossing round', () => {
    const d: Debrief = {
      ...base,
      moneyStory: [
        { roundNumber: 1, passiveIncome: 0, totalExpenses: 4_560 },
        { roundNumber: 9, passiveIncome: 4_600, totalExpenses: 4_560 },
      ],
      crossedRound: 9,
    };
    const story = debriefText(d).moneyStory;
    expect(story).toContain('$0');
    expect(story).toContain('$4,600');
    expect(story).toContain('round 9');
  });

  it('DEBRIEF TEXT: an end-of-game point is named as the end of the game', () => {
    const d: Debrief = {
      ...base,
      moneyStory: [
        { roundNumber: 1, passiveIncome: 0, totalExpenses: 4_560 },
        { roundNumber: 9, passiveIncome: 4_600, totalExpenses: 4_560, endOfGame: true },
      ],
      crossedRound: 9,
    };
    expect(debriefText(d).moneyStory).toContain('$4,600/mo at the end of the game');
  });
});
