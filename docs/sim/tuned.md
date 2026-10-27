# Balance simulation

Generated 2026-10-27 by `pnpm sim`. Bots are the five strategies in `packages/engine/sim/bots.ts`: Cautious, Balanced, Aggressive, Wealth Builder, Big Spender. The report measures the rules and numbers, not human play. A round is a month for the whole table; the game ends after round 15 (kids 10) unless someone escapes first.

## Targets (spec v2, Engineering practices)

| Target | Value | Met |
| --- | --- | --- |
| Games ending by escape or the round limit (at least 70%) | 99.7% | yes |
| Seats that went bankrupt (at most 20%) | 1.0% | yes |
| Every profession win rate between 20% and 45% | 26.9% (Restaurant Server) to 41.0% (Pharmacist) | yes |
| Best strategy beats worst by at least 15 points | 47.6 points (Balanced 54.0%, Big Spender 6.4%) | yes |
| Median game between 10 and 15 rounds | 15 | yes |
| Standard games ending by escape (at least 15%) | 200 (20.0%), median escape round 13, earliest 6 | yes |
| Wealth Builder beats Big Spender head to head (at least 70%) | 89.4% | yes |
| Kids games finished, none stuck | 1000 of 1000 | yes |
| Kids median at or under 10 rounds | 10 | yes |

## Standard games, mixed strategies

1000 standard games, seeds 20261023 to 20262022, 2 to 4 seats per game, each seat a random profession and a random strategy, abandoned as a draw after 400 turns.

| Measure | Value |
| --- | --- |
| Games ending by escape | 200 (20.0%) |
| Games ending at the round limit | 797 (79.7%) |
| Games ending with one player left | 3 (0.3%) |
| Games abandoned at the turn cap | 0 (0.0%) |
| Escape round: earliest / median | 6 / 13 |
| Game length, rounds: median | 15 |
| Game length, turns: mean / median / p90 / max | 42.1 / 43 / 59 / 59 |
| Game length, turns per player: mean / median | 14.0 / 14.5 |
| Seats that went bankrupt | 1.0% |
| Games with at least one bankruptcy | 2.9% |

### Win rate by profession

A fair game with 2 to 4 seats sits near 33.3% for every profession. Mean freedom is the final freedomPercent (0 for a seat that went out).

| Profession | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Restaurant Server | 182 | 49 | 26.9% | 9.9% | 30.1% |
| Retail Manager | 181 | 64 | 35.4% | 0.6% | 36.6% |
| Truck Driver | 191 | 65 | 34.0% | 1.6% | 33.2% |
| Welder | 178 | 52 | 29.2% | 1.7% | 33.3% |
| Electrician | 214 | 65 | 30.4% | 0.0% | 30.8% |
| Teacher | 195 | 59 | 30.3% | 0.5% | 29.2% |
| Police Officer | 179 | 57 | 31.8% | 0.0% | 32.8% |
| Firefighter | 202 | 79 | 39.1% | 0.0% | 39.7% |
| Army Sergeant | 183 | 56 | 30.6% | 0.0% | 38.4% |
| Nurse | 197 | 73 | 37.1% | 0.0% | 32.0% |
| Farmer | 188 | 51 | 27.1% | 0.0% | 26.9% |
| Real Estate Agent | 200 | 68 | 34.0% | 2.0% | 35.3% |
| Software Developer | 197 | 64 | 32.5% | 0.0% | 36.2% |
| Engineer | 159 | 46 | 28.9% | 0.0% | 30.7% |
| Pharmacist | 195 | 80 | 41.0% | 0.0% | 42.5% |
| Doctor | 177 | 72 | 40.7% | 0.0% | 40.9% |

### Win rate by strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Cautious | 608 | 98 | 16.1% | 0.0% | 16.7% |
| Balanced | 615 | 332 | 54.0% | 0.0% | 57.2% |
| Aggressive | 591 | 317 | 53.6% | 1.2% | 56.2% |
| Wealth Builder | 606 | 215 | 35.5% | 0.2% | 33.7% |
| Big Spender | 598 | 38 | 6.4% | 3.7% | 7.6% |

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
| Games ending by escape | 44 (4.4%) |
| Games ending at the round limit | 921 (92.1%) |
| Games ending with one player left | 35 (3.5%) |
| Games abandoned at the turn cap | 0 (0.0%) |
| Escape round: earliest / median | 8 / 13 |
| Game length, rounds: median | 15 |
| Game length, turns: mean / median / p90 / max | 28.1 / 29 / 29 / 29 |
| Game length, turns per player: mean / median | 14.1 / 14.5 |
| Seats that went bankrupt | 1.8% |
| Games with at least one bankruptcy | 3.5% |

### Win rate by strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Wealth Builder | 1000 | 894 | 89.4% | 0.0% | 35.4% |
| Big Spender | 1000 | 106 | 10.6% | 3.5% | 7.8% |

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
| Restaurant Server | 182 | 28 | 15.4% | 0.0% | 5.1% |
| Retail Manager | 181 | 56 | 30.9% | 0.0% | 9.3% |
| Truck Driver | 191 | 60 | 31.4% | 0.0% | 8.4% |
| Welder | 178 | 53 | 29.8% | 0.0% | 7.7% |
| Electrician | 214 | 71 | 33.2% | 0.0% | 10.0% |
| Teacher | 195 | 39 | 20.0% | 0.0% | 6.0% |
| Police Officer | 179 | 73 | 40.8% | 0.0% | 10.9% |
| Firefighter | 202 | 68 | 33.7% | 0.0% | 10.5% |
| Army Sergeant | 183 | 58 | 31.7% | 0.0% | 10.2% |
| Nurse | 197 | 81 | 41.1% | 0.0% | 11.0% |
| Farmer | 188 | 76 | 40.4% | 0.0% | 11.4% |
| Real Estate Agent | 200 | 53 | 26.5% | 0.0% | 8.3% |
| Software Developer | 197 | 78 | 39.6% | 0.0% | 10.3% |
| Engineer | 159 | 61 | 38.4% | 0.0% | 10.0% |
| Pharmacist | 195 | 83 | 42.6% | 0.0% | 12.3% |
| Doctor | 177 | 62 | 35.0% | 0.0% | 7.9% |

### Win rate by strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Cautious | 608 | 274 | 45.1% | 0.0% | 11.9% |
| Balanced | 615 | 262 | 42.6% | 0.0% | 13.4% |
| Aggressive | 591 | 273 | 46.2% | 0.0% | 13.7% |
| Wealth Builder | 606 | 45 | 7.4% | 0.0% | 1.2% |
| Big Spender | 598 | 146 | 24.4% | 0.0% | 6.4% |

### Game length by player count

| Players | Games | Median turns |
| --- | --- | --- |
| 2 | 323 | 19 |
| 3 | 336 | 29 |
| 4 | 341 | 39 |

## Reading (Stage D, 2026-10-27)

All ten targets are met after 14 rounds (log: `docs/sim/tuning-log.md`). That includes the escape-rate target Andre added mid-session, which replaced "escape reachable". Two other seed ranges also met all ten: from seed 1, escapes 20.9%, professions 29.6% to 39.3%, head to head 90.2%; from seed 50000000, escapes 18.8%, professions 27.4% to 39.5%, head to head 89.4%.

- **Escape happens in one game in five**, usually late (median round 13, earliest round 6). The escape rate needed returns that beat the bank: every rental and business except the four that engine tests name now pays 11% to 29% of its down payment a month. Borrowing for a deal pays for itself, and 196 of the 200 escapers borrowed. 83 of them also sold an asset to a Market buyer. Aggressive (91) and Balanced (89) bots make almost all the escapes; Wealth Builder made 16.
- **Profession balance held** (26.9% to 41.0%). The Restaurant Server is still lowest and the only profession with real bankruptcy risk (9.9% of its seats). Pharmacist and Doctor are highest.
- **Wealth Builder** wins 35.5% overall and beats Big Spender 89.4% head to head. **In kids mode it still loses to Big Spender (7.4% vs 24.4%)**: kids cannot borrow, so its three-month fund is all it builds. With a one-month fund it wins 48.7% overall, 93.9% head to head, and 27.1% vs 19.4% in kids mode, and every target still holds. That is a question in STATUS.md.
- **The four test-named small deals** (Duplex in Decatur, Starter Condo, Lawn Care Trailer, Vending Route) still return 3% to 5% a month, so next to every other deal they now read as traps. That is a question in STATUS.md.
- **Kids mode** never escapes in 10 rounds. In kids games the Restaurant Server wins 15.4% and the Teacher 20.0%. The kids target does not cover profession balance.
