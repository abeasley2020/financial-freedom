// Balance simulation entry point: `pnpm sim [--games N] [--seed N] [--max-turns N]
// [--players MIN-MAX] [--only mixed|h2h|kids] [--mode standard|kids] [--out path.md] [--summary]`.
// Plays bot games through the real engine and prints the report the spec asks
// for. By default it runs three suites and checks every target from spec v2
// (Engineering practices):
//
//   mixed  1,000 standard games, 2 to 4 seats, a random strategy per seat
//   h2h    1,000 two-seat standard games, Wealth Builder against Big Spender
//   kids   1,000 kids games, 2 to 4 seats, a random strategy per seat
//
// Targets: at least 70% of games end by escape or the round limit; at most
// 20% of seats go bankrupt; every profession's win rate between 20% and 45%;
// Wealth Builder beats Big Spender in at least 70% of head-to-head games; the
// best strategy beats the worst by at least 15 points; median game between 10
// and 15 rounds; kids mode never stuck, median at or under 10 rounds; and at
// least 15% of standard games end by escape (Andre, 2026-10-27, replacing
// "escape reachable within 15 rounds"). --summary prints only the target table.

import { writeFileSync } from 'node:fs';

import { PROFESSIONS } from '@ff/shared';

import { STRATEGIES, STRATEGY_NAMES } from './bots';
import { simulate, type SimOptions, type SimReport } from './simulate';

type Suite = 'mixed' | 'h2h' | 'kids';

interface Args {
  readonly base: Omit<SimOptions, 'mode' | 'strategies'>;
  readonly suites: readonly Suite[];
  readonly out: string | undefined;
  readonly summary: boolean;
}

function parseArgs(argv: readonly string[]): Args {
  const get = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const int = (flag: string, fallback: number): number => {
    const raw = get(flag);
    const value = raw === undefined ? fallback : Number(raw);
    if (!Number.isInteger(value) || value < 0) throw new Error(`${flag} needs a non-negative integer, got "${raw ?? ''}"`);
    return value;
  };
  const mode = get('--mode');
  if (mode !== undefined && mode !== 'standard' && mode !== 'kids') throw new Error(`--mode must be standard or kids, got "${mode}"`);
  const only = get('--only');
  if (only !== undefined && only !== 'mixed' && only !== 'h2h' && only !== 'kids') throw new Error(`--only must be mixed, h2h, or kids, got "${only}"`);
  const suites: readonly Suite[] = only !== undefined ? [only] : mode === 'kids' ? ['kids'] : mode === 'standard' ? ['mixed'] : ['mixed', 'h2h', 'kids'];
  const players = (get('--players') ?? '2-4').split('-').map(Number);
  const [minPlayers, maxPlayers] = players.length === 1 ? [players[0], players[0]] : players;
  if (minPlayers === undefined || maxPlayers === undefined || minPlayers < 2 || maxPlayers > 6 || minPlayers > maxPlayers) {
    throw new Error('--players must be MIN-MAX within 2-6');
  }
  return {
    base: { games: int('--games', 1_000), seed: int('--seed', 20_261_023), maxTurns: int('--max-turns', 400), minPlayers, maxPlayers },
    suites,
    out: get('--out'),
    summary: argv.includes('--summary'),
  };
}

function suiteOptions(suite: Suite, base: Args['base']): SimOptions {
  switch (suite) {
    case 'mixed':
      return { ...base, mode: 'standard', strategies: STRATEGIES };
    case 'h2h':
      return { ...base, mode: 'standard', strategies: STRATEGIES, minPlayers: 2, maxPlayers: 2, lineup: ['wealthBuilder', 'bigSpender'] };
    case 'kids':
      return { ...base, mode: 'kids', strategies: STRATEGIES };
  }
}

const share = (part: number, whole: number): number => (whole === 0 ? 0 : (100 * part) / whole);
const pctOf = (part: number, whole: number): string => (whole === 0 ? 'n/a' : `${share(part, whole).toFixed(1)}%`);
const fixed = (n: number): string => n.toFixed(1);

function median(sorted: readonly number[]): number {
  return sorted.length === 0 ? 0 : (sorted[Math.floor(sorted.length / 2)] ?? 0);
}

/** Median rounds per game: the round the game ended in. */
function medianRounds(report: SimReport): number {
  return median(report.games.map((g) => g.rounds).sort((a, b) => a - b));
}

interface Target {
  readonly name: string;
  readonly value: string;
  readonly met: boolean;
}

function targets(reports: ReadonlyMap<Suite, SimReport>): readonly Target[] {
  const list: Target[] = [];
  const mixed = reports.get('mixed');
  if (mixed !== undefined) {
    const n = mixed.options.games;
    const notLast = mixed.endings.escape + mixed.endings.roundLimit;
    list.push({ name: 'Games ending by escape or the round limit (at least 70%)', value: pctOf(notLast, n), met: share(notLast, n) >= 70 });
    list.push({ name: 'Seats that went bankrupt (at most 20%)', value: pctOf(mixed.bankruptcy.seatRate, 1), met: mixed.bankruptcy.seatRate <= 0.2 });
    const rates = PROFESSIONS.map((p) => {
      const t = mixed.byProfession.get(p.id);
      return { name: p.name, rate: t === undefined ? 0 : share(t.wins, t.seats) };
    }).sort((a, b) => a.rate - b.rate);
    const low = rates[0];
    const high = rates.at(-1);
    if (low !== undefined && high !== undefined) {
      list.push({
        name: 'Every profession win rate between 20% and 45%',
        value: `${low.rate.toFixed(1)}% (${low.name}) to ${high.rate.toFixed(1)}% (${high.name})`,
        met: low.rate >= 20 && high.rate <= 45,
      });
    }
    const strategies = [...mixed.byStrategy.entries()].map(([s, t]) => ({ s, rate: share(t.wins, t.seats) })).sort((a, b) => a.rate - b.rate);
    const worst = strategies[0];
    const best = strategies.at(-1);
    if (worst !== undefined && best !== undefined) {
      list.push({
        name: 'Best strategy beats worst by at least 15 points',
        value: `${(best.rate - worst.rate).toFixed(1)} points (${STRATEGY_NAMES[best.s]} ${best.rate.toFixed(1)}%, ${STRATEGY_NAMES[worst.s]} ${worst.rate.toFixed(1)}%)`,
        met: best.rate - worst.rate >= 15,
      });
    }
    const rounds = medianRounds(mixed);
    list.push({ name: 'Median game between 10 and 15 rounds', value: String(rounds), met: rounds >= 10 && rounds <= 15 });
    const escapes = mixed.endings.escape;
    list.push({
      name: 'Standard games ending by escape (at least 15%)',
      value: escapes === 0 ? '0 (0.0%)' : `${String(escapes)} (${pctOf(escapes, n)}), median escape round ${String(median(mixed.escapeRounds))}, earliest ${String(mixed.escapeRounds[0])}`,
      met: share(escapes, n) >= 15,
    });
  }
  const h2h = reports.get('h2h');
  if (h2h !== undefined) {
    const wb = h2h.byStrategy.get('wealthBuilder');
    const wins = wb?.wins ?? 0;
    list.push({ name: 'Wealth Builder beats Big Spender head to head (at least 70%)', value: pctOf(wins, h2h.options.games), met: share(wins, h2h.options.games) >= 70 });
  }
  const kids = reports.get('kids');
  if (kids !== undefined) {
    const rounds = medianRounds(kids);
    const finished = kids.games.length - kids.endings.capped;
    list.push({ name: 'Kids games finished, none stuck', value: `${String(finished)} of ${String(kids.games.length)}`, met: kids.endings.capped === 0 });
    list.push({ name: 'Kids median at or under 10 rounds', value: String(rounds), met: rounds <= 10 });
  }
  return list;
}

function targetTable(list: readonly Target[]): string[] {
  const lines = ['| Target | Value | Met |', '| --- | --- | --- |'];
  for (const t of list) lines.push(`| ${t.name} | ${t.value} | ${t.met ? 'yes' : 'NO'} |`);
  return lines;
}

const SUITE_TITLES: Readonly<Record<Suite, string>> = {
  mixed: 'Standard games, mixed strategies',
  h2h: 'Head to head: Wealth Builder vs Big Spender',
  kids: 'Kids games, mixed strategies',
};

function formatSuite(suite: Suite, report: SimReport): string[] {
  const { options, endings, turns, roundsPerGame, bankruptcy } = report;
  const lines: string[] = [];
  lines.push(`## ${SUITE_TITLES[suite]}`);
  lines.push('');
  const seating =
    options.lineup === undefined
      ? `${String(options.minPlayers)} to ${String(options.maxPlayers)} seats per game, each seat a random profession and a random strategy`
      : `${String(options.lineup.length)} seats per game (${options.lineup.map((s) => STRATEGY_NAMES[s]).join(' and ')}, seat order alternating by game), each a random profession`;
  lines.push(`${String(options.games)} ${options.mode} games, seeds ${String(options.seed)} to ${String(options.seed + options.games - 1)}, ${seating}, abandoned as a draw after ${String(options.maxTurns)} turns.`);
  lines.push('');
  lines.push(`| Measure | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Games ending by escape | ${String(endings.escape)} (${pctOf(endings.escape, options.games)}) |`);
  lines.push(`| Games ending at the round limit | ${String(endings.roundLimit)} (${pctOf(endings.roundLimit, options.games)}) |`);
  lines.push(`| Games ending with one player left | ${String(endings.lastStanding)} (${pctOf(endings.lastStanding, options.games)}) |`);
  lines.push(`| Games abandoned at the turn cap | ${String(endings.capped)} (${pctOf(endings.capped, options.games)}) |`);
  lines.push(`| Escape round: earliest / median | ${report.escapeRounds.length === 0 ? 'none' : `${String(report.escapeRounds[0])} / ${String(median(report.escapeRounds))}`} |`);
  lines.push(`| Game length, rounds: median | ${String(medianRounds(report))} |`);
  lines.push(`| Game length, turns: mean / median / p90 / max | ${fixed(turns.mean)} / ${String(turns.median)} / ${String(turns.p90)} / ${String(turns.max)} |`);
  lines.push(`| Game length, turns per player: mean / median | ${fixed(roundsPerGame.mean)} / ${fixed(roundsPerGame.median)} |`);
  lines.push(`| Seats that went bankrupt | ${pctOf(bankruptcy.seatRate, 1)} |`);
  lines.push(`| Games with at least one bankruptcy | ${pctOf(bankruptcy.gameRate, 1)} |`);
  lines.push('');
  if (options.lineup === undefined) {
    lines.push(`### Win rate by profession`);
    lines.push('');
    lines.push(`A fair game with ${String(options.minPlayers)} to ${String(options.maxPlayers)} seats sits near ${pctOf(2, options.minPlayers + options.maxPlayers)} for every profession. Mean freedom is the final freedomPercent (0 for a seat that went out).`);
    lines.push('');
    lines.push(`| Profession | Seats | Wins | Win rate | Went bankrupt | Mean freedom |`);
    lines.push(`| --- | --- | --- | --- | --- | --- |`);
    for (const profession of PROFESSIONS) {
      const t = report.byProfession.get(profession.id) ?? { seats: 0, wins: 0, outs: 0, freedom: 0 };
      lines.push(`| ${profession.name} | ${String(t.seats)} | ${String(t.wins)} | ${pctOf(t.wins, t.seats)} | ${pctOf(t.outs, t.seats)} | ${t.seats === 0 ? 'n/a' : `${fixed(t.freedom / t.seats)}%`} |`);
    }
    lines.push('');
  }
  lines.push(`### Win rate by strategy`);
  lines.push('');
  lines.push(`| Strategy | Seats | Wins | Win rate | Went bankrupt | Mean freedom |`);
  lines.push(`| --- | --- | --- | --- | --- | --- |`);
  for (const strategy of STRATEGIES) {
    const t = report.byStrategy.get(strategy);
    if (t === undefined) continue;
    lines.push(`| ${STRATEGY_NAMES[strategy]} | ${String(t.seats)} | ${String(t.wins)} | ${pctOf(t.wins, t.seats)} | ${pctOf(t.outs, t.seats)} | ${fixed(t.freedom / t.seats)}% |`);
  }
  lines.push('');
  if (options.lineup === undefined) {
    lines.push(`### Game length by player count`);
    lines.push('');
    lines.push(`| Players | Games | Median turns |`);
    lines.push(`| --- | --- | --- |`);
    for (const [count, row] of report.byPlayerCount) lines.push(`| ${String(count)} | ${String(row.games)} | ${String(row.medianTurns)} |`);
    lines.push('');
  }
  return lines;
}

export function formatReport(reports: ReadonlyMap<Suite, SimReport>, generatedAt: string, summary: boolean): string {
  const lines: string[] = [];
  lines.push(`# Balance simulation`);
  lines.push('');
  lines.push(
    `Generated ${generatedAt} by \`pnpm sim\`. Bots are the five strategies in \`packages/engine/sim/bots.ts\`: ${STRATEGIES.map((s) => STRATEGY_NAMES[s]).join(', ')}. The report measures the rules and numbers, not human play. A round is a month for the whole table; the game ends after round 15 (kids 10) unless someone escapes first.`,
  );
  lines.push('');
  lines.push(`## Targets (spec v2, Engineering practices)`);
  lines.push('');
  lines.push(...targetTable(targets(reports)));
  lines.push('');
  if (!summary) for (const [suite, report] of reports) lines.push(...formatSuite(suite, report));
  return lines.join('\n');
}

function main(): void {
  const { base, suites, out, summary } = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const reports = new Map<Suite, SimReport>();
  for (const suite of suites) {
    const options = suiteOptions(suite, base);
    reports.set(
      suite,
      simulate(options, (i) => {
        if (!summary && (i + 1) % 250 === 0) process.stderr.write(`  ${suite}: ${String(i + 1)} / ${String(options.games)} games\n`);
      }),
    );
  }
  const text = formatReport(reports, new Date().toISOString().slice(0, 10), summary);
  process.stdout.write(text);
  process.stderr.write(`\nsim: ${suites.join(', ')} in ${String(Date.now() - started)} ms\n`);
  if (out !== undefined) {
    writeFileSync(out, text + '\n', 'utf8');
    process.stderr.write(`sim: report written to ${out}\n`);
  }
}

main();
