/**
 * CI check script to ensure generated JSON Schema files are up-to-date.
 * Compares in-memory schema generation with committed files.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
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

interface SchemaExport {
  schema: object;
  outputPath: string;
}

const schemas: SchemaExport[] = [
  { schema: PositionSchema, outputPath: 'schemas/common/position.json' },
  { schema: VelocitySchema, outputPath: 'schemas/common/velocity.json' },
  { schema: MessageSchema, outputPath: 'schemas/common/message.json' },
  { schema: InputStateDataSchema, outputPath: 'schemas/client-to-server/input-state-data.json' },
  { schema: InputStateMessageSchema, outputPath: 'schemas/client-to-server/input-state-message.json' },
  { schema: PlayerShootDataSchema, outputPath: 'schemas/client-to-server/player-shoot-data.json' },
  { schema: PlayerShootMessageSchema, outputPath: 'schemas/client-to-server/player-shoot-message.json' },
  { schema: PlayerReloadMessageSchema, outputPath: 'schemas/client-to-server/player-reload-message.json' },
  { schema: WeaponPickupAttemptDataSchema, outputPath: 'schemas/client-to-server/weapon-pickup-attempt-data.json' },
  { schema: WeaponPickupAttemptMessageSchema, outputPath: 'schemas/client-to-server/weapon-pickup-attempt-message.json' },
];

/**
 * Check if a schema file matches its in-memory definition
 */
function checkSchemaUpToDate(schemaExport: SchemaExport): boolean {
  const fullPath = join(rootDir, schemaExport.outputPath);

  if (!existsSync(fullPath)) {
    console.error(`❌ Missing: ${schemaExport.outputPath}`);
    return false;
  }

  const expectedContent = JSON.stringify(schemaExport.schema, null, 2) + '\n';
  const actualContent = readFileSync(fullPath, 'utf8');

  if (expectedContent !== actualContent) {
    console.error(`❌ Stale: ${schemaExport.outputPath}`);
    return false;
  }

  console.log(`✓ ${schemaExport.outputPath}`);
  return true;
}

/**
 * Main check function
 */
export function checkSchemasUpToDate(): boolean {
  console.log('Checking if generated schemas are up-to-date...\n');

  let allUpToDate = true;

  for (const schemaExport of schemas) {
    if (!checkSchemaUpToDate(schemaExport)) {
      allUpToDate = false;
    }
  }

  if (!allUpToDate) {
    console.error('\n❌ Generated schemas are out of date.');
    console.error('Run: npm run build\n');
    return false;
  }

  console.log('\n✅ All schemas are up-to-date.');
  return true;
}

/**
 * CLI entry point
 */
export function runCheckCli(): void {
  const result = checkSchemasUpToDate();
  if (!result) {
    process.exit(1);
  }
}

// Run check when executed directly (but not when imported by tests)
/* c8 ignore start */
if (import.meta.url === `file://${process.argv[1]}`) {
  runCheckCli();
}
/* c8 ignore stop */
