import { Type, type Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

const WeaponTypeSchema = Type.Union([
  Type.Literal('uzi'),
  Type.Literal('ak47'),
  Type.Literal('shotgun'),
  Type.Literal('katana'),
  Type.Literal('bat'),
], { description: 'Supported authored weapon spawn types' });

export const MapObstacleSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    type: Type.Union([Type.Literal('wall'), Type.Literal('desk'), Type.Literal('pillar')]),
    shape: Type.Literal('rectangle'),
    x: Type.Number({ minimum: 0 }),
    y: Type.Number({ minimum: 0 }),
    width: Type.Number({ exclusiveMinimum: 0 }),
    height: Type.Number({ exclusiveMinimum: 0 }),
    blocksMovement: Type.Boolean(),
    blocksProjectiles: Type.Boolean(),
    blocksLineOfSight: Type.Boolean(),
  },
  { $id: 'MapObstacle', additionalProperties: false }
);

export const MapSpawnPointSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    x: Type.Number(),
    y: Type.Number(),
  },
  { $id: 'MapSpawnPoint', additionalProperties: false }
);

export const MapWeaponSpawnSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    x: Type.Number(),
    y: Type.Number(),
    weaponType: WeaponTypeSchema,
  },
  { $id: 'MapWeaponSpawn', additionalProperties: false }
);

export const MapVisualAcceptanceViewpointSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    playerPosition: Type.Object(
      {
        x: Type.Number(),
        y: Type.Number(),
      },
      { additionalProperties: false }
    ),
    aimDirection: Type.Object(
      {
        x: Type.Number(),
        y: Type.Number(),
      },
      { additionalProperties: false }
    ),
    expectedOutcome: Type.Union([
      Type.Literal('reads_blocked'),
      Type.Literal('reads_open'),
      Type.Literal('pickup_clearly_visible'),
      Type.Literal('hud_unobscured'),
    ]),
  },
  { $id: 'MapVisualAcceptanceViewpoint', additionalProperties: false }
);

export const MapConfigSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    width: Type.Number({ exclusiveMinimum: 0 }),
    height: Type.Number({ exclusiveMinimum: 0 }),
    obstacles: Type.Array(MapObstacleSchema),
    spawnPoints: Type.Array(MapSpawnPointSchema, { minItems: 1 }),
    weaponSpawns: Type.Array(MapWeaponSpawnSchema),
    visualAcceptanceViewpoints: Type.Array(MapVisualAcceptanceViewpointSchema, { minItems: 1 }),
  },
  { $id: 'MapConfig', additionalProperties: false }
);

export type MapObstacle = Static<typeof MapObstacleSchema>;
export type MapSpawnPoint = Static<typeof MapSpawnPointSchema>;
export type MapWeaponSpawn = Static<typeof MapWeaponSpawnSchema>;
export type MapVisualAcceptanceViewpoint = Static<typeof MapVisualAcceptanceViewpointSchema>;
export type MapConfig = Static<typeof MapConfigSchema>;

type Rectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function obstacleRect(obstacle: MapObstacle): Rectangle {
  return {
    x: obstacle.x,
    y: obstacle.y,
    width: obstacle.width,
    height: obstacle.height,
  };
}

function positiveAreaOverlap(a: Rectangle, b: Rectangle): boolean {
  const overlapWidth = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapHeight = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlapWidth > 0 && overlapHeight > 0;
}

function pointInsideRect(x: number, y: number, rect: Rectangle): boolean {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function withinBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && x <= width && y >= 0 && y <= height;
}

function collectDuplicateIDs(items: Array<{ id: string }>, kind: string): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      duplicates.push(`${kind} id "${item.id}" is duplicated`);
      continue;
    }
    seen.add(item.id);
  }

  return duplicates;
}

export function validateMapConfig(mapConfig: unknown): string[] {
  const errors = [...Value.Errors(MapConfigSchema, mapConfig)].map((error) =>
    `schema ${error.path || '/'} ${error.message}`
  );

  if (!Value.Check(MapConfigSchema, mapConfig)) {
    return errors;
  }

  const map = mapConfig as MapConfig;

  errors.push(...collectDuplicateIDs(map.obstacles, 'obstacle'));
  errors.push(...collectDuplicateIDs(map.spawnPoints, 'spawn point'));
  errors.push(...collectDuplicateIDs(map.weaponSpawns, 'weapon spawn'));
  errors.push(...collectDuplicateIDs(map.visualAcceptanceViewpoints, 'visual acceptance viewpoint'));

  for (const obstacle of map.obstacles) {
    if (!withinBounds(obstacle.x, obstacle.y, map.width, map.height) ||
      obstacle.x + obstacle.width > map.width ||
      obstacle.y + obstacle.height > map.height) {
      errors.push(`obstacle "${obstacle.id}" lies outside map bounds`);
    }
  }

  for (let i = 0; i < map.obstacles.length; i += 1) {
    for (let j = i + 1; j < map.obstacles.length; j += 1) {
      if (positiveAreaOverlap(obstacleRect(map.obstacles[i]), obstacleRect(map.obstacles[j]))) {
        errors.push(
          `obstacles "${map.obstacles[i].id}" and "${map.obstacles[j].id}" overlap with positive area`
        );
      }
    }
  }

  const movementBlockingObstacles = map.obstacles.filter((obstacle) => obstacle.blocksMovement);

  for (const spawnPoint of map.spawnPoints) {
    if (!withinBounds(spawnPoint.x, spawnPoint.y, map.width, map.height)) {
      errors.push(`spawn point "${spawnPoint.id}" lies outside map bounds`);
      continue;
    }

    for (const obstacle of movementBlockingObstacles) {
      if (pointInsideRect(spawnPoint.x, spawnPoint.y, obstacleRect(obstacle))) {
        errors.push(`spawn point "${spawnPoint.id}" overlaps blocking obstacle "${obstacle.id}"`);
      }
    }
  }

  for (const weaponSpawn of map.weaponSpawns) {
    if (!withinBounds(weaponSpawn.x, weaponSpawn.y, map.width, map.height)) {
      errors.push(`weapon spawn "${weaponSpawn.id}" lies outside map bounds`);
      continue;
    }

    for (const obstacle of movementBlockingObstacles) {
      if (pointInsideRect(weaponSpawn.x, weaponSpawn.y, obstacleRect(obstacle))) {
        errors.push(`weapon spawn "${weaponSpawn.id}" overlaps blocking obstacle "${obstacle.id}"`);
      }
    }
  }

  const expectedOutcomeCounts = new Map<string, number>();
  for (const viewpoint of map.visualAcceptanceViewpoints) {
    if (!withinBounds(viewpoint.playerPosition.x, viewpoint.playerPosition.y, map.width, map.height)) {
      errors.push(`visual acceptance viewpoint "${viewpoint.id}" has out-of-bounds playerPosition`);
    }

    const magnitude = Math.sqrt(
      viewpoint.aimDirection.x * viewpoint.aimDirection.x +
      viewpoint.aimDirection.y * viewpoint.aimDirection.y
    );
    if (magnitude < 0.001) {
      errors.push(`visual acceptance viewpoint "${viewpoint.id}" has zero aimDirection`);
    }

    expectedOutcomeCounts.set(
      viewpoint.expectedOutcome,
      (expectedOutcomeCounts.get(viewpoint.expectedOutcome) ?? 0) + 1
    );
  }

  const requiredOutcomes = [
    'reads_blocked',
    'reads_open',
    'pickup_clearly_visible',
    'hud_unobscured',
  ];
  for (const outcome of requiredOutcomes) {
    if (!expectedOutcomeCounts.has(outcome)) {
      errors.push(`visual acceptance viewpoints must include expectedOutcome "${outcome}"`);
    }
  }

  return errors;
}

export function buildMapRegistry(mapConfigs: readonly unknown[]): Map<string, MapConfig> {
  const registry = new Map<string, MapConfig>();

  for (const mapConfig of mapConfigs) {
    const errors = validateMapConfig(mapConfig);
    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }

    const typedMap = mapConfig as MapConfig;
    if (registry.has(typedMap.id)) {
      throw new Error(`map id "${typedMap.id}" is duplicated in the registry`);
    }

    registry.set(typedMap.id, typedMap);
  }

  return registry;
}
