import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './App';
import { useGame } from './store';

// Tells React 18 that act() is expected here, which silences its warning.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('App', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    useGame.getState().quit();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders the heading', () => {
    act(() => {
      root.render(<App />);
    });

    const heading = container.querySelector('h1');
    expect(heading?.textContent).toBe('Freedom Loop');
  });

  it('starts a game from the lobby and offers the first player the roll, and only the roll', () => {
    act(() => {
      root.render(<App />);
    });
    const start = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Start game');
    act(() => {
      start?.click();
    });
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent);
    expect(labels).toContain('Payday & roll');
    expect(labels).not.toContain('End turn');
    expect(useGame.getState().state?.game.phase).toBe('playing');
  });

  it('rolls, then undo is not offered because the roll cannot be taken back', () => {
    act(() => {
      root.render(<App />);
    });
    act(() => {
      [...container.querySelectorAll('button')].find((b) => b.textContent === 'Start game')?.click();
    });
    act(() => {
      [...container.querySelectorAll('button')].find((b) => b.textContent === 'Payday & roll')?.click();
    });
    expect(useGame.getState().state?.game.log.length).toBe(1);
    expect(useGame.getState().undoStack).toEqual([]);
    expect([...container.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('Undo');
  });
});
