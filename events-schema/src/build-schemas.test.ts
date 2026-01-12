import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildSchemas } from './build-schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const schemasDir = join(rootDir, 'schemas');
const commonDir = join(schemasDir, 'common');

describe('buildSchemas', () => {
  // Clean up generated files before each test
  beforeEach(() => {
    if (existsSync(commonDir)) {
      rmSync(commonDir, { recursive: true, force: true });
    }
  });

  // Clean up after all tests
  afterEach(() => {
    if (existsSync(commonDir)) {
      rmSync(commonDir, { recursive: true, force: true });
    }
  });

  it('should create schema output directory', () => {
    buildSchemas();
    expect(existsSync(commonDir)).toBe(true);
  });

  it('should generate position.json schema file', () => {
    buildSchemas();
    const positionPath = join(commonDir, 'position.json');
    expect(existsSync(positionPath)).toBe(true);
  });

  it('should generate velocity.json schema file', () => {
    buildSchemas();
    const velocityPath = join(commonDir, 'velocity.json');
    expect(existsSync(velocityPath)).toBe(true);
  });

  it('should generate message.json schema file', () => {
    buildSchemas();
    const messagePath = join(commonDir, 'message.json');
    expect(existsSync(messagePath)).toBe(true);
  });

  it('should generate valid JSON in position.json', () => {
    buildSchemas();
    const positionPath = join(commonDir, 'position.json');
    const content = readFileSync(positionPath, 'utf8');
    const schema = JSON.parse(content);

    expect(schema.$id).toBe('Position');
    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
    expect(schema.properties.x.type).toBe('number');
    expect(schema.properties.y.type).toBe('number');
  });

  it('should generate valid JSON in velocity.json', () => {
    buildSchemas();
    const velocityPath = join(commonDir, 'velocity.json');
    const content = readFileSync(velocityPath, 'utf8');
    const schema = JSON.parse(content);

    expect(schema.$id).toBe('Velocity');
    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
    expect(schema.properties.x.type).toBe('number');
    expect(schema.properties.y.type).toBe('number');
  });

  it('should generate valid JSON in message.json', () => {
    buildSchemas();
    const messagePath = join(commonDir, 'message.json');
    const content = readFileSync(messagePath, 'utf8');
    const schema = JSON.parse(content);

    expect(schema.$id).toBe('Message');
    expect(schema.type).toBe('object');
    expect(schema.properties).toBeDefined();
    expect(schema.properties.type.type).toBe('string');
    expect(schema.properties.timestamp.type).toBe('integer');
  });

  it('should format JSON with proper indentation', () => {
    buildSchemas();
    const positionPath = join(commonDir, 'position.json');
    const content = readFileSync(positionPath, 'utf8');

    // Check that it's formatted (not minified)
    expect(content).toContain('\n');
    expect(content).toContain('  '); // 2-space indentation
  });

  it('should include trailing newline in output files', () => {
    buildSchemas();
    const positionPath = join(commonDir, 'position.json');
    const content = readFileSync(positionPath, 'utf8');

    expect(content.endsWith('\n')).toBe(true);
  });
});
