import { isGrowthAsset, type GameState, type LogEvent } from '@ff/shared';

import { resolveBankruptcy } from './bankruptcy';
import { pct } from './money';
import { monthlyCashFlow, passiveIncome, playerById, totalExpenses } from './selectors';

export interface Payday {
  readonly state: GameState;
  readonly events: readonly LogEvent[];
}

/**
 * Spec, Core rules, turn step 1 (decided 2026-10-23, Q1): every turn is a
 * month and the player is paid at its start. First every growth asset grows
 * by pct(marketValue, growthPercent) (v2, Growth assets; decided Q2), then
 * salary + passiveIncome − totalExpenses is credited using the grown values,
 * then a paydaySnapshot records the facts the debrief needs. A Payday that
 * takes cash below zero runs the automatic bankruptcy sales (Core rules,
 * Bankruptcy); the snapshot is taken before those sales so it records the
 * month that broke the player. Called by ROLL for the current player and by
 * END_TURN for a seat it passes over.
 */
export function creditPayday(state: GameState, playerId: string): Payday {
  const events: LogEvent[] = [];
  const grown = playerById(state, playerId).assets.map((asset) => {
    if (!isGrowthAsset(asset)) return asset;
    const delta = pct(asset.marketValue, asset.growthPercent);
    if (delta === 0) return asset;
    const marketValue = asset.marketValue + delta;
    events.push({ kind: 'valueChanged', assetId: asset.id, delta, marketValue });
    return { ...asset, marketValue };
  });
  const player = { ...playerById(state, playerId), assets: grown };
  const amount = monthlyCashFlow(player);
  const cash = player.cash + amount;
  let next: GameState = { ...state, players: state.players.map((p) => (p.id === playerId ? { ...player, cash } : p)) };
  events.push(
    { kind: 'payday', amount },
    {
      kind: 'paydaySnapshot',
      playerId,
      passiveIncome: passiveIncome(player),
      totalExpenses: totalExpenses(player),
      cash,
    },
  );
  if (cash < 0) {
    const bankruptcy = resolveBankruptcy(next, playerId);
    next = bankruptcy.state;
    events.push(...bankruptcy.events);
  }
  return { state: next, events };
}
