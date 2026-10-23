// Loads every JSON fixture in src/data/ through its Zod schema.
//
// Shared is a pure package (CLAUDE.md, Rule 1), so this test imports the raw
// JSON instead of reading the filesystem. Vitest resolves JSON imports to
// plain objects, and TypeScript's resolveJsonModule types them.

import { describe, expect, it } from 'vitest';

import { BoardSchema } from '../board';
import { CardSchema, DealCardSchema, DECK_IDS, type DeckId } from '../cards';
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

  it('ships 20 starter cards across the five decks', () => {
    const total = DECK_IDS.reduce((n, deck) => n + CARDS_BY_DECK[deck].length, 0);
    expect(total).toBe(20);
  });

  it('card ids are unique across all decks', () => {
    const ids = DECK_IDS.flatMap((deck) => CARDS_BY_DECK[deck].map((c) => c.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes at least one stock card so the engine can exercise price ranges', () => {
    const stocks = SMALL_DEALS.filter((c) => c.type === 'stock');
    expect(stocks.length).toBeGreaterThan(0);
  });
});

describe('fixtures: board.json', () => {
  it('parses through BoardSchema', () => {
    const result = BoardSchema.safeParse(rawBoard);
    expect(result.success, issues(result)).toBe(true);
  });

  it('has 24 spaces with the space mix from the spec', () => {
    expect(BOARD.length).toBe(24);
    const count = (kind: string) => BOARD.filter((s) => s === kind).length;
    expect(count('opportunity')).toBe(9);
    expect(count('market')).toBe(5);
    expect(count('lifestyle')).toBe(5);
    expect(count('payday')).toBe(2);
    expect(count('giving')).toBe(2);
    expect(count('setback')).toBe(1);
  });
});
