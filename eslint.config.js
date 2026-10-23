import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const PURITY = 'Engine and shared are pure (CLAUDE.md, Rule 1). ';

/** Files that make up the pure engine. ESLint enforces Rule 1 on them. */
const PURE_FILES = ['packages/engine/src/**/*.ts', 'packages/shared/src/**/*.ts'];

/** Test code inside the pure packages may log and read ambient values, but still may not import UI or Node. */
const PURE_TEST_FILES = [
  'packages/engine/src/**/*.test.ts',
  'packages/engine/src/test/**/*.ts',
  'packages/shared/src/**/*.test.ts',
];

export default defineConfig([
  globalIgnores(['**/dist/**', '**/node_modules/**', '**/coverage/**', '.husky/**']),

  // Baseline for every file.
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Config files that no tsconfig includes. web/vite.config.ts is
          // covered by packages/web/tsconfig.node.json, so it is not listed.
          allowDefaultProject: ['*.config.ts', 'packages/*/vitest.config.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // "expenses" alone is ambiguous. Use baseExpenses or totalExpenses (CLAUDE.md, Rule 2).
      'id-denylist': ['error', 'expenses'],
    },
  },

  // Plain JS files (this config) get no type-aware rules.
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },

  // Rule 1: the engine is pure.
  {
    files: PURE_FILES,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: PURITY + 'No React in the engine.' },
            { name: 'react-dom', message: PURITY + 'No React in the engine.' },
            { name: 'zustand', message: PURITY + 'No client state library in the engine.' },
            { name: '@ff/web', message: PURITY + 'The engine never imports the web package.' },
            { name: 'fs', message: PURITY + 'No Node modules in the engine.' },
            { name: 'path', message: PURITY + 'No Node modules in the engine.' },
          ],
          patterns: [
            { group: ['react-dom/*', 'react/*'], message: PURITY + 'No React in the engine.' },
            { group: ['@supabase/*'], message: PURITY + 'No Supabase in the engine.' },
            { group: ['node:*', 'fs/*', 'path/*'], message: PURITY + 'No Node modules in the engine.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: PURITY + 'Time is not an input. Put it in state if a rule needs it.' },
        { name: 'performance', message: PURITY + 'No timers or clocks.' },
        { name: 'crypto', message: PURITY + 'Randomness comes only from the seeded PRNG in rng.ts.' },
        { name: 'setTimeout', message: PURITY + 'No timers.' },
        { name: 'setInterval', message: PURITY + 'No timers.' },
        { name: 'queueMicrotask', message: PURITY + 'No scheduling.' },
        { name: 'window', message: PURITY + 'No browser globals.' },
        { name: 'document', message: PURITY + 'No browser globals.' },
        { name: 'navigator', message: PURITY + 'No browser globals.' },
        { name: 'localStorage', message: PURITY + 'No browser storage.' },
        { name: 'sessionStorage', message: PURITY + 'No browser storage.' },
        { name: 'fetch', message: PURITY + 'No network.' },
        { name: 'console', message: PURITY + 'No logging. Return errors in ReduceResult instead.' },
        { name: 'process', message: PURITY + 'No Node globals.' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: PURITY + 'Randomness comes only from the seeded PRNG in rng.ts.',
        },
      ],
    },
  },
  {
    files: PURE_TEST_FILES,
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },

  // Balance simulation: a Node script outside the pure engine. It may log and
  // write files, but it still only talks to the engine through reduce().
  {
    files: ['packages/engine/sim/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // Web: React 18 + Vite, with accessibility lint.
  {
    files: ['packages/web/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
  {
    files: ['packages/web/src/**/*.{ts,tsx}'],
    ...reactRefresh.configs.vite,
  },
]);
