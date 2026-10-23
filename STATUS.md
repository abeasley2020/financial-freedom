# STATUS

Progress and next steps for Freedom Loop. `CLAUDE.md` holds the rules; this file holds where we are. Update it at the end of every session.

## Current state (2026-10-23)

**Scaffold complete, no game logic yet.** Spec "First Claude Code session" step 1 is done.

The repo is a pnpm workspace with three packages:

| Package | Purpose | Contents today |
| --- | --- | --- |
| `@ff/shared` | types, Zod schemas, card and profession JSON, `formatMoney` | empty `index.ts`, one smoke test |
| `@ff/engine` | pure reducer, selectors, rng, invariants, sim | empty `index.ts`, `src/test/deepFreeze.ts` helper with tests |
| `@ff/web` | React 18 + Vite, routes `/table` and `/player` | placeholder `App`, one render test, `@` alias |

Tooling in place: TypeScript strict (plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`), ESLint flat config with type-aware rules, the engine purity rules from CLAUDE.md Rule 1 enforced by ESLint, `id-denylist` on bare `expenses`, Vitest projects (`shared`, `engine`, `web`), Husky pre-commit running `pnpm typecheck` and `pnpm lint`, `.gitattributes` forcing LF.

All root scripts from the CLAUDE.md command table exist. Two are placeholders that exit 1 with a message: `pnpm e2e` (Playwright not installed) and `pnpm sim` (simulation not written). `pnpm test:props` passes with `--passWithNoTests`; remove that flag when the first `*.props.test.ts` file lands.

Package manager note: `corepack enable` fails with EPERM on this machine because Node lives under Program Files. pnpm was installed with `npm i -g pnpm` instead. The `packageManager` field in `package.json` pins the version.

## Next step

Spec step 2: write the shared types and Zod schemas for state, cards, and actions in `packages/shared/src/`. Before starting, resolve CLAUDE.md spec gaps 1 (liability payments), 2 (Payday timing), 4 (lifestyle loan kind), and 5 (giving pending state) with Andre, since they change the state shape.

Then step 3 (profession and card JSON fixtures), then step 4 (ROLL, END_TURN, Payday, test-first).

## Deferred from the scaffold

Not installed or configured yet, each waiting for the session that needs it:

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
