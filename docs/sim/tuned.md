# Balance simulation

Generated 2026-10-27 by `pnpm sim`. Bots are the five strategies in `packages/engine/sim/bots.ts`: Cautious, Balanced, Aggressive, Wealth Builder, Big Spender. The report measures the rules and numbers, not human play. A round is a month for the whole table; the game ends after round 15 (kids 10) unless someone escapes first.

## Targets (spec v2, Engineering practices)

| Target | Value | Met |
| --- | --- | --- |
| Games ending by escape or the round limit (at least 70%) | 99.6% | yes |
| Seats that went bankrupt (at most 20%) | 1.1% | yes |
| Every profession win rate between 20% and 45% | 23.6% (Restaurant Server) to 41.5% (Pharmacist) | yes |
| Best strategy beats worst by at least 15 points | 48.9 points (Balanced 57.6%, Big Spender 8.7%) | yes |
| Median game between 10 and 15 rounds | 15 | yes |
| Escape reachable within 15 rounds | 13 escapes (1.3%), earliest round 7, median round 14 | yes |
| Wealth Builder beats Big Spender head to head (at least 70%) | 78.2% | yes |
| Kids games finished, none stuck | 1000 of 1000 | yes |
| Kids median at or under 10 rounds | 10 | yes |

## Standard games, mixed strategies

1000 standard games, seeds 20261023 to 20262022, 2 to 4 seats per game, each seat a random profession and a random strategy, abandoned as a draw after 400 turns.

| Measure | Value |
| --- | --- |
| Games ending by escape | 13 (1.3%) |
| Games ending at the round limit | 983 (98.3%) |
| Games ending with one player left | 4 (0.4%) |
| Games abandoned at the turn cap | 0 (0.0%) |
| Escape round: earliest / median | 7 / 14 |
| Game length, rounds: median | 15 |
| Game length, turns: mean / median / p90 / max | 43.5 / 44 / 59 / 59 |
| Game length, turns per player: mean / median | 14.4 / 14.5 |
| Seats that went bankrupt | 1.1% |
| Games with at least one bankruptcy | 3.2% |

### Win rate by profession

A fair game with 2 to 4 seats sits near 33.3% for every profession. Mean freedom is the final freedomPercent (0 for a seat that went out).

| Profession | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Restaurant Server | 182 | 43 | 23.6% | 11.0% | 10.5% |
| Retail Manager | 181 | 56 | 30.9% | 0.6% | 13.5% |
| Truck Driver | 191 | 70 | 36.6% | 1.6% | 13.0% |
| Welder | 178 | 54 | 30.3% | 2.2% | 12.9% |
| Electrician | 214 | 72 | 33.6% | 0.0% | 12.9% |
| Teacher | 195 | 52 | 26.7% | 0.5% | 9.9% |
| Police Officer | 179 | 65 | 36.3% | 0.0% | 12.9% |
| Firefighter | 202 | 74 | 36.6% | 0.0% | 16.0% |
| Army Sergeant | 183 | 57 | 31.1% | 0.0% | 14.8% |
| Nurse | 197 | 72 | 36.5% | 0.0% | 12.0% |
| Farmer | 188 | 60 | 31.9% | 0.0% | 12.0% |
| Real Estate Agent | 200 | 66 | 33.0% | 2.0% | 15.4% |
| Software Developer | 197 | 64 | 32.5% | 0.0% | 15.4% |
| Engineer | 159 | 46 | 28.9% | 0.0% | 11.2% |
| Pharmacist | 195 | 81 | 41.5% | 0.0% | 15.7% |
| Doctor | 177 | 68 | 38.4% | 0.0% | 14.3% |

### Win rate by strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Cautious | 608 | 132 | 21.7% | 0.0% | 9.3% |
| Balanced | 615 | 354 | 57.6% | 0.0% | 22.9% |
| Aggressive | 591 | 293 | 49.6% | 1.7% | 20.2% |
| Wealth Builder | 606 | 169 | 27.9% | 0.0% | 10.0% |
| Big Spender | 598 | 52 | 8.7% | 3.8% | 4.0% |

### Game length by player count

| Players | Games | Median turns |
| --- | --- | --- |
| 2 | 323 | 29 |
| 3 | 336 | 43 |
| 4 | 341 | 58 |

## Head to head: Wealth Builder vs Big Spender

1000 standard games, seeds 20261023 to 20262022, 2 seats per game (Wealth Builder and Big Spender, seat order alternating by game), each a random profession, abandoned as a draw after 400 turns.

| Measure | Value |
| --- | --- |
| Games ending by escape | 0 (0.0%) |
| Games ending at the round limit | 964 (96.4%) |
| Games ending with one player left | 36 (3.6%) |
| Games abandoned at the turn cap | 0 (0.0%) |
| Escape round: earliest / median | none |
| Game length, rounds: median | 15 |
| Game length, turns: mean / median / p90 / max | 28.3 / 29 / 29 / 29 |
| Game length, turns per player: mean / median | 14.2 / 14.5 |
| Seats that went bankrupt | 1.8% |
| Games with at least one bankruptcy | 3.6% |

### Win rate by strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Wealth Builder | 1000 | 782 | 78.2% | 0.0% | 9.6% |
| Big Spender | 1000 | 218 | 21.8% | 3.6% | 3.9% |

## Kids games, mixed strategies

1000 kids games, seeds 20261023 to 20262022, 2 to 4 seats per game, each seat a random profession and a random strategy, abandoned as a draw after 400 turns.

| Measure | Value |
| --- | --- |
| Games ending by escape | 0 (0.0%) |
| Games ending at the round limit | 1000 (100.0%) |
| Games ending with one player left | 0 (0.0%) |
| Games abandoned at the turn cap | 0 (0.0%) |
| Escape round: earliest / median | none |
| Game length, rounds: median | 10 |
| Game length, turns: mean / median / p90 / max | 29.2 / 29 / 39 / 39 |
| Game length, turns per player: mean / median | 9.6 / 9.7 |
| Seats that went bankrupt | 0.0% |
| Games with at least one bankruptcy | 0.0% |

### Win rate by profession

A fair game with 2 to 4 seats sits near 33.3% for every profession. Mean freedom is the final freedomPercent (0 for a seat that went out).

| Profession | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Restaurant Server | 182 | 25 | 13.7% | 0.0% | 2.5% |
| Retail Manager | 181 | 54 | 29.8% | 0.0% | 4.8% |
| Truck Driver | 191 | 61 | 31.9% | 0.0% | 4.6% |
| Welder | 178 | 55 | 30.9% | 0.0% | 4.5% |
| Electrician | 214 | 67 | 31.3% | 0.0% | 5.3% |
| Teacher | 195 | 37 | 19.0% | 0.0% | 3.4% |
| Police Officer | 179 | 70 | 39.1% | 0.0% | 5.9% |
| Firefighter | 202 | 72 | 35.6% | 0.0% | 5.8% |
| Army Sergeant | 183 | 62 | 33.9% | 0.0% | 5.6% |
| Nurse | 197 | 84 | 42.6% | 0.0% | 5.9% |
| Farmer | 188 | 75 | 39.9% | 0.0% | 6.0% |
| Real Estate Agent | 200 | 49 | 24.5% | 0.0% | 4.6% |
| Software Developer | 197 | 77 | 39.1% | 0.0% | 6.0% |
| Engineer | 159 | 56 | 35.2% | 0.0% | 5.4% |
| Pharmacist | 195 | 88 | 45.1% | 0.0% | 7.0% |
| Doctor | 177 | 68 | 38.4% | 0.0% | 4.6% |

### Win rate by strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Cautious | 608 | 266 | 43.8% | 0.0% | 6.5% |
| Balanced | 615 | 279 | 45.4% | 0.0% | 7.3% |
| Aggressive | 591 | 266 | 45.0% | 0.0% | 7.2% |
| Wealth Builder | 606 | 48 | 7.9% | 0.0% | 1.2% |
| Big Spender | 598 | 141 | 23.6% | 0.0% | 3.4% |

### Game length by player count

| Players | Games | Median turns |
| --- | --- | --- |
| 2 | 323 | 19 |
| 3 | 336 | 29 |
| 4 | 341 | 39 |

## Reading (Stage D, 2026-10-27)

All nine targets are met after 11 rounds (log: `docs/sim/tuning-log.md`). Rerunning on two other seed ranges (`--seed 1` and `--seed 50000000`) also met all nine: profession win rates 26.7% to 39.8% and 26.8% to 41.5%, head to head 77.3% and 78.3%, 9 and 14 escapes.

- **Escape is reachable but rare** (about 1% of games, earliest round 7). Every escape in a 3,000-seed search came from the same road: buy a leveraged rental, sell it to a Market buyer at 200%, and put the cash into big deals. The golden recording `escape-three-players` (proposed, awaiting approval) is one of these games.
- **The lowest win rates belong to the thinnest monthly surplus**: the Restaurant Server (surplus 13% of totalExpenses, 23.6%, and 11% bankrupt) and the Teacher (16%, 26.7%). The highest belong to the Pharmacist (41.5%) and Doctor (38.4%), who can afford big deals early. Everyone else sits between 28.9% (Engineer) and 36.6%.
- **Wealth Builder loses to the simple bots** (27.9% overall against Balanced 57.6%). Its three-month emergency fund is three months of the 15-month game held back from deals. It still beats Big Spender 78% of the time head to head. **In kids mode it loses to Big Spender** (7.9% against 23.6%) because kids cannot borrow, so the fund is all it ever builds. With a one-month fund the Wealth Builder wins 45.5% overall, 91.2% head to head, and beats Big Spender in kids mode too. That is a question for Andre in STATUS.md, not a change made here.
- **Kids mode** never escapes in 10 rounds; mean Freedom is about 5%. Kids still see deals and compounding, but the round limit decides every kids game.
