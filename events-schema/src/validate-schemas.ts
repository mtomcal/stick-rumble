/**
 * Validation script for ensuring all JSON Schema files are valid.
 * Uses AJV to compile and validate schema structure.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import AjvModule from 'ajv';
const Ajv = AjvModule.default ?? AjvModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const schemasDir = join(rootDir, 'schemas');

/**
 * Recursively find all JSON files in a directory
 */
export function findJsonFiles(dir: string): string[] {
  const files: string[] = [];

  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return files;
  }

  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findJsonFiles(fullPath));
    } else if (entry.endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Validate a single schema file
 */
export function validateSchemaFile(ajv: InstanceType<typeof Ajv>, filePath: string): boolean {
  try {
    const content = readFileSync(filePath, 'utf8');
    const schema = JSON.parse(content);

    // Try to compile the schema with AJV
    ajv.compile(schema);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  Error: ${errorMessage}`);
    return false;
  }
}

/**
 * Main validation function
 * @param schemasDirOverride - Optional override for schemas directory (for testing)
 * @returns true if all schemas are valid, false otherwise
 */
export function validateSchemas(schemasDirOverride?: string): boolean {
  const targetDir = schemasDirOverride ?? schemasDir;
  console.log('Validating JSON Schema files...\n');

  const ajv = new Ajv({ strict: true, allErrors: true });
  const schemaFiles = findJsonFiles(targetDir);

  if (schemaFiles.length === 0) {
    console.log('No schema files found. Run build first.');
    return true;
  }

  let allValid = true;
  let validCount = 0;

  const baseDir = schemasDirOverride ? dirname(schemasDirOverride) : rootDir;

  for (const filePath of schemaFiles) {
    const relativePath = filePath.replace(baseDir + '/', '');
    process.stdout.write(`Validating ${relativePath}... `);

    if (validateSchemaFile(ajv, filePath)) {
      console.log('OK');
      validCount++;
    } else {
      console.log('FAILED');
      allValid = false;
    }
  }

  console.log(`\nValidation complete: ${validCount}/${schemaFiles.length} schemas valid.`);

  return allValid;
}

/**
 * CLI entry point - runs validation and exits with appropriate code
 * @param schemasDirOverride - Optional override for schemas directory (for testing)
 */
export function runValidationCli(schemasDirOverride?: string): void {
  const result = validateSchemas(schemasDirOverride);
  if (!result) {
    process.exit(1);
  }
}

// Run validation when executed directly
runValidationCli();
