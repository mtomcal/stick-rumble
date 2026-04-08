import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  MapConfigSchema,
  MapObstacleSchema,
  MapSpawnPointSchema,
  MapWeaponSpawnSchema,
} from './map-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const schemas = [
  { schema: MapObstacleSchema, outputPath: 'schemas/map-obstacle.json' },
  { schema: MapSpawnPointSchema, outputPath: 'schemas/map-spawn-point.json' },
  { schema: MapWeaponSpawnSchema, outputPath: 'schemas/map-weapon-spawn.json' },
  { schema: MapConfigSchema, outputPath: 'schemas/map-config.json' },
];

for (const { schema, outputPath } of schemas) {
  const fullPath = join(rootDir, outputPath);
  const directory = dirname(fullPath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  writeFileSync(fullPath, `${JSON.stringify(schema, null, 2)}\n`, 'utf-8');
}
