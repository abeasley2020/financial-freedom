import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './App';

// Tells React 18 that act() is expected here, which silences its warning.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('App', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
});
