# Freedom Loop Spec, v2 (Wealth Edition)

Version 2, 2026-10-23. Andre Beasley.

v2 rebuilds the game around investing, delayed gratification, and a personal debrief for every player. The build plan and stage prompts live in `docs/plan-wealth-edition.md`. Rules marked **proposed** are numbers this spec picked where the plan gave only a rule; each is a tuning lever for Stage D or an open question at the end. Every v1 rule not changed here still holds.

## Purpose and design goals

A family board game, played on phones and a laptop, that teaches one idea: you are free when the money your assets earn each month covers what you spend each month. A disciplined investor should beat a big spender most of the time, and every player should finish knowing exactly why they won or lost.

- Players: 2 to 6. Adults and teens play standard mode; kids 7 to 10 play kids mode at the same table.
- Session length: about 60 minutes for 4 players in standard mode, 30 to 40 minutes in kids mode. A game that runs past 90 minutes loses the kids.
- Teaches the ten principles below, through decisions that feel like real life: vehicles, clothes, gadgets, subscriptions, big life spending, windfalls, setbacks, and many kinds of investments.
- Realistic without heavy math: every decision shows two numbers, cost today and change per month. Nothing else is needed to choose.
- Not for sale. Personal use only. All card content, names, art, and numbers are original.
- Platform: one web app. The laptop or TV shows the shared table; each player's phone shows their private finances, action buttons, and end-of-game debrief.
- Constraints: no accounts or logins, works on home Wi-Fi and over the internet, meets WCAG 2.2 AA so grandparents and kids can both read it.

## Principles

Every card, every Life Choices option, and every decision log event carries one or more principle ids. The debrief speaks only in these ten ideas, so players hear the same lessons game after game.

| Id | Principle | Adult text | Kids text |
| --- | --- | --- | --- |
| P1 | Emergency fund | Cash on hand turns a surprise bill into an inconvenience instead of new debt. | Keep money saved for surprises so they do not turn into debt. |
| P2 | Assets vs. liabilities | Assets put money in your pocket every month. Liabilities take it out. | Assets put money in your pocket. Liabilities take it out. |
| P3 | Cash flow beats looking rich | Monthly cash flow decides freedom; what you own on paper does not. | What you earn each month matters more than what you show off. |
| P4 | Delayed gratification | Money not spent today can be invested to pay you every month after. | Waiting for what you want can buy you freedom later. |
| P5 | Good debt vs. bad debt | Debt that buys income can pay for itself. Debt that buys things only costs you. | Borrow to buy things that pay you, not things that cost you. |
| P6 | Things lose value | Vehicles, clothes, and gadgets lose value the day you buy them. | Cars, clothes, and gadgets are worth less the day you buy them. |
| P7 | Small costs add up | A small monthly charge runs every month until you cancel it. | A little every month becomes a lot every year. |
| P8 | Compounding and patience | Growth that earns growth gets bigger every Payday you wait. | Money that grows keeps growing on top of itself. |
| P9 | Risk and diversification | A single stock or a single big deal can swing hard. Spread your bets. | Do not bet everything on one thing. |
| P10 | Generosity | Giving is part of what money is for. | Giving is part of what money is for. |

## Core rules

### Winning and game length

- **Escape:** a player escapes when passiveIncome is greater than or equal to totalExpenses at END_TURN. Escape ends the game at once and that player wins.
- **Round limit:** if nobody escapes, the game ends after round 15 in standard mode and round 10 in kids mode. A round is complete when every seat that is still in has taken a turn since the round began. A skipped turn (Setback) counts as that seat's turn. The game ends at the END_TURN that completes the final round. In engine terms (decided 2026-10-26): a round completes when END_TURN passes the turn to a seat at or before the seat that just played, after skipping out players and consuming skipped turns; that END_TURN logs `roundCompleted`, and roundNumber counts those events.
- **Freedom percentage:** freedomPercent = floor(passiveIncome × 100 / totalExpenses). It is a selector, never stored.
- **Winner at the limit:** highest freedomPercent among players still in. Ties go to higher cash, then higher netWorth, then the earlier seat.
- **Bankruptcy end:** if bankruptcy leaves fewer than two players in, the game ends and the survivor wins (v1 rule, kept). The round limit makes this rare.
- The Freedom track and dream purchases from v1 are dropped. The round limit replaces them.

### Turn sequence

The engine enforces this order; no step can be skipped by hand.

Every turn is one month. A round is one month for the whole family, so a 15-round game is 15 months.

1. Payday: at the start of every turn, before the roll, the engine credits the player's monthly cash flow (salary plus passive income minus totalExpenses), grows their growth assets (see Growth assets), and writes a paydaySnapshot log event. A player is paid every month, like real life, not only when they land on a space. A turn skipped by a Setback still gets its Payday.
2. Roll one six-sided die and move that many spaces.
3. Resolve the space landed on.
4. Optional actions: repay a loan in full or cancel a subscription (REPAY, never a mortgage), sell shares of a stock when that stock's card is drawn again, or borrow from the bank in $1,000 increments at 10 percent of principal per month. BORROW is legal when pending is none, buyOrPass, or lifeChoice; it adds the cash and the bank liability and leaves the same decision open. In every other pending state BORROW is rejected. REPAY is legal only when no decision is pending. Kids mode never allows BORROW.
5. END_TURN: the engine checks escape and the round limit, then advances to the next player.

### Board

24 spaces. There are no Payday spaces; Payday happens every turn (decided 2026-10-23, Q1). **Proposed** mix and order (Stage D may change the mix, still 24 spaces):

| Space | Count | Positions (proposed) |
| --- | --- | --- |
| Opportunity | 10 | 0, 3, 5, 8, 10, 13, 15, 18, 20, 23 |
| Life Choices | 6 | 1, 7, 11, 14, 19, 22 |
| Market | 4 | 2, 9, 16, 21 |
| Giving | 2 | 4, 17 |
| Setback | 2 | 6, 12 |

### Professions

Sixteen professions. Freedom percentage scoring puts every profession on equal terms, so the differences live only in salary, expenses, and debt. No special perks.

Restaurant Server, Retail Manager, Truck Driver, Welder, Electrician, Teacher, Police Officer, Firefighter, Army Sergeant, Nurse, Farmer, Real Estate Agent, Software Developer, Engineer, Pharmacist, Doctor.

Numbers rule (**proposed**; Stage C writes the numbers and records sources in `docs/content-notes.md`):

- salary: recent US median monthly pay for the job, rounded to $100.
- baseExpenses and starting liabilities: realistic for someone early in that career.
- Starting monthly cash flow (salary minus totalExpenses) between 10 and 25 percent of salary.
- Starting cash between one half and two months of totalExpenses.

The six v1 professions stay in the fixtures, with their v1 numbers, until Stage C replaces them.

Liability payments: the profession table's Expenses column is baseExpenses. Each liability adds a monthly payment, floored to whole dollars: student loan 1% of principal, car loan 2%, credit card 3%, mortgage 0% (the deal card's monthlyCashFlow is already net of the mortgage payment), bank loan 10%, lifestyle loan and Life Choices car loan the option's stated monthly payment, subscription the option's stated monthly cost with principal 0. totalExpenses = baseExpenses + the sum of those payments.

Mortgages (v1, kept): each financed deal creates one liability of kind mortgage, with principal equal to the card's mortgage, monthlyPayment 0, and the assetId of the asset it finances. When that asset is sold, the sale proceeds pay off the linked mortgage first and the player keeps the remainder. REPAY cannot target a mortgage; it is retired only by the sale.

### Setback (v1, kept)

Landing on Setback draws a Setback card and pays its cashCost immediately; there is no decision to make and the card goes to the discard pile. If cash cannot cover the cost, the engine auto-borrows from the bank in $1,000 steps (the smallest number of steps that covers the shortfall, as an ordinary bank liability at 10 percent) and the player skips their next turn. The player also skips their next turn when the card's skipTurn is true. A skipped turn is recorded as skipsNextTurn and cleared when END_TURN passes over the player. Kids mode: the Setback space does nothing.

### Bankruptcy (v1, kept)

A player who cannot cover a required payment sells assets at half price until covered. Setback costs are always covered by auto-borrowing, so the payment that triggers bankruptcy is a turn's Payday whose negative cash flow would take cash below zero. Sales are automatic: assets are sold in order of lowest monthly cash flow first, ties broken by lowest purchasePrice, each at pct(purchasePrice, 50) (growth assets at pct(marketValue, 50)), until cash is zero or more. Proceeds pay off the asset's linked mortgage first and the player keeps the rest. A sold deal card returns to its deck's discard pile; a stock lot or growth asset simply disappears. If all assets are gone and cash is still below zero, the player is out: isOut is set, cash is set to 0, and the player takes no further turns.

## Kids mode

Kids play at the same table, with the same board and the same kinds of choices. Differences:

- Round limit 10.
- Opportunity draws come from small deals only, with single-stock cards removed. Index funds and savings stay, so kids still see compounding.
- No BORROW. Setback spaces do nothing.
- Kids mode uses only cards and options marked kidsOk, and their numbers are round (multiples of $10 for monthly amounts, $100 for cash amounts).
- Every card and option shows kidsText. The debrief uses the kids reading level.
- Because every Life Choices card has an option with no monthly cost, and kids can always choose it, a kid is never stuck on a card they cannot pay. Bankruptcy rules still apply if subscriptions push monthly cash flow negative.

## Card decks

Five decks, all original content, stored as JSON and validated with Zod at load. The engine works with any deck size.

| Deck | Count | What it teaches | Example |
| --- | --- | --- | --- |
| Small deals | 40 | Savings, CDs, index funds, stocks, dividend stocks, small rentals, side hustles, vending routes; down payment $5,000 or less | Duplex in Decatur: price 50,000, down 5,000, cash flow +160/mo |
| Big deals | 25 | Apartment buildings, car wash, laundromat, franchise, land; $6,000 to $50,000 down | Laundromat: price 120,000, down 30,000, cash flow +1,400/mo |
| Market | 20 | Prices move, buyers appear, tenants leave, markets crash and recover | Buyer offers 2x purchase price for any small rental you own |
| Life Choices | 30 | Vehicles, clothing, gadgets, subscriptions, big life spending, windfalls | Your car is 9 years old: keep it, buy used, or buy new |
| Setback | 10 | Car repair, medical bill, job layoff, roof leak | Furnace dies: pay 3,500 |

Every card carries: id, deck, title, principles (at least one), kidsText (90 characters or fewer, 4th-grade reading level), adultText (160 characters or fewer), and kidsOk. No em dashes in any text.

### Deal cards

Fields: id, deck, title, type, price, downPayment, mortgage, monthlyCashFlow, plus the type-specific fields below. downPayment + mortgage = price.

Types: rental, business, land, stock, and the three growth types savings, cd, and index. There is no separate fund type (decided 2026-10-26).

Stock rules (v1, kept): stocks are bought with cash only (mortgage 0). When a stock card is drawn the engine rolls sharePrice inside priceRange; the player buys a whole number of shares up to sharesAvailable. Each BUY creates a lot with purchasePrice = shares × sharePrice and monthlyCashFlow = floor(shares × dividendPerShare). Stocks are sold only by the current player when the same stock card is drawn again at a new price; the decision then offers buy, sell, or pass. A stock card never leaves its deck. A partial sale shrinks the lot's purchasePrice and downPaid in proportion (floored).

### Growth assets

Savings accounts, CDs, and index funds are growth assets. They teach compounding (P8) and still count toward freedom.

- Bought with cash only. The card's price is its minimum investment (no separate field, decided 2026-10-26). The player chooses an amount in $100 steps between that minimum and their cash.
- The asset stores marketValue (starts at the amount invested), plus growthPercent and payoutPercent from the card.
- At each Payday (every turn), marketValue grows by pct(marketValue, growthPercent). This happens before cash flow is credited.
- The asset's monthly cash flow is derived, never stored: pct(marketValue, payoutPercent). As the value compounds, the payout grows with it.
- **Proposed ranges:** savings growthPercent 1, payoutPercent 0; CD growthPercent 2, payoutPercent 1; index fund growthPercent 3 to 5, payoutPercent 1. Stage D tunes within growthPercent 1 to 6 and payoutPercent 0 to 2.
- Market cards can move marketValue with changeMarketValue (a crash or a boom).
- Selling uses marketValue. A growth asset is sold with SELL_ASSET at any time when pending is none and the player has rolled this turn (turn step 4, like REPAY and BORROW; before the roll it is rejected with MUST_ROLL_FIRST, decided 2026-10-26).

### Market cards

Fields: id, title, principles, texts, effects (array), appliesTo (asset types).

Effects: offerBuyout, forceSale, changeCashFlow, splitShares (v1), plus changeMarketValue { percent } for growth assets, signed (a crash is negative).

Resolution (v1, kept): ACCEPT_MARKET applies the card's effects in order to the current player's assets whose type is in appliesTo. offerBuyout and forceSale sell at pct(purchasePrice, percentOfPurchasePrice) with the linked mortgage paid first. changeCashFlow adds delta to each qualifying asset. splitShares multiplies shares and leaves purchasePrice and monthlyCashFlow unchanged. changeMarketValue adds pct(marketValue, percent) to each qualifying growth asset, never below $0. pct floors, so a crash can cost up to $1 more than the exact percent; every percent in the engine floors the same way (decided 2026-10-26). offerBuyout sells one asset (the only qualifying one, or the one named by assetId). DECLINE_MARKET is legal only when every effect is an offerBuyout or the player owns no qualifying asset.

### Life Choices cards

Life Choices replaces Lifestyle. Each card is a real decision with two or three options. **At least one option on every card has no monthly cost.** The content tests hold a stronger rule (decided 2026-10-26): every card has a free option, meaning no payCash, addLoan, addSubscription, or investGrowth effect, and that option is kidsOk whenever the card is. That is what guarantees a kid is never stuck. Temptation is only a lesson when saying no is possible, so there are no required Life Choices cards; true emergencies live in the Setback deck.

Card fields: id, deck, category (vehicle, clothing, gadget, subscription, bigLife, windfall), title, principles, kidsText, adultText, kidsOk, options.

Option fields: id, label, principles, kidsText, adultText, kidsOk, effects (array). Effects:

- payCash { amount }
- gainCash { amount } (windfalls)
- addLoan { loanKind: car or lifestyle, principal, monthlyPayment } (the schema names this field loanKind, and investGrowth's type assetType, because kind is the effect discriminator; decided 2026-10-26)
- addSubscription { monthlyCost } (a subscription liability, principal 0)
- investGrowth { assetType: savings, cd, or index; amount, growthPercent, payoutPercent } (a windfall option that invests directly)
- repayLargestLoan { amount } (a windfall option that pays down the player's highest monthly-payment loan, never a mortgage or a subscription, by up to the amount. A percent-based loan (student, car, credit, bank) gets its payment recomputed from the new principal; a loan with a stated payment (lifestyle, Life Choices car loan) keeps that payment while its principal shrinks. Decided 2026-10-26.)

Each option shows two derived numbers, computed by an engine selector so the UI never does math: costToday (cash out, or cash in as negative) and monthlyChange.

Resolution: landing on Life Choices draws a card into the lifeChoice decision. CHOOSE_LIFE_OPTION { optionId } applies that option's effects. An option the player cannot afford in cash is rejected with INSUFFICIENT_CASH; in standard mode the player may BORROW first. The card goes to the discard pile.

Subscriptions keep charging every Payday until cancelled with REPAY, which removes a subscription liability at no cost.

### Setback cards

Fields: id, title, principles (always P1, plus others as fit), texts, cashCost, skipTurn.

### Giving

Giving spaces are not cards. Landing on one opens the giveOrSkip decision. GIVE pays 10 percent of cash and adds a Favor token; GIVE is rejected when 10 percent of cash floors to $0. SKIP_GIVE clears the decision. Favor tokens have no spend action in v2 (see open question Q4).

## Decision log

The debrief reads only the final state and the log. Every decision event records the facts the debrief needs at the moment of the decision, so the debrief never replays the game.

- Every decision event carries principles: BUY, PASS on a deal, SELL_ASSET, BORROW, REPAY, CHOOSE_LIFE_OPTION, GIVE, SKIP_GIVE, and Setback auto-loans.
- PASS on a deal records the card's monthlyCashFlow, its downPayment, and whether the player could afford it with cash on hand (affordable).
- CHOOSE_LIFE_OPTION records the chosen option's costToday and monthlyChange, and the same two numbers for the cheapest option on the card (lowest monthlyChange, then lowest costToday).
- BORROW records what the borrowed cash was for: the open decision (buyOrPass means an asset, lifeChoice means a want) or none.
- Setback auto-loans record the loan id, principal, and the card.
- A sold event carries its card's principles. For a growth asset bought through a windfall option that is the card's tags while the matching bought event carries the option's tags; the debrief attributes "growth asset held" to P8 either way (decided 2026-10-26).
- paydaySnapshot at every Payday: playerId, passiveIncome, totalExpenses, cash, and roundNumber.

## The debrief

At the end of the game, `debrief(state, playerId, readingLevel)` returns structured data for one player. The UI renders it; templates in `@ff/shared` turn it into words. Templates fill in numbers and never compute them.

Each player sees their own debrief on their own device. Pass-and-play shows a "hand the device to" screen between players. The table screen shows only the family ranking and the money-story chart.

Sections, in this order:

1. **Result:** "You reached 72% Freedom. Your assets paid $2,160 of your $3,000 monthly bills." A player who went out sees the round they ran out of money.
2. **Why you won or lost:** the three decisions with the largest absolute dollar impact.
3. **Decisions that helped:** up to three, positive impact, largest first, each with its principle.
4. **Decisions that hurt:** up to three, negative impact, largest first, each with its principle.
5. **Next time, try:** up to two suggestions built from the largest hurt decisions, each with the dollars and the freedomPercent points that would have changed. Freedom points for a monthly difference = floor(monthly difference × 100 / final totalExpenses).
6. **Money story:** passiveIncome and totalExpenses at every paydaySnapshot. The point where the lines cross is freedom.
7. **Principles practiced:** each principle tagged on at least one helped decision.

Winners see sections 4 and 5 too.

Attribution rules. "Paydays afterward" means the player's paydaySnapshot events after the decision, which is the number of months the decision kept paying or costing.

| Decision | Dollar impact | Helped or hurt | Principles |
| --- | --- | --- | --- |
| Life Choices option | (cheapest costToday minus chosen costToday) plus (cheapest monthlyChange minus chosen monthlyChange) × Paydays afterward | Hurt when below 0. Choosing the cheapest option is helped, with impact equal to what the most expensive option would have cost | Option's principles |
| Passed an affordable deal with positive cash flow | monthlyCashFlow × Paydays afterward, as a negative | Hurt | P2, P3 |
| Bought a deal | Cash flow received across Paydays afterward, plus sale proceeds minus cash paid when sold | Helped when above 0 | Card's principles |
| Bank loan | Total payments made, as a negative. Labeled asset, want, or setback from the BORROW record | Hurt when for a want or setback; neutral when for an asset (the asset's own row carries the result) | P5 |
| Setback auto-loan | Payments made on that loan, as a negative | Hurt | P1 |
| Subscription | monthlyCost × Paydays it ran, as a negative | Hurt | P7 |
| Growth asset held | Value gained plus payouts received | Helped | P8 |
| Gave | Amount given, shown as a positive, never a loss | Helped | P10 |

Reading levels: kids (short sentences, plain words, numbers rounded to $10) and adult (full numbers).

## Game engine design

The engine is a pure TypeScript package with zero React and zero Supabase imports. It takes a game state and an action and returns a new game state.

State model (one immutable object, serializable to JSON):

- game: id, mode (standard or kids), phase (lobby, playing, finished), turnNumber, currentPlayerId, rngSeed, rngState, log.
- players: id, name, professionId, position, cash, salary, assets, liabilities, favorTokens, isOut, hasEscaped, skipsNextTurn.
- assets: id, cardId, type, purchasePrice, downPaid, monthlyCashFlow (not stored for growth assets), shares if stock; marketValue, growthPercent, payoutPercent if growth.
- liabilities: id, kind (student, car, credit, mortgage, bank, lifestyle, subscription), principal, monthlyPayment; sourceCardId for lifestyle, car loans from Life Choices, and subscriptions; assetId for mortgages.
- decks: drawPile and discardPile per deck (smallDeals, bigDeals, market, lifeChoices, setback).
- pending: none, chooseDealSize, buyOrPass, marketChoice, lifeChoice, giveOrSkip.

Derived values are never stored: passiveIncome, debtPayments, totalExpenses, monthlyCashFlow, netWorth, canEscape, freedomPercent, roundNumber, growth asset cash flow, option costToday and monthlyChange, legal actions.

Actions: ROLL, CHOOSE_DEAL_SIZE, BUY (with shares for stocks, amount for growth assets), PASS, SELL_ASSET, BORROW, REPAY, CHOOSE_LIFE_OPTION, ACCEPT_MARKET, DECLINE_MARKET, GIVE, SKIP_GIVE, END_TURN. PAY_LIFESTYLE is removed. Every action carries the acting playerId.

Invariants (v1, kept, extended): cash never negative for a player who is in; deck conservation per deck including the pending card; only the current player acts; exactly one pending decision; END_TURN only with pending none; replay determinism. New: every subscription has principal 0; every growth asset has marketValue of 0 or more; the game never runs past the round limit.

## Architecture and stack

One React app serves two routes: the table screen for the laptop and the player screen for phones. The engine runs only on the host. Phones send actions and render state.

Stack: React 18 + Vite + TypeScript strict, Tailwind v3, shadcn/ui, Zustand for client state, Zod for validation, Supabase Postgres plus Realtime for rooms, Vercel deploys from the abeasley2020 GitHub repo. No AI call in the game.

Phases: build stages A through H in `docs/plan-wealth-edition.md`. Phase 1 (single device, pass-and-play, private debriefs by handing the device) is Stage F. Phase 2 (rooms, private phone debriefs) is Stage G.

## Engineering practices

Repo, testing, CI, and accessibility rules from v1 still hold (see CLAUDE.md). Changes:

- Balance simulation targets, over 1,000 games at 2 to 4 players: at least 70% of games end by escape or the round limit; at most 20% of seats go bankrupt; every profession's win rate between 20% and 45%; Wealth Builder beats Big Spender in at least 70% of head-to-head games; best strategy beats worst by at least 15 points; median game between 10 and 15 rounds; kids mode never stuck, median at or under 10 rounds.
- Content tests: every principle on at least 3 cards; every Life Choices card has an option with no monthly cost; small-deal down payments $5,000 or less; growth asset percents inside the ranges above; text length limits; no em dashes.
- Accessibility: WCAG 2.2 AA; option cards show costToday and monthlyChange as text, never color alone.

Definition of done (v1, kept): engine tests and property suite pass; typecheck and lint with zero warnings; works on a phone-size screen and a laptop; axe check passes; played once by a family member with notes in docs/playtests.

## Open decisions (carried from v1)

- [ ] Game name. Working title is Freedom Loop. Needs a family vote.
- [ ] Phase 2 trigger: how many clean single-device playtests before adding phones and rooms? Recommended: three.

## v2 open questions

All eleven were decided by Andre on 2026-10-23. Each answer is now a rule.

| # | Question | Recommended default |
| --- | --- | --- |
| Q1 | How often is Payday? | **Decided 2026-10-23:** every turn is a month and every player is paid at the start of every turn. No Payday spaces. |
| Q2 | Growth asset math | **Decided 2026-10-23:** growthPercent per Payday (per month), so compounding is visible in one game; cash flow = pct(marketValue, payoutPercent). Ranges as listed under Growth assets. |
| Q3 | Does a skipped turn count toward the round? | **Decided 2026-10-23:** Yes. A Setback costs a turn, not a round. |
| Q4 | Favor tokens | **Decided 2026-10-23:** Keep earning them; still no spend action. Revisit after playtests. The debrief already rewards giving as a helped decision. |
| Q5 | Profession numbers rule | **Decided 2026-10-23:** Starting cash flow 10 to 25 percent of salary, starting cash one half to two months of totalExpenses, as written under Professions. |
| Q6 | Kids and subscriptions | **Decided 2026-10-23:** Kids may take subscriptions; bankruptcy rules apply. This keeps P7 in kids mode. |
| Q7 | Undo (CLAUDE.md gap) | **Decided 2026-10-23:** Undo is a host-side stack of states, not a reducer action, and cannot go back past the most recent ROLL or card draw. |
| Q8 | Board order | **Decided 2026-10-23:** The proposed positions above. Stage D may change the mix. |
| Q9 | Growth asset sales | **Decided 2026-10-23:** Sellable any time pending is none, at marketValue. |
| Q10 | Debrief for a player who went out | **Decided 2026-10-23:** Same seven sections; the result line names the round they ran out of money. |
| Q11 | Life Choices "needs" | **Decided 2026-10-23:** No required Life Choices cards. Needs (repairs, medical, layoffs) live in the Setback deck. |
