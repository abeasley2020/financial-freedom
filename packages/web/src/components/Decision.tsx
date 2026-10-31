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
import { useId, useState } from 'react';

import { assetName, card, cardText } from '../lib/text';
import { useGame } from '../store';
import { Borrow } from './Finances';
import { Money } from './Money';

/** The open decision for the current player, as option cards with buttons. */
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
      return <Market state={state} player={player} legal={legal} market={c} />;
    }
    case 'lifeChoice': {
      const c = card(pending.cardId);
      if (c.deck !== 'lifeChoices') return null;
      return <LifeChoice state={state} player={player} legal={legal} life={c} />;
    }
    case 'giveOrSkip':
      return <Giving state={state} player={player} legal={legal} />;
  }
}

function Shell({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className="panel border-2 border-accent" aria-labelledby="decision-heading">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">{kicker}</p>
      <h2 id="decision-heading" className="text-2xl font-bold">
        {title}
      </h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

function DealSize({ player, legal }: { player: Player; legal: readonly Action[] }) {
  const dispatch = useGame((s) => s.dispatch);
  const small = legal.find((a) => a.type === 'CHOOSE_DEAL_SIZE' && a.size === 'small');
  const big = legal.find((a) => a.type === 'CHOOSE_DEAL_SIZE' && a.size === 'big');
  return (
    <Shell kicker="Opportunity" title={`${player.name}, pick a deal size`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn-primary flex-col items-start py-3 text-left" disabled={small === undefined} onClick={() => small && dispatch(small)}>
          <span className="text-lg">Small deal</span>
          <span className="text-sm font-normal">$5,000 or less down. Savings, index funds, stocks, small rentals, side businesses.</span>
        </button>
        <button type="button" className="btn-primary flex-col items-start py-3 text-left" disabled={big === undefined} onClick={() => big && dispatch(big)}>
          <span className="text-lg">Big deal</span>
          <span className="text-sm font-normal">{big === undefined ? 'Not in kids mode.' : '$6,000 to $50,000 down. Apartments and big businesses.'}</span>
        </button>
      </div>
    </Shell>
  );
}

/** What a BUY would cost, read from the engine's own result so the UI never multiplies. */
function previewCost(state: GameState, action: Action): number | null {
  const result = reduce(state, action);
  if (!result.ok) return null;
  for (const event of result.state.game.log.at(-1)?.events ?? []) if (event.kind === 'bought') return event.cost;
  return null;
}

function Deal({ state, player, legal, deal, sharePrice }: { state: GameState; player: Player; legal: readonly Action[]; deal: DealCard; sharePrice: number | undefined }) {
  const dispatch = useGame((s) => s.dispatch);
  const kids = state.game.mode === 'kids';
  const pass = legal.find((a) => a.type === 'PASS');
  const isStock = deal.type === 'stock';
  const isGrowth = isGrowthAssetType(deal.type);
  const [shares, setShares] = useState(1);
  const [amount, setAmount] = useState(deal.price);
  const sharesId = useId();
  const amountId = useId();

  const buyAction: Action = isStock ? { type: 'BUY', playerId: player.id, shares } : isGrowth ? { type: 'BUY', playerId: player.id, amount } : { type: 'BUY', playerId: player.id };
  const cost = previewCost(state, buyAction);
  const lots = legal.filter((a): a is Extract<Action, { type: 'SELL_ASSET' }> => a.type === 'SELL_ASSET');

  return (
    <Shell kicker={deal.deck === 'bigDeals' ? 'Big deal' : 'Small deal'} title={deal.title}>
      <p className="text-lg">{cardText(deal, state.game.mode)}</p>
      <dl className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
        {isStock ? (
          <>
            <Fact label="Price per share today" value={formatMoney(sharePrice ?? deal.price)} />
            <Fact label="Shares for sale" value={String(deal.sharesAvailable ?? 0)} />
            <Fact label="Usual price range" value={`${formatMoney(deal.priceRange?.min ?? 0)} to ${formatMoney(deal.priceRange?.max ?? 0)}`} />
            <Fact label="Dividend per share" value={`${formatMoney(deal.dividendPerShare ?? 0)}/mo`} />
          </>
        ) : isGrowth ? (
          <>
            <Fact label="Minimum to invest" value={formatMoney(deal.price)} />
            <Fact label="Grows every month" value={`${String(deal.growthPercent ?? 0)}%`} />
            <Fact label="Pays you every month" value={`${String(deal.payoutPercent ?? 0)}% of its value`} />
          </>
        ) : (
          <>
            <Fact label="Cost today (down payment)" value={formatMoney(deal.downPayment)} />
            <Fact label="Change per month" value={<Money amount={deal.monthlyCashFlow} suffix="/mo" />} />
            <Fact label="Full price" value={formatMoney(deal.price)} />
            <Fact label="Mortgage" value={formatMoney(deal.mortgage)} />
          </>
        )}
      </dl>
      <p className="text-sm text-slate-700">You have {formatMoney(player.cash)} cash.</p>

      {isStock && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label htmlFor={sharesId} className="text-sm font-semibold">
              Shares to buy
            </label>
            <input
              id={sharesId}
              type="number"
              inputMode="numeric"
              min={1}
              max={deal.sharesAvailable}
              value={shares}
              onChange={(e) => {
                setShares(Math.max(1, Math.floor(Number(e.target.value) || 1)));
              }}
              className="min-h-[44px] w-32 rounded-md border border-slate-400 px-3"
            />
          </div>
          <button type="button" className="btn-primary" disabled={cost === null} onClick={() => dispatch(buyAction)}>
            {cost === null ? 'Cannot buy that many' : `Buy ${String(shares)} for ${formatMoney(cost)}`}
          </button>
        </div>
      )}

      {isGrowth && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col">
            <label htmlFor={amountId} className="text-sm font-semibold">
              Amount to invest (steps of {formatMoney(INVEST_STEP)})
            </label>
            <input
              id={amountId}
              type="number"
              inputMode="numeric"
              min={deal.price}
              step={INVEST_STEP}
              value={amount}
              onChange={(e) => {
                setAmount(Math.floor(Number(e.target.value) || 0));
              }}
              className="min-h-[44px] w-40 rounded-md border border-slate-400 px-3"
            />
          </div>
          <button type="button" className="btn-primary" disabled={cost === null} onClick={() => dispatch(buyAction)}>
            {cost === null ? 'Not allowed: check the amount and your cash' : `Invest ${formatMoney(cost)}`}
          </button>
        </div>
      )}

      {!isStock && !isGrowth && (
        <button type="button" className="btn-primary" disabled={cost === null} onClick={() => dispatch(buyAction)}>
          {cost === null ? `Need ${formatMoney(deal.downPayment)} to buy` : `Buy for ${formatMoney(cost)} down`}
        </button>
      )}

      {lots.map((sell) => (
        <button key={sell.assetId} type="button" className="btn-secondary ml-2" onClick={() => dispatch(sell)}>
          Sell all of my {ownedName(player, sell.assetId)} at today&rsquo;s price
        </button>
      ))}

      {cost === null && !kids && (legal.some((a) => a.type === 'BORROW') ? <Borrow state={state} player={player} /> : <p className="text-sm font-semibold">The bank will not lend you more: you have reached your credit limit. Pay off a bank loan to borrow again.</p>)}

      <div>
        <button type="button" className="btn-secondary" disabled={pass === undefined} onClick={() => pass && dispatch(pass)}>
          Pass
        </button>
      </div>
    </Shell>
  );
}

function Market({ state, player, legal, market }: { state: GameState; player: Player; legal: readonly Action[]; market: MarketCard }) {
  const dispatch = useGame((s) => s.dispatch);
  const acceptAny = legal.find((a) => a.type === 'ACCEPT_MARKET' && a.assetId === undefined);
  const acceptOne = legal.filter((a) => a.type === 'ACCEPT_MARKET' && a.assetId !== undefined);
  const decline = legal.find((a) => a.type === 'DECLINE_MARKET');
  return (
    <Shell kicker="Market" title={market.title}>
      <p className="text-lg">{cardText(market, state.game.mode)}</p>
      <div className="flex flex-wrap gap-2">
        {acceptAny !== undefined && (
          <button type="button" className="btn-primary" onClick={() => dispatch(acceptAny)}>
            {decline === undefined ? 'OK' : 'Accept'}
          </button>
        )}
        {acceptAny === undefined &&
          acceptOne.map((a) =>
            a.type === 'ACCEPT_MARKET' ? (
              <button key={a.assetId} type="button" className="btn-primary" onClick={() => dispatch(a)}>
                Sell {ownedName(player, a.assetId)}
              </button>
            ) : null,
          )}
        {decline !== undefined && (
          <button type="button" className="btn-secondary" onClick={() => dispatch(decline)}>
            {acceptAny === undefined && acceptOne.length === 0 ? 'OK' : 'Decline'}
          </button>
        )}
      </div>
    </Shell>
  );
}

function LifeChoice({ state, player, legal, life }: { state: GameState; player: Player; legal: readonly Action[]; life: LifeChoicesCard }) {
  const dispatch = useGame((s) => s.dispatch);
  const kids = state.game.mode === 'kids';
  const options = life.options.filter((o) => !kids || o.kidsOk);
  return (
    <Shell kicker="Life Choices" title={life.title}>
      <p className="text-lg">{cardText(life, state.game.mode)}</p>
      <ul className="grid gap-3 md:grid-cols-3">
        {options.map((option) => {
          const choose = legal.find((a) => a.type === 'CHOOSE_LIFE_OPTION' && a.optionId === option.id);
          const { costToday, monthlyChange } = optionCost(option, player);
          return (
            <li key={option.id} className="flex flex-col justify-between gap-2 rounded-lg border-2 border-slate-300 p-3">
              <div>
                <h3 className="text-lg font-bold">{option.label}</h3>
                <p className="text-sm">{cardText(option, state.game.mode)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="chip border-slate-400 bg-white">
                  Today:&nbsp;<Money amount={-costToday} />
                </span>
                <span className="chip border-slate-400 bg-white">
                  Monthly:&nbsp;<Money amount={-monthlyChange} suffix="/mo" />
                </span>
              </div>
              <button type="button" className="btn-primary" disabled={choose === undefined} onClick={() => choose && dispatch(choose)}>
                {choose === undefined ? 'Not enough cash' : `Choose: ${option.label}`}
              </button>
            </li>
          );
        })}
      </ul>
      {!kids && legal.some((a) => a.type === 'BORROW') && <Borrow state={state} player={player} />}
    </Shell>
  );
}

function Giving({ state, player, legal }: { state: GameState; player: Player; legal: readonly Action[] }) {
  const dispatch = useGame((s) => s.dispatch);
  const give = legal.find((a) => a.type === 'GIVE');
  const skip = legal.find((a) => a.type === 'SKIP_GIVE');
  const gift = give === undefined ? null : previewGift(state, give);
  return (
    <Shell kicker="Giving" title={`${player.name}, would you like to give?`}>
      <p className="text-lg">Give 10% of your cash to help others and earn a Favor token. Giving is part of what money is for.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={give === undefined} onClick={() => give && dispatch(give)}>
          {gift === null ? 'Not enough cash to give' : `Give ${formatMoney(gift)}`}
        </button>
        <button type="button" className="btn-secondary" disabled={skip === undefined} onClick={() => skip && dispatch(skip)}>
          Not this time
        </button>
      </div>
    </Shell>
  );
}

function previewGift(state: GameState, action: Action): number | null {
  const result = reduce(state, action);
  if (!result.ok) return null;
  for (const event of result.state.game.log.at(-1)?.events ?? []) if (event.kind === 'gave') return event.amount;
  return null;
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-slate-600">{label}</dt>
      <dd className="text-base font-bold">{value}</dd>
    </div>
  );
}

function ownedName(player: Player, assetId: string | undefined): string {
  const asset = player.assets.find((a) => a.id === assetId);
  return asset === undefined ? 'asset' : assetName(asset);
}
