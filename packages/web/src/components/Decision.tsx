import { optionCost, reduce } from '@ff/engine';
import {
  formatMoney,
  INVEST_STEP,
  isGrowthAssetType,
  type Action,
  type DealCard,
  type GameState,
  type LifeChoicesCard,
  type MarketCard,
  type Player,
} from '@ff/shared';
import { useState } from 'react';

import { assetName, card, cardText } from '../lib/text';
import { useGame } from '../store';
import { Borrow } from './Finances';
import { Money } from './Money';
import { BigStat, GameCard, type DeckTone } from './Show';

/** The open decision for the current player, as a game card with big choices. */
export function Decision({ state, player, legal }: { state: GameState; player: Player; legal: readonly Action[] }) {
  const pending = state.pending;
  switch (pending.kind) {
    case 'none':
      return null;
    case 'chooseDealSize':
      return <DealSize player={player} legal={legal} />;
    case 'buyOrPass': {
      const c = card(pending.cardId);
      if (c.deck !== 'smallDeals' && c.deck !== 'bigDeals') return null;
      return <Deal key={c.id} state={state} player={player} legal={legal} deal={c} sharePrice={pending.sharePrice} />;
    }
    case 'marketChoice': {
      const c = card(pending.cardId);
      if (c.deck !== 'market') return null;
      return <Market key={c.id} state={state} player={player} legal={legal} market={c} />;
    }
    case 'lifeChoice': {
      const c = card(pending.cardId);
      if (c.deck !== 'lifeChoices') return null;
      return <LifeChoice key={c.id} state={state} player={player} legal={legal} life={c} />;
    }
    case 'giveOrSkip':
      return <Giving state={state} player={player} legal={legal} />;
  }
}

function DealSize({ player, legal }: { player: Player; legal: readonly Action[] }) {
  const dispatch = useGame((s) => s.dispatch);
  const small = legal.find((a) => a.type === 'CHOOSE_DEAL_SIZE' && a.size === 'small');
  const big = legal.find((a) => a.type === 'CHOOSE_DEAL_SIZE' && a.size === 'big');
  const tile =
    'group flex min-h-[140px] flex-col items-start justify-end gap-1 rounded-3xl p-5 text-left shadow-lift transition duration-150 hover:-translate-y-1 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0';
  return (
    <GameCard tone="deal" kicker="Opportunity" title={`${player.name}, pick your deal`} headingId="decision-heading">
      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" className={`${tile} bg-gradient-to-br from-emerald-700 to-teal-900`} disabled={small === undefined} onClick={() => small && dispatch(small)}>
          <span className="font-display text-3xl font-extrabold">Small deal</span>
          <span className="text-sm text-white/90">$5,000 or less down. Savings, index funds, stocks, small rentals, side businesses.</span>
        </button>
        <button type="button" className={`${tile} bg-gradient-to-br from-cyan-700 to-indigo-900`} disabled={big === undefined} onClick={() => big && dispatch(big)}>
          <span className="font-display text-3xl font-extrabold">Big deal</span>
          <span className="text-sm text-white/90">{big === undefined ? 'Not in kids mode.' : '$6,000 to $50,000 down. Apartments and big businesses.'}</span>
        </button>
      </div>
    </GameCard>
  );
}

/** What a BUY would cost, read from the engine's own result so the UI never multiplies. */
function previewCost(state: GameState, action: Action): number | null {
  const result = reduce(state, action);
  if (!result.ok) return null;
  for (const event of result.state.game.log.at(-1)?.events ?? []) if (event.kind === 'bought') return event.cost;
  return null;
}

/** A minus, value, plus control: large targets, no typing. */
function Stepper(props: { label: string; value: string; onDown: () => void; onUp: () => void; downDisabled: boolean; upDisabled: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="eyebrow text-white/70">{props.label}</span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost !px-4 text-2xl" aria-label={`${props.label}: less`} disabled={props.downDisabled} onClick={props.onDown}>
          −
        </button>
        <output aria-live="polite" className="min-w-[6.5rem] text-center font-display text-3xl font-extrabold">
          {props.value}
        </output>
        <button type="button" className="btn-ghost !px-4 text-2xl" aria-label={`${props.label}: more`} disabled={props.upDisabled} onClick={props.onUp}>
          +
        </button>
      </div>
    </div>
  );
}

function Deal({ state, player, legal, deal, sharePrice }: { state: GameState; player: Player; legal: readonly Action[]; deal: DealCard; sharePrice: number | undefined }) {
  const dispatch = useGame((s) => s.dispatch);
  const kids = state.game.mode === 'kids';
  const pass = legal.find((a) => a.type === 'PASS');
  const isStock = deal.type === 'stock';
  const isGrowth = isGrowthAssetType(deal.type);
  const [shares, setShares] = useState(1);
  const [amount, setAmount] = useState(deal.price);

  const buyAction: Action = isStock ? { type: 'BUY', playerId: player.id, shares } : isGrowth ? { type: 'BUY', playerId: player.id, amount } : { type: 'BUY', playerId: player.id };
  const cost = previewCost(state, buyAction);
  // The steppers ask the engine whether one more step is allowed, so limits are never re-implemented here.
  const moreShares = reduce(state, { type: 'BUY', playerId: player.id, shares: shares + 1 }).ok;
  const moreAmount = reduce(state, { type: 'BUY', playerId: player.id, amount: amount + INVEST_STEP }).ok;
  const lots = legal.filter((a): a is Extract<Action, { type: 'SELL_ASSET' }> => a.type === 'SELL_ASSET');
  const tone: DeckTone = deal.deck === 'bigDeals' ? 'big' : 'deal';

  const buyLabel =
    cost === null
      ? isStock || isGrowth
        ? 'Not enough cash'
        : `Need ${formatMoney(deal.downPayment)}`
      : isStock
        ? `Buy ${String(shares)} for ${formatMoney(cost)}`
        : isGrowth
          ? `Invest ${formatMoney(cost)}`
          : `Buy it for ${formatMoney(cost)}`;

  return (
    <GameCard tone={tone} kicker={deal.deck === 'bigDeals' ? 'Big deal' : 'Small deal'} title={deal.title} headingId="decision-heading">
      <p className="text-lg leading-relaxed text-white/90">{cardText(deal, state.game.mode)}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3">
        {isStock ? (
          <>
            <BigStat label="Price per share today">{formatMoney(sharePrice ?? deal.price)}</BigStat>
            <BigStat label="Dividend per share">
              <Money amount={deal.dividendPerShare ?? 0} suffix="/mo" />
            </BigStat>
            <BigStat label="Usual price range">{`${formatMoney(deal.priceRange?.min ?? 0)} to ${formatMoney(deal.priceRange?.max ?? 0)}`}</BigStat>
            <BigStat label="Shares for sale">{String(deal.sharesAvailable ?? 0)}</BigStat>
          </>
        ) : isGrowth ? (
          <>
            <BigStat label="Grows every month">{`${String(deal.growthPercent ?? 0)}%`}</BigStat>
            <BigStat label="Pays you every month">{`${String(deal.payoutPercent ?? 0)}% of value`}</BigStat>
            <BigStat label="Minimum to invest">{formatMoney(deal.price)}</BigStat>
            <BigStat label="Your cash">{formatMoney(player.cash)}</BigStat>
          </>
        ) : (
          <>
            <BigStat label="Cost today">{formatMoney(deal.downPayment)}</BigStat>
            <BigStat label="Change per month">
              <Money amount={deal.monthlyCashFlow} suffix="/mo" />
            </BigStat>
          </>
        )}
      </dl>
      {!isStock && !isGrowth && (
        <p className="mt-2 text-sm text-white/75">
          Full price {formatMoney(deal.price)}, mortgage {formatMoney(deal.mortgage)}. You have {formatMoney(player.cash)} cash.
        </p>
      )}

      <div className="mt-5 space-y-4">
        {isStock && (
          <Stepper
            label="Shares"
            value={String(shares)}
            downDisabled={shares <= 1}
            upDisabled={!moreShares}
            onDown={() => {
              setShares((n) => Math.max(1, n - 1));
            }}
            onUp={() => {
              setShares((n) => n + 1);
            }}
          />
        )}
        {isGrowth && (
          <Stepper
            label="Invest"
            value={formatMoney(amount)}
            downDisabled={amount - INVEST_STEP < deal.price}
            upDisabled={!moreAmount}
            onDown={() => {
              setAmount((n) => Math.max(deal.price, n - INVEST_STEP));
            }}
            onUp={() => {
              setAmount((n) => n + INVEST_STEP);
            }}
          />
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-go px-8 py-4 text-xl" disabled={cost === null} onClick={() => dispatch(buyAction)}>
            {buyLabel}
          </button>
          <button type="button" className="btn-ghost px-8 py-4 text-xl" disabled={pass === undefined} onClick={() => pass && dispatch(pass)}>
            Pass
          </button>
        </div>

        {lots.map((sell) => (
          <button key={sell.assetId} type="button" className="btn-primary" onClick={() => dispatch(sell)}>
            Sell all of my {ownedName(player, sell.assetId)} at today&rsquo;s price
          </button>
        ))}

        {cost === null &&
          !kids &&
          (legal.some((a) => a.type === 'BORROW') ? (
            <Borrow state={state} player={player} />
          ) : (
            <p className="font-semibold text-white/80">The bank will not lend you more: you have reached your credit limit. Pay off a bank loan to borrow again.</p>
          ))}
      </div>
    </GameCard>
  );
}

function Market({ state, player, legal, market }: { state: GameState; player: Player; legal: readonly Action[]; market: MarketCard }) {
  const dispatch = useGame((s) => s.dispatch);
  const acceptAny = legal.find((a) => a.type === 'ACCEPT_MARKET' && a.assetId === undefined);
  const acceptOne = legal.filter((a): a is Extract<Action, { type: 'ACCEPT_MARKET' }> => a.type === 'ACCEPT_MARKET' && a.assetId !== undefined);
  const decline = legal.find((a) => a.type === 'DECLINE_MARKET');
  return (
    <GameCard tone="market" kicker="Market news" title={market.title} headingId="decision-heading">
      <p className="text-lg leading-relaxed text-white/90">{cardText(market, state.game.mode)}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        {acceptAny !== undefined && (
          <button type="button" className="btn-go px-8 py-4 text-xl" onClick={() => dispatch(acceptAny)}>
            {decline === undefined ? 'OK' : 'Accept'}
          </button>
        )}
        {acceptAny === undefined &&
          acceptOne.map((a) => (
            <button key={a.assetId} type="button" className="btn-go px-6 py-4 text-lg" onClick={() => dispatch(a)}>
              Sell {ownedName(player, a.assetId)}
            </button>
          ))}
        {decline !== undefined && (
          <button type="button" className="btn-ghost px-8 py-4 text-xl" onClick={() => dispatch(decline)}>
            {acceptAny === undefined && acceptOne.length === 0 ? 'OK' : 'Decline'}
          </button>
        )}
      </div>
    </GameCard>
  );
}

function LifeChoice({ state, player, legal, life }: { state: GameState; player: Player; legal: readonly Action[]; life: LifeChoicesCard }) {
  const dispatch = useGame((s) => s.dispatch);
  const kids = state.game.mode === 'kids';
  const options = life.options.filter((o) => !kids || o.kidsOk);
  return (
    <GameCard tone="life" kicker="Life Choices" title={life.title} headingId="decision-heading">
      <p className="text-lg leading-relaxed text-white/90">{cardText(life, state.game.mode)}</p>
      <ul className={`mt-5 grid gap-3 ${options.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {options.map((option) => {
          const choose = legal.find((a) => a.type === 'CHOOSE_LIFE_OPTION' && a.optionId === option.id);
          const { costToday, monthlyChange } = optionCost(option, player);
          return (
            <li key={option.id}>
              <button
                type="button"
                disabled={choose === undefined}
                onClick={() => choose && dispatch(choose)}
                className="flex h-full w-full flex-col gap-3 rounded-3xl border-2 border-white/15 bg-white/[0.06] p-4 text-left transition duration-150 hover:-translate-y-1 hover:border-gold hover:bg-white/[0.1] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:border-white/15"
              >
                <span className="font-display text-2xl font-extrabold leading-tight">{option.label}</span>
                <span className="text-sm text-white/80">{cardText(option, state.game.mode)}</span>
                <span className="mt-auto grid grid-cols-2 gap-2">
                  <span className="rounded-xl bg-black/25 px-3 py-2">
                    <span className="eyebrow block text-white/70">Today</span>
                    <span className="font-display text-xl font-extrabold">
                      <Money amount={-costToday} />
                    </span>
                  </span>
                  <span className="rounded-xl bg-black/25 px-3 py-2">
                    <span className="eyebrow block text-white/70">Monthly</span>
                    <span className="font-display text-xl font-extrabold">
                      <Money amount={-monthlyChange} suffix="/mo" />
                    </span>
                  </span>
                </span>
                <span className="font-display text-sm font-extrabold uppercase tracking-wider text-gold">{choose === undefined ? 'Not enough cash' : 'Choose this'}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {!kids && legal.some((a) => a.type === 'BORROW') && (
        <div className="mt-4">
          <Borrow state={state} player={player} />
        </div>
      )}
    </GameCard>
  );
}

function Giving({ state, player, legal }: { state: GameState; player: Player; legal: readonly Action[] }) {
  const dispatch = useGame((s) => s.dispatch);
  const give = legal.find((a) => a.type === 'GIVE');
  const skip = legal.find((a) => a.type === 'SKIP_GIVE');
  const gift = give === undefined ? null : previewGift(state, give);
  return (
    <GameCard tone="give" kicker="Giving" title={`${player.name}, want to give?`} headingId="decision-heading">
      <p className="text-lg leading-relaxed text-white/90">Give 10% of your cash to help others and earn a Favor token. Giving is part of what money is for.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn-go px-8 py-4 text-xl" disabled={give === undefined} onClick={() => give && dispatch(give)}>
          {gift === null ? 'Not enough cash to give' : `Give ${formatMoney(gift)}`}
        </button>
        <button type="button" className="btn-ghost px-8 py-4 text-xl" disabled={skip === undefined} onClick={() => skip && dispatch(skip)}>
          Not this time
        </button>
      </div>
    </GameCard>
  );
}

function previewGift(state: GameState, action: Action): number | null {
  const result = reduce(state, action);
  if (!result.ok) return null;
  for (const event of result.state.game.log.at(-1)?.events ?? []) if (event.kind === 'gave') return event.amount;
  return null;
}

function ownedName(player: Player, assetId: string | undefined): string {
  const asset = player.assets.find((a) => a.id === assetId);
  return asset === undefined ? 'asset' : assetName(asset);
}
