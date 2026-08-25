import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Several suites evaluate large module graphs at test time (e.g. the
    // full EN+MN i18n dictionaries via vi.resetModules()+import). Under
    // full-suite parallelism those cold evaluations intermittently exceed
    // Vitest's 5s default — a pure timeout flake, not an assertion failure.
    // Give slow-start tests real headroom instead of retrying them.
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
