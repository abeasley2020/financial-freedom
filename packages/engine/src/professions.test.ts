// The profession numbers rule (spec v2, Professions; decided 2026-10-23, Q5),
// checked through createGame and the selectors so the test never repeats the
// engine's payment math.

import { PROFESSIONS } from '@ff/shared';
import { describe, expect, it } from 'vitest';

import { createGame } from './createGame';
import { monthlyCashFlow, totalExpenses } from './selectors';

function startingPlayer(professionId: string) {
  const state = createGame({
    id: 'g1',
    mode: 'standard',
    seed: 1,
    players: [
      { id: 'p1', name: 'Ada', professionId },
      { id: 'p2', name: 'Grace', professionId },
    ],
  });
  const player = state.players[0];
  if (player === undefined) throw new Error('unreachable: two seats');
  return player;
}

describe.each(PROFESSIONS.map((p) => [p.id]))('profession %s', (professionId) => {
  it('PROFESSION: starting monthly cash flow is 10 to 25 percent of salary', () => {
    const player = startingPlayer(professionId);
    const flow = monthlyCashFlow(player);
    expect(flow * 100).toBeGreaterThanOrEqual(player.salary * 10);
    expect(flow * 100).toBeLessThanOrEqual(player.salary * 25);
  });

  it('PROFESSION: starting cash is one half to two months of totalExpenses', () => {
    const player = startingPlayer(professionId);
    expect(player.cash * 2).toBeGreaterThanOrEqual(totalExpenses(player));
    expect(player.cash).toBeLessThanOrEqual(totalExpenses(player) * 2);
  });
});
