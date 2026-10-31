import { createGame, monthlyCashFlow, totalDebt, totalExpenses } from '@ff/engine';
import { formatMoney, MAX_PLAYERS, MIN_PLAYERS, PROFESSIONS, type GameMode, type Player } from '@ff/shared';
import { useId, useState } from 'react';

import { tokenLabels } from '../lib/text';
import { useGame } from '../store';
import { Money } from './Money';
import { Pawn } from './Show';

/** Each profession's starting numbers, read from a throwaway engine game so the lobby never does the math. */
const STARTING: ReadonlyMap<string, Player> = new Map(
  PROFESSIONS.map((p) => {
    const preview = createGame({
      id: 'preview',
      mode: 'standard',
      seed: 1,
      players: [
        { id: 'a', name: 'a', professionId: p.id },
        { id: 'b', name: 'b', professionId: p.id },
      ],
    });
    const player = preview.players[0];
    if (player === undefined) throw new Error('unreachable');
    return [p.id, player];
  }),
);

interface Seat {
  readonly key: number;
  readonly name: string;
  readonly professionId: string;
}

const DEFAULT_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6'];

function randomProfession(): string {
  return PROFESSIONS[Math.floor(Math.random() * PROFESSIONS.length)]?.id ?? 'teacher';
}

export function Lobby() {
  const start = useGame((s) => s.start);
  const [mode, setMode] = useState<GameMode>('standard');
  const [seats, setSeats] = useState<readonly Seat[]>(() => [
    { key: 0, name: '', professionId: randomProfession() },
    { key: 1, name: '', professionId: randomProfession() },
  ]);
  const [nextKey, setNextKey] = useState(2);

  const names = seats.map((s, i) => (s.name.trim() === '' ? (DEFAULT_NAMES[i] ?? `Player ${String(i + 1)}`) : s.name.trim()));
  const labels = tokenLabels(names.map((name) => ({ name })));

  const update = (key: number, patch: Partial<Seat>) => {
    setSeats((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const begin = () => {
    start({
      mode,
      players: seats.map((s, i) => ({ id: `p${String(i + 1)}`, name: names[i] ?? `Player ${String(i + 1)}`, professionId: s.professionId })),
    });
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <header className="text-center">
        <p className="eyebrow text-gold">Family game night</p>
        <h1 className="mt-2 font-display text-6xl font-extrabold tracking-tight sm:text-7xl">
          <span className="shimmer-text">Freedom Loop</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">You win when the money your assets earn each month covers what you spend. Buy things that pay you. Skip things that cost you.</p>
      </header>

      <section aria-labelledby="mode-heading" className="mt-10">
        <h2 id="mode-heading" className="eyebrow mb-3 text-white/70">
          Pick the show
        </h2>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">Game mode</legend>
          <ModeOption value="standard" current={mode} onChange={setMode} title="Standard" detail="Teens and adults. 15 months, borrowing, big deals." gradient="from-indigo-600 to-violet-900" />
          <ModeOption value="kids" current={mode} onChange={setMode} title="Kids" detail="Ages 7 to 10. 10 months, small deals, no borrowing, simple words." gradient="from-pink-600 to-orange-800" />
        </fieldset>
      </section>

      <section aria-labelledby="players-heading" className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="players-heading" className="eyebrow text-white/70">
            Contestants ({seats.length})
          </h2>
          <button
            type="button"
            className="btn-ghost"
            disabled={seats.length >= MAX_PLAYERS}
            onClick={() => {
              setSeats((all) => [...all, { key: nextKey, name: '', professionId: randomProfession() }]);
              setNextKey((k) => k + 1);
            }}
          >
            + Add player
          </button>
        </div>
        <ul className="grid gap-4 md:grid-cols-2">
          {seats.map((seat, i) => (
            <SeatCard
              key={seat.key}
              index={i}
              label={labels[i] ?? '?'}
              seat={seat}
              canRemove={seats.length > MIN_PLAYERS}
              onChange={(patch) => {
                update(seat.key, patch);
              }}
              onRemove={() => {
                setSeats((all) => all.filter((s) => s.key !== seat.key));
              }}
            />
          ))}
        </ul>
      </section>

      <div className="mt-10 flex flex-col items-center gap-3">
        <button type="button" className="btn-go px-16 py-6 text-3xl" onClick={begin}>
          Start game
        </button>
        <p className="max-w-xl text-center text-sm text-white/70">Playing on a TV? After you start, click Show on TV and drag that window to the TV. This screen keeps the buttons.</p>
      </div>
    </main>
  );
}

function ModeOption(props: { value: GameMode; current: GameMode; onChange: (m: GameMode) => void; title: string; detail: string; gradient: string }) {
  const id = useId();
  const checked = props.value === props.current;
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 transition ${props.gradient} ${checked ? 'shadow-glow' : 'opacity-70 hover:opacity-95'}`}>
      <input
        id={id}
        type="radio"
        name="mode"
        className="peer absolute right-5 top-5 h-6 w-6 accent-[#ffd166]"
        checked={checked}
        onChange={() => {
          props.onChange(props.value);
        }}
      />
      <label htmlFor={id} className="block cursor-pointer pr-10">
        <span className="block font-display text-3xl font-extrabold">{props.title}</span>
        <span className="mt-1 block text-white/90">{props.detail}</span>
      </label>
    </div>
  );
}

function SeatCard(props: { index: number; label: string; seat: Seat; canRemove: boolean; onChange: (patch: Partial<Seat>) => void; onRemove: () => void }) {
  const { index, seat } = props;
  const nameId = useId();
  const jobId = useId();
  const start = STARTING.get(seat.professionId);
  return (
    <li className="glass p-5">
      <div className="flex items-center gap-4">
        <Pawn seat={index} label={props.label} size={52} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={nameId} className="eyebrow text-white/70">
            Name
          </label>
          <input
            id={nameId}
            className="field font-display text-xl font-extrabold"
            placeholder={DEFAULT_NAMES[index]}
            value={seat.name}
            maxLength={20}
            onChange={(e) => {
              props.onChange({ name: e.target.value });
            }}
          />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <label htmlFor={jobId} className="eyebrow text-white/70">
            Job
          </label>
          <select
            id={jobId}
            className="field"
            value={seat.professionId}
            onChange={(e) => {
              props.onChange({ professionId: e.target.value });
            }}
          >
            {PROFESSIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => {
            props.onChange({ professionId: randomProfession() });
          }}
        >
          Surprise me
        </button>
        {props.canRemove && (
          <button type="button" className="btn-danger" onClick={props.onRemove} aria-label={`Remove player ${String(index + 1)}`}>
            Remove
          </button>
        )}
      </div>
      {start !== undefined && (
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Salary">{formatMoney(start.salary)}</Stat>
          <Stat label="Bills">{formatMoney(totalExpenses(start))}</Stat>
          <Stat label="Payday">
            <Money amount={monthlyCashFlow(start)} />
          </Stat>
          <Stat label="Cash">{formatMoney(start.cash)}</Stat>
          <Stat label="Debt">{formatMoney(totalDebt(start))}</Stat>
          <Stat label="Freedom">0%</Stat>
        </dl>
      )}
    </li>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.06] px-2 py-2">
      <dt className="eyebrow !text-[0.65rem] text-white/70">{label}</dt>
      <dd className="font-display text-lg font-extrabold">{children}</dd>
    </div>
  );
}
