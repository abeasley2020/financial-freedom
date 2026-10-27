# Content notes (Stage C)

Where the profession and card numbers come from, and what the content is meant to teach. `docs/cards.md` is the full catalog; regenerate it with `node scripts/cards-catalog.mjs` after any JSON change.

## Professions

**Salary** is gross median pay, divided by 12 and rounded to $100. The source is the U.S. Bureau of Labor Statistics *Occupational Outlook Handbook* "median pay" figures (May 2023 wage data, published in the 2024 edition). The figures were taken from memory of those tables, not looked up again in this session. **Andre: spot-check any that look off before Stage D.** The Army Sergeant and the Doctor are worked out differently, as described below.

**Because salary is gross, baseExpenses includes income and payroll taxes** along with housing, food, insurance, and transportation. That is why baseExpenses runs about 70 to 80 percent of salary. The v1 numbers were closer to take-home pay; the spec now asks for median pay.

**Starting debt** uses the spec's liability kinds and percents (student 1%, car 2%, credit 3% of principal per month). It is sized for someone a few years into the career. Each profession's starting monthly cash flow lands between 12 and 17 percent of salary, and its starting cash between 0.55 and 0.70 months of totalExpenses. Both are inside the spec rule (10 to 25 percent, and one half to two months). The engine test `packages/engine/src/professions.test.ts` checks this rule through the real selectors.

| Profession | BLS occupation used | Annual median | Monthly (rounded) | Debt reasoning |
| --- | --- | ---: | ---: | --- |
| Restaurant Server | Waiters and waitresses (includes reported tips) | $31,940 | $2,700 | Older car, small card balance, no degree |
| Retail Manager | First-line supervisors of retail sales workers | $47,600 | $4,000 | Some college, modest car loan |
| Truck Driver | Heavy and tractor-trailer truck drivers | $54,320 | $4,500 | Personal pickup loan; CDL school assumed employer-paid |
| Welder | Welders, cutters, solderers, and brazers | $48,940 | $4,100 | Trade school loan, truck loan |
| Electrician | Electricians | $61,590 | $5,100 | Apprenticeship (no student debt), work truck loan |
| Teacher | Elementary school teachers | $63,680 | $5,300 | Bachelor's plus master's student loans |
| Police Officer | Police and detectives | $74,910 | $6,200 | Academy paid by the department; car loan |
| Firefighter | Firefighters | $57,120 | $4,800 | EMT certificate loan, car loan |
| Army Sergeant | E-5 regular military pay (see below) | about $61,000 | $5,100 | No student debt; the classic young-soldier car loan |
| Nurse | Registered nurses | $86,070 | $7,200 | BSN student loans, car loan |
| Farmer | Farmers, ranchers, and other agricultural managers | $83,770 | $7,000 | Farm pickup loan, higher card balance for seasonal cash gaps |
| Real Estate Agent | Real estate sales agents | $54,300 | $4,500 | A nicer car for showing homes (P6 on purpose), card balance from slow months |
| Software Developer | Software developers | $132,270 | $11,000 | Bachelor's student loans, newer car |
| Engineer | Civil engineers | $95,890 | $8,000 | Bachelor's student loans, car loan |
| Pharmacist | Pharmacists | $136,030 | $11,300 | Pharm.D. student loans of about $160,000, a typical balance |
| Doctor | Physicians, all (BLS reports "$239,200 or more") | $239,200 | $19,900 | Medical school loans of about $200,000, a $40,000 car, a large card balance |

**Army Sergeant:** BLS has no median for enlisted ranks. The figure adds three pieces of regular military compensation: an E-5's basic pay at about four years of service (about $3,600 a month on the 2025 table), the food allowance (BAS, about $460), and a mid-range housing allowance (BAH, about $1,000) for a soldier without dependents. That totals about $5,100 a month. BAH and BAS are not taxed, so this profession's baseExpenses is a little lower than a civilian's at the same pay.

**Doctor:** BLS publishes only a floor for physicians, so the game uses that floor. Early-career pay right after residency is lower. Stage D may want a lower salary and a smaller starting debt, which also matters for balance (see below).

## Cards

All 125 cards are original. The 26 cards from Stages 3 and B kept their ids and numbers, because engine tests name them. The other 99 are new. Deck counts match the spec: 40 small deals, 25 big deals, 20 market, 30 Life Choices, 10 setback.

**Coverage of the plan's decisions table** (`docs/plan-wealth-edition.md`, section 3):

| Area | Where it lives |
| --- | --- |
| Investing, safe | 3 savings, 3 CDs (small), 1 jumbo CD (big), 6 index funds. Windfall options invest straight into savings or an index fund |
| Investing, stocks | 7 single stocks (4 pay a dividend, 3 do not, from penny biotech to utilities). None is kidsOk |
| Real estate | 10 small rentals (mobile home to duplex), 10 big rentals (fourplex to strip mall), 3 land cards |
| Business | 11 small side hustles (vending, lawn care, dog walking, food truck share), 11 big businesses (laundromat, car wash, franchise, storage, child care) |
| Vehicles | 5 cards: keep, buy used with cash, finance new, or lease. A lease is a car loan whose principal is the remaining lease payments, so paying it off early costs the whole balance |
| Clothing and gadgets | 4 clothing and 5 gadget cards: sneakers, coats, phones, consoles, laptops, smart home |
| Recurring costs | 6 subscription cards (streaming, gym, meal kits, phone plan, delivery, music), plus subscriptions bundled into gadget and clothing options |
| Big life spending | Beach week, bigger house, destination wedding, boat, and a giving card (neighbor's house fire) |
| Windfalls | Tax refund, work bonus, inheritance, garage sale, overtime. Each offers spend, invest or save, and pay down debt (or keep the cash) |
| Setbacks | 10 cards from $900 (car repair) to $4,000 (roof). Two skip a turn (job loss, broken wrist), and one is helping family (P1 and P10) |
| Giving | Giving spaces (engine), plus P10 on three cards: the neighbor's fire, the inheritance (give and invest), and family needs help |

**Rules the content tests enforce** (`packages/shared/src/data/data.test.ts`):

- Every principle appears on at least 3 cards. P10 is on exactly 3, so it is the thinnest.
- Every Life Choices card has a free option, kidsOk whenever the card is (the stronger rule decided 2026-10-26).
- Small-deal down payments are $5,000 or less. Big-deal down payments are $6,000 to $50,000.
- Growth percents stay inside growthPercent 1 to 6 and payoutPercent 0 to 2, on deal cards and on windfall investGrowth options. The content uses the spec's proposed values: savings 1 and 0, CD 2 and 1, index 3 to 5 and 1.
- Kids numbers are round: multiples of $100 for cash and $10 for monthly amounts, on every kidsOk card and option.
- Every asset type, Life Choices category, Life Choices effect, and Market effect appears at least once.
- Text limits (kidsText 90, adultText 160) and no em dashes. The Zod schemas enforce these too.

**Realism notes for Andre's review:**

- Small rentals are priced like small-town Midwest property ($30,000 to $110,000) with 3.5 to 10 percent down, close to FHA and small-investor terms. Coastal prices would not fit under the $5,000 small-deal cap.
- Cash flows are generous next to real life. "Return on cash" in `docs/cards.md` runs 36 to 90 percent a year on small deals and up to 72 percent on big ones (land is negative). That is gamey on purpose (the v1 cards set it), and it is Stage D's main lever.
- Stock dividends are whole dollars per share per month (the schema's rule), so a $1 dividend on an $85 share is about a 14 percent yield. That is far above real dividend stocks, and a known limit of whole-dollar money.
- Life Choices prices are 2026 retail: $1,000 phone, $500 console, $26,000 new car at $520 a month, $7,000 used car, $300 sneakers.

## What the simulator says (not tuned; Stage D)

Reports: `docs/sim/stage-c-content.md` (standard) and `docs/sim/stage-c-content-kids.md`.

- Standard games: 99.4% end at the round limit, 0% by escape, and 0.6% with one player left. 0.9% of seats go bankrupt. The median game is 43 turns (14.3 rounds per player).
- Win rates spread from 4.4% for the Restaurant Server (also 12% bankrupt) to 59.9% for the Doctor. Pharmacist 51.8% and Software Developer 45.2% are also above the 45% target. The Restaurant Server is the only one below the 20% floor; the Welder (21.9%) sits just above it. Freedom percentage does not level the field on its own: higher pay leaves more cash to invest from turn one.
- Kids mode: 100% end at the round limit, nobody is stuck, and nobody goes bankrupt.
