import { currentPlayer, legalActions } from '@ff/engine';
import type { GameState } from '@ff/shared';
import { useEffect } from 'react';

import { Board } from './components/Board';
import { EndScreen } from './components/EndScreen';
import { MoneyHud } from './components/Finances';
import { Lobby } from './components/Lobby';
import { Scoreboard } from './components/Scoreboard';
import { Confetti, PaydayPop, TurnSplash } from './components/Show';
import { TableView } from './components/TableView';
import { BoardCenter, Stage } from './components/Turn';
import { celebrationKey, ERROR_TEXT, tokenLabels } from './lib/text';
import { tableUrl, useRoute } from './router';
import { useGame } from './store';

export function App() {
  const route = useRoute();
  const state = useGame((s) => s.state);
  if (route === 'table') return <TableView />;
  if (state === null) return <Lobby />;
  if (state.game.phase === 'finished') return <EndScreen state={state} />;
  return <GameScreen state={state} />;
}

function GameScreen({ state }: { state: GameState }) {
  const quit = useGame((s) => s.quit);
  const undo = useGame((s) => s.undo);
  const canUndo = useGame((s) => s.undoStack.length > 0);
  const player = currentPlayer(state);
  const legal = legalActions(state, player.id);
  const labels = tokenLabels(state.players);

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-10 pt-4 sm:px-6">
      <TurnSplash state={state} label={(seat) => labels[seat] ?? '?'} />
      <PaydayPop state={state} />
      <Confetti trigger={celebrationKey(state)} />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          <span className="shimmer-text">Freedom Loop</span>
          {state.game.mode === 'kids' && <span className="ml-2 align-middle text-base font-bold text-white/70">kids</span>}
        </h1>
        <div className="flex flex-wrap gap-2">
          {canUndo && (
            <button type="button" className="btn-ghost" onClick={undo}>
              Undo
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              window.open(tableUrl(), 'freedom-loop-table', 'popup=yes,width=1280,height=720');
            }}
          >
            Show on TV
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              if (window.confirm('End this game and go back to the lobby? The game will be lost.')) quit();
            }}
          >
            Quit
          </button>
        </div>
      </header>
      <ErrorBanner />

      {/* Phones: stage first. Laptops: board left, stage right. */}
      <main className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="order-2 lg:order-1">
          <div className="mx-auto max-w-[640px]">
            <Board state={state}>
              <BoardCenter state={state} player={player} />
            </Board>
          </div>
        </div>
        <div className="order-1 space-y-5 lg:order-2">
          <Stage state={state} player={player} legal={legal} />
          <MoneyHud state={state} player={player} legal={legal} />
        </div>
        <div className="order-3 lg:col-span-2">
          <Scoreboard state={state} />
        </div>
      </main>
    </div>
  );
}

function ErrorBanner() {
  const error = useGame((s) => s.lastError);
  const clear = useGame((s) => s.clearError);
  useEffect(() => {
    if (error === null) return;
    const timer = window.setTimeout(clear, 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [error, clear]);
  return (
    <div role="alert" className={error === null ? 'sr-only' : 'rise mt-3 rounded-2xl border border-loss/60 bg-loss/15 p-3 font-semibold text-loss'}>
      {error === null ? '' : ERROR_TEXT[error]}
    </div>
  );
}
