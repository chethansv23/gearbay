import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['{packages,services}/**/test/**/*.test.js'], exclude: ['**/*.it.test.js'] } },
      // Integration tests start a real Postgres in Docker, so they get a longer timeout.
      { test: { name: 'integration', include: ['{packages,services}/**/test/**/*.it.test.js'], testTimeout: 120_000, hookTimeout: 120_000 } },
    ],
    coverage: { include: ['packages/*/src/**', 'services/*/src/**'] },
  },
});
