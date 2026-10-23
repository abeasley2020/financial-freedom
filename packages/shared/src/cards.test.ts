import { describe, expect, it } from 'vitest';

import { CardSchema, DealCardSchema, MarketCardSchema, SetbackCardSchema } from './cards';

/** Copy of `obj` without the named keys. */
function without<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const dropped = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(obj).filter(([key]) => !dropped.has(key))) as Omit<T, K>;
}

const duplex = {
  id: 'small-001',
  deck: 'smallDeals',
  title: 'Duplex in Decatur',
  principles: ['P2', 'P3', 'P5'],
  adultText: 'Two units, both rented.',
  kidsText: 'Two homes you rent out.',
  kidsOk: true,
  type: 'rental',
  price: 80_000,
  downPayment: 8_000,
  mortgage: 72_000,
  monthlyCashFlow: 220,
};

describe('every card (spec v2, Card decks: id, deck, title, principles, kidsText, adultText, kidsOk)', () => {
  it('requires at least one principle', () => {
    expect(DealCardSchema.safeParse({ ...duplex, principles: [] }).success).toBe(false);
    expect(DealCardSchema.safeParse(without(duplex, 'principles')).success).toBe(false);
  });

  it('rejects an unknown principle id', () => {
    expect(DealCardSchema.safeParse({ ...duplex, principles: ['P11'] }).success).toBe(false);
  });

  it('caps kidsText at 90 characters and adultText at 160', () => {
    expect(DealCardSchema.safeParse({ ...duplex, kidsText: 'k'.repeat(90) }).success).toBe(true);
    expect(DealCardSchema.safeParse({ ...duplex, kidsText: 'k'.repeat(91) }).success).toBe(false);
    expect(DealCardSchema.safeParse({ ...duplex, adultText: 'a'.repeat(160) }).success).toBe(true);
    expect(DealCardSchema.safeParse({ ...duplex, adultText: 'a'.repeat(161) }).success).toBe(false);
  });

  it('rejects an em dash in either text', () => {
    expect(DealCardSchema.safeParse({ ...duplex, kidsText: 'Two homes \u2014 rented.' }).success).toBe(false);
    expect(DealCardSchema.safeParse({ ...duplex, adultText: 'Two units \u2014 rented.' }).success).toBe(false);
  });

  it('requires kidsOk to be explicit', () => {
    expect(DealCardSchema.safeParse(without(duplex, 'kidsOk')).success).toBe(false);
  });

  it('no longer accepts the v1 description or requiresKidsMode fields', () => {
    expect(DealCardSchema.safeParse({ ...duplex, description: 'x' }).success).toBe(false);
    expect(DealCardSchema.safeParse({ ...duplex, requiresKidsMode: false }).success).toBe(false);
  });
});

describe('DealCardSchema', () => {
  it('accepts the spec example deal', () => {
    expect(DealCardSchema.safeParse(duplex).success).toBe(true);
  });

  it('rejects a deal whose down payment plus mortgage is not the price', () => {
    const result = DealCardSchema.safeParse({ ...duplex, mortgage: 70_000 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer money', () => {
    expect(DealCardSchema.safeParse({ ...duplex, price: 80_000.5, downPayment: 8_000.5 }).success).toBe(false);
  });

  it('requires a stock to carry a price range and shares available', () => {
    const stock = { ...duplex, type: 'stock', price: 20, downPayment: 20, mortgage: 0, monthlyCashFlow: 0 };
    expect(DealCardSchema.safeParse(stock).success).toBe(false);
    expect(
      DealCardSchema.safeParse({ ...stock, priceRange: { min: 5, max: 40 }, sharesAvailable: 500 }).success,
    ).toBe(true);
  });

  it('rejects a price range whose min exceeds max', () => {
    const stock = {
      ...duplex,
      type: 'stock',
      price: 20,
      downPayment: 20,
      mortgage: 0,
      priceRange: { min: 40, max: 5 },
      sharesAvailable: 500,
    };
    expect(DealCardSchema.safeParse(stock).success).toBe(false);
  });

  it('rejects a non-stock that carries stock-only fields', () => {
    expect(DealCardSchema.safeParse({ ...duplex, sharesAvailable: 10 }).success).toBe(false);
    expect(DealCardSchema.safeParse({ ...duplex, dividendPerShare: 1 }).success).toBe(false);
  });

  const stock = {
    ...duplex,
    type: 'stock',
    price: 20,
    downPayment: 20,
    mortgage: 0,
    monthlyCashFlow: 0,
    priceRange: { min: 5, max: 40 },
    sharesAvailable: 500,
  };

  it('accepts a stock with an optional whole-dollar dividendPerShare', () => {
    expect(DealCardSchema.safeParse(stock).success).toBe(true);
    expect(DealCardSchema.safeParse({ ...stock, dividendPerShare: 0 }).success).toBe(true);
    expect(DealCardSchema.safeParse({ ...stock, dividendPerShare: 2 }).success).toBe(true);
    expect(DealCardSchema.safeParse({ ...stock, dividendPerShare: 0.5 }).success).toBe(false);
    expect(DealCardSchema.safeParse({ ...stock, dividendPerShare: -1 }).success).toBe(false);
  });

  it('rejects a stock with a mortgage: stocks are cash only', () => {
    expect(DealCardSchema.safeParse({ ...stock, price: 30, downPayment: 20, mortgage: 10 }).success).toBe(false);
  });

  it('allows negative monthly cash flow (land that costs taxes)', () => {
    expect(DealCardSchema.safeParse({ ...duplex, type: 'land', monthlyCashFlow: -50 }).success).toBe(true);
  });

  it('rejects a deal in a non-deal deck', () => {
    expect(DealCardSchema.safeParse({ ...duplex, deck: 'market' }).success).toBe(false);
  });
});

describe('MarketCardSchema', () => {
  const buyer = {
    id: 'market-001',
    deck: 'market',
    title: 'Eager Buyer',
    principles: ['P2', 'P3'],
    adultText: 'A buyer offers double what you paid for any rental.',
    kidsText: 'Someone offers twice what you paid for a rental.',
    kidsOk: true,
    effects: [{ kind: 'offerBuyout', percentOfPurchasePrice: 200 }],
    appliesTo: ['rental'],
  };

  it('accepts a buyout offer', () => {
    expect(MarketCardSchema.safeParse(buyer).success).toBe(true);
  });

  it('rejects an unknown effect kind', () => {
    expect(MarketCardSchema.safeParse({ ...buyer, effects: [{ kind: 'teleport' }] }).success).toBe(false);
  });

  it('requires at least one effect and one asset type', () => {
    expect(MarketCardSchema.safeParse({ ...buyer, effects: [] }).success).toBe(false);
    expect(MarketCardSchema.safeParse({ ...buyer, appliesTo: [] }).success).toBe(false);
  });

  it('accepts every effect kind from the spec', () => {
    const effects = [
      { kind: 'offerBuyout', percentOfPurchasePrice: 150 },
      { kind: 'changeCashFlow', delta: -100 },
      { kind: 'forceSale', percentOfPurchasePrice: 50 },
      { kind: 'splitShares', ratio: 2 },
    ];
    expect(MarketCardSchema.safeParse({ ...buyer, effects }).success).toBe(true);
  });
});

describe('SetbackCardSchema', () => {
  it('accepts a furnace repair', () => {
    expect(
      SetbackCardSchema.safeParse({
        id: 'setback-001',
        deck: 'setback',
        title: 'Furnace Dies',
        principles: ['P1'],
        adultText: 'Pay now.',
        kidsText: 'Pay now.',
        kidsOk: true,
        cashCost: 3_500,
        skipTurn: false,
      }).success,
    ).toBe(true);
  });

  it('requires skipTurn to be explicit', () => {
    expect(
      SetbackCardSchema.safeParse({
        id: 'setback-001',
        deck: 'setback',
        title: 'Furnace Dies',
        principles: ['P1'],
        adultText: 'Pay now.',
        kidsText: 'Pay now.',
        kidsOk: true,
        cashCost: 3_500,
      }).success,
    ).toBe(false);
  });
});

describe('CardSchema (union)', () => {
  it('discriminates on deck', () => {
    const parsed = CardSchema.parse(duplex);
    expect(parsed.deck).toBe('smallDeals');
    if (parsed.deck === 'smallDeals') {
      expect(parsed.monthlyCashFlow).toBe(220);
    }
  });

  it('rejects an unknown deck', () => {
    expect(CardSchema.safeParse({ ...duplex, deck: 'bonus' }).success).toBe(false);
  });
});
