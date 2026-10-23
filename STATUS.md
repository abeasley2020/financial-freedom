# STATUS

Progress and next steps for Freedom Loop. `CLAUDE.md` holds the rules; this file holds where we are. Update it at the end of every session.

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

## Current state (2026-10-23)

The repo is a pnpm workspace with three packages:

| Package | Purpose | Contents today |
| --- | --- | --- |
| `@ff/shared` | types, Zod schemas, card and profession JSON, `formatMoney` | schemas, types, and fixtures listed below; `formatMoney` not yet written |
| `@ff/engine` | pure reducer, selectors, rng, invariants, sim | `reduce`, `createGame`, the actions in the table above, selectors, `rng`, `pct`, `decks` (draw + reshuffle); test helpers in `src/test/` |
| `@ff/web` | React 18 + Vite, routes `/table` and `/player` | placeholder `App`, one render test, `@` alias |

`@ff/engine` today (all in `packages/engine/src/`):

| File | Contents |
| --- | --- |
| `reduce.ts` | `reduce(state, action)`. Guards phase and `NOT_YOUR_TURN`, dispatches to `actions/`, appends the log entry with the pre-action `turnNumber`. Unlisted actions return `NOT_IMPLEMENTED`. |
| `actions/roll.ts` | Rolls, moves, credits one Payday per Payday space passed or landed on (each using the player as they then stand), resolves the space: Opportunity → `chooseDealSize` (kids mode draws a small deal → `buyOrPass`), Market → draw → `marketChoice`, Lifestyle → draw → `payLifestyle`, Giving → `giveOrSkip`, Payday → none, Setback → draw, pay `cashCost` at once (auto-borrow the smallest $1,000 multiple covering the shortfall as a `bank` liability and set `skipsNextTurn`; also set it on `card.skipTurn`), card to the setback discard pile, pending none. Kids mode: Setback does nothing. A Payday that takes cash below zero calls `resolveBankruptcy`; a player who goes out does not resolve the space. Events: `rolled`, `moved`, `payday`, `drewCard`, `borrowed`, `cashChanged`, `setback`, plus bankruptcy events. |
| `bankruptcy.ts` | `resolveBankruptcy(state, playerId)`: while cash < 0, `liquidate` the asset with the lowest `monthlyCashFlow` (ties: lowest `purchasePrice`, then holding order) at `pct(purchasePrice, 50)`; if assets run out, set `isOut`, cash 0, event `wentOut { shortfall }`. |
| `actions/chooseDealSize.ts` | Valid only when `pending` is `chooseDealSize`. Draws from `smallDeals` or `bigDeals` into `pending: buyOrPass`. A stock card gets `sharePrice` rolled inside its `priceRange` (inclusive) at draw time, advancing `rngState`, logged as `sharePriceRolled`. Empty deck → `pending: none`. |
| `actions/buy.ts` | Valid only when `pending` is `buyOrPass`. Non-stock: pays `downPayment` (`INSUFFICIENT_CASH` if short), adds the asset with the card's numbers, adds one `mortgage` liability (`monthlyPayment: 0`, `assetId`) when financed, keeps the card as the asset. Stock: `shares` required and at most `sharesAvailable` (`INVALID_SHARES`), cost `shares × pending.sharePrice`, lot with `monthlyCashFlow = floor(shares × dividendPerShare)`, card back to the discard pile. Asset id is `${playerId}-${cardId}-${log.length}`; mortgage id is that plus `-mortgage`. Events: `cashChanged`, `bought`. |
| `actions/pass.ts` | Valid only when `pending` is `buyOrPass`. Sends the card to its deck's discard pile and clears `pending`. Same for a stock, which is how a holder declines to buy or sell. Event: `passed`. |
| `actions/borrow.ts` | Legal when `pending` is `none`, `buyOrPass`, or `payLifestyle` (spec, turn step 4), after a ROLL this turn, standard mode only (`NOT_ALLOWED_IN_KIDS_MODE`). Never changes `pending`. Amount must be a positive multiple of `BORROW_STEP` (`INVALID_AMOUNT`). Adds cash and one `bank` liability with `monthlyPayment = pct(amount, 10)`, id `${playerId}-bank-${log.length}`. Events: `cashChanged`, `borrowed`. |
| `actions/repay.ts` | Legal only with `pending: none` after a ROLL this turn (spec, turn step 4). Pays the liability's `principal` from cash (`INSUFFICIENT_CASH`) and removes it. `INVALID_LIABILITY` for a mortgage, an id the player does not hold, or another player's loan. Starting loans, bank loans, and lifestyle loans are all repayable. Allowed in kids mode. Events: `cashChanged`, `repaid`. |
| `actions/payLifestyle.ts` | Valid only when `pending` is `payLifestyle`. `cash` pays `cashCost` (`INSUFFICIENT_CASH`); `loan` adds a `lifestyle` liability (`principal: loanPrincipal`, `monthlyPayment: monthlyCost`, `sourceCardId`), id `${playerId}-lifestyle-${log.length}`. `INVALID_METHOD` when the card lacks that option. Card to the lifestyle discard pile. Events: `cashChanged` + `paidLifestyle` (cash), `paidLifestyle` with `liabilityId` (loan). |
| `actions/sellAsset.ts` | Valid only when `pending` is `buyOrPass` for a stock card (any other offer → `INVALID_FOR_PENDING`). `assetId` must be the current player's lot of that stock (`INVALID_ASSET`); `shares` defaults to the whole lot and may not exceed it (`INVALID_SHARES`). Proceeds `shares × pending.sharePrice`. A partial sale keeps the lot with `purchasePrice`/`downPaid` scaled down (floored) and `monthlyCashFlow = floor(remaining × dividendPerShare)`. Card to the discard pile. Events: `cashChanged`, `sold`. |
| `actions/acceptMarket.ts` | Valid only when `pending` is `marketChoice`. Applies the card's `effects` in order to the current player's assets whose type is in `appliesTo`: `offerBuyout` sells one (the only qualifying asset, or the one named by `assetId`; `INVALID_ASSET` when several qualify and none is named, or when `assetId` does not qualify), `forceSale` sells all, `changeCashFlow` adds `delta` to each, `splitShares` multiplies each lot's `shares`. Nothing qualifying → card discarded, no events. Market card to the market discard pile. Events: `sold` (+ `cashChanged` when the net is positive), `cashFlowChanged`, `sharesSplit`. Helpers `qualifyingAssets`, `marketCardOf`, `discardMarketCard` are shared with DECLINE_MARKET. |
| `actions/declineMarket.ts` | Valid only when `pending` is `marketChoice`. Legal when every effect is an `offerBuyout` or the player owns nothing the card applies to; otherwise `MARKET_EFFECT_MANDATORY` (resolve with ACCEPT_MARKET). Discards the card with no effect. Event: `passed`. |
| `actions/give.ts` | Valid only when `pending` is `giveOrSkip`. Pays `pct(cash, 10)` and adds one Favor token; `INSUFFICIENT_CASH` when the gift would be $0. Events: `cashChanged`, `gave`. |
| `actions/skipGive.ts` | Valid only when `pending` is `giveOrSkip`. Clears the decision. Event: `skippedGive`. |
| `invariants.ts` | `checkInvariants(state)` returns violations; `assertInvariants` throws them. Checks the Zod schema (integers, non-negative cash, strict shapes, one pending), per-player rules (out players hold no assets, mortgages finance a held asset, unique ids), the current player (an out player may be current only between their own ROLL and END_TURN), deck conservation per deck (draw + discard + held non-stock cards + pending card = the mode's deck, no duplicates), pending cards of the right deck, and log turn numbers. `fullDeck(state, deck)` is the mode-aware deck. |
| `replay.ts` | `replay(initial, actions)` re-applies a log; throws if any action is rejected. |
| `invariants.props.test.ts` | fast-check suite. A game is `(seed, mode, professions[], choices[])`; `test/walk.ts` turns each choice number into a candidate action from the current pending state (mostly legal, some deliberately off, every 23rd from the wrong player). Properties: invariants after every accepted action (standard and kids), only the current player is accepted, END_TURN only with pending none, one log entry per accepted action, replay rebuilds the final state, byte-identical determinism, standard games never get stuck, kids games get stuck only on an unpayable Lifestyle card (spec gap 2), wrong-player actions always `NOT_YOUR_TURN`. `test/fcConfig.ts` reads `FC_NUM_RUNS` (default 1,000). Each property has a 120 s timeout because `pnpm test` runs it in parallel with every other file. |
| `test/golden/*.json` + `test/golden.test.ts` | Three recorded full games, each `{ description, strategies, setup, ending, actions, expected }`: `escape-two-players` (Engineer vs Doctor, seed 1119, 97 turns, ends by escape), `attrition-four-players` (seed 7, 134 turns, three bankruptcies, ends with one player standing), `kids-three-players` (seed 53, 33 turns, stops where a child cannot pay a cash-only Lifestyle card, spec gap 2). The test replays each log from `createGame(setup)` and requires `toEqual` with the recorded state, checks the log matches the actions, and runs `assertInvariants`. Generated once on 2026-10-23 by playing the sim bots through the engine; the generator was deliberately not committed. A diff here means a rule changed: say which in the commit and get Andre's approval before touching the files (`-u` is never the answer). |
| `../sim/` (outside `src/`, own `tsconfig.json` with Node types, Node globals allowed in ESLint) | `bots.ts` (`decide(state, strategy)` returns moves best first; strategies cautious, balanced, aggressive differ in cash cushion, willingness to borrow for a deal, and required return per $1,000 down), `simulate.ts` (`playGame`, `simulate` → `SimReport`; seating drawn from the engine PRNG so a report is reproducible), `run.ts` (CLI, Markdown report, `--out`). Bots only ever call `reduce`; a bot with no accepted move throws, which the 1,000-game run never hit. |
| `sales.ts` | `liquidate(state, playerId, asset, proceeds, reason)`: removes the asset, retires its linked mortgage first (`mortgagePaid = min(proceeds, principal)`), credits the rest, returns a deal card to its deck's discard pile (a stock lot just disappears). Shared by Market sales and bankruptcy. |
| `actions/endTurn.ts` | Needs `pending: none` and a ROLL this turn. If the player is in and `canEscape`, sets `hasEscaped` and `phase: finished` without advancing. If fewer than two players are in, `phase: finished` with the survivor current. Otherwise increments `turnNumber` and moves to the next seat that is in; a seat with `skipsNextTurn` is passed over once, its flag cleared, event `turnSkipped`. |
| `selectors.ts` | `passiveIncome`, `debtPayments`, `totalExpenses`, `monthlyCashFlow`, `canEscape`, `currentPlayer`, `playerById`, `professionOf`, `hasRolledThisTurn` (derived from the log, so no "rolled" flag on state). |
| `createGame.ts` | Initial state from `{ id, mode, seed, players }`. Starting liabilities get `monthlyPayment = pct(principal, LIABILITY_PAYMENT_PERCENT[kind])`. Shuffles every deck from the seed. Standard mode drops `requiresKidsMode` cards; kids mode drops stock cards. |
| `decks.ts` | `drawCard(state, deck)`: reshuffles the discard pile into the draw pile when the draw pile is empty; returns `cardId: undefined` when both are empty. |
| `rng.ts`, `money.ts`, `errors.ts` | mulberry32 (`nextRandom`, `rollDie`, `shuffle`), `pct`, the `EngineError` union. |
| `test/` | `deepFreeze`, `apply`/`reject` wrappers that freeze input, `fixtures.ts` (`twoPlayerGame`, `withGame`, `withPlayer`, `aboutToRoll` to pin position and die roll, `offered` to walk the real path to a buyOrPass decision, `drawn` to walk the real ROLL onto Market or Lifestyle with a chosen card on top). |

Engine decisions made before tonight that Andre should confirm or overrule:

- **Empty deck.** Landing on Market or Lifestyle with no cards in either pile sets `pending: none`.
- **Kids mode** draws from `smallDeals` on Opportunity and skips `chooseDealSize`. CLAUDE.md spec gap 2 (kids who cannot pay) still blocks the rest of kids mode.
- **Rolling twice is rejected** with `ALREADY_ROLLED`; ending the turn before rolling is rejected with `MUST_ROLL_FIRST`. Both come from `hasRolledThisTurn`, which scans the log for the current turn.
- **Escape ends the game** at `END_TURN` (phase `finished`, `currentPlayerId` stays on the winner). Phase 1 has no Freedom track (gap 3).
- **Stock prices are rolled at draw time, not at BUY**, so the player sees the price before deciding. `pending.buyOrPass.sharePrice` holds it; `BUY` must use that, never re-roll.

`@ff/shared` holds (all in `packages/shared/src/`):

| File | Contents |
| --- | --- |
| `money.ts` | `MoneySchema` (integer, zero or more), `SignedMoneySchema`, `PercentSchema` |
| `cards.ts` | `DealCardSchema`, `MarketCardSchema` (+ `MarketEffectSchema`), `LifestyleCardSchema`, `SetbackCardSchema`, `CardSchema` union on `deck`; `DECK_IDS`, `ASSET_TYPES` |
| `professions.ts` | `ProfessionSchema`, `LIABILITY_KINDS`, `LIABILITY_PAYMENT_PERCENT` (student 1, car 2, credit 3, mortgage 0, bank 10) |
| `board.ts` | `BOARD_SIZE = 24`, `SpaceKindSchema`, `BoardSchema` |
| `state.ts` | `GameStateSchema` and its parts: `GameSchema`, `PlayerSchema`, `AssetSchema`, `LiabilitySchema`, `DecksSchema`, `PendingSchema`, `LogEntrySchema` / `LogEventSchema` |
| `actions.ts` | `ActionSchema` (all 13 actions, each with `playerId`), `BORROW_STEP = 1000` |
| `readonly.ts` | `DeepReadonly<T>`; every exported state and card type is wrapped in it |
| `data/` | `professions.json` (6), `cards/*.json` (21 starter cards: 7 small, 4 big, 4 market, 3 lifestyle, 3 setback), `board.json` (24 spaces); `data/index.ts` parses each at import and exports `PROFESSIONS`, `CARDS_BY_DECK`, `CARDS_BY_ID`, `BOARD` |

Schema decisions worth knowing:

- Deal cards must satisfy `downPayment + mortgage === price`. Stocks must carry `priceRange` and `sharesAvailable`, may carry `dividendPerShare` (absent means 0), and must have `mortgage: 0`; non-stocks carry none of those.
- The spec's Market `effect` field is named `effects` because it is an array. Effect kinds: `offerBuyout`, `changeCashFlow`, `forceSale`, `splitShares`. Buyout and forced-sale prices are a whole-number `percentOfPurchasePrice`, so they go through `pct()`.
- Lifestyle cards carry `cashCost`, a loan (`monthlyCost` + `loanPrincipal`, both or neither), or both.
- `Liability` has an `id` so `REPAY` can name one loan among several of the same kind. A `mortgage` liability must carry `assetId` and `monthlyPayment: 0`. A `lifestyle` liability must carry `sourceCardId`.
- `Asset` has its own `id`. One asset per BUY, so a stock bought twice is two lots. `SELL_ASSET` takes `assetId` plus optional `shares`; `ACCEPT_MARKET` takes optional `assetId`.
- `game` stores both `rngSeed` (never changes) and `rngState` (advanced on every draw).
- `LogEntry` is `{ turnNumber, action, events[] }`. Event kinds: `rolled`, `moved`, `payday`, `drewCard`, `sharePriceRolled`, `passed`, `borrowed`, `repaid`, `paidLifestyle`, `bought`, `sold`, `cashFlowChanged`, `sharesSplit`, `gave`, `skippedGive`, `setback`, `wentOut`, `turnSkipped`, `cashChanged`. Add kinds as actions need them.
- `Player.skipsNextTurn` (boolean) is the one fact added tonight: a Setback happened and the next END_TURN pass must skip this seat. It is an event that happened, like `isOut`, not a derived value.
- `board.json` order is a first pass: Payday at 0 and 12, Setback at 11. The spec gives only the mix, not the order.
- Small deals cap `downPayment` at $5,000. A fixture test enforces it.

Tooling in place: TypeScript strict (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`), ESLint flat config with type-aware rules, the engine purity rules from CLAUDE.md Rule 1 enforced by ESLint, `id-denylist` on bare `expenses`, Vitest projects (`shared`, `engine`, `web`), Husky pre-commit running `pnpm typecheck` and `pnpm lint`, `.gitattributes` forcing LF.

Root scripts from the CLAUDE.md command table all exist. One is a placeholder that exits 1 with a message: `pnpm e2e` (Playwright not installed). `pnpm sim` runs the balance simulation through `tsx` (1,000 games in under a second). `pnpm test:props` runs the fast-check suite (about 10 s at 1,000 runs); `pnpm test` runs it too, so `pnpm check` runs it twice.

Package manager note: `corepack enable` fails with EPERM on this machine because Node lives under Program Files. pnpm was installed with `npm i -g pnpm` instead. The `packageManager` field in `package.json` pins the version.

## Next step

Stage A of `docs/plan-wealth-edition.md` is done: `docs/spec.md` is v2 (Wealth Edition), the plan is committed, and CLAUDE.md points at both. Before Stage B, Andre reviews the "v2 open questions" table at the end of the spec (Q1 to Q11). Stage B uses each recommended default unless he overrules it in the spec.

Then Stage B (engine v2 rules, unattended), Stage C (content), Stage D (tuning), Stage E (debrief), in that order. Prompts are in the plan.

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
