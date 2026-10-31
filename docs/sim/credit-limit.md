# Balance simulation

Generated 2026-10-31 by `pnpm sim`. Bots are the five strategies in `packages/engine/sim/bots.ts`: Cautious, Balanced, Aggressive, Wealth Builder, Big Spender. The report measures the rules and numbers, not human play. A round is a month for the whole table; the game ends after round 15 (kids 10) unless someone escapes first.

## Targets (spec v2, Engineering practices)

| Target | Value | Met |
| --- | --- | --- |
| Games ending by escape or the round limit (at least 70%) | 99.6% | yes |
| Seats that went bankrupt (at most 20%) | 1.0% | yes |
| Every profession win rate between 20% and 45% | 22.0% (Restaurant Server) to 42.9% (Doctor) | yes |
| Best strategy beats worst by at least 15 points | 45.4 points (Balanced 50.7%, Big Spender 5.4%) | yes |
| Median game between 10 and 15 rounds | 15 | yes |
| Standard games ending by escape (at least 15%) | 181 (18.1%), median escape round 14, earliest 5 | yes |
| Wealth Builder beats Big Spender head to head (at least 70%) | 94.3% | yes |
| Kids games finished, none stuck | 1000 of 1000 | yes |
| Kids median at or under 10 rounds | 10 | yes |

