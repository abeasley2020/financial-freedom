// Debrief samples for Andre's Stage E gate: `pnpm debrief:samples [--seed N] [--out path.md]`.
// Plays three bot games through the real engine (one kids game, one Wealth
// Builder against Big Spender, one mixed standard game), then writes the
// debrief of the winner and one loser of each, at both reading levels, to
// docs/debrief-samples.md. The games are picked by fixed rules from a fixed
// seed, so the file is reproducible.

import { writeFileSync } from 'node:fs';

import { formatMoney, PROFESSIONS, renderDebrief, type Debrief, type GameState, type ReadingLevel } from '@ff/shared';

import { debrief } from '../src/debrief';
import { freedomPercent, rankPlayers, winner } from '../src/selectors';
import { STRATEGIES, STRATEGY_NAMES, type Strategy } from './bots';
import { playGameWithState, type GameRecord, type SimOptions } from './simulate';

interface Pick {
  readonly title: string;
  readonly why: string;
  readonly options: SimOptions;
  /** Accepts a finished game and returns the loser to show, or undefined to try the next seed. */
  readonly choose: (state: GameState, record: GameRecord) => string | undefined;
}

const SEARCH = 2_000;

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

const base = { games: 1, maxTurns: 400, seed: 0 };

/** The lowest-ranked player still in, or the first who went out. */
function lastPlace(state: GameState): string | undefined {
  const out = state.players.find((p) => p.isOut);
  return out?.id ?? rankPlayers(state).at(-1)?.id;
}

const hurtCount = (state: GameState, playerId: string): number => debrief(state, playerId, 'adult').hurt.length;
const helpedCount = (state: GameState, playerId: string): number => debrief(state, playerId, 'adult').helped.length;

const PICKS: readonly Pick[] = [
  {
    title: 'Kids mode',
    why: 'the first 3- or 4-seat kids game from the seed where the winner has a helped decision and last place has a hurt one',
    options: { ...base, mode: 'kids', strategies: STRATEGIES, minPlayers: 3, maxPlayers: 4 },
    choose: (state, record) => {
      const w = winner(state);
      const loser = lastPlace(state);
      if (record.ending !== 'roundLimit' || w === undefined || loser === undefined) return undefined;
      return helpedCount(state, w.id) > 0 && hurtCount(state, loser) > 0 ? loser : undefined;
    },
  },
  {
    title: 'Wealth Builder vs Big Spender',
    why: 'the first head-to-head game from the seed that the Wealth Builder wins (it wins 96% of them) with the Big Spender showing at least two hurt decisions',
    options: { ...base, mode: 'standard', strategies: STRATEGIES, minPlayers: 2, maxPlayers: 2, lineup: ['wealthBuilder', 'bigSpender'] },
    choose: (state, record) => {
      const w = record.seats.findIndex((s) => s.won);
      if (w === -1 || record.seats[w]?.strategy !== 'wealthBuilder') return undefined;
      const loser = state.players.find((_, i) => i !== w);
      return loser !== undefined && hurtCount(state, loser.id) >= 2 ? loser.id : undefined;
    },
  },
  {
    title: 'Mixed standard game',
    why: 'the first 3- or 4-seat standard game from the seed that ends by escape, so one sample shows an escape',
    options: { ...base, mode: 'standard', strategies: STRATEGIES, minPlayers: 3, maxPlayers: 4 },
    choose: (state, record) => (record.ending === 'escape' ? lastPlace(state) : undefined),
  },
];

interface Found {
  readonly pick: Pick;
  readonly seed: number;
  readonly state: GameState;
  readonly record: GameRecord;
  readonly loserId: string;
}

function find(pick: Pick, from: number): Found {
  for (let seed = from; seed < from + SEARCH; seed++) {
    const { record, state } = playGameWithState(seed, { ...pick.options, seed });
    if (record.ending === 'capped') continue;
    const loserId = pick.choose(state, record);
    if (loserId !== undefined) return { pick, seed, state, record, loserId };
  }
  throw new Error(`no ${pick.title} game in ${String(SEARCH)} seeds from ${String(from)}`);
}

function professionName(id: string): string {
  return PROFESSIONS.find((p) => p.id === id)?.name ?? id;
}

function seatLabel(found: Found, playerId: string): string {
  const index = found.state.players.findIndex((p) => p.id === playerId);
  const player = found.state.players[index];
  const strategy: Strategy | undefined = found.record.seats[index]?.strategy;
  if (player === undefined || strategy === undefined) throw new Error(`no seat for ${playerId}`);
  return `Seat ${String(index + 1)}, ${professionName(player.professionId)} (${STRATEGY_NAMES[strategy]} bot)`;
}

function renderMarkdown(d: Debrief): string[] {
  const lines: string[] = [];
  for (const section of renderDebrief(d)) {
    lines.push(`**${section.heading}**`, '');
    if (section.id === 'moneyStory') {
      lines.push('| Round | Assets paid | Bills |', '| ---: | ---: | ---: |');
      for (const p of d.moneyStory.points) lines.push(`| ${String(p.round)} | ${formatMoney(p.passiveIncome)} | ${formatMoney(p.totalExpenses)} |`);
      lines.push(`| end | ${formatMoney(d.moneyStory.final.passiveIncome)} | ${formatMoney(d.moneyStory.final.totalExpenses)} |`, '');
      lines.push(section.lines.at(-1) ?? '', '');
      continue;
    }
    for (const line of section.lines) lines.push(`- ${line}`);
    lines.push('');
  }
  return lines;
}

function playerSection(found: Found, playerId: string, role: string, levels: readonly ReadingLevel[]): string[] {
  const lines = [`### ${role}: ${seatLabel(found, playerId)}`, ''];
  for (const level of levels) {
    lines.push(`#### ${level === 'kids' ? 'Kids' : 'Adult'} reading level`, '');
    lines.push(...renderMarkdown(debrief(found.state, playerId, level)));
  }
  return lines;
}

function gameSection(found: Found, index: number): string[] {
  const { state, record, pick, seed } = found;
  const w = winner(state);
  if (w === undefined) throw new Error('sample game has no winner');
  const ending = record.ending === 'escape' ? `escape in round ${String(record.rounds)}` : record.ending === 'roundLimit' ? `round limit (${String(record.rounds)} rounds)` : 'last player standing';
  const lines = [
    `## Game ${String(index + 1)}: ${pick.title}`,
    '',
    `Seed ${String(seed)}, ${state.game.mode} mode, ${String(record.players)} seats, ended by ${ending}. Picked as ${pick.why}.`,
    '',
    '| Seat | Profession | Bot | Final Freedom | Result |',
    '| --- | --- | --- | ---: | --- |',
  ];
  state.players.forEach((p, i) => {
    const seat = record.seats[i];
    const result = p.id === w.id ? (p.hasEscaped ? 'won (escaped)' : 'won') : p.isOut ? 'went out' : 'lost';
    lines.push(`| ${String(i + 1)} | ${professionName(p.professionId)} | ${seat === undefined ? '' : STRATEGY_NAMES[seat.strategy]} | ${p.isOut ? 'out' : `${String(freedomPercent(p))}%`} | ${result} |`);
  });
  lines.push('');
  // Kids games show the kids level first, since that is what a kid at the table reads.
  const levels: readonly ReadingLevel[] = state.game.mode === 'kids' ? ['kids', 'adult'] : ['adult', 'kids'];
  lines.push(...playerSection(found, w.id, 'Winner', levels));
  lines.push(...playerSection(found, found.loserId, 'Loser', levels));
  return lines;
}

function main(): void {
  const from = Number(arg('--seed') ?? 20_261_023);
  const out = arg('--out') ?? 'docs/debrief-samples.md';
  const games = PICKS.map((pick) => find(pick, from));

  const first = games[1];
  const sampleJson = first === undefined ? '' : JSON.stringify(debrief(first.state, first.loserId, 'adult'), null, 2);

  const lines = [
    '# Debrief samples (Stage E)',
    '',
    `Generated ${new Date().toISOString().slice(0, 10)} by \`pnpm debrief:samples\` (seed search from ${String(from)}). Six debriefs from three bot games: the winner and one loser of a kids game, a Wealth Builder vs Big Spender game, and a mixed game, each at both reading levels. Andre's gate for Stage E: **does it teach?**`,
    '',
    'Everything below is produced by the engine and the templates the UI will use: `debrief(state, playerId, readingLevel)` in `packages/engine/src/debrief/` computes every number from the final state and the log, and `renderDebrief` in `packages/shared/src/debriefText.ts` fills the templates. Only the money story is drawn here as a table; the UI draws it as the two-line chart. The players are bots, so their choices follow fixed rules (`packages/engine/sim/bots.ts`), not judgment.',
    '',
    'How the numbers are attributed is the spec table (docs/spec.md, The debrief). Where it would count the same dollars twice, the readings below were picked and are listed in STATUS.md under Questions for Andre:',
    '',
    '- A growth asset (savings, CD, index fund), bought from a deal or a windfall, is scored once, as "growth asset held".',
    '- A Life Choices row counts spending, not saving: money an option invests or uses to pay down a loan is still yours, so it is not a cost there.',
    '- A subscription is scored once, on its own row, for the months it actually ran.',
    '- Cash a Generosity option gives away is a gift (helped), never a cost.',
    '- A Setback loan is scored once, as a Setback loan (P1).',
    '',
    ...games.flatMap((found, i) => gameSection(found, i)),
    '## The structured data behind one debrief',
    '',
    'What the UI receives for the Game 2 loser at the adult level. The UI renders this; it never computes a number.',
    '',
    '<details><summary>JSON</summary>',
    '',
    '```json',
    sampleJson,
    '```',
    '',
    '</details>',
    '',
  ];
  writeFileSync(out, lines.join('\n'), 'utf8');
  for (const found of games) process.stdout.write(`${found.pick.title}: seed ${String(found.seed)}, winner ${winner(found.state)?.id ?? '?'}, loser ${found.loserId}\n`);
  process.stdout.write(`debrief samples written to ${out}\n`);
}

main();
