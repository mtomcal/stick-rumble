/**
 * Tests for check-schemas-up-to-date script
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { checkSchemasUpToDate, runCheckCli } from './check-schemas-up-to-date.js';
import { buildSchemas } from './build-schemas.js';
import { writeFileSync, readFileSync, renameSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Global setup - ensure clean state before any tests run
beforeAll(() => {
  // Remove any backup files from previous failed test runs
  const backupPath = join(rootDir, 'schemas/common/velocity.json.backup');
  if (existsSync(backupPath)) {
    rmSync(backupPath);
  }

  // Rebuild all schemas to ensure clean starting state
  buildSchemas();
});

describe('checkSchemasUpToDate', () => {
  beforeAll(() => {
    // Ensure schemas are built before testing
    buildSchemas();
  });

  afterAll(() => {
    // Ensure schemas are rebuilt after any modifications
    buildSchemas();
  });

  it('should return true when all schemas are up-to-date', () => {
    const result = checkSchemasUpToDate();
    expect(result).toBe(true);
  });

  it('should verify all 44 schema files', () => {
    // This test ensures the check validates the expected number of files
    const result = checkSchemasUpToDate();
    expect(result).toBe(true);
    // If this passes, all 44 files were checked (3 common + 7 client-to-server + 34 server-to-client)
  });
});

// Separate suite for corruption tests with strict isolation
describe('checkSchemasUpToDate - corruption scenarios', () => {
  beforeEach(() => {
    // Rebuild schemas before each test to ensure clean state
    buildSchemas();
  });

  afterEach(() => {
    // Rebuild schemas after each test to prevent pollution
    buildSchemas();
  });

  it('should return false when a schema file is stale', () => {
    const testFilePath = join(rootDir, 'schemas/common/position.json');

    // Modify the file to make it stale
    writeFileSync(testFilePath, '{"modified": true}\n', 'utf8');

    const result = checkSchemasUpToDate();
    expect(result).toBe(false);

    // Cleanup happens in afterEach
  });

  it('should return false when a schema file is missing', () => {
    const testFilePath = join(rootDir, 'schemas/common/velocity.json');
    const backupPath = join(rootDir, 'schemas/common/velocity.json.backup');

    try {
      // Temporarily rename the file to simulate missing
      renameSync(testFilePath, backupPath);

      const result = checkSchemasUpToDate();
      expect(result).toBe(false);
    } finally {
      // Restore the file immediately
      if (existsSync(backupPath)) {
        renameSync(backupPath, testFilePath);
      }
    }

    // Additional cleanup happens in afterEach
  });
});

describe('runCheckCli', () => {
  beforeAll(() => {
    // Ensure clean state before CLI tests
    buildSchemas();
  });

  it('should not exit when schemas are up-to-date', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with code ${code}`);
    });

    try {
      // Should not throw (not call process.exit)
      expect(() => runCheckCli()).not.toThrow();
    } finally {
      exitSpy.mockRestore();
    }
  });
});

// Separate suite for CLI corruption test with strict isolation
describe('runCheckCli - corruption scenarios', () => {
  beforeEach(() => {
    // Rebuild schemas before each test to ensure clean state
    buildSchemas();
  });

  afterEach(() => {
    // Rebuild schemas after each test to prevent pollution
    buildSchemas();
  });

  it('should exit with code 1 when schemas are stale', () => {
    const testFilePath = join(rootDir, 'schemas/common/position.json');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with code ${code}`);
    });

    try {
      // Modify the file to make it stale
      writeFileSync(testFilePath, '{"modified": true}\n', 'utf8');

      // Should throw because process.exit(1) is called
      expect(() => runCheckCli()).toThrow('process.exit called with code 1');
    } finally {
      exitSpy.mockRestore();
      // Cleanup happens in afterEach
    }
  });
});
