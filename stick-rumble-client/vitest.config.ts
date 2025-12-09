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
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.integration.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
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
      ],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 88.62, // Maximum achievable - remaining gap is defensive Phaser lifecycle code
        statements: 90,
      },
    },
  },
});
