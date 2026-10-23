import type { Action, Asset, GameState, Liability } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { reduce } from './reduce';
import { monthlyCashFlow, passiveIncome, playerById } from './selectors';
import { apply } from './test/apply';
import { deepFreeze } from './test/deepFreeze';
import { aboutToRoll, rolledClean, twoPlayerGame, withGame, withPlayer } from './test/fixtures';

// Spec, Core rules, Bankruptcy (decided 2026-10-23). Ada the Teacher (p1) has
// 700/mo cash flow. A 1,500/mo lifestyle loan makes it -800, so each Payday
// takes 800 from cash. Payday opens every ROLL, before the die; a player who
// goes out at Payday does not roll or move.

const ROLL: Action = { type: 'ROLL', playerId: 'p1' };
const p1 = (state: GameState) => playerById(state, 'p1');

const bigLoan: Liability = { id: 'l-boat', kind: 'lifestyle', principal: 30_000, monthlyPayment: 1_500, sourceCardId: 'life-001' };
const lawn: Asset = { id: 'lawn', cardId: 'small-003', type: 'business', purchasePrice: 3_000, downPaid: 3_000, monthlyCashFlow: 150 };
/** A growth asset from a windfall: 2,000 at 1% payout = 20/mo, sold in bankruptcy at half its marketValue. */
const fund: Asset = { id: 'fund', cardId: 'life-005', type: 'index', purchasePrice: 2_000, downPaid: 2_000, marketValue: 2_000, growthPercent: 4, payoutPercent: 1 };
const vending: Asset = { id: 'vend', cardId: 'small-006', type: 'business', purchasePrice: 4_500, downPaid: 4_500, monthlyCashFlow: 180 };
const duplex: Asset = { id: 'dup', cardId: 'small-001', type: 'rental', purchasePrice: 50_000, downPaid: 5_000, monthlyCashFlow: 160 };
const duplexMortgage: Liability = { id: 'dup-mortgage', kind: 'mortgage', principal: 45_000, monthlyPayment: 0, assetId: 'dup' };
const robotics: Asset = { id: 'rob', cardId: 'small-005', type: 'stock', purchasePrice: 200, downPaid: 200, monthlyCashFlow: 0, shares: 10 };

/** p1 with `cash`, the big lifestyle loan, `assets`, and `extraLiabilities` starts a turn from 3 with a die of 1 (Giving at 4 if still in). */
function payday(cash: number, assets: readonly Asset[] = [], extraLiabilities: readonly Liability[] = []): GameState {
  const base = twoPlayerGame();
  const broke = withPlayer(base, 'p1', {
    cash,
    assets: [...assets],
    liabilities: [...p1(base).liabilities, bigLoan, ...extraLiabilities],
  });
  const extraPayments = extraLiabilities.reduce((sum, l) => sum + l.monthlyPayment, 0);
  expect(monthlyCashFlow(p1(broke))).toBe(-800 + passiveIncome(p1(broke)) - extraPayments);
  return apply(aboutToRoll(broke, 3, 1), ROLL);
}

describe('Bankruptcy: a Payday that would take cash below zero', () => {
  it('bankruptcy: with no assets the player is out and cash is set to 0', () => {
    const next = payday(500);
    expect(p1(next).isOut).toBe(true);
    expect(p1(next).cash).toBe(0);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.game.phase).toBe('playing');
  });

  it('bankruptcy: cash exactly covering the deficit is not bankruptcy', () => {
    const next = payday(800);
    expect(p1(next).cash).toBe(0);
    expect(p1(next).isOut).toBe(false);
  });

  it('bankruptcy: one dollar short with no assets is out', () => {
    expect(p1(payday(799)).isOut).toBe(true);
  });

  it('bankruptcy: sells an asset at half its purchase price and stays in once covered', () => {
    // -800 + 150 passive = -650; 500 cash → -150; lawn sells for 1,500 → 1,350.
    const before = twoPlayerGame();
    const next = payday(500, [lawn]);
    expect(p1(next).isOut).toBe(false);
    expect(p1(next).cash).toBe(500 - 650 + 1_500);
    expect(p1(next).assets).toEqual([]);
    expect(next.decks.smallDeals.discardPile).toEqual([...before.decks.smallDeals.discardPile, 'small-003']);
  });

  it('bankruptcy: sells the asset with the lowest monthly cash flow first and stops once covered', () => {
    // passive 170 → flow -630; 500 cash → -130. Fund (+20) goes before lawn (+150): half of marketValue 2,000 → +1,000 → 870.
    const next = payday(500, [lawn, fund]);
    expect(p1(next).assets).toEqual([lawn]);
    expect(p1(next).cash).toBe(500 - 630 + 1_000);
  });

  it('bankruptcy: a growth asset sells at half its marketValue, not its purchase price', () => {
    const grown: Asset = { ...fund, marketValue: 2_600 };
    // passive 26 → flow -774; 500 → -274; sale 1,300 → 1,026.
    const next = payday(500, [grown]);
    expect(p1(next).assets).toEqual([]);
    expect(p1(next).cash).toBe(500 - 774 + 1_300);
    // A sale carries the card's principles; the windfall option's own tags live on the bought event.
    expect(next.game.log.at(-1)?.events).toContainEqual({ kind: 'sold', assetId: 'fund', cardId: 'life-005', proceeds: 1_300, principles: ['P4', 'P5', 'P8'] });
  });

  it('bankruptcy: ties on cash flow are broken by the lowest purchase price', () => {
    const cheap: Asset = { ...fund, id: 'cheap', payoutPercent: 0, purchasePrice: 2_000 };
    const dear: Asset = { ...lawn, id: 'dear', monthlyCashFlow: 0, purchasePrice: 3_000 };
    const next = payday(500, [dear, cheap]);
    expect(p1(next).assets).toEqual([dear]);
    expect(p1(next).cash).toBe(500 - 800 + 1_000);
  });

  it('bankruptcy: keeps selling until the deficit is covered', () => {
    // passive 160 → flow -640; 0 cash → -640. Fund +1,000 covers it in one sale? No: -640 + 1,000 = 360. Use a deeper hole.
    const deeper: Liability = { ...bigLoan, id: 'l-2', monthlyPayment: 1_200 };
    // flow = 700 + 170 - 1,500 - 1,200 = -1,830; 0 cash → -1,830; fund +1,000 → -830; lawn +1,500 → 670.
    const next = payday(0, [lawn, fund], [deeper]);
    expect(p1(next).assets).toEqual([]);
    expect(p1(next).cash).toBe(670);
    expect(p1(next).isOut).toBe(false);
  });

  it('bankruptcy: a mortgaged asset pays off its mortgage first, so the player may see nothing from it', () => {
    // passive 160 → flow -640; 500 cash → -140. Duplex sells for 25,000, all of it to the 45,000 mortgage.
    // Then nothing is left to sell: out.
    const next = payday(500, [duplex], [duplexMortgage]);
    expect(p1(next).isOut).toBe(true);
    expect(p1(next).cash).toBe(0);
    expect(p1(next).assets).toEqual([]);
    expect(p1(next).liabilities.some((l) => l.kind === 'mortgage')).toBe(false);
    expect(next.decks.smallDeals.discardPile).toContain('small-001');
  });

  it('bankruptcy: a lightly mortgaged asset returns the remainder to the player', () => {
    const light: Liability = { ...duplexMortgage, principal: 20_000 };
    // -140 after Payday; duplex 25,000 - 20,000 = 5,000 → 4,860.
    const next = payday(500, [duplex], [light]);
    expect(p1(next).isOut).toBe(false);
    expect(p1(next).cash).toBe(4_860);
  });

  it('bankruptcy: a stock lot sells at half its cost basis and its card is not re-added to the deck', () => {
    const before = twoPlayerGame();
    // 700 cash → -100; lot 200 → 100 → 0.
    const next = payday(700, [robotics]);
    expect(p1(next).cash).toBe(0);
    expect(p1(next).isOut).toBe(false);
    expect(p1(next).assets).toEqual([]);
    expect(next.decks.smallDeals).toEqual(before.decks.smallDeals);
  });

  it('bankruptcy: selling everything and still falling short puts the player out', () => {
    // 0 cash, -800 → -800; lot 200 → 100 → -700; still short → out, cash 0.
    const next = payday(0, [robotics]);
    expect(p1(next).isOut).toBe(true);
    expect(p1(next).cash).toBe(0);
    expect(p1(next).assets).toEqual([]);
  });

  it('bankruptcy: an out player keeps their non-mortgage liabilities on record', () => {
    const next = payday(0);
    expect(p1(next).liabilities.map((l) => l.id)).toEqual(['p1-student-0', 'p1-car-1', 'p1-credit-2', 'l-boat']);
  });

  it('bankruptcy: a player who goes out at Payday does not roll, move, or resolve a space', () => {
    const base = twoPlayerGame();
    const broke = withPlayer(base, 'p1', { cash: 0, liabilities: [...p1(base).liabilities, bigLoan] });
    const before = aboutToRoll(broke, 11, 2);
    const next = apply(before, ROLL);
    expect(p1(next).isOut).toBe(true);
    expect(p1(next).position).toBe(11);
    expect(next.pending).toEqual({ kind: 'none' });
    expect(next.decks).toEqual(base.decks);
    expect(next.game.rngState).toBe(before.game.rngState);
  });

  it('bankruptcy: a sale that keeps the player in lets them resolve the landed space', () => {
    const base = twoPlayerGame();
    const broke = withPlayer(base, 'p1', { cash: 0, assets: [vending], liabilities: [...p1(base).liabilities, bigLoan] });
    // flow 700 + 180 - 1,500 = -620; vending 2,250 → 1,630. Then the roll lands on 13 Opportunity.
    const next = apply(aboutToRoll(broke, 11, 2), ROLL);
    expect(p1(next).isOut).toBe(false);
    expect(p1(next).cash).toBe(1_630);
    expect(next.pending).toEqual({ kind: 'chooseDealSize' });
  });

  it('bankruptcy: a positive Payday never triggers a sale', () => {
    const base = withPlayer(twoPlayerGame(), 'p1', { cash: 0, assets: [lawn] });
    const next = apply(aboutToRoll(base, 3, 1), ROLL);
    expect(p1(next).assets).toEqual([lawn]);
    expect(p1(next).cash).toBe(850);
  });

  it('bankruptcy: does not touch the other player', () => {
    const next = payday(0, [lawn, fund]);
    expect(next.players[1]).toEqual(twoPlayerGame().players[1]);
  });
});

describe('Bankruptcy: log', () => {
  it('bankruptcy: logs the Payday, each sale, then wentOut with the uncovered shortfall, and no roll', () => {
    const next = payday(0, [robotics]);
    expect(next.game.log.at(-1)?.events).toEqual([
      { kind: 'payday', amount: -800 },
      { kind: 'paydaySnapshot', playerId: 'p1', passiveIncome: 0, totalExpenses: 4_100, cash: -800 },
      { kind: 'sold', assetId: 'rob', cardId: 'small-005', proceeds: 100, principles: ['P8', 'P9'] },
      { kind: 'cashChanged', delta: 100, reason: 'bankruptcy' },
      { kind: 'wentOut', shortfall: 700 },
    ]);
  });

  it('bankruptcy: a covered deficit logs the sales and no wentOut, then the roll goes ahead', () => {
    const next = payday(500, [lawn]);
    expect(next.game.log.at(-1)?.events).toEqual([
      { kind: 'payday', amount: -650 },
      { kind: 'paydaySnapshot', playerId: 'p1', passiveIncome: 150, totalExpenses: 4_100, cash: -150 },
      { kind: 'sold', assetId: 'lawn', cardId: 'small-003', proceeds: 1_500, principles: ['P2', 'P3'] },
      { kind: 'cashChanged', delta: 1_500, reason: 'bankruptcy' },
      { kind: 'rolled', value: 1 },
      { kind: 'moved', from: 3, to: 4 },
    ]);
  });

  it('bankruptcy: is deterministic', () => {
    const base = twoPlayerGame();
    const broke = deepFreeze(
      aboutToRoll(withPlayer(base, 'p1', { cash: 0, assets: [lawn, fund], liabilities: [...p1(base).liabilities, bigLoan] }), 3, 1),
    );
    expect(JSON.stringify(reduce(broke, ROLL))).toBe(JSON.stringify(reduce(broke, ROLL)));
  });
});

describe('Bankruptcy: ending the turn and the game', () => {
  it('bankruptcy: the out player still ends their turn, and with one player left the game is finished', () => {
    const out = payday(500);
    expect(p1(out).isOut).toBe(true);
    const next = apply(out, { type: 'END_TURN', playerId: 'p1' });
    expect(next.game.phase).toBe('finished');
    expect(next.game.currentPlayerId).toBe('p2');
    expect(next.players.map((p) => p.hasEscaped)).toEqual([false, false]);
  });

  it('bankruptcy: an out player is never marked as escaped', () => {
    const out = payday(500);
    const next = apply(out, { type: 'END_TURN', playerId: 'p1' });
    expect(p1(next).hasEscaped).toBe(false);
  });

  it('bankruptcy: with three players the game continues after one goes out', () => {
    const three = twoPlayerGame({
      players: [
        { id: 'p1', name: 'A', professionId: 'teacher' },
        { id: 'p2', name: 'B', professionId: 'nurse' },
        { id: 'p3', name: 'C', professionId: 'doctor' },
      ],
    });
    const broke = withPlayer(three, 'p1', { cash: 0, liabilities: [...p1(three).liabilities, bigLoan] });
    const out = apply(aboutToRoll(broke, 3, 1), ROLL);
    expect(p1(out).isOut).toBe(true);
    const next = apply(out, { type: 'END_TURN', playerId: 'p1' });
    expect(next.game.phase).toBe('playing');
    expect(next.game.currentPlayerId).toBe('p2');
    const p3Turn = apply(rolledClean(next, 'p2'), { type: 'END_TURN', playerId: 'p2' });
    expect(p3Turn.game.currentPlayerId).toBe('p3');
    const wrapped = apply(rolledClean(p3Turn, 'p3'), { type: 'END_TURN', playerId: 'p3' });
    expect(wrapped.game.currentPlayerId).toBe('p2');
  });

  it('bankruptcy: an out player cannot act once the turn has passed', () => {
    const three = twoPlayerGame({
      players: [
        { id: 'p1', name: 'A', professionId: 'teacher' },
        { id: 'p2', name: 'B', professionId: 'nurse' },
        { id: 'p3', name: 'C', professionId: 'doctor' },
      ],
    });
    const broke = withPlayer(three, 'p1', { cash: 0, liabilities: [...p1(three).liabilities, bigLoan] });
    const next = apply(apply(aboutToRoll(broke, 3, 1), ROLL), { type: 'END_TURN', playerId: 'p1' });
    expect(reduce(deepFreeze(next), ROLL)).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(reduce(deepFreeze(withGame(next, { currentPlayerId: 'p1' })), ROLL).ok).toBe(true);
  });
});
