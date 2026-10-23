# STATUS

Progress and next steps for Freedom Loop. `CLAUDE.md` holds the rules; this file holds where we are. Update it at the end of every session.

## Current state (2026-10-23)

**Shared types, schemas, and fixtures done. No game logic yet.** Spec "First Claude Code session" steps 1, 2, and 3 are done.

The repo is a pnpm workspace with three packages:

| Package | Purpose | Contents today |
| --- | --- | --- |
| `@ff/shared` | types, Zod schemas, card and profession JSON, `formatMoney` | schemas, types, and fixtures listed below; `formatMoney` not yet written |
| `@ff/engine` | pure reducer, selectors, rng, invariants, sim | empty `index.ts`, `src/test/deepFreeze.ts` helper with tests |
| `@ff/web` | React 18 + Vite, routes `/table` and `/player` | placeholder `App`, one render test, `@` alias |

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
- The spec's "Duplex in Decatur" example has an $8,000 down payment although it describes small deals as under $5,000 down. The fixture keeps the spec's numbers.

Tooling in place: TypeScript strict (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`), ESLint flat config with type-aware rules, the engine purity rules from CLAUDE.md Rule 1 enforced by ESLint, `id-denylist` on bare `expenses`, Vitest projects (`shared`, `engine`, `web`), Husky pre-commit running `pnpm typecheck` and `pnpm lint`, `.gitattributes` forcing LF.

All root scripts from the CLAUDE.md command table exist. Two are placeholders that exit 1 with a message: `pnpm e2e` (Playwright not installed) and `pnpm sim` (simulation not written). `pnpm test:props` passes with `--passWithNoTests`; remove that flag when the first `*.props.test.ts` file lands.

Package manager note: `corepack enable` fails with EPERM on this machine because Node lives under Program Files. pnpm was installed with `npm i -g pnpm` instead. The `packageManager` field in `package.json` pins the version.

Spec gaps resolved on 2026-10-23 and written into `docs/spec.md`: liability monthly payments (fixed percent of principal per kind, under the profession table), Payday timing (credit each Payday passed or landed on, then resolve the space), the `lifestyle` liability kind with `sourceCardId`, and the `giveOrSkip` pending state. The remaining CLAUDE.md spec gaps are renumbered 1–5 (Setback, undo, bankruptcy sale, kids mode, Freedom track).

## Next step

Spec step 4: implement `ROLL`, `END_TURN`, and Payday crediting in `@ff/engine`, test-first per CLAUDE.md Rule 3. That session also needs `rng.ts` (mulberry32), `pct()`, `selectors.ts` (`passiveIncome`, `debtPayments`, `totalExpenses`, `monthlyCashFlow`), and an initial-state builder that applies `LIABILITY_PAYMENT_PERCENT` to each profession's starting liabilities.

Setback resolution (space 11) is blocked on CLAUDE.md spec gap 1; `ROLL` can land there and leave resolution for later.

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
