import { assetCashFlow, assetValue, creditAvailable, freedomPercent, monthlyCashFlow, passiveIncome, pct, reduce, totalDebt, totalExpenses } from '@ff/engine';
import { BANK_CREDIT_LIMIT_MONTHS, BORROW_STEP, formatMoney, formatSignedMoney, isGrowthAsset, LIABILITY_PAYMENT_PERCENT, type Action, type GameState, type Player } from '@ff/shared';
import { useEffect, useId, useRef, useState } from 'react';

import { assetName, assetTypeLabel, liabilityName, professionName, tokenLabels } from '../lib/text';
import { useGame } from '../store';
import { Money } from './Money';
import { FreedomRing, Pawn } from './Show';

/** The current player's numbers at a glance, with the button that opens the full balance sheet. */
export function MoneyHud({ state, player, legal }: { state: GameState; player: Player; legal: readonly Action[] }) {
  const seat = state.players.findIndex((p) => p.id === player.id);
  const [open, setOpen] = useState(false);
  const movesWaiting = legal.some((a) => a.type === 'REPAY' || (a.type === 'SELL_ASSET' && state.pending.kind === 'none'));
  return (
    <section aria-labelledby="finances-heading" className="glass flex flex-wrap items-center gap-4 p-4 sm:gap-6 sm:p-5">
      <div className="flex items-center gap-3">
        <Pawn seat={seat} label={tokenLabels(state.players)[seat] ?? '?'} size={48} />
        <div>
          <h2 id="finances-heading" className="font-display text-xl font-extrabold leading-tight">
            {player.name}&rsquo;s money
          </h2>
          <p className="text-sm text-white/70">{professionName(player.professionId)}</p>
        </div>
      </div>
      <dl className="flex flex-1 flex-wrap gap-x-6 gap-y-2">
        <HudStat label="Cash">{formatMoney(player.cash)}</HudStat>
        <HudStat label="Payday">
          <Money amount={monthlyCashFlow(player)} suffix="/mo" />
        </HudStat>
        <HudStat label="Assets pay">
          {formatMoney(passiveIncome(player))}
          <span className="text-base font-semibold text-white/70"> of {formatMoney(totalExpenses(player))}</span>
        </HudStat>
      </dl>
      <FreedomRing percent={freedomPercent(player)} seat={seat} size={72} label={`${player.name} freedom`} />
      <button
        type="button"
        className="btn-ghost"
        onClick={() => {
          setOpen(true);
        }}
      >
        My money
        {movesWaiting && (
          <span className="rounded-full bg-gold px-2 py-0.5 text-xs text-ink">
            moves
          </span>
        )}
      </button>
      <MoneyDrawer
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        state={state}
        player={player}
        legal={legal}
      />
    </section>
  );
}

function HudStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow text-white/70">{label}</dt>
      <dd className="font-display text-2xl font-extrabold leading-tight">{children}</dd>
    </div>
  );
}

/** The full balance sheet in a side drawer: assets, liabilities, and the always-available moves. */
function MoneyDrawer({ open, onClose, state, player, legal }: { open: boolean; onClose: () => void; state: GameState; player: Player; legal: readonly Action[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const dispatch = useGame((s) => s.dispatch);
  const kids = state.game.mode === 'kids';
  const headingId = useId();
  const canBorrow = legal.some((a) => a.type === 'BORROW') && state.pending.kind === 'none';

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      onClose={onClose}
      className="m-0 ml-auto h-full max-h-none w-full max-w-xl overflow-y-auto border-0 bg-surface p-0 text-white backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-surface/95 px-6 py-4 backdrop-blur">
        <h2 id={headingId} className="font-display text-2xl font-extrabold">
          {player.name}&rsquo;s balance sheet
        </h2>
        <button type="button" className="btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="space-y-6 p-6">
        <dl className="grid grid-cols-2 gap-3">
          <Box label="Cash">{formatMoney(player.cash)}</Box>
          <Box label="Payday each month">
            <Money amount={monthlyCashFlow(player)} suffix="/mo" />
          </Box>
          <Box label="Salary">{formatMoney(player.salary)}/mo</Box>
          <Box label="Monthly bills">{formatMoney(totalExpenses(player))}/mo</Box>
          <Box label="Passive income">
            <Money amount={passiveIncome(player)} suffix="/mo" />
          </Box>
          <Box label="Freedom">{freedomPercent(player)}%</Box>
        </dl>

        <section>
          <h3 className="eyebrow text-gain">Assets: things that pay you</h3>
          {player.assets.length === 0 ? (
            <p className="mt-2 text-white/70">None yet. Buy deals on Opportunity spaces.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {player.assets.map((asset) => {
                const sell = state.pending.kind === 'none' ? legal.find((a) => a.type === 'SELL_ASSET' && a.assetId === asset.id) : undefined;
                return (
                  <li key={asset.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/[0.06] px-4 py-3">
                    <span>
                      <span className="block font-semibold">{assetName(asset)}</span>
                      <span className="text-sm text-white/70">
                        {assetTypeLabel(asset)}
                        {asset.type === 'stock' ? `, ${String(asset.shares)} shares` : ''}, worth {formatMoney(assetValue(asset))}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <Money amount={assetCashFlow(asset)} suffix="/mo" />
                      {sell !== undefined && isGrowthAsset(asset) && (
                        <button type="button" className="btn-ghost" onClick={() => dispatch(sell)}>
                          Sell for {formatMoney(asset.marketValue)}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h3 className="eyebrow text-loss">Liabilities: things that cost you</h3>
          {player.liabilities.length === 0 ? (
            <p className="mt-2 text-white/70">No debts. Nice.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {player.liabilities.map((l) => {
                const repay = legal.find((a) => a.type === 'REPAY' && a.liabilityId === l.id);
                return (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/[0.06] px-4 py-3">
                    <span>
                      <span className="block font-semibold">{liabilityName(l)}</span>
                      {l.principal > 0 && <span className="text-sm text-white/70">owe {formatMoney(l.principal)}</span>}
                    </span>
                    <span className="flex items-center gap-3">
                      <Money amount={-l.monthlyPayment} suffix="/mo" />
                      {repay !== undefined && (
                        <button type="button" className="btn-ghost" onClick={() => dispatch(repay)}>
                          {l.kind === 'subscription' ? 'Cancel' : `Pay off ${formatMoney(l.principal)}`}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-sm text-white/70">Total debt: {formatMoney(totalDebt(player))}</p>
        </section>

        {!kids && canBorrow && <Borrow state={state} player={player} />}
      </div>
    </dialog>
  );
}

function Box({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] px-4 py-3">
      <dt className="eyebrow text-white/70">{label}</dt>
      <dd className="font-display text-xl font-extrabold">{children}</dd>
    </div>
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
    <div className="rounded-3xl border border-white/15 bg-black/20 p-4">
      <h3 className="font-display text-lg font-extrabold">Borrow from the bank</h3>
      <p className="text-sm text-white/80">
        Costs {LIABILITY_PAYMENT_PERCENT.bank}% of the loan every month until you pay it off. Borrow for things that pay you. The bank will lend up to {formatMoney(creditAvailable(player))} more ({BANK_CREDIT_LIMIT_MONTHS} months of salary in total).
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-ghost !px-4 text-xl"
          aria-label="Borrow $1,000 less"
          disabled={amount <= BORROW_STEP}
          onClick={() => {
            setAmount((a) => a - BORROW_STEP);
          }}
        >
          −
        </button>
        <output id={id} className="min-w-[6rem] text-center font-display text-2xl font-extrabold" aria-live="polite">
          {formatMoney(amount)}
        </output>
        <button
          type="button"
          className="btn-ghost !px-4 text-xl"
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
