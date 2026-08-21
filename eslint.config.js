import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      // Generated single-file artifact output; linting a 6 MB bundle is noise.
      'dist-standalone/**',
      'release/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'validation/reports/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    // PRODUCT LAW: exactly one frame-loop owner (src/app/Loop.ts).
    // Enforced structurally here and again by scripts/validate-frameloop.mjs.
    files: ['src/**/*.ts'],
    ignores: ['src/app/Loop.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'requestAnimationFrame',
          message:
            'Only src/app/Loop.ts may own a frame loop. Exhibits and systems receive update(dt) from the single loop.',
        },
        {
          name: 'setInterval',
          message: 'Use the single frame loop (update(dt)) instead of timers for simulation.',
        },
      ],
    },
  },
);
