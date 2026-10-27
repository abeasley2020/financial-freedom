# Balance simulation

Generated 2026-10-27 by `pnpm sim`. Bots are the five strategies in `packages/engine/sim/bots.ts`: Cautious, Balanced, Aggressive, Wealth Builder, Big Spender. The report measures the rules and numbers, not human play. A round is a month for the whole table; the game ends after round 15 (kids 10) unless someone escapes first.

## Targets (spec v2, Engineering practices)

| Target | Value | Met |
| --- | --- | --- |
| Games ending by escape or the round limit (at least 70%) | 99.7% | yes |
| Seats that went bankrupt (at most 20%) | 0.9% | yes |
| Every profession win rate between 20% and 45% | 28.2% (Farmer) to 44.1% (Doctor) | yes |
| Best strategy beats worst by at least 15 points | 44.9 points (Aggressive 49.9%, Big Spender 5.0%) | yes |
| Median game between 10 and 15 rounds | 15 | yes |
| Standard games ending by escape (at least 15%) | 359 (35.9%), median escape round 13, earliest 5 | yes |
| Wealth Builder beats Big Spender head to head (at least 70%) | 96.1% | yes |
| Kids games finished, none stuck | 1000 of 1000 | yes |
| Kids median at or under 10 rounds | 10 | yes |

## Standard games, mixed strategies

1000 standard games, seeds 20261023 to 20262022, 2 to 4 seats per game, each seat a random profession and a random strategy, abandoned as a draw after 400 turns.

| Measure | Value |
| --- | --- |
| Games ending by escape | 359 (35.9%) |
| Games ending at the round limit | 638 (63.8%) |
| Games ending with one player left | 3 (0.3%) |
| Games abandoned at the turn cap | 0 (0.0%) |
| Escape round: earliest / median | 5 / 13 |
| Game length, rounds: median | 15 |
| Game length, turns: mean / median / p90 / max | 40.8 / 43 / 58 / 59 |
| Game length, turns per player: mean / median | 13.6 / 14.3 |
| Seats that went bankrupt | 0.9% |
| Games with at least one bankruptcy | 2.5% |

### Win rate by profession

A fair game with 2 to 4 seats sits near 33.3% for every profession. Mean freedom is the final freedomPercent (0 for a seat that went out).

| Profession | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Restaurant Server | 182 | 54 | 29.7% | 8.8% | 38.6% |
| Retail Manager | 181 | 65 | 35.9% | 0.6% | 45.2% |
| Truck Driver | 191 | 59 | 30.9% | 1.6% | 43.8% |
| Welder | 178 | 52 | 29.2% | 1.7% | 40.9% |
| Electrician | 214 | 73 | 34.1% | 0.0% | 43.3% |
| Teacher | 195 | 56 | 28.7% | 0.5% | 36.2% |
| Police Officer | 179 | 58 | 32.4% | 0.0% | 40.0% |
| Firefighter | 202 | 74 | 36.6% | 0.0% | 49.1% |
| Army Sergeant | 183 | 58 | 31.7% | 0.0% | 46.6% |
| Nurse | 197 | 67 | 34.0% | 0.0% | 41.1% |
| Farmer | 188 | 53 | 28.2% | 0.0% | 35.5% |
| Real Estate Agent | 200 | 62 | 31.0% | 1.0% | 45.7% |
| Software Developer | 197 | 69 | 35.0% | 0.0% | 49.4% |
| Engineer | 159 | 49 | 30.8% | 0.0% | 40.6% |
| Pharmacist | 195 | 73 | 37.4% | 0.0% | 50.2% |
| Doctor | 177 | 78 | 44.1% | 0.0% | 50.0% |

### Win rate by strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Cautious | 608 | 79 | 13.0% | 0.0% | 17.2% |
| Balanced | 615 | 300 | 48.8% | 0.0% | 64.5% |
| Aggressive | 591 | 295 | 49.9% | 1.0% | 64.4% |
| Wealth Builder | 606 | 296 | 48.8% | 0.0% | 63.7% |
| Big Spender | 598 | 30 | 5.0% | 3.3% | 7.9% |

### Game length by player count

| Players | Games | Median turns |
| --- | --- | --- |
| 2 | 323 | 29 |
| 3 | 336 | 43 |
| 4 | 341 | 57 |

## Head to head: Wealth Builder vs Big Spender

1000 standard games, seeds 20261023 to 20262022, 2 seats per game (Wealth Builder and Big Spender, seat order alternating by game), each a random profession, abandoned as a draw after 400 turns.

| Measure | Value |
| --- | --- |
| Games ending by escape | 216 (21.6%) |
| Games ending at the round limit | 748 (74.8%) |
| Games ending with one player left | 36 (3.6%) |
| Games abandoned at the turn cap | 0 (0.0%) |
| Escape round: earliest / median | 7 / 14 |
| Game length, rounds: median | 15 |
| Game length, turns: mean / median / p90 / max | 27.5 / 29 / 29 / 29 |
| Game length, turns per player: mean / median | 13.7 / 14.5 |
| Seats that went bankrupt | 1.8% |
| Games with at least one bankruptcy | 3.6% |

### Win rate by strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Wealth Builder | 1000 | 961 | 96.1% | 0.0% | 69.9% |
| Big Spender | 1000 | 39 | 3.9% | 3.6% | 8.2% |

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
| Restaurant Server | 182 | 25 | 13.7% | 0.0% | 5.9% |
| Retail Manager | 181 | 57 | 31.5% | 0.0% | 10.9% |
| Truck Driver | 191 | 54 | 28.3% | 0.0% | 9.9% |
| Welder | 178 | 51 | 28.7% | 0.0% | 9.8% |
| Electrician | 214 | 75 | 35.0% | 0.0% | 13.1% |
| Teacher | 195 | 44 | 22.6% | 0.0% | 7.6% |
| Police Officer | 179 | 73 | 40.8% | 0.0% | 14.4% |
| Firefighter | 202 | 66 | 32.7% | 0.0% | 12.7% |
| Army Sergeant | 183 | 69 | 37.7% | 0.0% | 14.1% |
| Nurse | 197 | 74 | 37.6% | 0.0% | 13.6% |
| Farmer | 188 | 81 | 43.1% | 0.0% | 15.4% |
| Real Estate Agent | 200 | 53 | 26.5% | 0.0% | 11.2% |
| Software Developer | 197 | 82 | 41.6% | 0.0% | 14.3% |
| Engineer | 159 | 57 | 35.8% | 0.0% | 12.7% |
| Pharmacist | 195 | 88 | 45.1% | 0.0% | 15.5% |
| Doctor | 177 | 51 | 28.8% | 0.0% | 10.1% |

### Win rate by strategy

| Strategy | Seats | Wins | Win rate | Went bankrupt | Mean freedom |
| --- | --- | --- | --- | --- | --- |
| Cautious | 608 | 235 | 38.7% | 0.0% | 13.0% |
| Balanced | 615 | 247 | 40.2% | 0.0% | 15.0% |
| Aggressive | 591 | 245 | 41.5% | 0.0% | 15.2% |
| Wealth Builder | 606 | 157 | 25.9% | 0.0% | 9.7% |
| Big Spender | 598 | 116 | 19.4% | 0.0% | 7.0% |

### Game length by player count

| Players | Games | Median turns |
| --- | --- | --- |
| 2 | 323 | 19 |
| 3 | 336 | 29 |
| 4 | 341 | 39 |

## Reading (Stage D, 2026-10-27, after Andre's approvals)

All ten targets are met. This report includes the two changes Andre approved after tuning stopped at round 14: the Wealth Builder's emergency fund cut from three months to one, and the seven deals that engine tests name raised into the tuned range. Two other seed ranges also met all ten: from seed 1, escapes 35.3%, professions 27.4% to 43.7%, head to head 97.0%; from seed 50000000, escapes 35.7%, professions 25.4% to 41.0%, head to head 96.9%.

- **Escape happens in about one game in three** (35.9%), usually late (median round 13, earliest round 5). Every rental and business now pays 11% to 29% of its down payment a month, more than the 10% bank rate. 355 of the 359 escapers borrowed for a deal, and 131 also sold an asset to a Market buyer. Aggressive (130), Balanced (119), and Wealth Builder (106) make almost all the escapes.
- **Profession balance holds** (28.2% Farmer to 44.1% Doctor), but the Doctor now sits close to the 45% ceiling. The Restaurant Server is the only profession with real bankruptcy risk (8.8% of its seats).
- **Wealth Builder** wins 48.8% overall, tied for best with Balanced and just behind Aggressive (49.9%). It beats Big Spender 96.1% of the time head to head, and in kids mode too (25.9% vs 19.4%). Big Spender wins 5.0%.
- **Kids mode** never escapes in 10 rounds. In kids games the Restaurant Server wins only 13.7%; the kids targets do not cover profession balance.
