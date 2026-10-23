# Balance simulation

Generated 2026-10-23 by `pnpm sim`. 1000 kids games, seeds 20261023 to 20262022, 2 to 4 bot players per game, abandoned as a draw after 400 turns. Bots are the three simple strategies in `packages/engine/sim/bots.ts` (cautious, balanced, aggressive), assigned at random per seat. The report measures the rules and numbers, not human play.

Spec v2 targets: at least 70% of games end by escape or the round limit; at most 20% of seats go bankrupt; every profession's win rate between 20% and 45%; median game between 10 and 15 rounds.

## Headline

| Measure | Value |
| --- | --- |
| Games ending by escape | 0 (0.0%) |
| Games ending at the round limit | 1000 (100.0%) |
| Games ending with one player left | 0 (0.0%) |
| Games abandoned at the turn cap | 0 (0.0%) |
| Game length, turns: mean / median / p90 / max | 29.2 / 29 / 39 / 39 |
| Game length, rounds per player: mean / median | 9.6 / 9.7 |
| Seats that went bankrupt | 0.0% |
| Games with at least one bankruptcy | 0.0% |

A turn is one accepted END_TURN. With 2 to 4 players, "rounds per player" is turns divided by player count.

## Win rate by profession

Win rate is wins divided by seats played as that profession. A fair game with 2 to 4 players sits near 33.3% for every profession.

| Profession | Seats | Wins | Win rate | Went bankrupt |
| --- | --- | --- | --- | --- |
| Teacher | 507 | 60 | 11.8% | 0.0% |
| Electrician | 500 | 184 | 36.8% | 0.0% |
| Nurse | 515 | 252 | 48.9% | 0.0% |
| Police Officer | 501 | 148 | 29.5% | 0.0% |
| Engineer | 527 | 202 | 38.3% | 0.0% |
| Doctor | 468 | 154 | 32.9% | 0.0% |

## Win rate by bot strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt |
| --- | --- | --- | --- | --- |
| balanced | 1018 | 379 | 37.2% | 0.0% |
| aggressive | 990 | 296 | 29.9% | 0.0% |
| cautious | 1010 | 325 | 32.2% | 0.0% |

## Game length by player count

| Players | Games | Median turns |
| --- | --- | --- |
| 2 | 323 | 19 |
| 3 | 336 | 29 |
| 4 | 341 | 39 |

