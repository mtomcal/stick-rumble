import defaultOfficeMap from '../../../maps/default_office.json';
import {
  buildMapRegistry,
  type MapConfig,
  type MapObstacle,
  type MapVisualAcceptanceViewpoint,
  type MapWeaponSpawn,
} from '../../../maps-schema/src/index.js';

export type {
  MapObstacle,
  MapVisualAcceptanceViewpoint,
  MapWeaponSpawn,
} from '../../../maps-schema/src/index.js';

export const DEFAULT_MAP_ID = 'default_office';

export interface MatchMapContext {
  mapId: string;
  width: number;
  height: number;
  obstacles: MapObstacle[];
  weaponSpawns: MapWeaponSpawn[];
  visualAcceptanceViewpoints: MapVisualAcceptanceViewpoint[];
}

export interface BlockingObstacleContact {
  x: number;
  y: number;
  distance: number;
  obstacle: MapObstacle;
}

const mapRegistry = buildMapRegistry([defaultOfficeMap]);

function toMatchMapContext(mapConfig: MapConfig): MatchMapContext {
  return {
    mapId: mapConfig.id,
    width: mapConfig.width,
    height: mapConfig.height,
    obstacles: [...mapConfig.obstacles],
    weaponSpawns: [...mapConfig.weaponSpawns],
    visualAcceptanceViewpoints: [...mapConfig.visualAcceptanceViewpoints],
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

export function getFirstBlockingObstacleContact(
  start: { x: number; y: number },
  end: { x: number; y: number },
  obstacles: readonly MapObstacle[]
): BlockingObstacleContact | null {
  let nearest: BlockingObstacleContact | null = null;

  for (const obstacle of obstacles) {
    if (!obstacle.blocksProjectiles) {
      continue;
    }

    const contact = getSegmentRectContact(start, end, obstacle);
    if (!contact) {
      continue;
    }

    if (!nearest || contact.distance < nearest.distance) {
      nearest = { ...contact, obstacle };
    }
  }

  return nearest;
}

function getSegmentRectContact(
  start: { x: number; y: number },
  end: { x: number; y: number },
  obstacle: MapObstacle
): Omit<BlockingObstacleContact, 'obstacle'> | null {
  if (isPointInsideRect(start.x, start.y, obstacle)) {
    return { x: start.x, y: start.y, distance: 0 };
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;

  let tMin = 0;
  let tMax = 1;

  const clips: Array<[number, number]> = [
    [-dx, start.x - obstacle.x],
    [dx, obstacle.x + obstacle.width - start.x],
    [-dy, start.y - obstacle.y],
    [dy, obstacle.y + obstacle.height - start.y],
  ];

  for (const [p, q] of clips) {
    if (p === 0) {
      if (q < 0) {
        return null;
      }
      continue;
    }

    const t = q / p;
    if (p < 0) {
      if (t > tMax) {
        return null;
      }
      if (t > tMin) {
        tMin = t;
      }
    } else {
      if (t < tMin) {
        return null;
      }
      if (t < tMax) {
        tMax = t;
      }
    }
  }

  if (tMin < 0 || tMin > 1) {
    return null;
  }

  const x = start.x + dx * tMin;
  const y = start.y + dy * tMin;
  return {
    x,
    y,
    distance: Math.hypot(x - start.x, y - start.y),
  };
}

function isPointInsideRect(x: number, y: number, obstacle: MapObstacle): boolean {
  return (
    x >= obstacle.x &&
    x <= obstacle.x + obstacle.width &&
    y >= obstacle.y &&
    y <= obstacle.y + obstacle.height
  );
}
