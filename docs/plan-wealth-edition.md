# Wealth Edition plan

The game is rebuilt around one test: a disciplined investor should beat a big spender most of the time, and every player should finish knowing exactly why they won or lost. The engine from Stages 3 and 4 stays; the rules, content, scoring, and a new debrief layer change.

`docs/spec.md` is the source of truth for rules. This file is the build plan and the prompts for each stage. Where the two disagree, the spec wins.

## 1. The principles the game teaches

Every card, option, and decision carries one or more principle tags. The debrief speaks in these ten ideas and nothing else, so kids hear the same lessons game after game.

| Id | Principle | Kids version |
| --- | --- | --- |
| P1 | Emergency fund | Keep money saved for surprises so they do not turn into debt. |
| P2 | Assets vs. liabilities | Assets put money in your pocket. Liabilities take it out. |
| P3 | Cash flow beats looking rich | What you earn each month matters more than what you show off. |
| P4 | Delayed gratification | Waiting for what you want can buy you freedom later. |
| P5 | Good debt vs. bad debt | Borrow to buy things that pay you, not things that cost you. |
| P6 | Things lose value | Cars, clothes, and gadgets are worth less the day you buy them. |
| P7 | Small costs add up | A little every month becomes a lot every year. |
| P8 | Compounding and patience | Money that grows keeps growing on top of itself. |
| P9 | Risk and diversification | Do not bet everything on one thing. |
| P10 | Generosity | Giving is part of what money is for. |

## 2. Professions

Win by Freedom percentage, not dollars, so a server and a doctor compete on equal terms. Target 14 to 16 professions, salary from recent US median pay rounded to $100, with realistic early-career expenses and debt. Starting list: Restaurant Server, Retail Manager, Truck Driver, Welder, Electrician, Teacher, Police Officer, Firefighter, Army Sergeant, Nurse, Farmer, Real Estate Agent, Software Developer, Engineer, Pharmacist, Doctor. No special perks; the differences live in salary, expenses, and debt.

## 3. Decisions players face

Realistic without heavy math: every decision shows two numbers, cost today and change per month, and nothing else is required to choose.

| Area | Choices in the game | Principles |
| --- | --- | --- |
| Investing, safe | Savings account, CD, index fund that grows every month | P1, P8 |
| Investing, stocks | Single stocks with price swings, dividend stocks | P8, P9 |
| Real estate | Single-family rental, duplex, apartment building, land | P2, P3, P5 |
| Business | Vending route, car wash, laundromat, franchise, side hustle | P2, P3, P9 |
| Vehicles | Keep current car, buy used, buy new, lease | P4, P5, P6 |
| Clothing and gadgets | Designer shoes, new phone, gaming system, or skip | P4, P6 |
| Recurring costs | Streaming, gym, meal delivery, phone plan upgrades (cancel anytime) | P7 |
| Big life spending | Vacation, bigger house, wedding, boat | P3, P4 |
| Windfalls | Bonus, tax refund, inheritance: spend, pay debt, or invest | P4, P5, P8 |
| Setbacks | Car repair, medical bill, job layoff, roof leak | P1 |
| Giving | Give 10 percent of cash on a Giving space | P10 |

The Lifestyle deck becomes a Life Choices deck. Each card offers two or three options, and at least one option costs nothing per month. Temptation is only a lesson when saying no is possible.

## 4. Scoring and game length

- Escape (passive income covers totalExpenses) ends the game at once. That player wins.
- Otherwise the game ends after 15 rounds (kids mode 10). Winner has the highest Freedom percentage: passive income divided by totalExpenses. Ties go to cash, then net worth.
- Expected length: about 60 minutes for 4 players, 30 to 40 minutes in kids mode.

## 5. Kids mode

Kids play at the same table with the same rules. Differences: round numbers, 10-round limit, no single stocks, no bank loans, every card shows a kidsText line of 90 characters or fewer, and the debrief uses the kids reading level. Nuance stays because the options stay: a kid still chooses between a used bike and a new one and sees the monthly difference.

## 6. The debrief

Each player sees their own debrief on their own device at the end. Pass-and-play in Phase 1 shows a "hand the device to" screen between players; Phase 2 sends each debrief privately to each phone. The table screen shows only the family ranking and the money-story chart.

What every player sees, in this order:

1. Result: "You reached 72% Freedom. Your assets paid $2,160 of your $3,000 monthly bills."
2. Why you won or lost: the three biggest drivers, in dollars.
3. Decisions that helped: up to three, each with its dollar impact and principle.
4. Decisions that hurt: up to three, same format.
5. Next time, try: two concrete suggestions with the numbers that would have changed.
6. Money story chart: passive income and totalExpenses every month; the crossing point is freedom.
7. Principles practiced: the tags this player acted on well.

Winners get sections 4 and 5 too. Knowing why you won includes knowing what you left on the table.

The engine computes every number from the log with simple attribution rules. No re-simulation; randomness would make "what if" answers unreliable.

| Decision | Dollar impact | Principle |
| --- | --- | --- |
| Life Choices option chosen | Difference from the cheapest option: cash today plus monthly difference times Paydays received afterward | P4, P6, P7 |
| Passed an affordable deal with positive cash flow | Cash flow times Paydays received afterward | P2, P3 |
| Bought a deal | Cash flow received, plus or minus any sale result | P2, P3 |
| Bank loan | Total payments made, labeled by what it funded: an asset, a want, or a setback | P5 |
| Setback forced a loan | Payments made on that loan | P1 |
| Subscription kept | Monthly cost times Paydays it ran | P7 |
| Index fund held | Growth gained plus dividends | P8 |
| Gave | Amount given, never scored as a loss | P10 |

Text comes from templates keyed by principle and reading level (kids, adult). Templates only fill in numbers the engine computed.

## 7. Build stages

| Stage | Work | Runs | Andre's gate |
| --- | --- | --- | --- |
| A | Spec v2 from this plan | Attended, plan mode | Read the diff, answer open questions (30 min) |
| B | Engine v2 rules | Unattended | Read the Morning summary |
| C | Professions and full card decks | Unattended | Read docs/cards.md for realism (45 min) |
| D | Balance tuning with the simulator | Unattended | Read docs/sim/tuned.md |
| E | Debrief engine | Unattended | Read docs/debrief-samples.md: does it teach? |
| F | Single-device UI with debrief | Attended, plan mode | Play a full game on the laptop |
| G | Rooms and private phone debriefs | Attended, plan mode | Four phones finish a game |
| H | Family playtests and polish | Attended | Three family games, notes in docs/playtests |

Stages F, G, and H replace Stages 5 through 7 of the earlier prompt list. Run `/clear` before every stage. For unattended stages, allow `pnpm` and `git` in `/permissions`, switch to accept-edits mode, and keep the laptop awake.

## 8. Prompts

Stage A, attended, plan mode (done 2026-10-23: spec v2 written, open questions at the end of docs/spec.md)

```markdown
Read CLAUDE.md, STATUS.md, docs/spec.md, docs/sim/first-run.md, and docs/plan-wealth-edition.md. Andre approves all six "Decisions made alone tonight"; mark them confirmed in STATUS.md.

Rewrite docs/spec.md as v2 from plan sections 1 through 6: principles, professions, decisions and the Life Choices deck, scoring and round limit, kids mode, and the debrief with its attribution table. Keep every v1 rule the plan does not change. Where the plan gives a rule but not a number, propose one and mark it "proposed". Do not write code.

End the spec with "v2 open questions": every decision you could not make from the plan, each with a recommended default. Update the Spec gaps list in CLAUDE.md to match. Show me the full diff and wait for approval before committing with "docs: spec v2, wealth edition".
```

Stage B, unattended

```markdown
You are working unattended; Andre is not available. Read CLAUDE.md, STATUS.md, docs/spec.md (v2), and docs/plan-wealth-edition.md.

Implement the v2 engine rules test-first per CLAUDE.md Rule 3. One branch per item, squash merge only on green pnpm check, push main after each merge:
1. Principle ids P1 to P10 in @ff/shared. A principles field on every card, every Life Choices option, and every decision log event (BUY, PASS, BORROW, REPAY, SELL_ASSET, GIVE, SKIP_GIVE, CHOOSE_LIFE_OPTION, Setback auto-loans).
2. Life Choices deck replacing Lifestyle, exactly as docs/spec.md describes: cards with 2 or 3 options, each option a list of typed effects. New action CHOOSE_LIFE_OPTION { optionId } replaces PAY_LIFESTYLE. Subscriptions are liabilities of kind subscription with principal 0, so REPAY cancels one at no cost.
3. Growth assets per docs/spec.md: marketValue grows at each Payday the owner receives, and their cash flow is derived from marketValue by a selector. netWorth and sales use marketValue.
4. Round limit (15 standard, 10 kids) and the freedomPercent and roundNumber selectors. Winner at the limit by freedomPercent, then cash, then netWorth. Escape still ends the game at once.
5. The decision-time facts and paydaySnapshot log events that docs/spec.md "Decision log" requires, so the debrief reads from the log alone.
6. Property suite generators and invariants extended to every new action and effect.
Then update the sim bots to play v2 through reduce only.

Convert the 21 existing cards to the new schema and add only the fixtures tests need. Full content is Stage C. Regenerate the golden games once at the end; Andre approves, and the commit message must name the v2 rule changes. Questions go in STATUS.md with a default; skip what is blocked and continue. Finish with a Morning summary at the top of STATUS.md.
```

Stage C, unattended

```markdown
You are working unattended. Read CLAUDE.md, STATUS.md, docs/spec.md, and docs/plan-wealth-edition.md sections 2, 3, and 5.

Write the v2 content in @ff/shared/src/data:
- The 16 professions in docs/spec.md. Monthly salary from recent US median pay for the job, rounded to $100. baseExpenses and starting liabilities per the spec's profession rule. Record the source or reasoning for each in docs/content-notes.md.
- Full decks at spec counts: 40 small deals, 25 big deals, 20 market, 30 Life Choices, 10 setback. All original content, realistic 2026 prices. Cover every row of the plan's decisions table.
- Every card and option carries at least one principle, a kidsText of 90 characters or fewer at a 4th-grade reading level, and an adultText of 160 characters or fewer. No em dashes in any text.
- Fixture tests: every principle appears on at least 3 cards; every Life Choices card has an option with no monthly cost; small-deal down payments are $5,000 or less; growth assets stay inside the spec's growthPercent and payoutPercent ranges; text length limits hold.
- Generate docs/cards.md: a readable catalog of every profession and card, grouped by deck, with numbers and both texts, so Andre can review realism in one sitting.
Do not tune for balance; that is Stage D. Same unattended rules as Stage B. Finish with a Morning summary.
```

Stage D, unattended

```markdown
You are working unattended. Read CLAUDE.md, STATUS.md, docs/spec.md, docs/sim/first-run.md, and docs/cards.md.

Add two named bots if missing: Wealth Builder (keeps three months of totalExpenses as an emergency fund, picks the no-monthly-cost Life Choices option, buys deals by cash flow per $1,000 down, borrows only for positive cash flow assets) and Big Spender (picks the most expensive Life Choices option, buys deals only with leftover cash, borrows freely). Keep the existing bots.

Tune to these targets, measured by pnpm sim over 1,000 games at 2 to 4 players:
- At least 70% of games end by escape or the round limit, not by last player standing.
- At most 20% of seats go bankrupt.
- Every profession's win rate between 20% and 45%.
- Wealth Builder beats Big Spender in at least 70% of head-to-head games, and the best strategy beats the worst by at least 15 points overall.
- Median game between 10 and 15 rounds.
- Kids mode: 1,000 games, none stuck, median at or under 10 rounds.

Levers you may change: card numbers and the mix within spec deck counts, the board space mix (still 24 spaces), Setback costs, growthPercent and payoutPercent within the spec's ranges. Do not change the 10% bank rate, liability payment percents, professions, or any rule without writing it in STATUS.md as a question.

Work in rounds: change one lever, run pnpm sim, add a row to docs/sim/tuning-log.md (what changed, every target number), keep or revert. Stop when all targets are met or after 30 rounds. Regenerate docs/cards.md and the golden games once at the end; Andre approves, and the commit must say tuning changed them. Save the final report as docs/sim/tuned.md and finish with a Morning summary.
```

Stage E, unattended

```markdown
You are working unattended. Read CLAUDE.md, STATUS.md, docs/spec.md debrief section, and docs/plan-wealth-edition.md section 6.

Implement debrief(state, playerId, readingLevel) in packages/engine/src/debrief/ as a pure function of the final state and log. Return structured data, not prose: result, freedomPercent, top three drivers, up to three helped and three hurt decisions each with dollar impact and principle, up to two next-time suggestions with counterfactual numbers, the money-story series from paydaySnapshot events, and principles practiced. Winners get hurt decisions and suggestions too.

Use exactly the spec's attribution table. Text comes from templates in @ff/shared keyed by principle and reading level (kids, adult); templates fill in numbers and never compute them.

Test-first: one test per attribution rule using hand-built logs, plus a property test that every debrief references only events in the log and every dollar figure is an integer. Then generate docs/debrief-samples.md with debriefs from six sim games: winner and one loser from each of three games (one kids mode, one Wealth Builder vs Big Spender, one mixed), both reading levels, so Andre can judge whether it teaches. Same unattended rules. Finish with a Morning summary.
```

Stage F, attended, plan mode, one session per numbered item

```markdown
Read CLAUDE.md, STATUS.md, docs/spec.md, and docs/plan-wealth-edition.md. Build the single-device web app in packages/web with Tailwind v3, shadcn/ui, and Zustand holding only engine state. Add formatMoney and legalActions(state, playerId) first if missing. WCAG 2.2 AA: 4.5 to 1 contrast, 44 px touch targets, keyboard operable, labels on every value. The UI never computes money; it calls engine selectors and dispatches actions.
Session F1: lobby. Add 2 to 6 players, each picks a profession from cards showing salary, totalExpenses, and debt; choose standard or kids mode.
Session F2: game screen. Board, whose turn, current player's finances, and the pending decision as option cards. Every option card shows cost today and change per month as two chips, plus kidsText or adultText by mode. Undo per spec.
Session F3: end of game. Family ranking and money-story chart on the table view, then a hand-the-device screen and each player's private debrief in the spec's seven-section order, with a More detail toggle in kids mode. Playwright happy path plus axe check.
Commit after each session; tell me the local URL to test.
```

Stage G, attended, plan mode

```markdown
Read CLAUDE.md, STATUS.md, docs/spec.md Architecture, and docs/plan-wealth-edition.md section 6. Add Supabase rooms: games table (room_code, state jsonb, host_player_id, updated_at), a Realtime channel per room, host creates a 4-letter code, phones join by code and name. Only the host runs reduce; phones send actions and render state. Phone route shows only that player's finances and buttons. At game end each phone shows only its own debrief; the table shows the ranking and chart. Reconnect by code and name. Playwright test with one host and two players through three turns and the end screen. Keep pass-and-play as a mode.
```

Stage H, attended

```markdown
Read docs/playtests/ and STATUS.md. Here are my notes from today's family game: [paste notes]. Propose the smallest set of card, text, or rule changes that address them, show me the list, and wait for approval. After approval, implement, rerun pnpm sim to confirm targets still hold, and update docs/cards.md.
```
