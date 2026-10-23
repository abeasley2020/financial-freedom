# STATUS

Progress and next steps for Freedom Loop. `CLAUDE.md` holds the rules; this file holds where we are. Update it at the end of every session.

## Current state (2026-10-23)

**ROLL and END_TURN work, with Payday crediting.** Spec "First Claude Code session" steps 1 through 4 are done.

The repo is a pnpm workspace with three packages:

| Package | Purpose | Contents today |
| --- | --- | --- |
| `@ff/shared` | types, Zod schemas, card and profession JSON, `formatMoney` | schemas, types, and fixtures listed below; `formatMoney` not yet written |
| `@ff/engine` | pure reducer, selectors, rng, invariants, sim | `reduce`, `createGame`, `ROLL`, `END_TURN`, selectors, `rng`, `pct`, `decks` (draw + reshuffle); test helpers in `src/test/` |
| `@ff/web` | React 18 + Vite, routes `/table` and `/player` | placeholder `App`, one render test, `@` alias |

`@ff/engine` today (all in `packages/engine/src/`):

| File | Contents |
| --- | --- |
| `reduce.ts` | `reduce(state, action)`. Guards phase and `NOT_YOUR_TURN`, dispatches to `actions/`, appends the log entry with the pre-action `turnNumber`. Unlisted actions return `NOT_IMPLEMENTED`. |
| `actions/roll.ts` | Rolls, moves, credits one Payday per Payday space passed or landed on, resolves the space: Opportunity → `chooseDealSize` (kids mode draws a small deal → `buyOrPass`), Market → draw → `marketChoice`, Lifestyle → draw → `payLifestyle`, Giving → `giveOrSkip`, Payday → none, Setback → none (gap 1). |
| `actions/chooseDealSize.ts` | Valid only when `pending` is `chooseDealSize`. Draws from `smallDeals` or `bigDeals` into `pending: buyOrPass`. A stock card gets `sharePrice` rolled inside its `priceRange` (inclusive) at draw time, advancing `rngState`, logged as `sharePriceRolled`. Empty deck → `pending: none`. |
| `actions/buy.ts` | Valid only when `pending` is `buyOrPass`. Non-stock: pays `downPayment` (`INSUFFICIENT_CASH` if short), adds the asset with the card's numbers, adds one `mortgage` liability (`monthlyPayment: 0`, `assetId`) when financed, keeps the card as the asset. Stock: `shares` required and at most `sharesAvailable` (`INVALID_SHARES`), cost `shares × pending.sharePrice`, lot with `monthlyCashFlow = floor(shares × dividendPerShare)`, card back to the discard pile. Asset id is `${playerId}-${cardId}-${log.length}`; mortgage id is that plus `-mortgage`. Events: `cashChanged`, `bought`. |
| `actions/pass.ts` | Valid only when `pending` is `buyOrPass`. Sends the card to its deck's discard pile and clears `pending`. Same for a stock, which is how a holder declines to buy or sell. Event: `passed`. |
| `actions/endTurn.ts` | Needs `pending: none` and a ROLL this turn. If `canEscape`, sets `hasEscaped` and `phase: finished` without advancing. Otherwise increments `turnNumber` and moves to the next player who is not out. |
| `selectors.ts` | `passiveIncome`, `debtPayments`, `totalExpenses`, `monthlyCashFlow`, `canEscape`, `currentPlayer`, `playerById`, `professionOf`, `hasRolledThisTurn` (derived from the log, so no "rolled" flag on state). |
| `createGame.ts` | Initial state from `{ id, mode, seed, players }`. Starting liabilities get `monthlyPayment = pct(principal, LIABILITY_PAYMENT_PERCENT[kind])`. Shuffles every deck from the seed. Standard mode drops `requiresKidsMode` cards. |
| `decks.ts` | `drawCard(state, deck)`: reshuffles the discard pile into the draw pile when the draw pile is empty; returns `cardId: undefined` when both are empty. |
| `rng.ts`, `money.ts`, `errors.ts` | mulberry32 (`nextRandom`, `rollDie`, `shuffle`), `pct`, the `EngineError` union. |
| `test/` | `deepFreeze`, `apply`/`reject` wrappers that freeze input, `fixtures.ts` (`twoPlayerGame`, `withGame`, `withPlayer`, `aboutToRoll` to pin position and die roll). |

Engine decisions made in step 4 that Andre should confirm or overrule:

- **Negative Payday below zero cash.** `ROLL` adds `monthlyCashFlow` to cash even when negative. No current action can make cash flow negative, so this cannot yet drive cash below zero, but once lifestyle loans exist it can. That is bankruptcy (gap 3). Decide before `PAY_LIFESTYLE`.
- **Landing on Setback does nothing** until gap 1 is resolved. No card is drawn.
- **Empty deck.** Landing on Market or Lifestyle with no cards in either pile sets `pending: none`.
- **Kids mode** draws from `smallDeals` on Opportunity and skips `chooseDealSize`. Gap 4 still blocks the rest of kids mode.
- **Rolling twice is rejected** with `ALREADY_ROLLED`; ending the turn before rolling is rejected with `MUST_ROLL_FIRST`. Both come from `hasRolledThisTurn`, which scans the log for the current turn.
- **Escape ends the game** at `END_TURN` (phase `finished`, `currentPlayerId` stays on the winner). Phase 1 has no Freedom track (gap 5).
- **Stock prices are rolled at draw time, not at BUY**, so the player sees the price before deciding. `pending.buyOrPass.sharePrice` holds it; `BUY` must use that, never re-roll. Kids mode never draws a stock: `createGame` removes stock cards from the small deals deck in kids mode (spec, Kids mode), and a ROLL test draws the whole kids deck twice across 25 seeds to prove it.
- The fast-check action generator (CLAUDE.md Rule 3, step 5) does not exist yet. It lands with spec step 6.

`@ff/shared` now holds (all in `packages/shared/src/`):

| File | Contents |
| --- | --- |
| `money.ts` | `MoneySchema` (integer, zero or more), `SignedMoneySchema`, `PercentSchema` |
| `cards.ts` | `DealCardSchema`, `MarketCardSchema` (+ `MarketEffectSchema`), `LifestyleCardSchema`, `SetbackCardSchema`, `CardSchema` union on `deck`; `DECK_IDS`, `ASSET_TYPES` |
| `professions.ts` | `ProfessionSchema`, `LIABILITY_KINDS`, `LIABILITY_PAYMENT_PERCENT` (student 1, car 2, credit 3, mortgage 1, bank 10) |
| `board.ts` | `BOARD_SIZE = 24`, `SpaceKindSchema`, `BoardSchema` |
| `state.ts` | `GameStateSchema` and its parts: `GameSchema`, `PlayerSchema`, `AssetSchema`, `LiabilitySchema`, `DecksSchema`, `PendingSchema`, `LogEntrySchema` / `LogEventSchema` |
| `actions.ts` | `ActionSchema` (all 13 actions, each with `playerId`), `BORROW_STEP = 1000` |
| `readonly.ts` | `DeepReadonly<T>`; every exported state and card type is wrapped in it |
| `data/` | `professions.json` (6), `cards/*.json` (21 starter cards: 7 small, 4 big, 4 market, 3 lifestyle, 3 setback; the 21st is Lakeshore Utilities, a dividend-paying stock added so BUY can test the dividend rule), `board.json` (24 spaces); `data/index.ts` parses each at import and exports `PROFESSIONS`, `CARDS_BY_DECK`, `CARDS_BY_ID`, `BOARD` |

Schema decisions worth knowing before step 4:

- Deal cards must satisfy `downPayment + mortgage === price`. Stocks must carry `priceRange` and `sharesAvailable`, may carry `dividendPerShare` (absent means 0), and must have `mortgage: 0` because stocks are cash only; non-stocks carry none of those.
- The spec's Market `effect` field is named `effects` because it is an array. Effect kinds: `offerBuyout`, `changeCashFlow`, `forceSale`, `splitShares`. Buyout and forced-sale prices are a whole-number `percentOfPurchasePrice`, so they go through `pct()`.
- Lifestyle cards carry `cashCost`, a loan (`monthlyCost` + `loanPrincipal`, both or neither), or both.
- `Liability` has an `id` so `REPAY` can name one loan among several of the same kind. `monthlyPayment` is stored per the spec; profession JSON stores principal only and the engine derives starting payments with `LIABILITY_PAYMENT_PERCENT`. A `mortgage` liability must carry `assetId` and `monthlyPayment: 0` (`LIABILITY_PAYMENT_PERCENT.mortgage` is 0; the deal card's cash flow is already net of it). REPAY cannot target a mortgage; a sale pays it off first.
- `Asset` has its own `id`. One asset per BUY, so a stock bought twice is two lots. `SELL_ASSET` takes `assetId` plus optional `shares` (stock lots only); `ACCEPT_MARKET` takes optional `assetId`.
- Stock rules (spec, Card decks, "Stock rules"): cash only; whole shares up to `sharesAvailable`; `purchasePrice = shares × sharePrice`; `monthlyCashFlow = floor(shares × dividendPerShare)`; sold only by the current player when the same card is drawn again, at the new `sharePrice`, from one lot; the card goes back to the discard pile after the decision, so lots do not count toward the deck-size invariant.
- `game` stores both `rngSeed` (never changes) and `rngState` (advanced on every draw).
- `LogEntry` is `{ turnNumber, action, events[] }`. Event kinds so far: `rolled`, `moved`, `payday`, `drewCard`, `cashChanged`. Add kinds as actions need them.
- `board.json` order is a first pass: Payday at 0 and 12, Setback at 11. The spec gives only the mix, not the order.
- Small deals cap `downPayment` at $5,000. A fixture test enforces it. The spec's Duplex example was changed to price 50,000, down 5,000, cash flow +160/mo to fit.

Tooling in place: TypeScript strict (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`), ESLint flat config with type-aware rules, the engine purity rules from CLAUDE.md Rule 1 enforced by ESLint, `id-denylist` on bare `expenses`, Vitest projects (`shared`, `engine`, `web`), Husky pre-commit running `pnpm typecheck` and `pnpm lint`, `.gitattributes` forcing LF.

All root scripts from the CLAUDE.md command table exist. Two are placeholders that exit 1 with a message: `pnpm e2e` (Playwright not installed) and `pnpm sim` (simulation not written). `pnpm test:props` passes with `--passWithNoTests`; remove that flag when the first `*.props.test.ts` file lands.

Package manager note: `corepack enable` fails with EPERM on this machine because Node lives under Program Files. pnpm was installed with `npm i -g pnpm` instead. The `packageManager` field in `package.json` pins the version.

Spec gaps resolved on 2026-10-23 and written into `docs/spec.md`: liability monthly payments (fixed percent of principal per kind, under the profession table), Payday timing (credit each Payday passed or landed on, then resolve the space), the `lifestyle` liability kind with `sourceCardId`, and the `giveOrSkip` pending state. The remaining CLAUDE.md spec gaps are renumbered 1–5 (Setback, undo, bankruptcy sale, kids mode, Freedom track).

Also resolved on 2026-10-23, written into `docs/spec.md` (Core rules "Mortgages", Card decks "Stock rules", Game engine design state model and invariants): stocks are cash only with per-lot assets, dividends, and sell-on-redraw; each financed deal creates one 0%-payment mortgage liability linked by `assetId`, paid off first on sale, never by REPAY; kids mode removes stock cards from the small deals.

## Next step

Spec step 5, next action: `BORROW` (Core rules, turn step 4: optional, in $1,000 steps, 10% of principal added to monthly expenses). Valid when `pending` is `none` and the player has rolled this turn (it is an optional action in step 4, after the space is resolved). Adds cash and one `bank` liability with `monthlyPayment = pct(amount, 10)`. Kids mode has no bank loans (Core rules, Kids mode), so reject there. Open question for Andre: may a player BORROW while a `buyOrPass` or `payLifestyle` decision is pending, to afford it? The spec's turn order puts optional actions after resolving the space, which says no, but it makes some deals unreachable. Decide before writing the tests.

Then `REPAY` (reject a mortgage), `PAY_LIFESTYLE`, `SELL_ASSET` (stock lots only while `pending` is `buyOrPass` for that card; mortgage paid off first from proceeds), and on in the CLAUDE.md order. Test helper `offered(state, cardId, sharePrice?)` in `test/fixtures.ts` walks the real ROLL → CHOOSE_DEAL_SIZE path to a buyOrPass decision.

## Deferred from the scaffold

Not installed or configured yet, each waiting for the session that needs it:

- `formatMoney` in `@ff/shared` (first UI session, or whenever the first display code needs it)
- Tailwind v3, shadcn/ui, Zustand (first UI session)
- A router for `/table` and `/player`. `react-router` is not on the approved dependency list; ask before adding.
- Playwright + `@axe-core/playwright` and the real `pnpm e2e` script
- Balance simulation (`pnpm sim`). Node 24 runs `.ts` files natively, so no `tsx` is needed; `erasableSyntaxOnly` keeps the engine strippable.
- fast-check global config reading `FC_NUM_RUNS` (spec step 6). `fast-check` itself is installed in `@ff/engine`.
- GitHub Actions CI (typecheck, lint, test, test:props on PRs)
- Vercel project link. When linking, set `HUSKY=0` in the Vercel environment so `prepare` skips hook install.
- README beyond the title line

## Playtests

None yet. Notes go in `docs/playtests/YYYY-MM-DD.md`.
