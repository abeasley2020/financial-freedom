// Loads every JSON fixture in src/data/ through its Zod schema.
//
// Shared is a pure package (CLAUDE.md, Rule 1), so this test imports the raw
// JSON instead of reading the filesystem. Vitest resolves JSON imports to
// plain objects, and TypeScript's resolveJsonModule types them.

import { describe, expect, it } from 'vitest';

import { BoardSchema } from '../board';
import { ASSET_TYPES, CardSchema, DealCardSchema, DECK_IDS, LIFE_CHOICE_CATEGORIES, type DeckId } from '../cards';
import { PRINCIPLE_IDS } from '../principles';
import { ProfessionSchema } from '../professions';
import rawBoard from './board.json';
import rawBigDeals from './cards/big-deals.json';
import rawLifeChoices from './cards/life-choices.json';
import rawMarket from './cards/market.json';
import rawSetback from './cards/setback.json';
import rawSmallDeals from './cards/small-deals.json';
import { BIG_DEALS, BOARD, CARDS_BY_DECK, LIFE_CHOICES_CARDS, MARKET_CARDS, PROFESSIONS, SETBACK_CARDS, SMALL_DEALS } from './index';
import rawProfessions from './professions.json';

const RAW_DECKS: Record<DeckId, unknown> = {
  smallDeals: rawSmallDeals,
  bigDeals: rawBigDeals,
  market: rawMarket,
  lifeChoices: rawLifeChoices,
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

  it('holds exactly the sixteen professions from the spec, in the spec order', () => {
    expect(PROFESSIONS.map((p) => p.name)).toEqual([
      'Restaurant Server',
      'Retail Manager',
      'Truck Driver',
      'Welder',
      'Electrician',
      'Teacher',
      'Police Officer',
      'Firefighter',
      'Army Sergeant',
      'Nurse',
      'Farmer',
      'Real Estate Agent',
      'Software Developer',
      'Engineer',
      'Pharmacist',
      'Doctor',
    ]);
  });

  it('matches docs/content-notes.md for the Teacher', () => {
    const teacher = PROFESSIONS.find((p) => p.id === 'teacher');
    expect(teacher).toEqual({
      id: 'teacher',
      name: 'Teacher',
      salary: 5_300,
      baseExpenses: 4_000,
      startingCash: 2_500,
      startingLiabilities: [
        { kind: 'student', principal: 30_000 },
        { kind: 'car', principal: 10_000 },
        { kind: 'credit', principal: 2_000 },
      ],
    });
  });

  it('every salary is rounded to $100 (spec, Professions numbers rule)', () => {
    for (const p of PROFESSIONS) expect(p.salary % 100, p.id).toBe(0);
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

  it('ships the spec deck counts: 40 small deals, 25 big deals, 20 market, 30 Life Choices, 10 setback', () => {
    const counts = Object.fromEntries(DECK_IDS.map((deck) => [deck, CARDS_BY_DECK[deck].length]));
    expect(counts).toEqual({ smallDeals: 40, bigDeals: 25, market: 20, lifeChoices: 30, setback: 10 });
  });

  it('growth deal cards stay inside the spec ranges: growthPercent 1 to 6, payoutPercent 0 to 2', () => {
    const growth = [...CARDS_BY_DECK.smallDeals, ...CARDS_BY_DECK.bigDeals].filter(
      (c) => c.deck !== 'market' && c.deck !== 'lifeChoices' && c.deck !== 'setback' && (c.type === 'savings' || c.type === 'cd' || c.type === 'index'),
    );
    expect(growth.length).toBeGreaterThan(0);
    for (const card of growth) {
      if (card.deck !== 'smallDeals' && card.deck !== 'bigDeals') continue;
      expect(card.growthPercent, card.id).toBeGreaterThanOrEqual(1);
      expect(card.growthPercent, card.id).toBeLessThanOrEqual(6);
      expect(card.payoutPercent, card.id).toBeGreaterThanOrEqual(0);
      expect(card.payoutPercent, card.id).toBeLessThanOrEqual(2);
    }
  });

  it('the v1 index fund is now a growth asset and a savings account exists for kids', () => {
    const index = SMALL_DEALS.find((c) => c.id === 'small-004');
    expect(index).toMatchObject({ type: 'index', price: 500, downPayment: 500, mortgage: 0, monthlyCashFlow: 0, growthPercent: 4, payoutPercent: 1 });
    expect(SMALL_DEALS.some((c) => c.type === 'savings' && c.kidsOk)).toBe(true);
  });

  it('includes Market cards that move marketValue both ways', () => {
    const percents = CARDS_BY_DECK.market
      .flatMap((c) => (c.deck === 'market' ? c.effects : []))
      .flatMap((e) => (e.kind === 'changeMarketValue' ? [e.percent] : []));
    expect(percents.some((p) => p < 0)).toBe(true);
    expect(percents.some((p) => p > 0)).toBe(true);
  });

  it('every Life Choices card has an option with no monthly cost (spec, Life Choices cards)', () => {
    for (const card of CARDS_BY_DECK.lifeChoices) {
      if (card.deck !== 'lifeChoices') continue;
      const noMonthly = card.options.filter((o) => !o.effects.some((e) => e.kind === 'addLoan' || e.kind === 'addSubscription'));
      expect(noMonthly.length, card.id).toBeGreaterThan(0);
    }
  });

  it('every Life Choices card has a free option (nothing today, nothing monthly) that kids may choose, so a kid is never stuck', () => {
    // Stronger than the spec's "no monthly cost": see STATUS.md, Questions for Andre.
    for (const card of CARDS_BY_DECK.lifeChoices) {
      if (card.deck !== 'lifeChoices') continue;
      const free = card.options.filter((o) => !o.effects.some((e) => e.kind === 'payCash' || e.kind === 'addLoan' || e.kind === 'addSubscription' || e.kind === 'investGrowth'));
      expect(free.length, card.id).toBeGreaterThan(0);
      if (card.kidsOk) expect(free.some((o) => o.kidsOk), `${card.id} free option for kids`).toBe(true);
    }
  });

  it('every Life Choices option carries at least one principle and texts within limits', () => {
    for (const card of CARDS_BY_DECK.lifeChoices) {
      if (card.deck !== 'lifeChoices') continue;
      for (const option of card.options) {
        expect(option.principles.length, `${card.id}/${option.id}`).toBeGreaterThan(0);
        expect(option.kidsText.length, `${card.id}/${option.id}`).toBeLessThanOrEqual(90);
        expect(option.adultText.length, `${card.id}/${option.id}`).toBeLessThanOrEqual(160);
      }
    }
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

  // Spec v2, Engineering practices, content tests.
  const everyCard = DECK_IDS.flatMap((deck) => CARDS_BY_DECK[deck]);

  it('every principle appears on at least 3 cards', () => {
    for (const id of PRINCIPLE_IDS) {
      const cards = everyCard.filter((c) => c.principles.includes(id)).map((c) => c.id);
      expect(cards.length, `${id} on ${cards.join(', ')}`).toBeGreaterThanOrEqual(3);
    }
  });

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

describe('content coverage (Stage C: the plan decisions table, kids numbers, growth ranges)', () => {
  const deals = [...SMALL_DEALS, ...BIG_DEALS];

  it('every asset type appears in the deal decks, and stocks come with and without a dividend', () => {
    for (const type of ASSET_TYPES) expect(deals.some((c) => c.type === type), type).toBe(true);
    const stocks = deals.filter((c) => c.type === 'stock');
    expect(stocks.some((c) => (c.dividendPerShare ?? 0) > 0)).toBe(true);
    expect(stocks.some((c) => (c.dividendPerShare ?? 0) === 0)).toBe(true);
  });

  it('big deal down payments are $6,000 to $50,000 (spec, Card decks)', () => {
    const outside = BIG_DEALS.filter((c) => c.downPayment < 6_000 || c.downPayment > 50_000).map((c) => c.id);
    expect(outside).toEqual([]);
  });

  it('every Life Choices category, Life Choices effect, and Market effect from the spec is used', () => {
    for (const category of LIFE_CHOICE_CATEGORIES) {
      expect(LIFE_CHOICES_CARDS.some((c) => c.category === category), category).toBe(true);
    }
    const lifeEffects = new Set<string>(LIFE_CHOICES_CARDS.flatMap((c) => c.options.flatMap((o) => o.effects.map((e) => e.kind))));
    for (const kind of ['payCash', 'gainCash', 'addLoan', 'addSubscription', 'investGrowth', 'repayLargestLoan']) {
      expect(lifeEffects.has(kind), kind).toBe(true);
    }
    const marketEffects = new Set<string>(MARKET_CARDS.flatMap((c) => c.effects.map((e) => e.kind)));
    for (const kind of ['offerBuyout', 'forceSale', 'changeCashFlow', 'splitShares', 'changeMarketValue']) {
      expect(marketEffects.has(kind), kind).toBe(true);
    }
  });

  it('windfall options invest only inside the growth ranges: growthPercent 1 to 6, payoutPercent 0 to 2', () => {
    const invests = LIFE_CHOICES_CARDS.flatMap((c) => c.options.flatMap((o) => o.effects.flatMap((e) => (e.kind === 'investGrowth' ? [{ id: `${c.id}/${o.id}`, e }] : []))));
    expect(invests.length).toBeGreaterThan(0);
    for (const { id, e } of invests) {
      expect(e.growthPercent, id).toBeGreaterThanOrEqual(1);
      expect(e.growthPercent, id).toBeLessThanOrEqual(6);
      expect(e.payoutPercent, id).toBeGreaterThanOrEqual(0);
      expect(e.payoutPercent, id).toBeLessThanOrEqual(2);
    }
  });

  it('kids numbers are round: multiples of $100 for cash and $10 for monthly amounts (spec, Kids mode)', () => {
    const odd: string[] = [];
    const cash = (id: string, n: number) => {
      if (n % 100 !== 0) odd.push(`${id} cash ${String(n)}`);
    };
    const monthly = (id: string, n: number) => {
      if (n % 10 !== 0) odd.push(`${id} monthly ${String(n)}`);
    };
    for (const c of deals.filter((d) => d.kidsOk)) {
      cash(c.id, c.price);
      cash(c.id, c.downPayment);
      monthly(c.id, c.monthlyCashFlow);
    }
    for (const c of SETBACK_CARDS.filter((d) => d.kidsOk)) cash(c.id, c.cashCost);
    for (const c of MARKET_CARDS.filter((d) => d.kidsOk)) {
      for (const e of c.effects) if (e.kind === 'changeCashFlow') monthly(c.id, e.delta);
    }
    for (const c of LIFE_CHOICES_CARDS.filter((d) => d.kidsOk)) {
      for (const o of c.options.filter((x) => x.kidsOk)) {
        const id = `${c.id}/${o.id}`;
        for (const e of o.effects) {
          if (e.kind === 'addLoan') {
            cash(id, e.principal);
            monthly(id, e.monthlyPayment);
          } else if (e.kind === 'addSubscription') monthly(id, e.monthlyCost);
          else cash(id, e.amount);
        }
      }
    }
    expect(odd).toEqual([]);
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
    expect(count('lifeChoices')).toBe(6);
    expect(count('market')).toBe(4);
    expect(count('giving')).toBe(2);
    expect(count('setback')).toBe(2);
    expect(BOARD).not.toContain('payday');
  });

  it('places each kind at the positions the spec proposes (decided 2026-10-23, Q8)', () => {
    const positions = (kind: string) => BOARD.flatMap((s, i) => (s === kind ? [i] : []));
    expect(positions('opportunity')).toEqual([0, 3, 5, 8, 10, 13, 15, 18, 20, 23]);
    expect(positions('lifeChoices')).toEqual([1, 7, 11, 14, 19, 22]);
    expect(positions('market')).toEqual([2, 9, 16, 21]);
    expect(positions('giving')).toEqual([4, 17]);
    expect(positions('setback')).toEqual([6, 12]);
  });
});
