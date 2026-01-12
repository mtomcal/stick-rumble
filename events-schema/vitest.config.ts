import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Disable parallel file execution to prevent test isolation issues
    // Tests that modify schema files must run sequentially to avoid race conditions
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'generated/**',
        '**/*.test.ts',
        'vitest.config.ts',
      ],
      ignoreEmptyLines: true,
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
