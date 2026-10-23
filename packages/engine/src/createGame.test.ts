import { CARDS_BY_DECK, DECK_IDS } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { createGame, type CreateGameOptions } from './createGame';

const options: CreateGameOptions = {
  id: 'g1',
  mode: 'standard',
  seed: 42,
  players: [
    { id: 'p1', name: 'Ada', professionId: 'teacher' },
    { id: 'p2', name: 'Grace', professionId: 'doctor' },
  ],
};

describe('createGame', () => {
  it('starts in the playing phase with the first player current and turn 0', () => {
    const state = createGame(options);
    expect(state.game).toMatchObject({
      id: 'g1',
      mode: 'standard',
      phase: 'playing',
      turnNumber: 0,
      currentPlayerId: 'p1',
      rngSeed: 42,
      log: [],
    });
    expect(state.pending).toEqual({ kind: 'none' });
  });

  it('seats each player at position 0 with the profession starting cash and salary', () => {
    const [ada, grace] = createGame(options).players;
    expect(ada).toMatchObject({ id: 'p1', name: 'Ada', professionId: 'teacher', position: 0, cash: 400, salary: 3_300 });
    expect(grace).toMatchObject({ id: 'p2', professionId: 'doctor', position: 0, cash: 3_000, salary: 13_000 });
    expect(ada).toMatchObject({ assets: [], favorTokens: 0, isOut: false, hasEscaped: false });
  });

  it('builds starting liabilities with monthlyPayment from the fixed percent per kind', () => {
    const [ada] = createGame(options).players;
    expect(ada?.liabilities).toEqual([
      { id: 'p1-student-0', kind: 'student', principal: 12_000, monthlyPayment: 120 },
      { id: 'p1-car-1', kind: 'car', principal: 6_000, monthlyPayment: 120 },
      { id: 'p1-credit-2', kind: 'credit', principal: 2_000, monthlyPayment: 60 },
    ]);
  });

  it('fills every draw pile with the full deck and leaves discard piles empty', () => {
    const state = createGame(options);
    for (const deck of DECK_IDS) {
      const ids = CARDS_BY_DECK[deck].map((c) => c.id).sort();
      expect([...state.decks[deck].drawPile].sort(), deck).toEqual(ids);
      expect(state.decks[deck].discardPile, deck).toEqual([]);
    }
  });

  it('shuffles the draw piles from the seed and advances rngState past the seed', () => {
    const state = createGame(options);
    const unshuffled = CARDS_BY_DECK.smallDeals.map((c) => c.id);
    expect(state.decks.smallDeals.drawPile).not.toEqual(unshuffled);
    expect(state.game.rngState).not.toBe(42);
  });

  it('is deterministic: same options give a byte-identical state', () => {
    expect(JSON.stringify(createGame(options))).toBe(JSON.stringify(createGame(options)));
  });

  it('gives a different shuffle for a different seed', () => {
    const a = createGame(options);
    const b = createGame({ ...options, seed: 43 });
    expect(a.decks.smallDeals.drawPile).not.toEqual(b.decks.smallDeals.drawPile);
  });

  it('kids mode keeps only kidsOk cards in every deck, which drops the single stocks (spec, Kids mode)', () => {
    const kids = createGame({ ...options, mode: 'kids' });
    for (const deck of DECK_IDS) {
      const kidsOk = CARDS_BY_DECK[deck].filter((c) => c.kidsOk).map((c) => c.id);
      expect([...kids.decks[deck].drawPile].sort(), deck).toEqual(kidsOk.sort());
    }
    expect(kids.decks.smallDeals.drawPile).not.toContain('small-005');
    expect(kids.decks.smallDeals.drawPile).not.toContain('small-007');
    expect(kids.decks.smallDeals.drawPile.length).toBeGreaterThan(0);
  });

  it('kids mode drops a non-stock card that is not kidsOk', () => {
    // Every fixture small deal that is not a stock is kidsOk today, so this pins the rule against the schema, not the data.
    const notForKids = CARDS_BY_DECK.smallDeals.filter((c) => !c.kidsOk);
    for (const card of notForKids) {
      expect(createGame({ ...options, mode: 'kids' }).decks.smallDeals.drawPile).not.toContain(card.id);
    }
  });

  it('standard mode keeps stock cards in the small deals deck', () => {
    expect(createGame(options).decks.smallDeals.drawPile).toContain('small-005');
  });

  it('throws on an unknown professionId', () => {
    expect(() =>
      createGame({ ...options, players: [{ id: 'p3', name: 'A', professionId: 'astronaut' }, ...options.players] }),
    ).toThrow(/astronaut/);
  });

  it('throws on duplicate player ids', () => {
    const players = options.players.map((p) => ({ ...p, id: 'p1' }));
    expect(() => createGame({ ...options, players })).toThrow(/p1/);
  });

  it('throws when the player count is outside 2 to 6', () => {
    expect(() => createGame({ ...options, players: options.players.slice(0, 1) })).toThrow(/2/);
    const seven = Array.from({ length: 7 }, (_, i) => ({ id: `p${String(i)}`, name: 'X', professionId: 'nurse' }));
    expect(() => createGame({ ...options, players: seven })).toThrow(/6/);
  });
});
