/**
 * Build script for generating JSON Schema files from TypeBox definitions.
 * TypeBox schemas ARE valid JSON Schema, so this script simply serializes them
 * to JSON files for use by other languages (Go) and tooling.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import schemas
import { PositionSchema, VelocitySchema, MessageSchema } from './schemas/common.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/**
 * Schema definitions to export
 */
interface SchemaExport {
  schema: object;
  outputPath: string;
}

const schemas: SchemaExport[] = [
  {
    schema: PositionSchema,
    outputPath: 'schemas/common/position.json',
  },
  {
    schema: VelocitySchema,
    outputPath: 'schemas/common/velocity.json',
  },
  {
    schema: MessageSchema,
    outputPath: 'schemas/common/message.json',
  },
];

/**
 * Writes a schema to a JSON file
 */
function writeSchemaFile(schemaExport: SchemaExport): void {
  const fullPath = join(rootDir, schemaExport.outputPath);
  const dir = dirname(fullPath);

  // Ensure directory exists
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Write the schema as formatted JSON
  const jsonContent = JSON.stringify(schemaExport.schema, null, 2);
  writeFileSync(fullPath, jsonContent + '\n', 'utf8');
  console.log(`Generated: ${schemaExport.outputPath}`);
}

/**
 * Main build function
 */
export function buildSchemas(): void {
  console.log('Building JSON Schema files from TypeBox definitions...\n');

  for (const schemaExport of schemas) {
    writeSchemaFile(schemaExport);
  }

  console.log(`\nSuccessfully generated ${schemas.length} schema files.`);
}

// Run build when executed directly
buildSchemas();
