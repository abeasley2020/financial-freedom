import { createGame, monthlyCashFlow, totalDebt, totalExpenses } from '@ff/engine';
import { formatMoney, formatSignedMoney, MAX_PLAYERS, MIN_PLAYERS, PROFESSIONS, type GameMode, type Player } from '@ff/shared';
import { useId, useState } from 'react';

import { seatColor } from '../lib/text';
import { useGame } from '../store';

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

  const update = (key: number, patch: Partial<Seat>) => {
    setSeats((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const begin = () => {
    start({
      mode,
      players: seats.map((s, i) => ({
        id: `p${String(i + 1)}`,
        name: s.name.trim() === '' ? (DEFAULT_NAMES[i] ?? `Player ${String(i + 1)}`) : s.name.trim(),
        professionId: s.professionId,
      })),
    });
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-4xl font-extrabold tracking-tight">Freedom Loop</h1>
      <p className="mt-2 text-lg text-slate-700">
        You are free when the money your assets earn each month covers what you spend each month.
      </p>

      <section className="panel mt-6" aria-labelledby="mode-heading">
        <h2 id="mode-heading" className="text-xl font-bold">
          Game mode
        </h2>
        <fieldset className="mt-3 flex flex-wrap gap-3">
          <legend className="sr-only">Game mode</legend>
          <ModeOption value="standard" current={mode} onChange={setMode} title="Standard" detail="Teens and adults. 15 months. Borrowing allowed." />
          <ModeOption value="kids" current={mode} onChange={setMode} title="Kids" detail="Ages 7 to 10. 10 months. Small deals only, no borrowing, simpler words." />
        </fieldset>
      </section>

      <section className="panel mt-6" aria-labelledby="players-heading">
        <h2 id="players-heading" className="text-xl font-bold">
          Players ({seats.length})
        </h2>
        <ul className="mt-3 space-y-4">
          {seats.map((seat, i) => (
            <SeatRow
              key={seat.key}
              index={i}
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
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary"
            disabled={seats.length >= MAX_PLAYERS}
            onClick={() => {
              setSeats((all) => [...all, { key: nextKey, name: '', professionId: randomProfession() }]);
              setNextKey((k) => k + 1);
            }}
          >
            Add player
          </button>
        </div>
      </section>

      <p className="mt-6 text-sm text-slate-700">Playing on a TV? Start the game, then click Show on TV and drag that window to the TV. Your laptop keeps the buttons and everyone&rsquo;s private numbers.</p>
      <div className="mt-3 flex justify-end">
        <button type="button" className="btn-primary px-8 text-lg" onClick={begin}>
          Start game
        </button>
      </div>
    </main>
  );
}

function ModeOption(props: { value: GameMode; current: GameMode; onChange: (m: GameMode) => void; title: string; detail: string }) {
  const id = useId();
  const checked = props.value === props.current;
  return (
    <div className={`flex min-h-[44px] flex-1 items-start gap-3 rounded-lg border-2 p-3 ${checked ? 'border-accent bg-sky-50' : 'border-slate-300 bg-white'}`}>
      <input
        id={id}
        type="radio"
        name="mode"
        className="mt-1 h-5 w-5"
        checked={checked}
        onChange={() => {
          props.onChange(props.value);
        }}
      />
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block font-bold">{props.title}</span>
        <span className="block text-sm text-slate-700">{props.detail}</span>
      </label>
    </div>
  );
}

function SeatRow(props: { index: number; seat: Seat; canRemove: boolean; onChange: (patch: Partial<Seat>) => void; onRemove: () => void }) {
  const { index, seat } = props;
  const nameId = useId();
  const jobId = useId();
  const start = STARTING.get(seat.professionId);
  const debt = start === undefined ? 0 : totalDebt(start);
  return (
    <li className="rounded-lg border border-slate-300 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white"
          style={{ backgroundColor: seatColor(index) }}
        >
          {index + 1}
        </span>
        <div className="flex min-w-[10rem] flex-1 flex-col">
          <label htmlFor={nameId} className="text-sm font-semibold">
            Name
          </label>
          <input
            id={nameId}
            className="min-h-[44px] rounded-md border border-slate-400 px-3"
            placeholder={DEFAULT_NAMES[index]}
            value={seat.name}
            maxLength={20}
            onChange={(e) => {
              props.onChange({ name: e.target.value });
            }}
          />
        </div>
        <div className="flex min-w-[12rem] flex-1 flex-col">
          <label htmlFor={jobId} className="text-sm font-semibold">
            Profession
          </label>
          <select
            id={jobId}
            className="min-h-[44px] rounded-md border border-slate-400 bg-white px-3"
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
          className="btn-secondary"
          onClick={() => {
            props.onChange({ professionId: randomProfession() });
          }}
        >
          Random job
        </button>
        {props.canRemove && (
          <button type="button" className="btn-danger" onClick={props.onRemove} aria-label={`Remove player ${String(index + 1)}`}>
            Remove
          </button>
        )}
      </div>
      {start !== undefined && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
          <Stat label="Salary" value={`${formatMoney(start.salary)}/mo`} />
          <Stat label="Monthly bills" value={`${formatMoney(totalExpenses(start))}/mo`} />
          <Stat label="Payday" value={`${formatSignedMoney(monthlyCashFlow(start))}/mo`} />
          <Stat label="Cash" value={formatMoney(start.cash)} />
          <Stat label="Debt" value={formatMoney(debt)} />
        </dl>
      )}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-600">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
