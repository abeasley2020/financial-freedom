import { describe, expect, it } from 'vitest';

import { DECISION_PRINCIPLES, PRINCIPLE_IDS, PRINCIPLES, PrincipleIdSchema } from './principles';

// Spec v2, Principles: ten ideas the whole game speaks in.

describe('principles', () => {
  it('has exactly the ten ids P1 to P10, in order', () => {
    expect(PRINCIPLE_IDS).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10']);
  });

  it('PrincipleIdSchema accepts each id and rejects anything else', () => {
    for (const id of PRINCIPLE_IDS) expect(PrincipleIdSchema.safeParse(id).success, id).toBe(true);
    expect(PrincipleIdSchema.safeParse('P0').success).toBe(false);
    expect(PrincipleIdSchema.safeParse('P11').success).toBe(false);
    expect(PrincipleIdSchema.safeParse('p1').success).toBe(false);
  });

  it('gives every principle a name, an adult text, and a kids text', () => {
    expect(PRINCIPLES.map((p) => p.id)).toEqual(PRINCIPLE_IDS);
    for (const p of PRINCIPLES) {
      expect(p.name.length, p.id).toBeGreaterThan(0);
      expect(p.adultText.length, p.id).toBeGreaterThan(0);
      expect(p.kidsText.length, p.id).toBeGreaterThan(0);
      expect(p.kidsText.length, `${p.id} kids text is for 4th graders`).toBeLessThanOrEqual(90);
      expect(p.adultText.length, p.id).toBeLessThanOrEqual(160);
      expect(p.adultText, p.id).not.toMatch(/—/);
      expect(p.kidsText, p.id).not.toMatch(/—/);
    }
  });

  it('matches the spec table for the first and last principles', () => {
    expect(PRINCIPLES[0]).toEqual({
      id: 'P1',
      name: 'Emergency fund',
      adultText: 'Cash on hand turns a surprise bill into an inconvenience instead of new debt.',
      kidsText: 'Keep money saved for surprises so they do not turn into debt.',
    });
    expect(PRINCIPLES[9]).toMatchObject({ id: 'P10', name: 'Generosity' });
  });

  it('fixes the principles each engine decision is tagged with (spec, Decision log and debrief attribution)', () => {
    expect(DECISION_PRINCIPLES).toEqual({
      bankLoan: ['P5'],
      setbackLoan: ['P1'],
      repayLoan: ['P5'],
      cancelSubscription: ['P7'],
      giving: ['P10'],
    });
  });
});
