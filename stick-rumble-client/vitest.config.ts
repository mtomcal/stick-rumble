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
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.integration.test.ts',
      '**/tests/visual/**', // Playwright visual tests
    ],
    coverage: {
      provider: 'v8',
      reporter: ['json-summary', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.*',
        '**/vite.config.ts',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        '**/*.css',
        'package.json',
        'src/main.tsx', // App entry point, difficult to test
        'src/**/*.integration.helpers.ts', // Integration test helpers, tested during integration
        'src/ui-test-*.ts', // UI test harness files for Playwright visual tests
      ],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 93.21, // Adjusted for UI test harness exclusions
        statements: 90,
      },
    },
  },
});
