# STATUS

Progress and next steps for Freedom Loop. `CLAUDE.md` holds the rules; this file holds where we are. Update it at the end of every session.

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
| GIVE, SKIP_GIVE | next | |
| Setback resolution + bankruptcy | todo | decided tonight; lands as its own branch after the actions |
| Stage 4.1 property suite | todo | |
| Stage 4.2 simulator | todo | |
| Stage 4.3 golden games | todo | |

### Questions for Andre

None yet. Each entry below, when added, has a proposed default and names the action it blocked.

### Decisions made alone tonight (confirm or overrule)

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
| `actions/roll.ts` | Rolls, moves, credits one Payday per Payday space passed or landed on, resolves the space: Opportunity → `chooseDealSize` (kids mode draws a small deal → `buyOrPass`), Market → draw → `marketChoice`, Lifestyle → draw → `payLifestyle`, Giving → `giveOrSkip`, Payday → none, Setback → none (resolution not yet written). |
| `actions/chooseDealSize.ts` | Valid only when `pending` is `chooseDealSize`. Draws from `smallDeals` or `bigDeals` into `pending: buyOrPass`. A stock card gets `sharePrice` rolled inside its `priceRange` (inclusive) at draw time, advancing `rngState`, logged as `sharePriceRolled`. Empty deck → `pending: none`. |
| `actions/buy.ts` | Valid only when `pending` is `buyOrPass`. Non-stock: pays `downPayment` (`INSUFFICIENT_CASH` if short), adds the asset with the card's numbers, adds one `mortgage` liability (`monthlyPayment: 0`, `assetId`) when financed, keeps the card as the asset. Stock: `shares` required and at most `sharesAvailable` (`INVALID_SHARES`), cost `shares × pending.sharePrice`, lot with `monthlyCashFlow = floor(shares × dividendPerShare)`, card back to the discard pile. Asset id is `${playerId}-${cardId}-${log.length}`; mortgage id is that plus `-mortgage`. Events: `cashChanged`, `bought`. |
| `actions/pass.ts` | Valid only when `pending` is `buyOrPass`. Sends the card to its deck's discard pile and clears `pending`. Same for a stock, which is how a holder declines to buy or sell. Event: `passed`. |
| `actions/borrow.ts` | Legal when `pending` is `none`, `buyOrPass`, or `payLifestyle` (spec, turn step 4), after a ROLL this turn, standard mode only (`NOT_ALLOWED_IN_KIDS_MODE`). Never changes `pending`. Amount must be a positive multiple of `BORROW_STEP` (`INVALID_AMOUNT`). Adds cash and one `bank` liability with `monthlyPayment = pct(amount, 10)`, id `${playerId}-bank-${log.length}`. Events: `cashChanged`, `borrowed`. |
| `actions/repay.ts` | Legal only with `pending: none` after a ROLL this turn (spec, turn step 4). Pays the liability's `principal` from cash (`INSUFFICIENT_CASH`) and removes it. `INVALID_LIABILITY` for a mortgage, an id the player does not hold, or another player's loan. Starting loans, bank loans, and lifestyle loans are all repayable. Allowed in kids mode. Events: `cashChanged`, `repaid`. |
| `actions/payLifestyle.ts` | Valid only when `pending` is `payLifestyle`. `cash` pays `cashCost` (`INSUFFICIENT_CASH`); `loan` adds a `lifestyle` liability (`principal: loanPrincipal`, `monthlyPayment: monthlyCost`, `sourceCardId`), id `${playerId}-lifestyle-${log.length}`. `INVALID_METHOD` when the card lacks that option. Card to the lifestyle discard pile. Events: `cashChanged` + `paidLifestyle` (cash), `paidLifestyle` with `liabilityId` (loan). |
| `actions/sellAsset.ts` | Valid only when `pending` is `buyOrPass` for a stock card (any other offer → `INVALID_FOR_PENDING`). `assetId` must be the current player's lot of that stock (`INVALID_ASSET`); `shares` defaults to the whole lot and may not exceed it (`INVALID_SHARES`). Proceeds `shares × pending.sharePrice`. A partial sale keeps the lot with `purchasePrice`/`downPaid` scaled down (floored) and `monthlyCashFlow = floor(remaining × dividendPerShare)`. Card to the discard pile. Events: `cashChanged`, `sold`. |
| `actions/acceptMarket.ts` | Valid only when `pending` is `marketChoice`. Applies the card's `effects` in order to the current player's assets whose type is in `appliesTo`: `offerBuyout` sells one (the only qualifying asset, or the one named by `assetId`; `INVALID_ASSET` when several qualify and none is named, or when `assetId` does not qualify), `forceSale` sells all, `changeCashFlow` adds `delta` to each, `splitShares` multiplies each lot's `shares`. Nothing qualifying → card discarded, no events. Market card to the market discard pile. Events: `sold` (+ `cashChanged` when the net is positive), `cashFlowChanged`, `sharesSplit`. |
| `actions/declineMarket.ts` | Valid only when `pending` is `marketChoice`. Legal when every effect is an `offerBuyout` or the player owns nothing the card applies to; otherwise `MARKET_EFFECT_MANDATORY` (resolve with ACCEPT_MARKET). Discards the card with no effect. Event: `passed`. |
| `sales.ts` | `liquidate(state, playerId, asset, proceeds, reason)`: removes the asset, retires its linked mortgage first (`mortgagePaid = min(proceeds, principal)`), credits the rest, returns a deal card to its deck's discard pile (a stock lot just disappears). Shared by Market sales and bankruptcy. |
| `actions/endTurn.ts` | Needs `pending: none` and a ROLL this turn. If `canEscape`, sets `hasEscaped` and `phase: finished` without advancing. Otherwise increments `turnNumber` and moves to the next player who is not out. |
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
- `LogEntry` is `{ turnNumber, action, events[] }`. Event kinds: `rolled`, `moved`, `payday`, `drewCard`, `sharePriceRolled`, `passed`, `borrowed`, `repaid`, `paidLifestyle`, `bought`, `sold`, `cashFlowChanged`, `sharesSplit`, `cashChanged`. Add kinds as actions need them.
- `board.json` order is a first pass: Payday at 0 and 12, Setback at 11. The spec gives only the mix, not the order.
- Small deals cap `downPayment` at $5,000. A fixture test enforces it.

Tooling in place: TypeScript strict (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`), ESLint flat config with type-aware rules, the engine purity rules from CLAUDE.md Rule 1 enforced by ESLint, `id-denylist` on bare `expenses`, Vitest projects (`shared`, `engine`, `web`), Husky pre-commit running `pnpm typecheck` and `pnpm lint`, `.gitattributes` forcing LF.

Root scripts from the CLAUDE.md command table all exist. Two are placeholders that exit 1 with a message: `pnpm e2e` (Playwright not installed) and `pnpm sim` (simulation not written). `pnpm test:props` passes with `--passWithNoTests`; remove that flag when the first `*.props.test.ts` file lands.

Package manager note: `corepack enable` fails with EPERM on this machine because Node lives under Program Files. pnpm was installed with `npm i -g pnpm` instead. The `packageManager` field in `package.json` pins the version.

## Next step

See the Stage 3 progress table above. The next unmerged row is the next action, test first, in the CLAUDE.md order.

## Deferred from the scaffold

Not installed or configured yet, each waiting for the session that needs it:

- `formatMoney` in `@ff/shared` (first UI session, or whenever the first display code needs it)
- Tailwind v3, shadcn/ui, Zustand (first UI session)
- A router for `/table` and `/player`. `react-router` is not on the approved dependency list; ask before adding.
- Playwright + `@axe-core/playwright` and the real `pnpm e2e` script
- fast-check global config reading `FC_NUM_RUNS` (lands with the property suite)
- GitHub Actions CI (typecheck, lint, test, test:props on PRs)
- Vercel project link. When linking, set `HUSKY=0` in the Vercel environment so `prepare` skips hook install.
- README beyond the title line

## Playtests

None yet. Notes go in `docs/playtests/YYYY-MM-DD.md`.
