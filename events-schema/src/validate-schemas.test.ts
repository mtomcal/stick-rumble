import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import { validateSchemas, findJsonFiles, validateSchemaFile, runValidationCli } from './validate-schemas.js';
import { buildSchemas } from './build-schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const schemasDir = join(rootDir, 'schemas');
const commonDir = join(schemasDir, 'common');
const testDir = join(schemasDir, 'test-fixtures');

describe('findJsonFiles', () => {
  const fixturesDir = join(testDir, 'find-json');

  beforeEach(() => {
    // Clean up before each test
    if (existsSync(fixturesDir)) {
      rmSync(fixturesDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up after each test
    if (existsSync(fixturesDir)) {
      rmSync(fixturesDir, { recursive: true, force: true });
    }
  });

  it('should return empty array for non-existent directory', () => {
    const result = findJsonFiles('/non/existent/path');
    expect(result).toEqual([]);
  });

  it('should return empty array for a file path (not directory)', () => {
    // Create a test file
    mkdirSync(fixturesDir, { recursive: true });
    const filePath = join(fixturesDir, 'test.txt');
    writeFileSync(filePath, 'test content', 'utf8');

    const result = findJsonFiles(filePath);
    expect(result).toEqual([]);
  });

  it('should return empty array for empty directory', () => {
    mkdirSync(fixturesDir, { recursive: true });
    const result = findJsonFiles(fixturesDir);
    expect(result).toEqual([]);
  });

  it('should find JSON files in directory', () => {
    mkdirSync(fixturesDir, { recursive: true });
    const jsonPath = join(fixturesDir, 'schema.json');
    writeFileSync(jsonPath, '{}', 'utf8');

    const result = findJsonFiles(fixturesDir);
    expect(result).toContain(jsonPath);
  });

  it('should ignore non-JSON files', () => {
    mkdirSync(fixturesDir, { recursive: true });
    const txtPath = join(fixturesDir, 'readme.txt');
    const tsPath = join(fixturesDir, 'file.ts');
    writeFileSync(txtPath, 'readme', 'utf8');
    writeFileSync(tsPath, 'const x = 1;', 'utf8');

    const result = findJsonFiles(fixturesDir);
    expect(result).toEqual([]);
  });

  it('should recursively find JSON files in subdirectories', () => {
    const subDir = join(fixturesDir, 'subdir');
    mkdirSync(subDir, { recursive: true });
    const jsonPath = join(subDir, 'nested.json');
    writeFileSync(jsonPath, '{}', 'utf8');

    const result = findJsonFiles(fixturesDir);
    expect(result).toContain(jsonPath);
  });
});

describe('validateSchemaFile', () => {
  const fixturesDir = join(testDir, 'validate-file');
  const ajv = new Ajv({ strict: true });

  beforeEach(() => {
    if (existsSync(fixturesDir)) {
      rmSync(fixturesDir, { recursive: true, force: true });
    }
    mkdirSync(fixturesDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(fixturesDir)) {
      rmSync(fixturesDir, { recursive: true, force: true });
    }
  });

  it('should return true for valid JSON Schema', () => {
    const schemaPath = join(fixturesDir, 'valid.json');
    const validSchema = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
    };
    writeFileSync(schemaPath, JSON.stringify(validSchema), 'utf8');

    const result = validateSchemaFile(ajv, schemaPath);
    expect(result).toBe(true);
  });

  it('should return false for malformed JSON', () => {
    const schemaPath = join(fixturesDir, 'malformed.json');
    writeFileSync(schemaPath, '{ invalid json }', 'utf8');

    const result = validateSchemaFile(ajv, schemaPath);
    expect(result).toBe(false);
  });

  it('should return false for invalid JSON Schema', () => {
    const schemaPath = join(fixturesDir, 'invalid-schema.json');
    // Invalid schema - type should be a string or array of strings
    const invalidSchema = {
      type: 123,
    };
    writeFileSync(schemaPath, JSON.stringify(invalidSchema), 'utf8');

    const result = validateSchemaFile(ajv, schemaPath);
    expect(result).toBe(false);
  });

  it('should handle error that is not an Error instance', () => {
    const schemaPath = join(fixturesDir, 'nonexistent.json');
    // This will throw an ENOENT error when trying to read
    const result = validateSchemaFile(ajv, schemaPath);
    expect(result).toBe(false);
  });
});

describe('validateSchemas', () => {
  // Build schemas before running validation tests
  beforeAll(() => {
    buildSchemas();
  });

  // Clean up generated files after all tests
  afterAll(() => {
    if (existsSync(commonDir)) {
      rmSync(commonDir, { recursive: true, force: true });
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should return true when schemas are valid', () => {
    const result = validateSchemas();
    expect(result).toBe(true);
  });

  it('should validate all generated schema files', () => {
    expect(existsSync(join(commonDir, 'position.json'))).toBe(true);
    expect(existsSync(join(commonDir, 'velocity.json'))).toBe(true);
    expect(existsSync(join(commonDir, 'message.json'))).toBe(true);

    const result = validateSchemas();
    expect(result).toBe(true);
  });

  it('should return true when no schema files exist', () => {
    const emptyDir = join(testDir, 'empty');
    mkdirSync(emptyDir, { recursive: true });

    const result = validateSchemas(emptyDir);
    expect(result).toBe(true);

    rmSync(emptyDir, { recursive: true, force: true });
  });

  it('should return true for non-existent directory', () => {
    const result = validateSchemas('/non/existent/schemas');
    expect(result).toBe(true);
  });
});

describe('validateSchemas with invalid files', () => {
  const invalidDir = join(testDir, 'invalid-schemas');

  beforeEach(() => {
    if (existsSync(invalidDir)) {
      rmSync(invalidDir, { recursive: true, force: true });
    }
    mkdirSync(invalidDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(invalidDir)) {
      rmSync(invalidDir, { recursive: true, force: true });
    }
  });

  it('should return false when schemas are invalid', () => {
    // Create an invalid schema file
    const invalidSchemaPath = join(invalidDir, 'bad-schema.json');
    writeFileSync(invalidSchemaPath, '{ "type": 123 }', 'utf8');

    const result = validateSchemas(invalidDir);
    expect(result).toBe(false);
  });

  it('should return false when JSON is malformed', () => {
    const malformedPath = join(invalidDir, 'malformed.json');
    writeFileSync(malformedPath, '{ invalid }', 'utf8');

    const result = validateSchemas(invalidDir);
    expect(result).toBe(false);
  });

  it('should handle mixed valid and invalid schemas', () => {
    // Create one valid and one invalid schema
    const validPath = join(invalidDir, 'valid.json');
    const invalidPath = join(invalidDir, 'invalid.json');

    writeFileSync(validPath, '{ "type": "object" }', 'utf8');
    writeFileSync(invalidPath, '{ invalid json }', 'utf8');

    const result = validateSchemas(invalidDir);
    expect(result).toBe(false);
  });
});

describe('runValidationCli', () => {
  const cliTestDir = join(testDir, 'cli-test');

  beforeEach(() => {
    if (existsSync(cliTestDir)) {
      rmSync(cliTestDir, { recursive: true, force: true });
    }
    mkdirSync(cliTestDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(cliTestDir)) {
      rmSync(cliTestDir, { recursive: true, force: true });
    }
  });

  it('should not exit when schemas are valid', () => {
    // Create a valid schema
    const validSchemaPath = join(cliTestDir, 'valid.json');
    writeFileSync(validSchemaPath, '{ "type": "object" }', 'utf8');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    runValidationCli(cliTestDir);

    expect(exitSpy).not.toHaveBeenCalled();
    exitSpy.mockRestore();
  });

  it('should exit with code 1 when schemas are invalid', () => {
    // Create an invalid schema
    const invalidSchemaPath = join(cliTestDir, 'invalid.json');
    writeFileSync(invalidSchemaPath, '{ invalid json }', 'utf8');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    runValidationCli(cliTestDir);

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });
});
