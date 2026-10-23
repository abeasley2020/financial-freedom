# Balance simulation

Generated 2026-10-23 by `pnpm sim`. 1000 standard games, seeds 20261023 to 20262022, 2 to 4 bot players per game, abandoned as a draw after 400 turns. Bots are the three simple strategies in `packages/engine/sim/bots.ts` (cautious, balanced, aggressive), assigned at random per seat. The report measures the rules and numbers, not human play.

Spec v2 targets: at least 70% of games end by escape or the round limit; at most 20% of seats go bankrupt; every profession's win rate between 20% and 45%; median game between 10 and 15 rounds.

## Headline

| Measure | Value |
| --- | --- |
| Games ending by escape | 0 (0.0%) |
| Games ending at the round limit | 998 (99.8%) |
| Games ending with one player left | 2 (0.2%) |
| Games abandoned at the turn cap | 0 (0.0%) |
| Game length, turns: mean / median / p90 / max | 42.2 / 42 / 57 / 59 |
| Game length, rounds per player: mean / median | 14.0 / 14.0 |
| Seats that went bankrupt | 0.2% |
| Games with at least one bankruptcy | 0.7% |

A turn is one accepted END_TURN. With 2 to 4 players, "rounds per player" is turns divided by player count.

## Win rate by profession

Win rate is wins divided by seats played as that profession. A fair game with 2 to 4 players sits near 33.3% for every profession.

| Profession | Seats | Wins | Win rate | Went bankrupt |
| --- | --- | --- | --- | --- |
| Teacher | 507 | 75 | 14.8% | 1.4% |
| Electrician | 500 | 207 | 41.4% | 0.0% |
| Nurse | 515 | 224 | 43.5% | 0.0% |
| Police Officer | 501 | 151 | 30.1% | 0.0% |
| Engineer | 527 | 214 | 40.6% | 0.0% |
| Doctor | 468 | 129 | 27.6% | 0.0% |

## Win rate by bot strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt |
| --- | --- | --- | --- | --- |
| balanced | 1018 | 397 | 39.0% | 0.0% |
| aggressive | 990 | 303 | 30.6% | 0.7% |
| cautious | 1010 | 300 | 29.7% | 0.0% |

## Game length by player count

| Players | Games | Median turns |
| --- | --- | --- |
| 2 | 323 | 28 |
| 3 | 336 | 42 |
| 4 | 341 | 56 |

