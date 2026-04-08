import { describe, expect, it } from 'vitest';
import { getDefaultMatchMapContext, getMatchMapContext, isPointInsideBlockingObstacle } from './maps';

describe('shared maps', () => {
  it('loads the default_office map context from the shared registry', () => {
    const mapContext = getDefaultMatchMapContext();

    expect(mapContext.mapId).toBe('default_office');
    expect(mapContext.width).toBe(1920);
    expect(mapContext.height).toBe(1080);
    expect(mapContext.obstacles.length).toBeGreaterThan(0);
    expect(mapContext.weaponSpawns.length).toBeGreaterThan(0);
  });

  it('resolves a known map by mapId', () => {
    expect(getMatchMapContext('default_office').mapId).toBe('default_office');
  });

  it('fails fast when the requested map is missing', () => {
    expect(() => getMatchMapContext('missing_map')).toThrow(
      'Map "missing_map" is not present in the local registry'
    );
  });

  it('detects points inside projectile-blocking obstacles', () => {
    const mapContext = getDefaultMatchMapContext();

    expect(isPointInsideBlockingObstacle(10, 10, mapContext.obstacles)).toBe(true);
    expect(isPointInsideBlockingObstacle(960, 540, mapContext.obstacles)).toBe(false);
  });
});
