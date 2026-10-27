# Debrief samples (Stage E)

Generated 2026-10-27 by `pnpm debrief:samples` (seed search from 20261023). Six debriefs from three bot games: the winner and one loser of a kids game, a Wealth Builder vs Big Spender game, and a mixed game, each at both reading levels. Andre's gate for Stage E: **does it teach?**

Everything below is produced by the engine and the templates the UI will use: `debrief(state, playerId, readingLevel)` in `packages/engine/src/debrief/` computes every number from the final state and the log, and `renderDebrief` in `packages/shared/src/debriefText.ts` fills the templates. Only the money story is drawn here as a table; the UI draws it as the two-line chart. The players are bots, so their choices follow fixed rules (`packages/engine/sim/bots.ts`), not judgment.

How the numbers are attributed is the spec table (docs/spec.md, The debrief). Where it would count the same dollars twice, the readings below were picked and are listed in STATUS.md under Questions for Andre:

- A growth asset (savings, CD, index fund), bought from a deal or a windfall, is scored once, as "growth asset held".
- A Life Choices row counts spending, not saving: money an option invests or uses to pay down a loan is still yours, so it is not a cost there.
- A subscription is scored once, on its own row, for the months it actually ran.
- Cash a Generosity option gives away is a gift (helped), never a cost.
- A Setback loan is scored once, as a Setback loan (P1).

## Game 1: Kids mode

Seed 20261024, kids mode, 3 seats, ended by round limit (10 rounds). Picked as the first 3- or 4-seat kids game from the seed where the winner has a helped decision and last place has a hurt one.

| Seat | Profession | Bot | Final Freedom | Result |
| --- | --- | --- | ---: | --- |
| 1 | Firefighter | Big Spender | 20% | won |
| 2 | Real Estate Agent | Aggressive | 3% | lost |
| 3 | Real Estate Agent | Wealth Builder | 15% | lost |

### Winner: Seat 1, Firefighter (Big Spender bot)

#### Kids reading level

**How you did**

- You reached 20% Freedom! Your assets paid $820 of your $4,010 bills each month.
- You won!

**Your biggest moves**

- You said no to Bounce House Rentals. It would have paid you $3,900.
- You picked "Spend it". "Pay down your biggest loan" would have saved you $2,280.
- You said no to Online Tutoring Business. It would have paid you $1,840.

**Good moves**

- You bought Cabin Share by the Lake. It paid you $700!

**Moves that cost you**

- You said no to Bounce House Rentals. It would have paid you $3,900.
- You picked "Spend it". "Pay down your biggest loan" would have saved you $2,280.
- You said no to Online Tutoring Business. It would have paid you $1,840.

**Next time, try**

- Assets put money in your pocket. Next time, say yes to Bounce House Rentals. That is worth $3,900 and 16 more Freedom points.
- Waiting can buy you freedom. Next time, pick "Pay down your biggest loan". That is worth $2,280.

**Your money story**

| Round | Assets paid | Bills |
| ---: | ---: | ---: |
| 1 | $0 | $3,990 |
| 2 | $0 | $3,990 |
| 3 | $0 | $3,990 |
| 4 | $0 | $3,990 |
| 5 | $0 | $3,990 |
| 6 | $0 | $3,990 |
| 7 | $0 | $4,010 |
| 8 | $0 | $4,010 |
| 9 | $350 | $4,010 |
| 10 | $350 | $4,010 |
| end | $820 | $4,010 |

Your assets paid $820 of your $4,010 bills. Keep going!

**What you practiced**

- Assets vs. liabilities: Assets put money in your pocket. Liabilities take it out.
- Risk and diversification: Do not bet everything on one thing.

#### Adult reading level

**Result**

- You reached 20% Freedom. Your assets paid $820 of your $4,010 monthly bills.
- You won after 10 rounds.

**What made the biggest difference**

- -$3,900: You passed on Bounce House Rentals, which would have paid $650 a month for 6 months. (Assets vs. liabilities, Cash flow beats looking rich)
- -$2,280: You chose "Spend it" over "Pay down your biggest loan" on Tax Refund, which meant $2,000 more spent today and $40 a month more for 7 months. (Delayed gratification, Things lose value)
- -$1,840: You passed on Online Tutoring Business, which would have paid $230 a month for 8 months. (Assets vs. liabilities, Cash flow beats looking rich)

**Decisions that helped**

- +$700: You bought Cabin Share by the Lake. It paid you $700 over 2 months. (Assets vs. liabilities, Risk and diversification)

**Decisions that hurt**

- -$3,900: You passed on Bounce House Rentals, which would have paid $650 a month for 6 months. (Assets vs. liabilities, Cash flow beats looking rich)
- -$2,280: You chose "Spend it" over "Pay down your biggest loan" on Tax Refund, which meant $2,000 more spent today and $40 a month more for 7 months. (Delayed gratification, Things lose value)
- -$1,840: You passed on Online Tutoring Business, which would have paid $230 a month for 8 months. (Assets vs. liabilities, Cash flow beats looking rich)

**Next time, try**

- Own assets that pay you: buy Bounce House Rentals when you can. That was worth $3,900 and 16 Freedom points.
- Wait for what you want: choose "Pay down your biggest loan" on Tax Refund. That was worth $2,280.

**Money story**

| Round | Assets paid | Bills |
| ---: | ---: | ---: |
| 1 | $0 | $3,990 |
| 2 | $0 | $3,990 |
| 3 | $0 | $3,990 |
| 4 | $0 | $3,990 |
| 5 | $0 | $3,990 |
| 6 | $0 | $3,990 |
| 7 | $0 | $4,010 |
| 8 | $0 | $4,010 |
| 9 | $350 | $4,010 |
| 10 | $350 | $4,010 |
| end | $820 | $4,010 |

At the end your assets paid $820 of your $4,010 bills. Keep growing the first number.

**Principles practiced**

- Assets vs. liabilities: Assets put money in your pocket every month. Liabilities take it out.
- Risk and diversification: A single stock or a single big deal can swing hard. Spread your bets.

### Loser: Seat 2, Real Estate Agent (Aggressive bot)

#### Kids reading level

**How you did**

- You reached 3% Freedom! Your assets paid $140 of your $3,820 bills each month.
- You came in 3rd of 3.

**Your biggest moves**

- You picked "Stay where you are" instead of "Move to the bigger house". You kept $5,000!
- You picked "Keep your car" instead of "Lease the new SUV". You kept $2,160!
- Your Six-Month CD grew and paid you $1,700!

**Good moves**

- You picked "Stay where you are" instead of "Move to the bigger house". You kept $5,000!
- You picked "Keep your car" instead of "Lease the new SUV". You kept $2,160!
- Your Six-Month CD grew and paid you $1,700!

**Moves that cost you**

- You picked "Gadgets plus monitoring". "Skip it" would have saved you $300.
- You picked "Shop thrift stores". "Keep what you have" would have saved you $200.
- You picked "Payment plan". "Keep your phone" would have saved you $150.

**Next time, try**

- Things lose value fast. Next time, pick "Skip it". That is worth $300.
- Waiting can buy you freedom. Next time, pick "Keep what you have". That is worth $200.

**Your money story**

| Round | Assets paid | Bills |
| ---: | ---: | ---: |
| 1 | $0 | $3,820 |
| 2 | $0 | $3,820 |
| 3 | $80 | $3,820 |
| 4 | $80 | $3,820 |
| 5 | $80 | $3,820 |
| 6 | $130 | $3,820 |
| 7 | $130 | $3,820 |
| 8 | $140 | $3,820 |
| 9 | $140 | $3,820 |
| 10 | $140 | $3,820 |
| end | $140 | $3,820 |

Your assets paid $140 of your $3,820 bills. Keep going!

**What you practiced**

- Delayed gratification: Waiting for what you want can buy you freedom later.
- Compounding and patience: Money that grows keeps growing on top of itself.

#### Adult reading level

**Result**

- You reached 3% Freedom. Your assets paid $144 of your $3,820 monthly bills.
- You finished 3rd of 3.

**What made the biggest difference**

- +$5,000: You chose "Stay where you are" over "Move to the bigger house" on Bigger House, which meant $5,000 less spent today. (Delayed gratification)
- +$2,160: You chose "Keep your car" over "Lease the new SUV" on New SUV Lease Offer, which meant $360 a month less for 6 months. (Delayed gratification)
- +$1,704: Your Six-Month CD grew $1,011 and paid you $693 over 8 months. (Compounding and patience)

**Decisions that helped**

- +$5,000: You chose "Stay where you are" over "Move to the bigger house" on Bigger House, which meant $5,000 less spent today. (Delayed gratification)
- +$2,160: You chose "Keep your car" over "Lease the new SUV" on New SUV Lease Offer, which meant $360 a month less for 6 months. (Delayed gratification)
- +$1,704: Your Six-Month CD grew $1,011 and paid you $693 over 8 months. (Compounding and patience)

**Decisions that hurt**

- -$300: You chose "Gadgets plus monitoring" over "Skip it" on Smart Home Gadgets, which meant $300 more spent today. (Things lose value, Small costs add up)
- -$200: You chose "Shop thrift stores" over "Keep what you have" on Wardrobe Refresh, which meant $200 more spent today. (Delayed gratification, Things lose value)
- -$150: You chose "Payment plan" over "Keep your phone" on New Phone Comes Out, which meant $50 a month more for 3 months. (Things lose value, Small costs add up)

**Next time, try**

- Skip things that lose value: choose "Skip it" on Smart Home Gadgets. That was worth $300.
- Wait for what you want: choose "Keep what you have" on Wardrobe Refresh. That was worth $200.

**Money story**

| Round | Assets paid | Bills |
| ---: | ---: | ---: |
| 1 | $0 | $3,820 |
| 2 | $0 | $3,820 |
| 3 | $78 | $3,820 |
| 4 | $80 | $3,820 |
| 5 | $83 | $3,820 |
| 6 | $128 | $3,820 |
| 7 | $132 | $3,820 |
| 8 | $135 | $3,820 |
| 9 | $140 | $3,820 |
| 10 | $144 | $3,820 |
| end | $144 | $3,820 |

At the end your assets paid $144 of your $3,820 bills. Keep growing the first number.

**Principles practiced**

- Delayed gratification: Money not spent today can be invested to pay you every month after.
- Compounding and patience: Growth that earns growth gets bigger every Payday you wait.

## Game 2: Wealth Builder vs Big Spender

Seed 20261024, standard mode, 2 seats, ended by escape in round 11. Picked as the first head-to-head game from the seed that the Wealth Builder wins (it wins 96% of them) with the Big Spender showing at least two hurt decisions.

| Seat | Profession | Bot | Final Freedom | Result |
| --- | --- | --- | ---: | --- |
| 1 | Firefighter | Wealth Builder | 110% | won (escaped) |
| 2 | Real Estate Agent | Big Spender | 0% | lost |

### Winner: Seat 1, Firefighter (Wealth Builder bot)

#### Adult reading level

**Result**

- You reached 110% Freedom. Your assets paid $4,761 of your $4,300 monthly bills.
- You escaped in round 11 and won.

**What made the biggest difference**

- +$30,470: You bought Garage Apartment. It paid you $470 over one month, and selling it made $30,000. (Assets vs. liabilities, Cash flow beats looking rich, Good debt vs. bad debt)
- +$4,550: You bought Bounce House Rentals. It paid you $4,550 over 7 months. (Assets vs. liabilities, Cash flow beats looking rich, Risk and diversification)
- +$3,160: You bought RV and Boat Storage Lot. It paid you $3,160 over one month. (Assets vs. liabilities, Cash flow beats looking rich, Good debt vs. bad debt)

**Decisions that helped**

- +$30,470: You bought Garage Apartment. It paid you $470 over one month, and selling it made $30,000. (Assets vs. liabilities, Cash flow beats looking rich, Good debt vs. bad debt)
- +$4,550: You bought Bounce House Rentals. It paid you $4,550 over 7 months. (Assets vs. liabilities, Cash flow beats looking rich, Risk and diversification)
- +$3,160: You bought RV and Boat Storage Lot. It paid you $3,160 over one month. (Assets vs. liabilities, Cash flow beats looking rich, Good debt vs. bad debt)

**Decisions that hurt**

- Nothing you chose cost you money.

**Next time, try**

- Keep doing what you did.

**Money story**

| Round | Assets paid | Bills |
| ---: | ---: | ---: |
| 1 | $0 | $3,990 |
| 2 | $0 | $3,990 |
| 3 | $0 | $3,990 |
| 4 | $0 | $3,990 |
| 5 | $650 | $4,390 |
| 6 | $659 | $4,390 |
| 7 | $1,049 | $4,390 |
| 8 | $1,050 | $4,390 |
| 9 | $1,520 | $4,390 |
| 10 | $1,050 | $3,600 |
| 11 | $4,211 | $4,400 |
| end | $4,761 | $4,300 |

Your assets passed your bills in round 11. That is freedom.

**Principles practiced**

- Assets vs. liabilities: Assets put money in your pocket every month. Liabilities take it out.
- Cash flow beats looking rich: Monthly cash flow decides freedom; what you own on paper does not.
- Delayed gratification: Money not spent today can be invested to pay you every month after.
- Good debt vs. bad debt: Debt that buys income can pay for itself. Debt that buys things only costs you.
- Compounding and patience: Growth that earns growth gets bigger every Payday you wait.
- Risk and diversification: A single stock or a single big deal can swing hard. Spread your bets.
- Generosity: Giving is part of what money is for.

#### Kids reading level

**How you did**

- You reached 110% Freedom! Your assets paid $4,760 of your $4,300 bills each month.
- You got free in round 11 and won!

**Your biggest moves**

- You bought Garage Apartment. It paid you $30,470!
- You bought Bounce House Rentals. It paid you $4,550!
- You bought RV and Boat Storage Lot. It paid you $3,160!

**Good moves**

- You bought Garage Apartment. It paid you $30,470!
- You bought Bounce House Rentals. It paid you $4,550!
- You bought RV and Boat Storage Lot. It paid you $3,160!

**Moves that cost you**

- Nothing cost you money. Great job!

**Next time, try**

- Keep doing what you did!

**Your money story**

| Round | Assets paid | Bills |
| ---: | ---: | ---: |
| 1 | $0 | $3,990 |
| 2 | $0 | $3,990 |
| 3 | $0 | $3,990 |
| 4 | $0 | $3,990 |
| 5 | $650 | $4,390 |
| 6 | $660 | $4,390 |
| 7 | $1,050 | $4,390 |
| 8 | $1,050 | $4,390 |
| 9 | $1,520 | $4,390 |
| 10 | $1,050 | $3,600 |
| 11 | $4,210 | $4,400 |
| end | $4,760 | $4,300 |

In round 11 your assets paid all your bills. You were free!

**What you practiced**

- Assets vs. liabilities: Assets put money in your pocket. Liabilities take it out.
- Cash flow beats looking rich: What you earn each month matters more than what you show off.
- Delayed gratification: Waiting for what you want can buy you freedom later.
- Good debt vs. bad debt: Borrow to buy things that pay you, not things that cost you.
- Compounding and patience: Money that grows keeps growing on top of itself.
- Risk and diversification: Do not bet everything on one thing.
- Generosity: Giving is part of what money is for.

### Loser: Seat 2, Real Estate Agent (Big Spender bot)

#### Adult reading level

**Result**

- You reached 0% Freedom. Your assets paid $0 of your $3,960 monthly bills.
- You finished 2nd of 2.

**What made the biggest difference**

- -$3,600: You passed on Lawn Care Trailer, which would have paid $450 a month for 8 months. (Assets vs. liabilities, Cash flow beats looking rich)
- -$2,720: You passed on Basement Apartment, which would have paid $1,360 a month for 2 months. (Assets vs. liabilities, Cash flow beats looking rich)
- -$330: You chose "Finance the top model" over "Keep your laptop" on Laptop Upgrade, which meant $110 a month more for 3 months. (Good debt vs. bad debt, Things lose value)

**Decisions that helped**

- No decision paid off this game.

**Decisions that hurt**

- -$3,600: You passed on Lawn Care Trailer, which would have paid $450 a month for 8 months. (Assets vs. liabilities, Cash flow beats looking rich)
- -$2,720: You passed on Basement Apartment, which would have paid $1,360 a month for 2 months. (Assets vs. liabilities, Cash flow beats looking rich)
- -$330: You chose "Finance the top model" over "Keep your laptop" on Laptop Upgrade, which meant $110 a month more for 3 months. (Good debt vs. bad debt, Things lose value)

**Next time, try**

- Own assets that pay you: buy Lawn Care Trailer when you can. That was worth $3,600 and 11 Freedom points.
- Own assets that pay you: buy Basement Apartment when you can. That was worth $2,720 and 34 Freedom points.

**Money story**

| Round | Assets paid | Bills |
| ---: | ---: | ---: |
| 1 | $0 | $3,820 |
| 2 | $0 | $3,820 |
| 3 | $0 | $3,820 |
| 4 | $0 | $3,850 |
| 5 | $0 | $3,850 |
| 6 | $0 | $3,850 |
| 7 | $0 | $3,850 |
| 8 | $0 | $3,960 |
| 9 | $0 | $3,960 |
| 10 | $0 | $3,960 |
| end | $0 | $3,960 |

At the end your assets paid $0 of your $3,960 bills. Keep growing the first number.

**Principles practiced**

- None this game. Try one of the ideas above.

#### Kids reading level

**How you did**

- You reached 0% Freedom! Your assets paid $0 of your $3,960 bills each month.
- You came in 2nd of 2.

**Your biggest moves**

- You said no to Lawn Care Trailer. It would have paid you $3,600.
- You said no to Basement Apartment. It would have paid you $2,720.
- You picked "Finance the top model". "Keep your laptop" would have saved you $330.

**Good moves**

- No good moves to show this time.

**Moves that cost you**

- You said no to Lawn Care Trailer. It would have paid you $3,600.
- You said no to Basement Apartment. It would have paid you $2,720.
- You picked "Finance the top model". "Keep your laptop" would have saved you $330.

**Next time, try**

- Assets put money in your pocket. Next time, say yes to Lawn Care Trailer. That is worth $3,600 and 11 more Freedom points.
- Assets put money in your pocket. Next time, say yes to Basement Apartment. That is worth $2,720 and 34 more Freedom points.

**Your money story**

| Round | Assets paid | Bills |
| ---: | ---: | ---: |
| 1 | $0 | $3,820 |
| 2 | $0 | $3,820 |
| 3 | $0 | $3,820 |
| 4 | $0 | $3,850 |
| 5 | $0 | $3,850 |
| 6 | $0 | $3,850 |
| 7 | $0 | $3,850 |
| 8 | $0 | $3,960 |
| 9 | $0 | $3,960 |
| 10 | $0 | $3,960 |
| end | $0 | $3,960 |

Your assets paid $0 of your $3,960 bills. Keep going!

**What you practiced**

- Try one of the ideas above next game!

## Game 3: Mixed standard game

Seed 20261023, standard mode, 4 seats, ended by escape in round 13. Picked as the first 3- or 4-seat standard game from the seed that ends by escape, so one sample shows an escape.

| Seat | Profession | Bot | Final Freedom | Result |
| --- | --- | --- | ---: | --- |
| 1 | Software Developer | Aggressive | 105% | won (escaped) |
| 2 | Electrician | Wealth Builder | 60% | lost |
| 3 | Engineer | Balanced | 36% | lost |
| 4 | Retail Manager | Balanced | 25% | lost |

### Winner: Seat 1, Software Developer (Aggressive bot)

#### Adult reading level

**Result**

- You reached 105% Freedom. Your assets paid $12,110 of your $11,450 monthly bills.
- You escaped in round 13 and won.

**What made the biggest difference**

- +$31,590: You bought Three Rental Houses. It paid you $31,590 over 9 months. (Assets vs. liabilities, Cash flow beats looking rich, Risk and diversification)
- +$27,020: You bought Small Office Building. It paid you $27,020 over 7 months. (Assets vs. liabilities, Cash flow beats looking rich, Risk and diversification)
- +$7,400: You bought ATM Route. It paid you $7,400 over 5 months. (Assets vs. liabilities, Cash flow beats looking rich)

**Decisions that helped**

- +$31,590: You bought Three Rental Houses. It paid you $31,590 over 9 months. (Assets vs. liabilities, Cash flow beats looking rich, Risk and diversification)
- +$27,020: You bought Small Office Building. It paid you $27,020 over 7 months. (Assets vs. liabilities, Cash flow beats looking rich, Risk and diversification)
- +$7,400: You bought ATM Route. It paid you $7,400 over 5 months. (Assets vs. liabilities, Cash flow beats looking rich)

**Decisions that hurt**

- -$2,500: You chose "Book the beach house" over "Stay home this year" on Family Beach Week, which meant $2,500 more spent today. (Cash flow beats looking rich, Delayed gratification)

**Next time, try**

- Pick cash flow over looking rich: choose "Stay home this year" on Family Beach Week. That was worth $2,500.

**Money story**

| Round | Assets paid | Bills |
| ---: | ---: | ---: |
| 1 | $0 | $9,170 |
| 2 | $0 | $9,050 |
| 3 | $450 | $9,050 |
| 4 | $920 | $9,050 |
| 5 | $4,430 | $11,150 |
| 6 | $4,430 | $11,150 |
| 7 | $8,290 | $13,550 |
| 8 | $8,870 | $13,550 |
| 9 | $10,350 | $13,650 |
| 10 | $12,110 | $14,450 |
| 11 | $12,110 | $14,350 |
| 12 | $12,110 | $13,550 |
| 13 | $12,110 | $13,550 |
| end | $12,110 | $11,450 |

Your assets passed your bills in round 13. That is freedom.

**Principles practiced**

- Assets vs. liabilities: Assets put money in your pocket every month. Liabilities take it out.
- Cash flow beats looking rich: Monthly cash flow decides freedom; what you own on paper does not.
- Good debt vs. bad debt: Debt that buys income can pay for itself. Debt that buys things only costs you.
- Risk and diversification: A single stock or a single big deal can swing hard. Spread your bets.

#### Kids reading level

**How you did**

- You reached 105% Freedom! Your assets paid $12,110 of your $11,450 bills each month.
- You got free in round 13 and won!

**Your biggest moves**

- You bought Three Rental Houses. It paid you $31,590!
- You bought Small Office Building. It paid you $27,020!
- You bought ATM Route. It paid you $7,400!

**Good moves**

- You bought Three Rental Houses. It paid you $31,590!
- You bought Small Office Building. It paid you $27,020!
- You bought ATM Route. It paid you $7,400!

**Moves that cost you**

- You picked "Book the beach house". "Stay home this year" would have saved you $2,500.

**Next time, try**

- Money each month beats showing off. Next time, pick "Stay home this year". That is worth $2,500.

**Your money story**

| Round | Assets paid | Bills |
| ---: | ---: | ---: |
| 1 | $0 | $9,170 |
| 2 | $0 | $9,050 |
| 3 | $450 | $9,050 |
| 4 | $920 | $9,050 |
| 5 | $4,430 | $11,150 |
| 6 | $4,430 | $11,150 |
| 7 | $8,290 | $13,550 |
| 8 | $8,870 | $13,550 |
| 9 | $10,350 | $13,650 |
| 10 | $12,110 | $14,450 |
| 11 | $12,110 | $14,350 |
| 12 | $12,110 | $13,550 |
| 13 | $12,110 | $13,550 |
| end | $12,110 | $11,450 |

In round 13 your assets paid all your bills. You were free!

**What you practiced**

- Assets vs. liabilities: Assets put money in your pocket. Liabilities take it out.
- Cash flow beats looking rich: What you earn each month matters more than what you show off.
- Good debt vs. bad debt: Borrow to buy things that pay you, not things that cost you.
- Risk and diversification: Do not bet everything on one thing.

### Loser: Seat 4, Retail Manager (Balanced bot)

#### Adult reading level

**Result**

- You reached 25% Freedom. Your assets paid $829 of your $3,260 monthly bills.
- You finished 4th of 4.

**What made the biggest difference**

- +$6,300: You bought Duplex Needing Paint. It paid you $6,300 over 9 months. (Assets vs. liabilities, Cash flow beats looking rich, Good debt vs. bad debt)
- +$1,660: You bought Online Tutoring Business. It paid you $460 over 2 months, and selling it made $1,200. (Assets vs. liabilities, Cash flow beats looking rich)
- +$1,600: You chose "Skip it" over "Finance a new pontoon" on Boat Show Deal, which meant $400 a month less for 4 months. (Delayed gratification)

**Decisions that helped**

- +$6,300: You bought Duplex Needing Paint. It paid you $6,300 over 9 months. (Assets vs. liabilities, Cash flow beats looking rich, Good debt vs. bad debt)
- +$1,660: You bought Online Tutoring Business. It paid you $460 over 2 months, and selling it made $1,200. (Assets vs. liabilities, Cash flow beats looking rich)
- +$1,600: You chose "Skip it" over "Finance a new pontoon" on Boat Show Deal, which meant $400 a month less for 4 months. (Delayed gratification)

**Decisions that hurt**

- Nothing you chose cost you money.

**Next time, try**

- Keep doing what you did.

**Money story**

| Round | Assets paid | Bills |
| ---: | ---: | ---: |
| 1 | $0 | $3,350 |
| 2 | $0 | $3,350 |
| 3 | $0 | $3,350 |
| 4 | $700 | $3,650 |
| 5 | $930 | $3,650 |
| 6 | $963 | $3,650 |
| 7 | $733 | $3,350 |
| 8 | $733 | $3,350 |
| 9 | $733 | $3,350 |
| 10 | $733 | $3,260 |
| 11 | $733 | $3,260 |
| 12 | $733 | $3,260 |
| end | $829 | $3,260 |

At the end your assets paid $829 of your $3,260 bills. Keep growing the first number.

**Principles practiced**

- Assets vs. liabilities: Assets put money in your pocket every month. Liabilities take it out.
- Cash flow beats looking rich: Monthly cash flow decides freedom; what you own on paper does not.
- Delayed gratification: Money not spent today can be invested to pay you every month after.
- Good debt vs. bad debt: Debt that buys income can pay for itself. Debt that buys things only costs you.
- Compounding and patience: Growth that earns growth gets bigger every Payday you wait.
- Risk and diversification: A single stock or a single big deal can swing hard. Spread your bets.
- Generosity: Giving is part of what money is for.

#### Kids reading level

**How you did**

- You reached 25% Freedom! Your assets paid $830 of your $3,260 bills each month.
- You came in 4th of 4.

**Your biggest moves**

- You bought Duplex Needing Paint. It paid you $6,300!
- You bought Online Tutoring Business. It paid you $1,660!
- You picked "Skip it" instead of "Finance a new pontoon". You kept $1,600!

**Good moves**

- You bought Duplex Needing Paint. It paid you $6,300!
- You bought Online Tutoring Business. It paid you $1,660!
- You picked "Skip it" instead of "Finance a new pontoon". You kept $1,600!

**Moves that cost you**

- Nothing cost you money. Great job!

**Next time, try**

- Keep doing what you did!

**Your money story**

| Round | Assets paid | Bills |
| ---: | ---: | ---: |
| 1 | $0 | $3,350 |
| 2 | $0 | $3,350 |
| 3 | $0 | $3,350 |
| 4 | $700 | $3,650 |
| 5 | $930 | $3,650 |
| 6 | $960 | $3,650 |
| 7 | $730 | $3,350 |
| 8 | $730 | $3,350 |
| 9 | $730 | $3,350 |
| 10 | $730 | $3,260 |
| 11 | $730 | $3,260 |
| 12 | $730 | $3,260 |
| end | $830 | $3,260 |

Your assets paid $830 of your $3,260 bills. Keep going!

**What you practiced**

- Assets vs. liabilities: Assets put money in your pocket. Liabilities take it out.
- Cash flow beats looking rich: What you earn each month matters more than what you show off.
- Delayed gratification: Waiting for what you want can buy you freedom later.
- Good debt vs. bad debt: Borrow to buy things that pay you, not things that cost you.
- Compounding and patience: Money that grows keeps growing on top of itself.
- Risk and diversification: Do not bet everything on one thing.
- Generosity: Giving is part of what money is for.

## The structured data behind one debrief

What the UI receives for the Game 2 loser at the adult level. The UI renders this; it never computes a number.

<details><summary>JSON</summary>

```json
{
  "readingLevel": "adult",
  "result": {
    "playerId": "p2",
    "professionId": "real-estate-agent",
    "freedomPercent": 0,
    "passiveIncome": 0,
    "totalExpenses": 3960,
    "won": false,
    "escaped": false,
    "place": 2,
    "players": 2,
    "ending": "escape",
    "rounds": 11
  },
  "drivers": [
    {
      "kind": "passedDeal",
      "ref": {
        "entry": 6,
        "event": 0
      },
      "outcome": "hurt",
      "impact": -3600,
      "dollars": 3600,
      "principles": [
        "P2",
        "P3"
      ],
      "round": 2,
      "months": 8,
      "cardId": "small-003",
      "monthlyCashFlow": 450
    },
    {
      "kind": "passedDeal",
      "ref": {
        "entry": 53,
        "event": 0
      },
      "outcome": "hurt",
      "impact": -2720,
      "dollars": 2720,
      "principles": [
        "P2",
        "P3"
      ],
      "round": 8,
      "months": 2,
      "cardId": "small-027",
      "monthlyCashFlow": 1360
    },
    {
      "kind": "lifeChoice",
      "ref": {
        "entry": 45,
        "event": 0
      },
      "outcome": "hurt",
      "impact": -330,
      "dollars": 330,
      "principles": [
        "P5",
        "P6"
      ],
      "round": 7,
      "months": 3,
      "cardId": "life-016",
      "optionId": "top",
      "otherOptionId": "keep",
      "todayDifference": 0,
      "monthlyDifference": -110
    }
  ],
  "helped": [],
  "hurt": [
    {
      "kind": "passedDeal",
      "ref": {
        "entry": 6,
        "event": 0
      },
      "outcome": "hurt",
      "impact": -3600,
      "dollars": 3600,
      "principles": [
        "P2",
        "P3"
      ],
      "round": 2,
      "months": 8,
      "cardId": "small-003",
      "monthlyCashFlow": 450
    },
    {
      "kind": "passedDeal",
      "ref": {
        "entry": 53,
        "event": 0
      },
      "outcome": "hurt",
      "impact": -2720,
      "dollars": 2720,
      "principles": [
        "P2",
        "P3"
      ],
      "round": 8,
      "months": 2,
      "cardId": "small-027",
      "monthlyCashFlow": 1360
    },
    {
      "kind": "lifeChoice",
      "ref": {
        "entry": 45,
        "event": 0
      },
      "outcome": "hurt",
      "impact": -330,
      "dollars": 330,
      "principles": [
        "P5",
        "P6"
      ],
      "round": 7,
      "months": 3,
      "cardId": "life-016",
      "optionId": "top",
      "otherOptionId": "keep",
      "todayDifference": 0,
      "monthlyDifference": -110
    }
  ],
  "suggestions": [
    {
      "decision": {
        "kind": "passedDeal",
        "ref": {
          "entry": 6,
          "event": 0
        },
        "outcome": "hurt",
        "impact": -3600,
        "dollars": 3600,
        "principles": [
          "P2",
          "P3"
        ],
        "round": 2,
        "months": 8,
        "cardId": "small-003",
        "monthlyCashFlow": 450
      },
      "principle": "P2",
      "dollars": 3600,
      "monthly": 450,
      "freedomPoints": 11
    },
    {
      "decision": {
        "kind": "passedDeal",
        "ref": {
          "entry": 53,
          "event": 0
        },
        "outcome": "hurt",
        "impact": -2720,
        "dollars": 2720,
        "principles": [
          "P2",
          "P3"
        ],
        "round": 8,
        "months": 2,
        "cardId": "small-027",
        "monthlyCashFlow": 1360
      },
      "principle": "P2",
      "dollars": 2720,
      "monthly": 1360,
      "freedomPoints": 34
    }
  ],
  "moneyStory": {
    "points": [
      {
        "ref": {
          "entry": 2,
          "event": 1
        },
        "round": 1,
        "passiveIncome": 0,
        "totalExpenses": 3820
      },
      {
        "ref": {
          "entry": 4,
          "event": 1
        },
        "round": 2,
        "passiveIncome": 0,
        "totalExpenses": 3820
      },
      {
        "ref": {
          "entry": 11,
          "event": 1
        },
        "round": 3,
        "passiveIncome": 0,
        "totalExpenses": 3820
      },
      {
        "ref": {
          "entry": 21,
          "event": 1
        },
        "round": 4,
        "passiveIncome": 0,
        "totalExpenses": 3850
      },
      {
        "ref": {
          "entry": 29,
          "event": 1
        },
        "round": 5,
        "passiveIncome": 0,
        "totalExpenses": 3850
      },
      {
        "ref": {
          "entry": 37,
          "event": 1
        },
        "round": 6,
        "passiveIncome": 0,
        "totalExpenses": 3850
      },
      {
        "ref": {
          "entry": 44,
          "event": 1
        },
        "round": 7,
        "passiveIncome": 0,
        "totalExpenses": 3850
      },
      {
        "ref": {
          "entry": 51,
          "event": 1
        },
        "round": 8,
        "passiveIncome": 0,
        "totalExpenses": 3960
      },
      {
        "ref": {
          "entry": 62,
          "event": 1
        },
        "round": 9,
        "passiveIncome": 0,
        "totalExpenses": 3960
      },
      {
        "ref": {
          "entry": 72,
          "event": 1
        },
        "round": 10,
        "passiveIncome": 0,
        "totalExpenses": 3960
      }
    ],
    "final": {
      "passiveIncome": 0,
      "totalExpenses": 3960
    }
  },
  "principlesPracticed": []
}
```

</details>
