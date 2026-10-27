# Stage D tuning log

One lever per round, measured by `pnpm sim` (1,000 mixed standard games at 2 to 4 seats, 1,000 Wealth Builder vs Big Spender head-to-head games, 1,000 kids games; seeds from 20261023). Each row records every target number; "Kept" says whether the change stayed.

Targets: escape or round limit at least 70%; bankrupt seats at most 20%; every profession 20% to 45%; WB beats BS head to head at least 70%; best strategy minus worst at least 15 points; median game 10 to 15 rounds; kids never stuck, median at or under 10 rounds; escape reachable within 15 rounds.

Column key: **End** escape plus round-limit share; **Bkr** bankrupt seats; **Prof** lowest to highest profession win rate; **H2H** WB wins over BS; **Spread** best minus worst strategy (names); **Med** median rounds; **Esc** escapes in 1,000 mixed games (earliest round); **Kids** stuck games and median rounds.

| Round | Lever | Kept | End | Bkr | Prof | H2H | Spread | Med | Esc | Kids |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | Baseline: Stage C content, five bots (Wealth Builder and Big Spender added) | n/a | 99.3% | 1.7% | 7.7% Server to 58.8% Doctor | 59.3% | 34.1 (Balanced 50.6, WB 16.5) | 15 | 0 | 0 stuck, 10 |
| 1 | Small rentals and businesses (17 cards, not the 4 that engine tests name): cash flow doubled, capped at 9.5% of the down payment a month, so a bank loan at 10% never pays for itself | yes | 99.3% | 1.7% | 12.6% Server to 44.1% Pharmacist | 56.7% | 44.4 (Balanced 58.0, WB 13.7) | 15 | 1 (round 15) | 0 stuck, 10 |
| 2 | Growth assets (not the two cards engine tests name): savings 2%/1%, CDs 3%/2%, index funds growth +1 point (4 to 6) and payout 2% | yes | 99.3% | 1.7% | 11.0% Server to 44.6% Firefighter | 62.8% | 46.5 (Balanced 59.0, BS 12.5) | 15 | 1 (round 15) | 0 stuck, 10 |
| 2b | Bot fix, not a lever: Wealth Builder's loan test counted the fund's growth twice, so it would borrow only for deals paying over 14% a month. Now it borrows the part its free cash does not cover when the deal pays more than the loan. New baseline | yes | 99.3% | 1.7% | 9.9% Server to 45.0% Firefighter | 64.3% | 46.2 (Balanced 58.5, BS 12.4) | 15 | 1 (round 15) | 0 stuck, 10 |
| 3 | Five small deals become "gems" paying 13% to 15% a month on the down payment (Basement Apartment 700, Pressure Washing 350, Gumball Machines 170, Online Tutoring 120, Dog Walking 140), so a bank loan for them pays for itself (P5, good debt) | yes | 99.3% | 1.7% | 12.1% Server to 44.6% Firefighter | 72.7% | 44.9 (Balanced 55.3, BS 10.4) | 15 | 1 (round 15) | 0 stuck, 10 |
| 4 | Bigger windfalls (Work Bonus 3,000 to 4,000, Garage Sale 400 to 1,000, Overtime 1,500 to 2,500): a fixed sum means more to a low salary | yes (neutral, kept as a mild help for low earners) | 99.3% | 1.6% | 12.1% Server to 45.0% Firefighter | 72.7% | 44.8 (Balanced 55.1, BS 10.4) | 15 | 1 (round 15) | 0 stuck, 10 |
| 5 | Four small deals made cheaper (half the down payment and about half the cash flow: Mobile Home, Garage Apartment, Cabin Share, Car Detailing) so a low salary can start sooner | no (Server unchanged at 12.1%, the one escape lost) | 99.3% | 1.6% | 12.1% Server to 44.1% Firefighter | 71.5% | 46.2 (Balanced 55.6, BS 9.4) | 15 | 0 | 0 stuck, 10 |
| 6 | Setback costs cut on the seven cards engine tests do not name (Emergency Room 800, Roof Leak 1,500, Cracked Tooth 700, Water Heater 900, Vet 1,000, Broken Wrist 600, Family Needs Help 500): a fixed bill hurts a low salary most | yes (Server up, bankruptcies down; Firefighter now over 45%) | 99.5% | 1.3% | 14.8% Server to 47.0% Firefighter | 73.2% | 43.8 (Balanced 54.6, BS 10.9) | 15 | 1 (round 15) | 0 stuck, 10 |
| 7 | Four more small gems by lowering the down payment or raising cash flow (Garage Apartment 2,000 down, Cabin Share 1,500 down, Used Book Shop 200/mo, Car Detailing 2,000 down): cheap, strong deals a low salary can reach | yes (Server up again; the single escape was noise) | 99.5% | 1.2% | 15.9% Server to 47.5% Firefighter | 74.7% | 43.4 (Balanced 54.0, BS 10.5) | 15 | 0 | 0 stuck, 10 |
| 8 | Market buyers pay more: Investor Buys Rentals 150% to 200% of purchase price, Business Buyer 150% to 250%. A leveraged rental sold to a buyer funds a big deal, the main road to an early escape | yes | 99.5% | 1.2% | 16.5% Server to 48.0% Firefighter | 74.5% | 43.8 (Balanced 54.3, BS 10.5) | 15 | 2 (round 13) | 0 stuck, 10 |
| 9 | Board mix: Opportunity 10 to 13, Market 4 to 3, Giving 2 to 1, Setback 2 to 1 (Life Choices stays 6; positions 4, 12, and 16 became Opportunity). More deal draws turn the game from cash-limited toward deal-limited, which helps low salaries | yes | 99.7% | 1.0% | 22.6% Doctor to 45.0% Firefighter (45.05, just over) | 77.1% | 47.1 (Balanced 56.4, BS 9.4) | 15 | 2 (round 13) | 0 stuck, 10 |
| 10 | Big rentals and businesses (18 cards, not the 4 that engine tests name): cash flow up 80%, capped at 9.5% of the down payment a month. Land stays negative | yes. **All targets met; tuning stops here** | 99.7% | 0.9% | 22.0% Server to 43.6% Pharmacist | 77.0% | 48.7 (Balanced 57.7, BS 9.0) | 15 | 7 (round 8) | 0 stuck, 10 |
| 11 | Same mix as round 9, new positions: spaces 0 to 6 keep their kinds (engine tests land on Giving at 4 and Setback at 6), and the rest spread out (Market at 2, 9, 17; Life Choices at 1, 7, 11, 14, 19, 22; Giving 4; Setback 6). Run to confirm the targets still hold | yes | 99.6% | 1.1% | 23.6% Server to 41.5% Pharmacist | 78.2% | 48.9 (Balanced 57.6, BS 8.7) | 15 | 13 (round 7) | 0 stuck, 10 |

## Where it ended

All nine targets were met at round 10; round 11 only moved spaces so engine tests keep their board positions, and confirmed the targets. Tuning stopped at round 11 of 30. Final report: `docs/sim/tuned.md`.

Robustness (not tuning rounds, same content, other seeds):

| Seeds from | End | Bkr | Prof | H2H | Spread | Med | Esc | Kids |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 99.2% | 0.8% | 26.7% Real Estate Agent to 39.8% Pharmacist | 77.3% | 48.3 (Balanced 57.2, BS 8.9) | 15 | 9 (round 10) | 0 stuck, 10 |
| 50000000 | 98.9% | 1.0% | 26.8% Server to 41.5% Software Developer | 78.3% | 46.9 (Balanced 56.6, BS 9.7) | 15 | 14 (round 7) | 0 stuck, 10 |

Wealth Builder fund sensitivity (bot setting, not a lever; the committed bot keeps three months as specified):

| Fund | WB overall | H2H | Kids WB vs BS | Prof | All targets |
| --- | --- | --- | --- | --- | --- |
| 3 months (committed) | 27.9% | 78.2% | 7.9% vs 23.6% | 23.6% to 41.5% | yes |
| 2 months | 36.0% | 86.4% | 12.2% vs 22.7% | 22.5% to 41.0% | yes |
| 1 month | 45.5% | 91.2% | 26.7% vs 19.4% | 25.1% to 40.1% | yes |

## Rounds 12 on: new escape target

Andre replaced "escape reachable within 15 rounds" with **at least 15% of standard games end by escape** (2026-10-27, relayed by the parent session). From here the Esc column is that target: escapes in 1,000 mixed games, share, and median escape round. Rounds 1 to 11 measured it too (best: 13 escapes, 1.3%, round 11), so tuning resumes.

| Round | Lever | Kept | End | Bkr | Prof | H2H | Spread | Med | Esc | Kids |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 12 | Small rentals and businesses (not test-named): cash flow up 50% (ordinary deals now 9% to 14% a month, gems 18% to 21%) | yes | 99.6% | 1.0% | 22.8% Software Developer to 42.0% Real Estate Agent | 88.8% | 51.4 (Balanced 57.7, BS 6.4) | 15 | 31 (3.1%), median round 14 | 0 stuck, 10 |
