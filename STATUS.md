# STATUS

Progress and next steps for Freedom Loop. `CLAUDE.md` holds the rules; this file holds where we are. Update it at the end of every session.

## Morning summary (Stage D, 2026-10-27)

**Stage D is complete and `pnpm check` is green** (738 tests, 22 properties, zero lint warnings) on branch `feat/stage-d-tuning`. It is pushed, not merged, and has no PR. All ten balance targets are met, including the escape-rate target Andre added mid-session (at least 15% of standard games end by escape, replacing "escape reachable"). Tuning stopped at round 14 of 30. Andre then approved the three recommendations: the golden games, the one-month Wealth Builder fund, and raising the test-named deals.

| Target | Stage C | Final |
| --- | --- | --- |
| Escape or round limit (at least 70%) | 99.4% | 99.7% |
| Seats bankrupt (at most 20%) | 0.9% | 0.9% |
| Profession win rates (20% to 45%) | 4.4% to 59.9% | 28.2% (Farmer) to 44.1% (Doctor) |
| Wealth Builder beats Big Spender head to head (at least 70%) | n/a | 96.1% |
| Best strategy minus worst (at least 15 points) | n/a | 44.9 (Aggressive 49.9%, Big Spender 5.0%) |
| Median game (10 to 15 rounds) | 15 | 15 |
| Games ending by escape (at least 15%) | 0% | 35.9%, median escape round 13, earliest 5 |
| Kids: none stuck, median at or under 10 rounds | yes, 10 | yes, 10 |

Two other seed ranges also met all ten. Full report: `docs/sim/tuned.md`. Log of every round: `docs/sim/tuning-log.md`.

**What changed:**

1. **Bots.** Added Wealth Builder (one-month emergency fund, approved 2026-10-27; the spec said three) and Big Spender. The three original bots are unchanged. `pnpm sim` runs mixed, head-to-head, and kids suites and prints a pass/fail target table; `--summary` prints only the table.
2. **Deal returns.** Every rental and business pays 11% to 29% of its down payment a month, more than the 10% bank rate, so borrowing for an asset always pays (P5). These are game returns, not real ones (`docs/content-notes.md`, Stage D). The seven test-named deals were raised too, and five engine tests were re-pinned.
3. **Growth assets:** savings 2%/1%, CDs 3%/2%, index funds 4% to 6% growth with 2% payout.
4. **Board:** 13 Opportunity, 6 Life Choices, 3 Market, 1 Giving, 1 Setback (spec, Board).
5. **Smaller levers:** cheaper Setbacks, bigger windfalls, and more generous Market buyers. The card texts that quote these numbers are fixed.
6. **Golden games** re-recorded with Andre's approval: the four Stage C setups keep their endings (the four-player game moved to seed 1, because seed 0 now escapes), plus the first escape recording, `escape-three-players`.

**Open questions for Andre (none block Stage E):**

1. **Every deal now beats the bank,** so borrowing for any deal is always right: 355 of 359 escapers borrowed. Default: keep, and watch at the first playtest whether players learn "borrow for everything".
2. **Escapes are now 36%,** above the 15% floor, after the test-named deals were raised. The Doctor sits at 44.1%, close to the 45% ceiling. Default: keep; trim if a playtest feels too easy.
3. **Realism.** A small rental returns 140% to 230% a year. The honest alternative is more months (a higher round limit), which is a rule change. Default: keep for now.
4. **Board positions** changed from space 7 onward when the mix changed (Q8). Default: keep.
5. **Kids profession balance** is outside the targets; in kids games the Restaurant Server wins 13.7%. Default: revisit after playtests.

## Morning summary (Stage C, 2026-10-26)

Stage C is complete on branch `ccr-af56ad4e-r2r1ks` (not merged to main). `pnpm check` is green: 31 test files, 733 tests plus 22 fast-check properties at 1,000 runs, zero lint warnings. No dependencies were added and no engine source changed; only data, tests, docs, and one Node script.

**What was written:**

1. **16 professions** in `professions.json`, in the spec order. Salary is gross BLS median pay rounded to $100, so baseExpenses includes taxes. Starting cash flow is 12 to 17 percent of salary, and starting cash is 0.55 to 0.70 months of totalExpenses. Sources and reasoning are in `docs/content-notes.md`. The salaries came from memory of the BLS tables, not a fresh lookup: **spot-check them.**
2. **Full decks at spec counts:** 40 small, 25 big, 20 market, 30 Life Choices, 10 setback (125 cards). The 26 earlier cards kept their ids and numbers, and 99 cards are new. Every row of the plan's decisions table is covered (see the content notes).
3. **Content tests:** every principle on at least 3 cards; a free option on every Life Choices card; small-deal down payments of $5,000 or less and big-deal down payments of $6,000 to $50,000; growth percents in range (cards and windfall options); round kids numbers; every asset type, category, and effect used; text limits. Plus `packages/engine/src/professions.test.ts`, which checks the profession numbers rule through `createGame` and the selectors.
4. **`docs/cards.md`**, the catalog for your 45-minute realism read. It is generated by `node scripts/cards-catalog.mjs`; rerun it after any JSON change.
5. **Engine tests re-pinned.** 131 engine tests hard-coded the v1 Teacher (cash flow $700, cash $400) and Doctor. They now use the new numbers ($740 and $2,500), and every boundary case was recomputed so it still lands on its edge. None of the failures was an engine bug. One test needed a real setup change: the repayLargestLoan tie-break now builds its own tie, because the new Teacher's loans no longer tie.
6. **Golden games regenerated** (approved 2026-10-26): `limit-two-players` (Engineer vs Doctor, seed 1000, 29 turns), `limit-four-players` (Restaurant Server, Firefighter, Army Sergeant, Pharmacist; seed 0, 56 turns), `kids-three-players` (Teacher, Welder, Farmer; seed 53, 29 turns), and a new `last-standing-two-players` (Restaurant Server vs Welder, seed 1, 26 turns). An escape recording is still impossible: 6,000 seeds produced none.

**Simulator on the new content (not tuned; `docs/sim/stage-c-content.md`):** 99.4% of games end at the round limit, 0% by escape, 0.6% with one player left. 0.9% of seats go bankrupt. The median game is 43 turns. Win rates run from 4.4% (Restaurant Server, 12% bankrupt) to 59.9% (Doctor). Pharmacist and Software Developer are also above 45%. Kids mode: 100% end at the round limit and nobody is stuck. Reading for Stage D: Freedom percentage alone does not level salaries, because high earners have more cash to invest from turn one. Escape is still out of reach in 15 rounds.

**Questions for Andre: all three decided 2026-10-26, defaults approved as written.** Salary stays gross, the Doctor keeps the BLS floor for now, and deal returns are left for Stage D to tune.

1. **Gross vs take-home salary.** The spec says "median pay", so salary is gross and baseExpenses carries the taxes. Default: keep. The alternative is take-home salary with smaller baseExpenses, which shrinks every number but changes no ratios.
2. **Doctor salary.** BLS gives only a floor ($239,200 or more), and the Doctor is the strongest profession in the sim. Default: keep the floor for Stage C and let Stage D decide whether "early career" means a lower salary.
3. **Generous deal returns.** Small deals return 36 to 90 percent a year on cash, inherited from the v1 cards. Default: leave them for Stage D, which tunes returns against the escape and win-rate targets.

## Morning summary (Stage B, unattended, 2026-10-23)

Stage B is complete: the engine plays spec v2. Main is green (`pnpm check`: 30 test files, 689 tests plus 22 fast-check properties at 1,000 runs, zero lint warnings) and pushed to origin. Seven squash merges, one per item (#7 Payday every turn, #8 principles, #9 Life Choices, #10 growth assets, #11 round limit, #12 decision log facts, #13 property coverage), plus #14 for the golden games and this summary. No dependencies were added. No UI work was started.

**What changed, in the order the plan gave:**

0. **Payday every turn.** ROLL credits salary + passiveIncome − totalExpenses before the die and logs `payday` and `paydaySnapshot`; a player whose Payday puts them out does not roll, move, or resolve a space. END_TURN pays a seat it skips for a Setback, so a skipped turn still gets its month and can still go bankrupt. `board.json` is the spec's proposed 24-space mix and order; the Payday space kind is gone.
1. **Principles.** `@ff/shared/principles`: `PRINCIPLE_IDS`, the `PRINCIPLES` table (name, adult text, kids text), `DECISION_PRINCIPLES` for rule-driven decisions (bank loan P5, Setback loan P1, repay P5, cancel subscription P7, giving P10). Every card carries `principles`, `kidsText` (90 max), `adultText` (160 max), `kidsOk`; no em dashes. `description` and `requiresKidsMode` are gone. Kids mode plays only `kidsOk` cards. Every decision event carries `principles`.
2. **Life Choices.** The `lifeChoices` deck and space replace `lifestyle`. Each card has 2 or 3 options with typed effects (`payCash`, `gainCash`, `addLoan`, `addSubscription`, `investGrowth`, `repayLargestLoan`). `CHOOSE_LIFE_OPTION { optionId }` replaces PAY_LIFESTYLE; `INSUFFICIENT_CASH` when short (BORROW first in standard mode), `INVALID_OPTION` for an unknown id or a non-kidsOk option in kids mode. Subscriptions are `subscription` liabilities with principal 0; REPAY cancels one at no cost under P7. Assets are now a union: property, stock lot, growth asset.
3. **Growth assets.** Savings, CD, and index deal cards carry `growthPercent` and `payoutPercent`; `price` is the minimum investment; `BUY { amount }` invests in $100 steps up to cash. marketValue grows at every Payday before cash flow is credited (`valueChanged`); cash flow is `pct(marketValue, payoutPercent)`, derived by `assetCashFlow`. Market cards gain `changeMarketValue { percent }`. SELL_ASSET sells a growth asset at marketValue any time nothing is pending after the roll. Bankruptcy sells growth assets at half marketValue. `netWorth` counts them at marketValue.
4. **Round limit.** 15 rounds standard, 10 kids. END_TURN logs `roundCompleted` when the turn wraps, and the END_TURN that completes the final round ends the game with `gameEnded { reason: 'roundLimit', winnerId }` and the winner current. Winner: highest `freedomPercent`, then cash, then `netWorth`, then the earlier seat. Escape and last-standing endings also log `gameEnded`. `roundNumber` is derived from the log.
5. **Decision log facts.** `passed` records `monthlyCashFlow`, `downPayment`, `affordable`; `borrowed` records `purpose` (asset, want, none, or setback with the card); `choseLifeOption` records the two numbers for the chosen, cheapest, and priciest options; `paydaySnapshot` carries `roundNumber`; `declinedMarket` is its own event.
6. **Property suite.** The walks reach all 13 actions, all 6 Life Choices effects, all 5 Market effects, and a round-limit ending; a growth asset's marketValue only ever falls through a Market card; kids games never get stuck. New invariants: subscriptions have principal 0, growth assets have marketValue ≥ 0 and a card that could have produced them, card liabilities point at a Life Choices card, a playing game never passes the round limit.

The sim bots play v2 through `reduce` only: they pick Life Choices options by `optionCost` (cautious and balanced take the smallest monthly change, aggressive the priciest it can afford) and invest spare cash in growth assets.

**Golden games regenerated** (Andre's standing approval from the Stage B prompt; the commit names the rule changes). All three recordings end at the round limit and are named for it: `limit-two-players` (Engineer vs Doctor, seed 1000, 29 turns), `limit-four-players` (seed 0, 58 turns), `kids-three-players` (seed 53, 29 turns). In 6,000 seeds each, no bot game escaped within 15 rounds and no four-player game ended with one player standing, so there is no honest escape or last-standing recording yet; they come with Stage C content.

**Simulator (docs/sim/v2-first-run.md, 1,000 standard games, 2 to 4 bots):** 99.8% end at the round limit, 0 by escape, 0.2% with one player left; median 42 turns (14 rounds per player); 0.2% of seats bankrupt. Win rates: Nurse 43.5%, Electrician 41.4%, Engineer 40.6%, Police Officer 30.1%, Doctor 27.6%, Teacher 14.8%. Kids mode (docs/sim/v2-first-run-kids.md, 1,000 games): 100% round limit, none stuck, median 29 turns. Reading for Stage D: the 15-month horizon is now the whole game, and the 26 starter cards cannot produce an escape in it; the Teacher's low salary leaves no cash to invest, so Freedom percentage alone did not level the professions. Before the round limit existed, the 4%-a-month index fund made 98% of long games end by escape, so growth percents are the lever to watch.

**Questions for Andre: all ten decided 2026-10-26, defaults approved as written.** Q1 to Q9 are written into `docs/spec.md`; Q10 (escape and last-standing golden games) carries into Stage C. Andre also approved regenerating the golden games once at the end of Stage C.

1. **Free option rule.** The spec requires an option with no monthly cost on every Life Choices card. The content test enforces more: an option with nothing today and nothing monthly (no payCash, loan, subscription, or investment) that is `kidsOk` when the card is. That is what makes "a kid is never stuck" true. Default: keep the stronger rule and write it into the spec.
2. **Effect field names.** `addLoan.kind` and `investGrowth.type` from the spec are `loanKind` and `assetType` in the schema, because `kind` is the effect discriminator. Default: keep.
3. **Growth card minimum.** A growth deal card's `price` is its minimum investment (no separate field). Default: keep.
4. **Asset types.** The spec lists deal types as "rental, business, land, stock, fund (growth assets: savings, cd, index)". The code has `savings`, `cd`, `index` and no `fund`. Default: keep.
5. **Growth sales before the roll.** Spec: "sold with SELL_ASSET at any time when pending is none." The engine also requires the roll to have happened (turn step 4), so SELL_ASSET before rolling is `MUST_ROLL_FIRST`. Default: keep, matching REPAY and BORROW.
6. **Partial paydown.** `repayLargestLoan` pays down the highest-payment loan by up to the amount. A percent-based loan (student, car, credit, bank) gets its payment recomputed from the new principal; a card loan (lifestyle, Life Choices car loan) keeps its stated payment while the principal shrinks. Default: keep.
7. **Round completion.** A round completes when the turn passes to a seat at or before the ending seat, after skipping out players and consuming skipped turns. `roundNumber` counts `roundCompleted` log events (an event that happened, not a stored field). Default: keep.
8. **Crash rounding.** `changeMarketValue` goes through `pct`, which floors, so a crash costs up to $1 more than the exact percent. Default: keep; every percent in the engine floors.
9. **Sold event principles.** A sold asset carries its card's principles; for a growth asset from a windfall that is the card's tags (P4, P5, P8), while the matching `bought` event carries the option's tags. Default: keep; the debrief attributes "growth asset held" to P8 regardless.
10. **Golden set without an escape.** See above. Default: add escape and last-standing recordings in Stage C once the decks allow them.

## Stage A, spec v2 (2026-10-23)

- `docs/spec.md` rewritten as v2: ten principles, 16 professions with a numbers rule, Life Choices deck (every card has an option with no monthly cost), growth assets, 15-round limit and Freedom percentage, decision log facts, and the debrief with its attribution table. v1 rules not changed are kept and labeled.
- `docs/plan-wealth-edition.md` added: build stages A to H and their prompts.
- CLAUDE.md spec gaps now point at the spec's v2 open questions. Kids-who-cannot-pay and the Freedom track are resolved by v2.
- The six overnight decisions are confirmed.
- No code changed.

## Morning summary (overnight session, 2026-10-23)

Stages 3 and 4 are complete. Main is green (`pnpm check`: 27 test files, 526 tests including the 7 fast-check properties at 1,000 runs each, zero lint warnings) and pushed to origin. No UI work was started.

**Completed and merged to main, one squash commit each:**

- PR #4 (shared schemas and fixtures) and PR #5 (engine through BORROW), which were still open, squash-merged so the night's work could build on main.
- Docs: Setback and bankruptcy decisions written into `docs/spec.md`, removed from the CLAUDE.md spec gaps (now 3 gaps: undo, kids mode, Freedom track); `tsx` marked approved.
- Stage 3, test first: REPAY, PAY_LIFESTYLE, SELL_ASSET, ACCEPT_MARKET, DECLINE_MARKET, GIVE, SKIP_GIVE. All 13 reducer actions exist. Then Setback resolution, automatic bankruptcy sales, `skipsNextTurn`, END_TURN skipping, and game end when fewer than two players remain.
- Stage 4.1: `checkInvariants`, `replay`, and the fast-check property suite (`pnpm test:props`, `FC_NUM_RUNS` honoured). It caught one over-strict invariant on its first full run (an out player stays current until their END_TURN), which was fixed in the invariant, not the engine.
- Stage 4.2: `pnpm sim` (bots in `packages/engine/sim/`, run with `tsx`); first 1,000-game report saved to `docs/sim/first-run.md`. No game numbers were changed.
- Stage 4.3: three golden games in `packages/engine/src/test/golden/`, replayed by `golden.test.ts`.

**Test counts:** 267 tests before tonight → 526 now, 7 of them fast-check properties that each play up to 1,000 random games.

**Simulator headline (1,000 standard games, 2 to 4 bots):** 0.3% of games end by escape, 99.1% end with one player left after everyone else goes bankrupt, median length 100 turns (2 players: 58), 66.6% of seats go bankrupt. Win rate by profession: Doctor 65%, Engineer 44%, Nurse 31%, Electrician 28%, Police Officer 23%, Teacher 9.5%. Both spec targets (no profession above 25%, median under 60 turns) are missed. Details and a reading in "Simulator first run" below.

**Questions waiting for Andre:** none blocked an action. One decision is worth making before UI work: whether to fill out the card decks to the spec's counts before judging balance, since the simulator says the starter decks produce a game of attrition. The six "Decisions made alone tonight" below are readings of the spec made to keep moving; each is pinned by a test and written into `docs/spec.md`, so overruling one is a spec edit plus a test edit. Dependencies added tonight: `tsx` (root, approved) and `@types/node` for the engine's `sim/` folder (previously approved for web).

## Overnight session, 2026-10-23 (unattended)

Working alone on Andre's overnight plan: finish Stage 3 (the remaining engine actions), then Stage 4.1 (property suite), 4.2 (simulator), 4.3 (golden games). No UI work. One branch per action, squash-merged to main when `pnpm check` is green, main pushed after each merge.

### Stage 3 progress

| Action | State | Notes |
| --- | --- | --- |
| ROLL, END_TURN, Payday | merged (#5) | before tonight |
| CHOOSE_DEAL_SIZE, BUY, PASS, BORROW | merged (#5) | before tonight |
| REPAY | merged | `INVALID_LIABILITY` for a mortgage, an unknown id, or another player's loan |
| PAY_LIFESTYLE | merged | `INVALID_METHOD` when the card does not offer that method; loan allowed in kids mode |
| SELL_ASSET | merged | stock lots only, at redraw; `INVALID_ASSET` for any other asset |
| ACCEPT_MARKET | merged | buyout needs `assetId` when several qualify; `liquidate` helper in `sales.ts` pays the mortgage first |
| DECLINE_MARKET | merged | `MARKET_EFFECT_MANDATORY` unless every effect is a buyout or nothing qualifies |
| GIVE | merged | `INSUFFICIENT_CASH` when 10% floors to $0 |
| SKIP_GIVE | merged | |
| Setback resolution + bankruptcy | merged | `skipsNextTurn` on Player; END_TURN consumes skips and ends the game when fewer than two players remain |
| Stage 4.1 property suite | merged | `invariants.props.test.ts`, 1,000 runs default, `FC_NUM_RUNS` honoured; found and fixed one over-strict invariant |
| Stage 4.2 simulator | merged | `pnpm sim`, report in `docs/sim/first-run.md`; no game numbers changed |
| Stage 4.3 golden games | merged | three recorded games in `src/test/golden/`, never regenerate |

### Simulator first run (docs/sim/first-run.md)

1,000 standard games, 2 to 4 bots, three simple strategies, 400-turn cap. Headline numbers, with the spec targets of "no profession above 25% win rate" and "median game under 60 turns":

| Measure | First run |
| --- | --- |
| Games ending by escape | 0.3% |
| Games ending with one player left (everyone else bankrupt) | 99.1% |
| Median game length, turns | 100 (2 players: 58, 3: 102, 4: 137) |
| Seats that went bankrupt | 66.6% |
| Win rate: Doctor / Engineer / Nurse / Electrician / Police / Teacher | 65% / 44% / 31% / 28% / 23% / 9.5% |

Reading, for Andre to judge (no numbers were changed): with the current rules and the 21-card starter decks, the game is decided by attrition, not escape. The likely drivers are the mandatory Lifestyle cards (5 of 24 spaces, 3 cards recycling, loans that add $90 to $380/mo), Setback auto-loans at 10%/mo, and bankruptcy sales at half price with the mortgage paid first, which usually return nothing. Escapes need roughly $2,600 to $9,200/mo of passive income from 11 deal cards. Win rate tracks starting salary almost exactly, so the Doctor's cushion matters more than any play decision. The bots are simple, so a smarter buying strategy might escape more often; the simulator can be rerun after any card or number change with `pnpm sim`, and `--games`, `--seed`, `--players 2-6`, `--mode kids`, and `--max-turns` are accepted.

### Questions for Andre

None blocked an action tonight. The simulator reading above is the one thing most worth a decision: whether the Phase 1 target is still "first escape wins" with these numbers, or whether the card decks need filling out (spec counts: 40 small, 25 big, 20 market, 25 lifestyle, 10 setback) before balance means anything.

### Decisions made alone tonight (confirmed by Andre 2026-10-23)

These are engine readings of the spec that the spec and tonight's decisions did not state outright. Each is written into `docs/spec.md` so the rule has one home; overruling one means editing the spec and the test that pins it.

1. **What triggers bankruptcy.** Setback costs always auto-borrow, so the only required payment that can fail is a Payday whose negative cash flow would take cash below zero. That Payday runs the automatic sales; no auto-borrow first (borrowing against a negative cash flow only deepens it). Written into spec, Core rules, Bankruptcy.
2. **Game end with fewer than two players in.** When bankruptcy leaves one player, the game ends (phase `finished`) with that player current. Nobody is marked `hasEscaped`. Spec, Core rules, Bankruptcy.
3. **Kids mode Setback space does nothing.** The spec says kids mode has "no Setback spaces", so landing there in kids mode is inert. Spec, Core rules, Setback.
4. **Market resolution.** ACCEPT_MARKET applies every effect to qualifying assets (buyout sells one, named by `assetId` when there are several); DECLINE_MARKET is legal only when every effect is an `offerBuyout` or the player owns nothing that qualifies. A stock split leaves `monthlyCashFlow` and `purchasePrice` unchanged. Spec, Card decks, Market card resolution.
5. **GIVE with less than $10 cash is rejected** (`INSUFFICIENT_CASH`), so a Favor token is never free. Spec, Card decks, Giving.
6. **Partial stock sales** shrink the lot's `purchasePrice` and `downPaid` in proportion, floored. Spec, Card decks, Stock rules.

## Current state (2026-10-27, after Stage D)

The repo is a pnpm workspace with three packages:

| Package | Purpose | Contents today |
| --- | --- | --- |
| `@ff/shared` | types, Zod schemas, card and profession JSON, principles, `formatMoney` | schemas, types, principles, and fixtures listed below; `formatMoney` not yet written |
| `@ff/engine` | pure reducer, selectors, rng, invariants, sim | `reduce`, `createGame`, 13 actions, selectors, `payday`, `rng`, `pct`, `decks`; test helpers in `src/test/` |
| `@ff/web` | React 18 + Vite, routes `/table` and `/player` | placeholder `App`, one render test, `@` alias |

`@ff/engine` (all in `packages/engine/src/`):

| File | Contents |
| --- | --- |
| `reduce.ts` | `reduce(state, action)`. Guards phase and `NOT_YOUR_TURN`, dispatches to `actions/`, appends the log entry with the pre-action `turnNumber`. |
| `payday.ts` | `creditPayday(state, playerId)`: grows every growth asset by `pct(marketValue, growthPercent)` (`valueChanged`), credits salary + passiveIncome − totalExpenses with the grown values (`payday`), writes `paydaySnapshot` (playerId, passiveIncome, totalExpenses, cash, roundNumber), then runs `resolveBankruptcy` if cash is below zero. Used by ROLL for the current player and by END_TURN for a skipped seat. |
| `actions/roll.ts` | Payday first; a player who goes out there does not roll. Then rolls, moves, resolves the space: Opportunity → `chooseDealSize` (kids: small deal → `buyOrPass`), Market → `marketChoice`, Life Choices → `lifeChoice`, Giving → `giveOrSkip`, Setback → pay at once with auto-borrow in $1,000 steps (`borrowed` with purpose `setback` and the card) and `skipsNextTurn`. Kids mode: Setback does nothing. |
| `actions/endTurn.ts` | Needs `pending: none` and a ROLL this turn. Escape → `finished`, `gameEnded escape`. Fewer than two players in → `gameEnded lastStanding`. Otherwise advances past out players, paying and clearing skipped seats; when the turn wraps to a seat at or before the current one the round is complete: `roundCompleted`, or at the limit `gameEnded roundLimit` with the winner (`rankPlayers`) current. |
| `actions/chooseDealSize.ts` | Draws from `smallDeals` or `bigDeals` into `buyOrPass`; stocks get `sharePrice` rolled inside `priceRange`. |
| `actions/buy.ts` | Property: pays `downPayment`, adds the asset and a `mortgage` liability when financed, keeps the card. Stock: `shares` × `sharePrice`, a lot with `floor(shares × dividendPerShare)`, card to the discard pile. Growth: `amount` in $100 steps from the card minimum (`price`) up to cash (`INVALID_AMOUNT`, `INSUFFICIENT_CASH`), a growth asset at that marketValue, card to the discard pile. |
| `actions/pass.ts` | Discards the deal; `passed` records `monthlyCashFlow`, `downPayment`, `affordable`. |
| `actions/borrow.ts` | Legal when pending is `none`, `buyOrPass`, or `lifeChoice`, after the roll, standard mode only. `borrowed` records `purpose` asset, want, or none. |
| `actions/repay.ts` | Pays a loan in full, or cancels a subscription at no cost (`repaid` with principles P7). Never a mortgage. |
| `actions/chooseLifeOption.ts` | Valid only with `pending: lifeChoice`. `INVALID_OPTION` for an unknown id or a non-kidsOk option in kids mode; `INSUFFICIENT_CASH` when cash is below the option's costToday. Logs `choseLifeOption` (chosen, cheapest, priciest numbers) then applies effects in order: `cashChanged`, `loanAdded`, `subscriptionAdded`, `bought` (investGrowth), `paidDown` or `repaid` (repayLargestLoan). Ids: `${playerId}-${cardId}-${log.length}-${effectIndex}`. Card to the discard pile. |
| `actions/sellAsset.ts` | With `pending: none` after the roll: a growth asset sells whole at marketValue (`MUST_ROLL_FIRST`, `INVALID_ASSET`, `INVALID_SHARES`; a stock or property here is `INVALID_FOR_PENDING`). With `pending: buyOrPass` on a stock card: the v1 lot sale at the rolled price, whole or partial. |
| `actions/acceptMarket.ts` | Applies effects in order to qualifying assets: `offerBuyout`, `forceSale`, `changeCashFlow` (stored cash flows only), `splitShares`, `changeMarketValue` (growth assets, `pct` of marketValue, floor at $0, `valueChanged`). |
| `actions/declineMarket.ts` | Legal when every effect is a buyout or nothing qualifies; logs `declinedMarket`. |
| `actions/give.ts`, `actions/skipGive.ts` | 10% of cash and a Favor token (`INSUFFICIENT_CASH` at $0), or skip. Both carry P10. |
| `bankruptcy.ts`, `sales.ts` | Automatic sales lowest cash flow first (ties lowest purchasePrice) at `bankruptcyPrice` (half purchasePrice, or half marketValue for growth); `liquidate` retires a linked mortgage first and returns a property card to its deck; stock lots and growth assets simply disappear. |
| `selectors.ts` | `assetCashFlow`, `passiveIncome`, `debtPayments`, `totalExpenses`, `monthlyCashFlow`, `canEscape`, `freedomPercent`, `assetValue`, `netWorth`, `roundLimit`, `roundNumber`, `rankPlayers`, `winner`, `optionCost`, `cheapestOption`, `priciestOption`, `largestLoan`, `paidDown`, `currentPlayer`, `playerById`, `professionOf`, `hasRolledThisTurn`. |
| `invariants.ts` | Schema, non-negative cash for players in, out players hold nothing, mortgages finance a held asset, subscriptions have principal 0, card liabilities point at a Life Choices card, growth assets have marketValue ≥ 0 and a card that could produce them, deck conservation (stock lots and growth assets never take a card out), pending cards of the right deck, the round limit, log turn numbers. |
| `invariants.props.test.ts` | 22 properties: invariants after every accepted action (standard and kids), coverage of every action and effect and a round-limit ending, growth monotonic except through Market cards, only the current player acts, END_TURN only with pending none, one log entry per action, replay rebuilds the state, byte-identical determinism, standard and kids games never stuck, the round limit holds, wrong-player actions are `NOT_YOUR_TURN`. |
| `test/golden/*.json` + `test/golden.test.ts` | Five Stage D recordings (approved 2026-10-27): two- and four-player round-limit games, a kids game, a last-standing game, and the first escape game. Never regenerate without Andre's approval. |
| `test/` | `deepFreeze`, `apply`/`reject`, `fixtures.ts` (`twoPlayerGame`, `withGame`, `withPlayer`, `withZeroCashFlow`, `aboutToRoll`, `rolledClean`, `onTopOfDeck`, `offered`, `drawn`), `walk.ts` (candidate actions for every pending state, including CHOOSE_LIFE_OPTION, BUY by amount, growth sales; idle-turn BORROW on one choice in five). |
| `../sim/` | `bots.ts` (cautious, balanced, aggressive, Wealth Builder, Big Spender), `simulate.ts` (random or fixed lineups, final freedomPercent per seat, escape rounds), `run.ts` (three suites: mixed, head to head, kids; target table with pass/fail; `--summary`, `--only`). |

`@ff/shared` (all in `packages/shared/src/`):

| File | Contents |
| --- | --- |
| `principles.ts` | `PRINCIPLE_IDS` P1 to P10, `PrincipleIdSchema`, `PrinciplesSchema`, `PRINCIPLES` (name, adultText, kidsText), `DECISION_PRINCIPLES` |
| `cards.ts` | `DECK_IDS` (smallDeals, bigDeals, market, lifeChoices, setback), `ASSET_TYPES` (stock, rental, business, land, savings, cd, index), `GROWTH_ASSET_TYPES`, `INVEST_STEP`, card base (id, title, principles, kidsText ≤ 90, adultText ≤ 160, kidsOk, no em dashes), `DealCardSchema` (growth cards: growthPercent, payoutPercent, price = minimum), `MarketCardSchema` (effects + `changeMarketValue`), `LifeChoicesCardSchema` (category, 2 to 3 options with unique ids, one with no monthly cost), `LifeOptionSchema`, `LifeEffectSchema`, `SetbackCardSchema` |
| `professions.ts` | `LIABILITY_KINDS` (+ subscription), `StartingLiabilityKindSchema` (no lifestyle, no subscription), `LIABILITY_PAYMENT_PERCENT` |
| `board.ts` | `SPACE_KINDS` (opportunity, market, lifeChoices, giving, setback), `BOARD_SIZE = 24` |
| `state.ts` | `AssetSchema` union (property, stock, growth) with `isGrowthAsset`; `LiabilitySchema` (sourceCardId rules, subscription principal 0); `PendingSchema` (`lifeChoice` replaces `payLifestyle`); `ROUND_LIMIT`; `LogEventSchema` with the v2 events below |
| `actions.ts` | 13 actions; `CHOOSE_LIFE_OPTION { optionId }` replaces PAY_LIFESTYLE; `BUY { shares? , amount? }` |
| `data/` | 125 cards (40 small deals, 25 big deals, 20 market, 30 Life Choices, 10 setback) with Stage D tuned numbers, `board.json` Stage D mix (13 Opportunity, 6 Life Choices, 3 Market, 1 Giving, 1 Setback), 16 professions. Catalog in `docs/cards.md`, sources and tuning notes in `docs/content-notes.md` |

Log event kinds: `payday`, `paydaySnapshot`, `valueChanged`, `rolled`, `moved`, `drewCard`, `sharePriceRolled`, `passed`, `declinedMarket`, `borrowed`, `repaid`, `paidDown`, `loanAdded`, `subscriptionAdded`, `choseLifeOption`, `bought`, `sold`, `cashFlowChanged`, `sharesSplit`, `gave`, `skippedGive`, `setback`, `wentOut`, `turnSkipped`, `roundCompleted`, `gameEnded`, `cashChanged`.

Tooling and package-manager notes from the scaffold still hold (see the sections below).

## Next step

Stage D is done (2026-10-27) on `feat/stage-d-tuning`, green. Next: merge to main, then Stage E (debrief engine).

## Deferred from the scaffold

Not installed or configured yet, each waiting for the session that needs it:

- `formatMoney` in `@ff/shared` (first UI session, or whenever the first display code needs it)
- Tailwind v3, shadcn/ui, Zustand (first UI session)
- A router for `/table` and `/player`. `react-router` is not on the approved dependency list; ask before adding.
- Playwright + `@axe-core/playwright` and the real `pnpm e2e` script
- GitHub Actions CI (typecheck, lint, test, test:props on PRs)
- Vercel project link. When linking, set `HUSKY=0` in the Vercel environment so `prepare` skips hook install.
- README beyond the title line

## Playtests

None yet. Notes go in `docs/playtests/YYYY-MM-DD.md`.
