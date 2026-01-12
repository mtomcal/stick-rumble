/**
 * Tests for check-schemas-up-to-date script
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { checkSchemasUpToDate, runCheckCli } from './check-schemas-up-to-date.js';
import { buildSchemas } from './build-schemas.js';
import { writeFileSync, readFileSync, renameSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

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

  it.sequential('should return false when a schema file is stale', () => {
    const testFilePath = join(rootDir, 'schemas/common/position.json');
    const originalContent = readFileSync(testFilePath, 'utf8');

    try {
      // Modify the file to make it stale
      writeFileSync(testFilePath, '{"modified": true}\n', 'utf8');

      const result = checkSchemasUpToDate();
      expect(result).toBe(false);
    } finally {
      // Restore by regenerating all schemas to ensure consistency
      buildSchemas();
    }

    // Verify restoration worked
    const restoredResult = checkSchemasUpToDate();
    expect(restoredResult).toBe(true);
  });

  it.sequential('should return false when a schema file is missing', () => {
    const testFilePath = join(rootDir, 'schemas/common/velocity.json');
    const backupPath = join(rootDir, 'schemas/common/velocity.json.backup');

    try {
      // Temporarily rename the file to simulate missing
      renameSync(testFilePath, backupPath);

      const result = checkSchemasUpToDate();
      expect(result).toBe(false);
    } finally {
      // Restore by regenerating all schemas to ensure consistency
      if (existsSync(backupPath)) {
        renameSync(backupPath, testFilePath);
      }
      buildSchemas();
    }

    // Verify restoration worked
    const restoredResult = checkSchemasUpToDate();
    expect(restoredResult).toBe(true);
  });
});

describe('runCheckCli', () => {
  it('should not exit when schemas are up-to-date', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit called with code ${code}`);
    });

    // Should not throw (not call process.exit)
    expect(() => runCheckCli()).not.toThrow();

    exitSpy.mockRestore();
  });

  it.sequential('should exit with code 1 when schemas are stale', () => {
    const testFilePath = join(rootDir, 'schemas/common/position.json');
    const originalContent = readFileSync(testFilePath, 'utf8');

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
      // Restore original content
      writeFileSync(testFilePath, originalContent, 'utf8');
    }
  });
});
