import { currentPlayer, legalActions } from '@ff/engine';
import type { GameState } from '@ff/shared';
import { useEffect } from 'react';

import { Board } from './components/Board';
import { Decision } from './components/Decision';
import { EndScreen } from './components/EndScreen';
import { Finances } from './components/Finances';
import { Lobby } from './components/Lobby';
import { Scoreboard } from './components/Scoreboard';
import { Turn } from './components/Turn';
import { ERROR_TEXT } from './lib/text';
import { useGame } from './store';

export function App() {
  const state = useGame((s) => s.state);
  if (state === null) return <Lobby />;
  if (state.game.phase === 'finished') return <EndScreen state={state} />;
  return <GameScreen state={state} />;
}

function GameScreen({ state }: { state: GameState }) {
  const quit = useGame((s) => s.quit);
  const player = currentPlayer(state);
  const legal = legalActions(state, player.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Freedom Loop{state.game.mode === 'kids' ? ' (kids mode)' : ''}</h1>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            if (window.confirm('End this game and go back to the lobby? The game will be lost.')) quit();
          }}
        >
          Quit game
        </button>
      </header>
      <ErrorBanner />
      {/* Phones: board, decision, money, table. Laptops: board and table left, decision and money right. */}
      <main className="mt-4 flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="contents lg:block lg:space-y-4">
          <div className="order-1">
            <Board state={state}>
              <Turn state={state} player={player} legal={legal} />
            </Board>
          </div>
          <div className="order-4">
            <Scoreboard state={state} />
          </div>
        </div>
        <div className="contents lg:block lg:space-y-4">
          <div className="order-2">
            <Decision state={state} player={player} legal={legal} />
          </div>
          <div className="order-3">
            <Finances state={state} player={player} legal={legal} />
          </div>
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
    <div role="alert" className={error === null ? 'sr-only' : 'mt-3 rounded-lg border-2 border-loss bg-red-50 p-3 font-semibold text-loss'}>
      {error === null ? '' : ERROR_TEXT[error]}
    </div>
  );
}
