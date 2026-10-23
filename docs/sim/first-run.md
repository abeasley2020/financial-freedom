# Balance simulation

Generated 2026-10-23 by `pnpm sim`. 1000 standard games, seeds 20261023 to 20262022, 2 to 4 bot players per game, abandoned as a draw after 400 turns. Bots are the three simple strategies in `packages/engine/sim/bots.ts` (cautious, balanced, aggressive), assigned at random per seat. The report measures the rules and numbers, not human play.

Spec targets: no profession above 25% win rate; median game under 60 turns.

## Headline

| Measure | Value |
| --- | --- |
| Games ending by escape | 3 (0.3%) |
| Games ending with one player left | 991 (99.1%) |
| Games abandoned at the turn cap | 6 (0.6%) |
| Game length, turns: mean / median / p90 / max | 107.2 / 100 / 175 / 400 |
| Game length, rounds per player: mean / median | 34.9 / 32.7 |
| Seats that went bankrupt | 66.6% |
| Games with at least one bankruptcy | 99.6% |

A turn is one accepted END_TURN. With 2 to 4 players, "rounds per player" is turns divided by player count.

## Win rate by profession

Win rate is wins divided by seats played as that profession. A fair game with 2 to 4 players sits near 33.3% for every profession.

| Profession | Seats | Wins | Win rate | Went bankrupt |
| --- | --- | --- | --- | --- |
| Teacher | 507 | 48 | 9.5% | 90.5% |
| Electrician | 500 | 141 | 28.2% | 71.8% |
| Nurse | 515 | 158 | 30.7% | 68.7% |
| Police Officer | 501 | 113 | 22.6% | 77.4% |
| Engineer | 527 | 230 | 43.6% | 56.2% |
| Doctor | 468 | 304 | 65.0% | 32.7% |

## Win rate by bot strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt |
| --- | --- | --- | --- | --- |
| balanced | 1018 | 355 | 34.9% | 64.5% |
| aggressive | 990 | 330 | 33.3% | 65.9% |
| cautious | 1010 | 309 | 30.6% | 69.3% |

## Game length by player count

| Players | Games | Median turns |
| --- | --- | --- |
| 2 | 323 | 58 |
| 3 | 336 | 102 |
| 4 | 341 | 137 |

