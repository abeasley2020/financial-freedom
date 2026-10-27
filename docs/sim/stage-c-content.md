# Balance simulation

Generated 2026-10-26 by `pnpm sim`. 1000 standard games, seeds 20261023 to 20262022, 2 to 4 bot players per game, abandoned as a draw after 400 turns. Bots are the three simple strategies in `packages/engine/sim/bots.ts` (cautious, balanced, aggressive), assigned at random per seat. The report measures the rules and numbers, not human play.

Spec v2 targets: at least 70% of games end by escape or the round limit; at most 20% of seats go bankrupt; every profession's win rate between 20% and 45%; median game between 10 and 15 rounds.

## Headline

| Measure | Value |
| --- | --- |
| Games ending by escape | 0 (0.0%) |
| Games ending at the round limit | 994 (99.4%) |
| Games ending with one player left | 6 (0.6%) |
| Games abandoned at the turn cap | 0 (0.0%) |
| Game length, turns: mean / median / p90 / max | 42.7 / 43 / 58 / 59 |
| Game length, rounds per player: mean / median | 14.1 / 14.3 |
| Seats that went bankrupt | 0.9% |
| Games with at least one bankruptcy | 2.8% |

A turn is one accepted END_TURN. With 2 to 4 players, "rounds per player" is turns divided by player count.

## Win rate by profession

Win rate is wins divided by seats played as that profession. A fair game with 2 to 4 players sits near 33.3% for every profession.

| Profession | Seats | Wins | Win rate | Went bankrupt |
| --- | --- | --- | --- | --- |
| Restaurant Server | 182 | 8 | 4.4% | 12.1% |
| Retail Manager | 181 | 44 | 24.3% | 1.1% |
| Truck Driver | 191 | 60 | 31.4% | 0.0% |
| Welder | 178 | 39 | 21.9% | 1.1% |
| Electrician | 214 | 52 | 24.3% | 0.0% |
| Teacher | 195 | 53 | 27.2% | 0.5% |
| Police Officer | 179 | 68 | 38.0% | 0.0% |
| Firefighter | 202 | 76 | 37.6% | 0.0% |
| Army Sergeant | 183 | 55 | 30.1% | 0.5% |
| Nurse | 197 | 69 | 35.0% | 0.0% |
| Farmer | 188 | 70 | 37.2% | 0.0% |
| Real Estate Agent | 200 | 57 | 28.5% | 0.0% |
| Software Developer | 197 | 89 | 45.2% | 0.0% |
| Engineer | 159 | 53 | 33.3% | 0.0% |
| Pharmacist | 195 | 101 | 51.8% | 0.0% |
| Doctor | 177 | 106 | 59.9% | 0.0% |

## Win rate by bot strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt |
| --- | --- | --- | --- | --- |
| balanced | 1018 | 433 | 42.5% | 0.3% |
| aggressive | 990 | 292 | 29.5% | 2.4% |
| cautious | 1010 | 275 | 27.2% | 0.1% |

## Game length by player count

| Players | Games | Median turns |
| --- | --- | --- |
| 2 | 323 | 28 |
| 3 | 336 | 43 |
| 4 | 341 | 57 |
