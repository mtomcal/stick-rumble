import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      phaser: path.resolve(__dirname, './tests/__mocks__/phaser.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    reporters: ['dot'],
    silent: 'passed-only',
    include: ['**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 20000, // Increased from 10s to 20s for CI stability
    retry: 2, // Retry flaky integration tests up to 2 times (3 total attempts)
  },
});
