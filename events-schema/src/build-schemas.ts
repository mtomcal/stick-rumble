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
import {
  InputStateDataSchema,
  InputStateMessageSchema,
  PlayerShootDataSchema,
  PlayerShootMessageSchema,
  PlayerReloadMessageSchema,
  WeaponPickupAttemptDataSchema,
  WeaponPickupAttemptMessageSchema,
} from './schemas/client-to-server.js';

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
  // Client-to-server schemas
  {
    schema: InputStateDataSchema,
    outputPath: 'schemas/client-to-server/input-state-data.json',
  },
  {
    schema: InputStateMessageSchema,
    outputPath: 'schemas/client-to-server/input-state-message.json',
  },
  {
    schema: PlayerShootDataSchema,
    outputPath: 'schemas/client-to-server/player-shoot-data.json',
  },
  {
    schema: PlayerShootMessageSchema,
    outputPath: 'schemas/client-to-server/player-shoot-message.json',
  },
  {
    schema: PlayerReloadMessageSchema,
    outputPath: 'schemas/client-to-server/player-reload-message.json',
  },
  {
    schema: WeaponPickupAttemptDataSchema,
    outputPath: 'schemas/client-to-server/weapon-pickup-attempt-data.json',
  },
  {
    schema: WeaponPickupAttemptMessageSchema,
    outputPath: 'schemas/client-to-server/weapon-pickup-attempt-message.json',
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
