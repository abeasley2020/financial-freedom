// Balance simulation entry point: `pnpm sim [--games N] [--seed N] [--mode standard|kids]
// [--max-turns N] [--players MIN-MAX] [--out path.md]`. Plays bot games through
// the real engine and prints the report the spec asks for (spec, Testing
// strategy: average game length, win rate by profession, bankruptcy rate).
// Targets from the spec: no profession above 25% win rate, median game under
// 60 turns.

import { writeFileSync } from 'node:fs';

import { PROFESSIONS } from '@ff/shared';

import { simulate, type SimOptions, type SimReport } from './simulate';

function parseArgs(argv: readonly string[]): SimOptions & { readonly out: string | undefined } {
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
  const mode = get('--mode') ?? 'standard';
  if (mode !== 'standard' && mode !== 'kids') throw new Error(`--mode must be standard or kids, got "${mode}"`);
  const players = (get('--players') ?? '2-4').split('-').map(Number);
  const [minPlayers, maxPlayers] = players.length === 1 ? [players[0], players[0]] : players;
  if (minPlayers === undefined || maxPlayers === undefined || minPlayers < 2 || maxPlayers > 6 || minPlayers > maxPlayers) {
    throw new Error('--players must be MIN-MAX within 2-6');
  }
  return {
    games: int('--games', 1_000),
    seed: int('--seed', 20_261_023),
    mode,
    maxTurns: int('--max-turns', 400),
    minPlayers,
    maxPlayers,
    out: get('--out'),
  };
}

const pctOf = (part: number, whole: number): string => (whole === 0 ? 'n/a' : `${(100 * part / whole).toFixed(1)}%`);
const fixed = (n: number): string => n.toFixed(1);

export function formatReport(report: SimReport, generatedAt: string): string {
  const { options, endings, turns, roundsPerGame, bankruptcy } = report;
  const lines: string[] = [];
  lines.push(`# Balance simulation`);
  lines.push('');
  lines.push(`Generated ${generatedAt} by \`pnpm sim\`. ${String(options.games)} ${options.mode} games, seeds ${String(options.seed)} to ${String(options.seed + options.games - 1)}, ${String(options.minPlayers)} to ${String(options.maxPlayers)} bot players per game, abandoned as a draw after ${String(options.maxTurns)} turns. Bots are the three simple strategies in \`packages/engine/sim/bots.ts\` (cautious, balanced, aggressive), assigned at random per seat. The report measures the rules and numbers, not human play.`);
  lines.push('');
  lines.push(`Spec targets: no profession above 25% win rate; median game under 60 turns.`);
  lines.push('');
  lines.push(`## Headline`);
  lines.push('');
  lines.push(`| Measure | Value |`);
  lines.push(`| --- | --- |`);
  lines.push(`| Games ending by escape | ${String(endings.escape)} (${pctOf(endings.escape, options.games)}) |`);
  lines.push(`| Games ending with one player left | ${String(endings.lastStanding)} (${pctOf(endings.lastStanding, options.games)}) |`);
  lines.push(`| Games abandoned at the turn cap | ${String(endings.capped)} (${pctOf(endings.capped, options.games)}) |`);
  lines.push(`| Game length, turns: mean / median / p90 / max | ${fixed(turns.mean)} / ${String(turns.median)} / ${String(turns.p90)} / ${String(turns.max)} |`);
  lines.push(`| Game length, rounds per player: mean / median | ${fixed(roundsPerGame.mean)} / ${fixed(roundsPerGame.median)} |`);
  lines.push(`| Seats that went bankrupt | ${pctOf(bankruptcy.seatRate, 1)} |`);
  lines.push(`| Games with at least one bankruptcy | ${pctOf(bankruptcy.gameRate, 1)} |`);
  lines.push('');
  lines.push(`A turn is one accepted END_TURN. With ${String(options.minPlayers)} to ${String(options.maxPlayers)} players, "rounds per player" is turns divided by player count.`);
  lines.push('');
  lines.push(`## Win rate by profession`);
  lines.push('');
  lines.push(`Win rate is wins divided by seats played as that profession. A fair game with ${String(options.minPlayers)} to ${String(options.maxPlayers)} players sits near ${pctOf(2, options.minPlayers + options.maxPlayers)} for every profession.`);
  lines.push('');
  lines.push(`| Profession | Seats | Wins | Win rate | Went bankrupt |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  for (const profession of PROFESSIONS) {
    const tally = report.byProfession.get(profession.id) ?? { seats: 0, wins: 0, outs: 0 };
    lines.push(`| ${profession.name} | ${String(tally.seats)} | ${String(tally.wins)} | ${pctOf(tally.wins, tally.seats)} | ${pctOf(tally.outs, tally.seats)} |`);
  }
  lines.push('');
  lines.push(`## Win rate by bot strategy`);
  lines.push('');
  lines.push(`| Strategy | Seats | Wins | Win rate | Went bankrupt |`);
  lines.push(`| --- | --- | --- | --- | --- |`);
  for (const [strategy, tally] of report.byStrategy) {
    lines.push(`| ${strategy} | ${String(tally.seats)} | ${String(tally.wins)} | ${pctOf(tally.wins, tally.seats)} | ${pctOf(tally.outs, tally.seats)} |`);
  }
  lines.push('');
  lines.push(`## Game length by player count`);
  lines.push('');
  lines.push(`| Players | Games | Median turns |`);
  lines.push(`| --- | --- | --- |`);
  for (const [count, row] of report.byPlayerCount) {
    lines.push(`| ${String(count)} | ${String(row.games)} | ${String(row.medianTurns)} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function main(): void {
  const { out, ...options } = parseArgs(process.argv.slice(2));
  const started = Date.now();
  const report = simulate(options, (i) => {
    if ((i + 1) % 100 === 0) process.stderr.write(`  ${String(i + 1)} / ${String(options.games)} games\n`);
  });
  const text = formatReport(report, new Date().toISOString().slice(0, 10));
  process.stdout.write(text);
  process.stderr.write(`\nsim: ${String(options.games)} games in ${String(Date.now() - started)} ms\n`);
  if (out !== undefined) {
    writeFileSync(out, text + '\n', 'utf8');
    process.stderr.write(`sim: report written to ${out}\n`);
  }
}

main();
