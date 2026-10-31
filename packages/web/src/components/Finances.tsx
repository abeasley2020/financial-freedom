import { assetCashFlow, assetValue, creditAvailable, freedomPercent, monthlyCashFlow, passiveIncome, pct, reduce, totalDebt, totalExpenses } from '@ff/engine';
import { BANK_CREDIT_LIMIT_MONTHS, BORROW_STEP, formatMoney, formatSignedMoney, isGrowthAsset, LIABILITY_PAYMENT_PERCENT, type Action, type GameState, type Player } from '@ff/shared';
import { useId, useState } from 'react';

import { assetName, assetTypeLabel, liabilityName, professionName } from '../lib/text';
import { useGame } from '../store';
import { Money } from './Money';

/** The current player's balance sheet, with the always-available actions (borrow, repay, sell a growth asset). */
export function Finances({ state, player, legal }: { state: GameState; player: Player; legal: readonly Action[] }) {
  const dispatch = useGame((s) => s.dispatch);
  const kids = state.game.mode === 'kids';
  const freedom = freedomPercent(player);
  const canBorrow = legal.some((a) => a.type === 'BORROW');

  return (
    <section className="panel" aria-labelledby="finances-heading">
      <h2 id="finances-heading" className="text-xl font-bold">
        {player.name}&rsquo;s money <span className="text-base font-normal text-slate-600">({professionName(player.professionId)})</span>
      </h2>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        <Row label="Cash" value={formatMoney(player.cash)} big />
        <Row label="Payday each month" value={<Money amount={monthlyCashFlow(player)} suffix="/mo" />} big />
        <Row label="Freedom" value={`${String(freedom)}%`} big />
        <Row label="Salary" value={`${formatMoney(player.salary)}/mo`} />
        <Row label="Passive income" value={<Money amount={passiveIncome(player)} suffix="/mo" />} />
        <Row label="Monthly bills" value={`${formatMoney(totalExpenses(player))}/mo`} />
      </dl>

      <div className="mt-3">
        <div className="flex justify-between text-sm">
          <span>Passive income vs. monthly bills</span>
          <span className="font-semibold">{freedom}% free</span>
        </div>
        <div
          role="meter"
          aria-label="Freedom"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(freedom, 100)}
          aria-valuetext={`${String(freedom)} percent`}
          className="mt-1 h-4 w-full overflow-hidden rounded-full border border-slate-400 bg-slate-100"
        >
          <div className="h-full bg-gain" style={{ width: `${String(Math.min(freedom, 100))}%` }} />
        </div>
        <p className="mt-1 text-xs text-slate-600">Reach 100% to escape and win.</p>
      </div>

      <h3 className="mt-4 font-bold">Assets (things that pay you)</h3>
      {player.assets.length === 0 ? (
        <p className="text-sm text-slate-600">None yet. Buy deals on Opportunity spaces.</p>
      ) : (
        <ul className="mt-1 divide-y divide-slate-200">
          {player.assets.map((asset) => {
            const sell = legal.find((a) => a.type === 'SELL_ASSET' && a.assetId === asset.id && state.pending.kind === 'none');
            return (
              <li key={asset.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold">{assetName(asset)}</span>{' '}
                  <span className="text-sm text-slate-600">
                    {assetTypeLabel(asset)}
                    {asset.type === 'stock' ? `, ${String(asset.shares)} shares` : ''}, worth {formatMoney(assetValue(asset))}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Money amount={assetCashFlow(asset)} suffix="/mo" />
                  {sell !== undefined && isGrowthAsset(asset) && (
                    <button type="button" className="btn-secondary" onClick={() => dispatch(sell)}>
                      Sell for {formatMoney(asset.marketValue)}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="mt-4 font-bold">Liabilities (things that cost you)</h3>
      {player.liabilities.length === 0 ? (
        <p className="text-sm text-slate-600">No debts. Nice.</p>
      ) : (
        <ul className="mt-1 divide-y divide-slate-200">
          {player.liabilities.map((l) => {
            const repay = legal.find((a) => a.type === 'REPAY' && a.liabilityId === l.id);
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold">{liabilityName(l)}</span>{' '}
                  {l.principal > 0 && <span className="text-sm text-slate-600">owe {formatMoney(l.principal)}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <Money amount={-l.monthlyPayment} suffix="/mo" />
                  {repay !== undefined && (
                    <button type="button" className="btn-secondary" onClick={() => dispatch(repay)}>
                      {l.kind === 'subscription' ? 'Cancel' : `Pay off ${formatMoney(l.principal)}`}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-1 text-sm text-slate-600">Total debt: {formatMoney(totalDebt(player))}</p>

      {!kids && canBorrow && state.pending.kind === 'none' && <Borrow state={state} player={player} />}
    </section>
  );
}

export function Borrow({ state, player }: { state: GameState; player: Player }) {
  const dispatch = useGame((s) => s.dispatch);
  const playerId = player.id;
  const [amount, setAmount] = useState(BORROW_STEP);
  // Ask the engine whether one more step is allowed, so the credit limit is never re-implemented here.
  const canMore = reduce(state, { type: 'BORROW', playerId, amount: amount + BORROW_STEP }).ok;
  const canThis = reduce(state, { type: 'BORROW', playerId, amount }).ok;
  const id = useId();
  const payment = pct(amount, LIABILITY_PAYMENT_PERCENT.bank);
  return (
    <div className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <h3 className="font-bold">Borrow from the bank</h3>
      <p className="text-sm text-slate-700">Bank loans cost {LIABILITY_PAYMENT_PERCENT.bank}% of the loan every month until you pay them off. Borrow to buy things that pay you.</p>
      <p className="mt-1 text-sm font-semibold">
        The bank will lend you up to {formatMoney(creditAvailable(player))} more (limit: {BANK_CREDIT_LIMIT_MONTHS} months of salary in bank loans).
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-secondary"
          aria-label="Borrow $1,000 less"
          disabled={amount <= BORROW_STEP}
          onClick={() => {
            setAmount((a) => a - BORROW_STEP);
          }}
        >
          −
        </button>
        <output id={id} className="min-w-[6rem] text-center text-lg font-bold" aria-live="polite">
          {formatMoney(amount)}
        </output>
        <button
          type="button"
          className="btn-secondary"
          aria-label="Borrow $1,000 more"
          disabled={!canMore}
          onClick={() => {
            setAmount((a) => a + BORROW_STEP);
          }}
        >
          +
        </button>
        <button
          type="button"
          className="btn-primary"
          aria-describedby={id}
          disabled={!canThis}
          onClick={() => {
            if (dispatch({ type: 'BORROW', playerId, amount })) setAmount(BORROW_STEP);
          }}
        >
          Borrow {formatMoney(amount)} ({formatSignedMoney(-payment)}/mo)
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, big = false }: { label: string; value: React.ReactNode; big?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className={big ? 'text-2xl font-bold' : 'font-semibold'}>{value}</dd>
    </div>
  );
}
