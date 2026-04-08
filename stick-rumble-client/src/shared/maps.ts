import defaultOfficeMap from '../../../maps/default_office.json';
import {
  buildMapRegistry,
  type MapConfig,
  type MapObstacle,
  type MapWeaponSpawn,
} from '../../../maps-schema/src/index.js';

export type { MapObstacle, MapWeaponSpawn } from '../../../maps-schema/src/index.js';

export const DEFAULT_MAP_ID = 'default_office';

export interface MatchMapContext {
  mapId: string;
  width: number;
  height: number;
  obstacles: MapObstacle[];
  weaponSpawns: MapWeaponSpawn[];
}

const mapRegistry = buildMapRegistry([defaultOfficeMap]);

function toMatchMapContext(mapConfig: MapConfig): MatchMapContext {
  return {
    mapId: mapConfig.id,
    width: mapConfig.width,
    height: mapConfig.height,
    obstacles: [...mapConfig.obstacles],
    weaponSpawns: [...mapConfig.weaponSpawns],
  };
}

export function getMatchMapContext(mapId: string): MatchMapContext {
  const mapConfig = mapRegistry.get(mapId);
  if (!mapConfig) {
    throw new Error(`Map "${mapId}" is not present in the local registry`);
  }

  return toMatchMapContext(mapConfig);
}

export function getDefaultMatchMapContext(): MatchMapContext {
  return getMatchMapContext(DEFAULT_MAP_ID);
}

export function isPointInsideBlockingObstacle(
  x: number,
  y: number,
  obstacles: readonly MapObstacle[]
): boolean {
  return obstacles.some(
    (obstacle) =>
      obstacle.blocksProjectiles &&
      x >= obstacle.x &&
      x <= obstacle.x + obstacle.width &&
      y >= obstacle.y &&
      y <= obstacle.y + obstacle.height
  );
}
