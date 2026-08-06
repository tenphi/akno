import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
    environment: 'node',
    // Indexing tests open real SQLite files in temp dirs; keep them serial-ish
    // so a slow machine does not thrash.
    pool: 'forks',
    testTimeout: 30000,
  },
});
