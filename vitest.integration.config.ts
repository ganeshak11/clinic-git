import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/app/api/__tests__/**/*.integration.test.ts'],
    environment: 'node',
    testTimeout: 10000,
  },
});
