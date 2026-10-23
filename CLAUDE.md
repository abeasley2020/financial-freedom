# Financial Freedom (working title: Freedom Loop)

Family cash-flow board game. Laptop shows the shared table, phones show private finances. The full design is in `docs/spec.md`. This file holds the rules for building it. If the two conflict, this file wins for engineering questions and the spec wins for game-design questions. When you find a conflict, report it rather than picking a side quietly.

Progress and next steps go in `STATUS.md`, not here. Read both at the start of every session.

**Current state:** pre-scaffold. The repo holds only `README.md`, `docs/spec.md`, and this file. The first session follows the "First Claude Code session" list in the spec, in that order.

---

## The three rules

These three rules matter more than anything else in this file. Breaking any of them means rework.

### Rule 1: The engine is pure

`packages/engine` (and `packages/shared`, which it imports) is plain TypeScript. A rule like "keep the engine free of UI code" is too vague to check, so purity here means all of the following. Each item is checkable.

1. **Allowed imports only:** the engine may import `@ff/shared` and `zod`. It may not import `react`, `react-dom`, `zustand`, `@supabase/*`, `@ff/web`, any `node:*` module, `fs`, or `path`. Enforced by ESLint `no-restricted-imports` scoped to `packages/engine/**` and `packages/shared/**`.
2. **No ambient inputs:** no `Math.random`, `Date`, `Date.now`, `performance`, `crypto`, `setTimeout`, `window`, `document`, `localStorage`, or `console`. Enforced by ESLint `no-restricted-globals` / `no-restricted-properties`. The engine `tsconfig.json` sets `"lib": ["ES2022"]` with no `DOM`, so browser globals also fail typecheck.
3. **No mutation:** the reducer never mutates its input. Every engine test deep-freezes the input state (`deepFreeze` helper in `packages/engine/src/test/`), so a mutation throws.
4. **Randomness only from state:** dice and shuffles use the seeded PRNG in `packages/engine/src/rng.ts` (mulberry32). The PRNG's current position is stored in `game.rngState` and advanced in the returned state on every draw. Storing only the starting seed is not enough, because then every roll would return the same number. Same starting state plus same actions must give a byte-identical final state.
5. **One entry point:**
   ```ts
   reduce(state: GameState, action: Action): ReduceResult
   type ReduceResult =
     | { ok: true; state: GameState }
     | { ok: false; error: EngineError } // e.g. NOT_YOUR_TURN, INVALID_FOR_PENDING, INSUFFICIENT_CASH
   ```
   A rejected action does not throw, does not change state, and is not logged. Throwing is reserved for programmer bugs such as an unknown card id or a schema violation.
6. **The engine runs only on the host.** `web` (and phones in Phase 2) send actions and render returned state. Game logic is never duplicated in a component, hook, or Zustand store. If the UI needs to know whether an action is allowed, it calls an engine function such as `legalActions(state, playerId)`. It never re-implements the check.

### Rule 2: No stored derived values

Store only facts. If a value can be computed from other stored values, it is a selector in `packages/engine/src/selectors.ts`. It is never a field on state and never cached in Zustand, React state, or Supabase.

| Derived (selector only, never stored) | Stored (facts) |
| --- | --- |
| `passiveIncome` = sum of asset `monthlyCashFlow` | `assets[]`, `liabilities[]`, `cash` |
| `debtPayments` = sum of liability `monthlyPayment` | `professionId` (base expenses are looked up from profession data, not copied) |
| `totalExpenses` = profession base expenses + `debtPayments` | `salary` (stored because Setback cards can change it) |
| `monthlyCashFlow` = salary + passiveIncome − totalExpenses | `hasEscaped`, `isOut` (events that happened; passive income can fall later) |
| `netWorth`, `canEscape` (passiveIncome ≥ totalExpenses) | `game.currentPlayerId`, `game.turnNumber` (spec calls it `turnIndex`) |
| current player object, deck sizes, legal actions | `decks[*].drawPile` / `discardPile`, `pending`, `rngState`, `log` |

Use the names above exactly. The spec uses "expenses" in two different senses, so "expenses" alone is banned in code. Always write `baseExpenses` or `totalExpenses`.

The test for whether something belongs on state: if it can disagree with another field, it is derived. Delete the field and write a selector.

### Rule 3: Test-first for every engine action

No reducer action or selector is written before a failing test for it. For each action, in this order:

1. Find the rule in `docs/spec.md`. If the rule is unclear or listed under "Spec gaps" below, stop and ask. Don't guess game rules.
2. Write `packages/engine/src/actions/<action>.test.ts`. Minimum cases:
   - the happy path, asserting the exact resulting numbers
   - rejected with `NOT_YOUR_TURN` when a non-current player sends it
   - rejected with `INVALID_FOR_PENDING` for every `pending` state it is not valid in
   - one test per rule or edge case in the spec (zero cash, exact-amount boundaries, last card in a pile, kids mode)
   - a log entry appended
   - name each test `"<ACTION>: <rule in plain words>"`, e.g. `"ROLL: credits Payday cash flow when passing a Payday space"`
3. Add a stub that returns `{ ok: false, error: 'NOT_IMPLEMENTED' }`, then run the test. **Confirm it fails on an assertion,** not on an import or type error. Show the failing output.
4. Implement the minimum code to pass, then run the file again.
5. Add the action to the fast-check action generator, then run `pnpm test:props`.
6. Run `pnpm check`. Done means green with zero warnings.

Action order (from the spec; nothing new starts until the previous step passes):
ROLL, END_TURN, Payday crediting → CHOOSE_DEAL_SIZE → BUY → PASS → BORROW → REPAY → PAY_LIFESTYLE → SELL_ASSET → ACCEPT_MARKET → DECLINE_MARKET → GIVE → SKIP_GIVE.

---

## Engine invariants

`packages/engine/src/invariants.ts` exports `checkInvariants(state)`. Property tests call it after every accepted action:

- `cash >= 0` for every player not marked `isOut`.
- For each deck: drawPile + discardPile + cards held as assets + the card awaiting a `pending` decision = deck size. The spec leaves out the pending card. Include it.
- Exactly one `pending` value at a time, and `END_TURN` is legal only when `pending` is `none`.
- Only `currentPlayerId` can produce an accepted action.
- Replay: `replay(initialState, log.actions)` deep-equals the current state.

---

## Money

- All money is **integer whole dollars** (`number`, always `Number.isInteger`). No cents, no floats in state.
- All percentages go through one helper, `pct(amount, percent)`, which uses `Math.floor`. This covers borrow interest (10%), giving (10% of cash), and half-price sales.
- Display: `$1,234`, no decimals, through one `formatMoney` in `shared`. Money out is red, money in is green, and both always carry a text label (`-$380/mo expense`) so color is never the only signal.

---

## Layout

```
packages/
  shared/   @ff/shared   types, Zod schemas, profession + card JSON (src/data/*.json), formatMoney
  engine/   @ff/engine   reduce, actions/ (one file + test per action), selectors, rng, invariants, sim/
  web/      @ff/web      React 18 + Vite; routes /table and /player; Zustand holds engine state only
docs/
  spec.md
  playtests/YYYY-MM-DD.md   one note per playtest: who, what confused them, what broke, duration
```

- Card and profession data are JSON, validated with Zod at load. The engine must work with any deck size, so never hard-code counts.
- Golden games: `packages/engine/src/test/golden/*.json` (seed + actions + expected final state). Never regenerate them (`-u`) without Andre's approval. The commit message must say which rule change caused the difference.

## Dependencies

Approved (from the spec): react 18, vite, typescript, tailwindcss v3, shadcn/ui (and its Radix deps), zustand, zod, @supabase/supabase-js (Phase 2 only), vitest, fast-check, @playwright/test, @axe-core/playwright, eslint + typescript-eslint, husky. **Ask before adding anything else**, including `tsx` for the simulation script.

---

## Commands (PowerShell 7)

The scaffold step creates these root scripts. The names are fixed; don't rename them. Scripts must be cross-platform because CI runs on Linux. Write them without `rm -rf`, without `VAR=x cmd`, and without `&&` chains that assume bash.

| Command | What it does |
| --- | --- |
| `corepack enable` | One-time: makes `pnpm` available |
| `pnpm install` | Install all workspace packages |
| `pnpm dev` | Vite dev server with `--host` so phones on Wi-Fi can join |
| `pnpm build` | Production build of `web` |
| `pnpm typecheck` | `tsc -b` across all packages |
| `pnpm lint` | ESLint, `--max-warnings 0` |
| `pnpm test` | All Vitest unit tests (engine + shared + web) |
| `pnpm test:engine` | Engine tests only |
| `pnpm test:props` | fast-check invariant suite (1,000 runs default) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm e2e` | Playwright happy path + axe check |
| `pnpm sim` | Balance simulation, 1,000 bot games, prints length / win rate by profession / bankruptcy rate |
| `pnpm check` | typecheck + lint + test + test:props. Run before every commit and before saying "done" |

Common one-offs:

```powershell
# One test file
pnpm --filter @ff/engine exec vitest run src/actions/roll.test.ts

# Tests matching a name
pnpm --filter @ff/engine exec vitest run -t "ROLL:"

# Heavier property run (env var syntax is PowerShell, not bash)
$env:FC_NUM_RUNS = 10000; pnpm test:props; Remove-Item Env:FC_NUM_RUNS

# First-time Playwright browser install
pnpm exec playwright install chromium

# Laptop IP for phones to open http://<ip>:5173
(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi).IPAddress

# Free port 5173 if a dev server is stuck
Get-NetTCPConnection -LocalPort 5173 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

When fast-check finds a failure, it prints a `seed` and `path`. Paste both into the test's `fc.assert(..., { seed, path })` to replay it, fix the bug, then remove them.

Windows notes: the first `pnpm dev --host` triggers a Windows Firewall prompt. Allow it on private networks or phones can't connect. Commit `.gitattributes` with `* text=auto eol=lf` during scaffold. Without it, CRLF line endings break golden-file comparisons between Windows and CI.

---

## Git

- Conventional commits (`feat(engine): add BORROW`). One feature per branch, squash merge to main. Main is always playable.
- Husky pre-commit runs `pnpm typecheck` and `pnpm lint`.
- Feature definition of done: spec "Definition of done", items 1–5.

---

## Spec gaps: ask Andre before implementing the affected action

Each item below is a game-design decision the spec doesn't make. Where a default is listed, use it only after Andre confirms.

1. **Liability monthly payments per profession.** The profession table gives principals but no monthly payments, and `totalExpenses` needs them. Blocks: profession fixtures, Payday.
2. **Payday timing.** Turn step 2 says resolve the space, step 3 says credit Payday "before resolving the space." Default: move → credit each Payday passed or landed on → resolve the space. Blocks: ROLL.
3. **Setback vs. no negative cash.** The spec says "skip a turn if cash is negative," but the invariant forbids negative cash. Default: if cash can't cover the cost, auto-borrow in $1,000 steps and skip next turn. Also skip if `card.skipTurn`. Blocks: Setback resolution.
4. **Lifestyle loans.** The liability `kind` list has no slot for a lifestyle loan. Default: add `kind: 'lifestyle'` with `sourceCardId`, so it counts in `debtPayments` and `REPAY` can clear it. Blocks: PAY_LIFESTYLE.
5. **Giving needs a pending state.** GIVE/SKIP_GIVE exist, but `pending` has no matching value. Default: add `giveOrSkip`. Blocks: GIVE, SKIP_GIVE.
6. **Undo vs. randomness.** "Undo until END_TURN" would let a player re-roll. Default: undo is a host-side stack of states, not a reducer action, and can't go back past the most recent ROLL or card draw. Blocks: web undo button.
7. **Bankruptcy sale details.** Who picks which asset to sell? Is half price taken from `purchasePrice`? Does the mortgage get paid off from the proceeds? Blocks: bankruptcy.
8. **Kids mode with no loans.** What happens when a kid can't afford a Lifestyle card or a required payment? Blocks: kids mode (Phase 3).
9. **Freedom track and dream purchases.** Not specified. Phase 1 ends the game at the first escape. Don't build the Freedom track until it's specified.
