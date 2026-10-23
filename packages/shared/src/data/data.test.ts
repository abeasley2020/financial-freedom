// Loads every JSON fixture in src/data/ through its Zod schema.
//
// Shared is a pure package (CLAUDE.md, Rule 1), so this test imports the raw
// JSON instead of reading the filesystem. Vitest resolves JSON imports to
// plain objects, and TypeScript's resolveJsonModule types them.

import { describe, expect, it } from 'vitest';

import { BoardSchema } from '../board';
import { CardSchema, DealCardSchema, DECK_IDS, type DeckId } from '../cards';
import { PRINCIPLE_IDS } from '../principles';
import { ProfessionSchema } from '../professions';
import rawBoard from './board.json';
import rawBigDeals from './cards/big-deals.json';
import rawLifestyle from './cards/lifestyle.json';
import rawMarket from './cards/market.json';
import rawSetback from './cards/setback.json';
import rawSmallDeals from './cards/small-deals.json';
import { BOARD, CARDS_BY_DECK, PROFESSIONS, SMALL_DEALS } from './index';
import rawProfessions from './professions.json';

const RAW_DECKS: Record<DeckId, unknown> = {
  smallDeals: rawSmallDeals,
  bigDeals: rawBigDeals,
  market: rawMarket,
  lifestyle: rawLifestyle,
  setback: rawSetback,
};

function issues(result: { success: boolean; error?: { issues: unknown } }): string {
  return result.success ? '' : JSON.stringify(result.error?.issues, null, 2);
}

describe('fixtures: professions.json', () => {
  it('every profession parses through ProfessionSchema', () => {
    const result = ProfessionSchema.array().safeParse(rawProfessions);
    expect(result.success, issues(result)).toBe(true);
  });

  it('holds exactly the six professions from the spec', () => {
    const ids = PROFESSIONS.map((p) => p.id).sort();
    expect(ids).toEqual(['doctor', 'electrician', 'engineer', 'nurse', 'police-officer', 'teacher']);
  });

  it('matches the spec table for the Teacher', () => {
    const teacher = PROFESSIONS.find((p) => p.id === 'teacher');
    expect(teacher).toEqual({
      id: 'teacher',
      name: 'Teacher',
      salary: 3_300,
      baseExpenses: 2_300,
      startingCash: 400,
      startingLiabilities: [
        { kind: 'student', principal: 12_000 },
        { kind: 'car', principal: 6_000 },
        { kind: 'credit', principal: 2_000 },
      ],
    });
  });

  it('has unique ids', () => {
    const ids = PROFESSIONS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('fixtures: cards/*.json', () => {
  it.each(DECK_IDS)('deck %s: every card parses through CardSchema', (deck) => {
    const result = CardSchema.array().safeParse(RAW_DECKS[deck]);
    expect(result.success, issues(result)).toBe(true);
  });

  it.each(DECK_IDS)('deck %s: every card in the file carries that deck id', (deck) => {
    expect(CARDS_BY_DECK[deck].length).toBeGreaterThan(0);
    for (const card of CARDS_BY_DECK[deck]) {
      expect(card.deck).toBe(deck);
    }
  });

  it('deal decks parse through DealCardSchema specifically', () => {
    const deals = [...CARDS_BY_DECK.smallDeals, ...CARDS_BY_DECK.bigDeals];
    const result = DealCardSchema.array().safeParse(deals);
    expect(result.success, issues(result)).toBe(true);
  });

  it('ships 21 starter cards across the five decks (20 from spec step 3 plus one dividend stock)', () => {
    const total = DECK_IDS.reduce((n, deck) => n + CARDS_BY_DECK[deck].length, 0);
    expect(total).toBe(21);
  });

  it('includes at least one dividend-paying stock so BUY can exercise the dividend rule', () => {
    const paying = SMALL_DEALS.filter((c) => c.type === 'stock' && (c.dividendPerShare ?? 0) > 0);
    expect(paying.length).toBeGreaterThan(0);
  });

  it('card ids are unique across all decks', () => {
    const ids = DECK_IDS.flatMap((deck) => CARDS_BY_DECK[deck].map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every small deal has downPayment <= 5000', () => {
    const over = SMALL_DEALS.filter((c) => c.downPayment > 5_000).map((c) => `${c.id} (${String(c.downPayment)})`);
    expect(over).toEqual([]);
  });

  it('includes at least one stock card so the engine can exercise price ranges', () => {
    const stocks = SMALL_DEALS.filter((c) => c.type === 'stock');
    expect(stocks.length).toBeGreaterThan(0);
  });

  // Spec v2, Engineering practices, content tests. The per-principle minimum
  // (every principle on at least 3 cards) waits for Stage C's full decks.
  const everyCard = DECK_IDS.flatMap((deck) => CARDS_BY_DECK[deck]);

  it('every card carries at least one known principle', () => {
    for (const card of everyCard) {
      expect(card.principles.length, card.id).toBeGreaterThan(0);
      for (const p of card.principles) expect(PRINCIPLE_IDS, `${card.id} ${p}`).toContain(p);
    }
  });

  it('every card has kidsText of 90 characters or fewer and adultText of 160 or fewer, with no em dashes', () => {
    for (const card of everyCard) {
      expect(card.kidsText.length, `${card.id} kidsText`).toBeLessThanOrEqual(90);
      expect(card.adultText.length, `${card.id} adultText`).toBeLessThanOrEqual(160);
      expect(card.kidsText, card.id).not.toMatch(/\u2014/);
      expect(card.adultText, card.id).not.toMatch(/\u2014/);
      expect(card.title, card.id).not.toMatch(/\u2014/);
    }
  });

  it('every Setback card teaches P1 (spec, Setback cards)', () => {
    for (const card of CARDS_BY_DECK.setback) expect(card.principles, card.id).toContain('P1');
  });

  it('single stocks are not kidsOk (spec, Kids mode: no single stocks)', () => {
    for (const card of SMALL_DEALS) {
      if (card.type === 'stock') expect(card.kidsOk, card.id).toBe(false);
    }
  });

  it('every deck keeps at least one kidsOk card so kids mode has something to draw', () => {
    for (const deck of DECK_IDS) {
      expect(CARDS_BY_DECK[deck].some((c) => c.kidsOk), deck).toBe(true);
    }
  });
});

describe('fixtures: board.json', () => {
  it('parses through BoardSchema', () => {
    const result = BoardSchema.safeParse(rawBoard);
    expect(result.success, issues(result)).toBe(true);
  });

  it('has 24 spaces with the v2 space mix from the spec (no Payday spaces; Payday happens every turn)', () => {
    expect(BOARD.length).toBe(24);
    const count = (kind: string) => BOARD.filter((s) => s === kind).length;
    expect(count('opportunity')).toBe(10);
    expect(count('lifestyle')).toBe(6);
    expect(count('market')).toBe(4);
    expect(count('giving')).toBe(2);
    expect(count('setback')).toBe(2);
    expect(BOARD).not.toContain('payday');
  });

  it('places each kind at the positions the spec proposes (decided 2026-10-23, Q8)', () => {
    const positions = (kind: string) => BOARD.flatMap((s, i) => (s === kind ? [i] : []));
    expect(positions('opportunity')).toEqual([0, 3, 5, 8, 10, 13, 15, 18, 20, 23]);
    expect(positions('lifestyle')).toEqual([1, 7, 11, 14, 19, 22]);
    expect(positions('market')).toEqual([2, 9, 16, 21]);
    expect(positions('giving')).toEqual([4, 17]);
    expect(positions('setback')).toEqual([6, 12]);
  });
});
