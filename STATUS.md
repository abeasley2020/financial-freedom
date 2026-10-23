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
| `data/` | `professions.json` (6), `cards/*.json` (20 starter cards: 6 small, 4 big, 4 market, 3 lifestyle, 3 setback), `board.json` (24 spaces); `data/index.ts` parses each at import and exports `PROFESSIONS`, `CARDS_BY_DECK`, `CARDS_BY_ID`, `BOARD` |

Schema decisions worth knowing before step 4:

- Deal cards must satisfy `downPayment + mortgage === price`. Stocks must carry `priceRange` and `sharesAvailable`; non-stocks must not.
- The spec's Market `effect` field is named `effects` because it is an array. Effect kinds: `offerBuyout`, `changeCashFlow`, `forceSale`, `splitShares`. Buyout and forced-sale prices are a whole-number `percentOfPurchasePrice`, so they go through `pct()`.
- Lifestyle cards carry `cashCost`, a loan (`monthlyCost` + `loanPrincipal`, both or neither), or both.
- `Liability` has an `id` (not in the spec) so `REPAY` can name one loan among several of the same kind. `monthlyPayment` is stored per the spec; profession JSON stores principal only and the engine derives starting payments with `LIABILITY_PAYMENT_PERCENT`.
- `Asset` is keyed by `cardId`; `SELL_ASSET` and `ACCEPT_MARKET` use `cardId` to name an asset.
- `game` stores both `rngSeed` (never changes) and `rngState` (advanced on every draw).
- `LogEntry` is `{ turnNumber, action, events[] }`. Event kinds so far: `rolled`, `moved`, `payday`, `drewCard`, `cashChanged`. Add kinds as actions need them.
- `board.json` order is a first pass: Payday at 0 and 12, Setback at 11. The spec gives only the mix, not the order.
- Small deals cap `downPayment` at $5,000. A fixture test enforces it. The spec's Duplex example was changed to price 50,000, down 5,000, cash flow +160/mo to fit.

Tooling in place: TypeScript strict (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`), ESLint flat config with type-aware rules, the engine purity rules from CLAUDE.md Rule 1 enforced by ESLint, `id-denylist` on bare `expenses`, Vitest projects (`shared`, `engine`, `web`), Husky pre-commit running `pnpm typecheck` and `pnpm lint`, `.gitattributes` forcing LF.

All root scripts from the CLAUDE.md command table exist. Two are placeholders that exit 1 with a message: `pnpm e2e` (Playwright not installed) and `pnpm sim` (simulation not written). `pnpm test:props` passes with `--passWithNoTests`; remove that flag when the first `*.props.test.ts` file lands.

Package manager note: `corepack enable` fails with EPERM on this machine because Node lives under Program Files. pnpm was installed with `npm i -g pnpm` instead. The `packageManager` field in `package.json` pins the version.

Spec gaps resolved on 2026-10-23 and written into `docs/spec.md`: liability monthly payments (fixed percent of principal per kind, under the profession table), Payday timing (credit each Payday passed or landed on, then resolve the space), the `lifestyle` liability kind with `sourceCardId`, and the `giveOrSkip` pending state. The remaining CLAUDE.md spec gaps are renumbered 1–5 (Setback, undo, bankruptcy sale, kids mode, Freedom track).

## Next step

Spec step 5, first action: `CHOOSE_DEAL_SIZE` (valid only when `pending` is `chooseDealSize`; draws from `smallDeals` or `bigDeals` via `drawCard` into `pending: buyOrPass`). Then `BUY`, `PASS`, and so on in the CLAUDE.md order. Each one test-first with the same `apply`/`reject` helpers.

`BUY` for stocks needs the engine to roll a price inside `priceRange`; that is the first use of `nextRandom` outside dice and shuffles.

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
