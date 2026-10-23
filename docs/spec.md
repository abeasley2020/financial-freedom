# Family Cashflow Game Spec

Oct 23, 2026 · @Andre Beasley

## Purpose and design goals

A family board game, played on phones and a laptop, that teaches one idea: you are free when the money your assets earn each month exceeds what you spend each month. Everything else in the design serves that lesson.

- Players: 2 to 6, ages 10 and up, with a simplified mode for younger kids.
- Session length: 45 to 75 minutes. A game that runs past 90 minutes loses the kids.
- Teaches: reading an income statement and balance sheet, cash flow versus net worth, good debt versus bad debt, the cost of lifestyle spending, and evaluating a deal (price, down payment, monthly cash flow, return on cash).
- Not for sale. Personal use only. All card content, names, art, and numbers are original.
- Platform: one web app. The laptop or TV shows the shared table; each player's phone shows their private finances and action buttons.
- Constraints: no accounts or logins, works on a home Wi-Fi network and over the internet, meets WCAG 2.2 AA so grandparents and kids can both read it.

## Core rules

Win condition: a player escapes the Grind (the inner loop) when passive income is greater than or equal to monthly expenses. First player to escape wins the standard game. The full game continues on the Freedom track, where the goal is to buy one dream purchase chosen at setup.

Turn sequence (the engine enforces this order; no step can be skipped by hand):

1. Roll one six-sided die and move that many spaces on the inner loop.
2. Credit monthly cash flow for each Payday space passed or landed on during the move.
3. Resolve the space landed on.
4. Player may take optional actions: repay a loan in full, sell an asset when a Market card allows it, or borrow from the bank in $1,000 increments at 10 percent of principal added to monthly expenses.
5. Engine checks the win condition and advances to the next player.

Board: inner loop of 24 spaces. Space mix: 9 Opportunity, 5 Market, 5 Lifestyle, 2 Payday, 2 Giving, 1 Setback. Setback cards (job loss, medical bill, car repair) force the player to pay or borrow and skip a turn if cash is negative.

Bankruptcy: if a player cannot cover a required payment even after borrowing, they sell assets at half price until covered. If still short, they are out.

Professions (starting numbers in dollars per month; cash is a one-time start):

| Profession | Salary | Expenses | Starting cash | Starting liabilities |
| --- | --- | --- | --- | --- |
| Teacher | 3,300 | 2,300 | 400 | Student loan 12,000, car loan 6,000, credit card 2,000 |
| Electrician | 4,100 | 2,700 | 700 | Car loan 8,000, credit card 3,000 |
| Nurse | 4,600 | 3,100 | 900 | Student loan 20,000, car loan 7,000 |
| Police officer | 4,200 | 2,900 | 600 | Car loan 9,000, credit card 2,500 |
| Engineer | 6,500 | 4,400 | 1,500 | Student loan 35,000, car loan 12,000, credit card 4,000 |
| Doctor | 13,000 | 9,200 | 3,000 | Student loan 150,000, car loan 20,000, credit card 8,000 |

The Expenses column is baseExpenses. Each liability adds a monthly payment equal to a fixed percent of its principal, floored to whole dollars: student loan 1%, car loan 2%, credit card 3%, mortgage 1%, bank loan 10%, lifestyle loan the card's stated monthly cost. totalExpenses = baseExpenses + the sum of those payments.

Starting cash flow varies by profession on purpose; the Stage 4 simulator decides whether any profession needs rebalancing.

Kids mode (ages 7 to 10): one Opportunity deck instead of two, round numbers only, no bank loans, no Setback spaces, win at passive income greater than or equal to expenses, target 30 minutes.

## Card decks

Five decks, all original content, stored as JSON so cards can be added or rebalanced without touching code. Phase 1 ships with the counts below; the engine must work with any deck size.

| Deck | Count | What it teaches | Example card |
| --- | --- | --- | --- |
| Small deals | 40 | Stocks, index funds, small rentals, side businesses under $5,000 down | Duplex in Decatur: price 50,000, down 5,000, cash flow +160/mo |
| Big deals | 25 | Apartment buildings, businesses, land; $6,000 to $50,000 down | Laundromat: price 120,000, down 30,000, cash flow +1,400/mo |
| Market | 20 | Prices move; buyers appear; tenants leave; the player decides to sell or hold | Buyer offers 2x purchase price for any small rental you own |
| Lifestyle | 25 | Spending that feels good and quietly raises monthly expenses | New truck: pay 4,000 cash or add 380/mo loan payment |
| Setback | 10 | Emergencies; why an emergency fund matters | Furnace dies: pay 3,500 |

Card data shape (one TypeScript type per deck, validated with Zod at load time):

- Deal card: id, deck, title, description, type (stock, fund, rental, business, land), price, downPayment, mortgage, monthlyCashFlow, sharesAvailable for stocks, priceRange for stock randomization, requiresKidsMode flag.
- Market card: id, title, description, effect (an array of typed effects such as offerBuyout, changeCashFlow, forceSale, splitShares), appliesTo (asset type filter).
- Lifestyle card: id, title, description, cashCost, or monthlyCost plus loanPrincipal.
- Setback card: id, title, description, cashCost, skipTurn boolean.

Stock cards use a price range instead of a fixed price. The engine rolls within the range so the same stock card teaches buying low and selling high across multiple draws.

Giving spaces are not cards. Landing on one lets the player give 10 percent of cash on hand. Each gift adds a Favor token. Three Favor tokens may be spent to re-draw any card once. This rewards generosity without making it a math trick.

## Game engine design

The engine is a pure TypeScript package with zero React and zero Supabase imports. It takes a game state and an action and returns a new game state. This is the single most important engineering decision in the project: it makes every rule testable without a browser, and it lets Phase 2 networking reuse the engine untouched.

State model (one immutable object, serializable to JSON):

- game: id, mode (standard or kids), phase (lobby, playing, finished), turnIndex, currentPlayerId, rngSeed, log.
- players: array of player objects with id, name, professionId, position, cash, salary, assets, liabilities, favorTokens, isOut, hasEscaped.
- assets: each with cardId, type, purchasePrice, downPaid, monthlyCashFlow, shares if stock.
- liabilities: each with kind (student, car, credit, mortgage, bank, lifestyle), principal, monthlyPayment. A lifestyle liability stores sourceCardId.
- decks: for each deck, drawPile and discardPile as arrays of card ids.
- pending: the one decision the current player must make before the turn advances (none, chooseDealSize, buyOrPass, marketChoice, payLifestyle, giveOrSkip).

Derived values are never stored. Monthly expenses, passive income, cash flow, and net worth are computed from the state by selector functions so they can never drift out of sync.

Actions (the full list the reducer accepts): ROLL, CHOOSE\_DEAL\_SIZE, BUY, PASS, SELL\_ASSET, BORROW, REPAY, PAY\_LIFESTYLE, ACCEPT\_MARKET, DECLINE\_MARKET, GIVE, SKIP\_GIVE, END\_TURN. Every action carries the acting playerId. The reducer rejects any action from a player who is not current or that is not valid in the current pending state.

Invariants the test suite enforces on every state transition:

- Cash never goes negative without an explicit bankruptcy resolution.
- Total cards across drawPile, discardPile, and player assets equals the deck size at all times.
- Only the current player may act, and exactly one pending decision exists at a time.
- Passive income equals the sum of asset monthlyCashFlow; expenses equal profession expenses plus liability payments plus lifestyle additions.
- Given the same rngSeed and the same action sequence, the final state is identical. Dice and shuffles use a seeded random number generator so bugs can be replayed from the log.

The log is an append-only array of every action and its result. The end-of-game scorecard is built from this log, and so is bug reproduction.

## Architecture and stack

One React app serves two routes: the table screen for the laptop and the player screen for phones. The engine runs only on the host. Phones never compute game logic; they send actions and render whatever state comes back. That rule prevents the two most common multiplayer bugs: desynced state and cheating by a modified client.

&#91;embedded content: architecture · phones, Supabase, host engine\]

The host applies every action through the pure engine and publishes the result; phones and the table screen only render.

Stack: React 18 + Vite + TypeScript strict, Tailwind v3, shadcn/ui, Zustand for client state, Zod for card and state validation, Supabase Postgres plus Realtime for Phase 2 rooms, Vercel deploys from the abeasley2020 GitHub repo. No Cloudflare Worker is needed; there is no AI call in the game.

Phases

- Phase 1, one device: lobby, profession pick, full turn loop, all five decks, win detection, end-of-game scorecard. Pass-and-play on the laptop. Nothing networked.
- Phase 2, rooms: Supabase games table with a room code, Realtime channel, phone route, host election (first to create the room). Reconnect logic: a phone that reloads rejoins by room code plus player name and gets the current state.
- Phase 3, polish: kids mode toggle, card illustrations, sound, the scorecard showing each player's purchases and what moved their cash flow, and a replay viewer built from the action log.

## Engineering practices

These are the habits that separate a game that works at the kitchen table from one that breaks the second time it is played.

Repo and structure

- One GitHub repo under abeasley2020, pnpm workspace with three packages: engine (pure TypeScript), web (React + Vite), and shared (types and Zod schemas). Vite + React 18 + TypeScript strict mode, Tailwind v3, shadcn/ui, Zustand.
- CLAUDE.md at the root that states the engine-is-pure rule, the no-stored-derived-values rule, and the command set. Claude Code reads it on every session.
- Conventional commits, one feature per branch, squash merge to main. Main is always playable.

Testing strategy (the engine is where the tests live)

- Vitest unit tests for every reducer action and every selector. Target: every rule in the Core rules section has at least one named test.
- Property-based tests with fast-check that run thousands of random action sequences against the invariants listed under Game engine design. This is how you find the bug where a card vanishes or cash goes negative.
- Golden-game tests: three recorded full games stored as seed plus action log plus expected final state. Any rule change that alters them must be intentional.
- Playwright end-to-end test for the happy path on one device: create game, two players, ten turns, one purchase.
- Balance simulation script: play 1,000 games with simple bot strategies and report average game length, win rate by profession, and how often bankruptcy happens. Re-run after every card or number change. Target: no profession above 25 percent win rate, median game under 60 turns.

Continuous integration and deploy

- GitHub Actions on every pull request: typecheck, lint, unit tests, property tests. Playwright on main only.
- Vercel preview deploy on every pull request so the game can be opened on a phone before merge.
- Husky pre-commit hook for lint and typecheck so broken code never reaches a pull request.

Accessibility and user experience

- WCAG 2.2 AA: 4.5 to 1 contrast, 44 by 44 pixel touch targets on phone, full keyboard operation on laptop, screen reader labels on every money value and button.
- Numbers always show as currency with no decimals. Red for money out, green for money in, plus a text label so color is never the only signal.
- Every action has an undo within the same turn, until END\_TURN. Kids mis-tap.

Definition of done for any feature

1. Engine logic has unit tests and passes the property suite.
2. Typecheck and lint pass with zero warnings.
3. Feature works on an iPhone-size screen and a laptop in the Vercel preview.
4. Accessibility check passes with axe in Playwright.
5. Played once by a real family member, with notes captured in the repo under docs/playtests.

Device testing protocol

- Phase 1 runs on your laptop with Vite dev server. Phones join the same network through the laptop's local IP.
- Every playtest gets a dated markdown note: who played, what confused them, what broke, how long it ran. Balance changes come from these notes, not from guesses.

## Build plan and milestones

Eight weeks of evenings gets a networked game the family can play; the engine comes first and nothing is networked until the rules survive three playtests.

&#91;embedded content: build roadmap · 4 phases, 3 gates\]

Each gate is a pass or fail check, not a date. If G2 fails, the fix is in the cards and numbers, not in the UI.

First Claude Code session, in order:

1. Scaffold the pnpm workspace with engine, shared, and web packages. Commit the CLAUDE.md.
2. Write the shared types and Zod schemas for state, cards, and actions from the Game engine design section.
3. Write the six professions and 20 starter cards as JSON fixtures.
4. Implement ROLL, END\_TURN, and Payday crediting with tests. Nothing else until those pass.
5. Add one action at a time, test first, in this order: CHOOSE\_DEAL\_SIZE, BUY, PASS, BORROW, REPAY, PAY\_LIFESTYLE, SELL\_ASSET, ACCEPT\_MARKET, DECLINE\_MARKET, GIVE, SKIP\_GIVE.
6. Add the property-based invariant suite and run it on every action.

## Open decisions

- [ ] Game name. Working title is Freedom Loop. Needs a family vote.
- [ ] Dream purchases for the Freedom track: list 8 to 10 that mean something to your kids.
- [ ] Giving mechanic: keep the Favor token design above, or make giving purely a values choice with no in-game reward?
- [ ] Starting numbers: the six professions above are a first pass. Approve, or send me the ones you want and I will rebalance.
- [ ] Phase 2 trigger: how many clean single-device playtests before adding phones and rooms? Recommended: three.
