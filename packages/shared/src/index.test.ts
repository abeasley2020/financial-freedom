import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import * as shared from './index';

describe('@ff/shared scaffold', () => {
  it('module resolves', () => {
    expect(shared).toBeDefined();
  });

  it('zod is wired', () => {
    expect(z.number().int().safeParse(1_000).success).toBe(true);
  });
});
