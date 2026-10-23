import { describe, expect, it } from 'vitest';

import { CardSchema, DealCardSchema, LifestyleCardSchema, MarketCardSchema, SetbackCardSchema } from './cards';

/** Copy of `obj` without the named keys. */
function without<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  const dropped = new Set<PropertyKey>(keys);
  return Object.fromEntries(Object.entries(obj).filter(([key]) => !dropped.has(key))) as Omit<T, K>;
}

const duplex = {
  id: 'small-001',
  deck: 'smallDeals',
  title: 'Duplex in Decatur',
  description: 'Two units, both rented.',
  type: 'rental',
  price: 80_000,
  downPayment: 8_000,
  mortgage: 72_000,
  monthlyCashFlow: 220,
  requiresKidsMode: false,
};

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
    description: 'A buyer offers double what you paid for any rental.',
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

describe('LifestyleCardSchema', () => {
  const truck = {
    id: 'life-001',
    deck: 'lifestyle',
    title: 'New Truck',
    description: 'Pay cash or finance it.',
    cashCost: 4_000,
    monthlyCost: 380,
    loanPrincipal: 12_000,
  };

  it('accepts cash-or-loan', () => {
    expect(LifestyleCardSchema.safeParse(truck).success).toBe(true);
  });

  it('accepts cash only', () => {
    expect(LifestyleCardSchema.safeParse(without(truck, 'monthlyCost', 'loanPrincipal')).success).toBe(true);
  });

  it('accepts loan only', () => {
    expect(LifestyleCardSchema.safeParse(without(truck, 'cashCost')).success).toBe(true);
  });

  it('rejects a loan with a monthly cost but no principal', () => {
    expect(LifestyleCardSchema.safeParse(without(truck, 'loanPrincipal')).success).toBe(false);
  });

  it('rejects a card with neither a cash cost nor a loan', () => {
    expect(
      LifestyleCardSchema.safeParse(without(truck, 'cashCost', 'monthlyCost', 'loanPrincipal')).success,
    ).toBe(false);
  });
});

describe('SetbackCardSchema', () => {
  it('accepts a furnace repair', () => {
    expect(
      SetbackCardSchema.safeParse({
        id: 'setback-001',
        deck: 'setback',
        title: 'Furnace Dies',
        description: 'Pay now.',
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
        description: 'Pay now.',
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
