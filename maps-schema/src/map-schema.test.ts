import { describe, expect, it } from 'vitest';
import defaultOfficeMap from '../../maps/default_office.json';
import { buildMapRegistry, type MapConfig, validateMapConfig } from './map-schema.js';

function createValidMap(overrides: Partial<MapConfig> = {}): MapConfig {
  return {
    id: 'test_map',
    name: 'Test Map',
    width: 800,
    height: 600,
    obstacles: [
      {
        id: 'wall_a',
        type: 'wall',
        shape: 'rectangle',
        x: 100,
        y: 100,
        width: 100,
        height: 100,
        blocksMovement: true,
        blocksProjectiles: true,
        blocksLineOfSight: true,
      },
    ],
    spawnPoints: [
      { id: 'spawn_a', x: 50, y: 50 },
      { id: 'spawn_b', x: 700, y: 500 },
    ],
    weaponSpawns: [
      { id: 'weapon_a', x: 300, y: 300, weaponType: 'uzi' },
    ],
    ...overrides,
  };
}

describe('map schema validation', () => {
  it('loads the default_office map into a valid registry', () => {
    const registry = buildMapRegistry([defaultOfficeMap]);

    expect(registry.get('default_office')).toBeDefined();
  });

  it('rejects invalid map structure', () => {
    const errors = validateMapConfig({
      id: 'broken',
      name: 'Broken Map',
      width: 800,
      obstacles: [],
      spawnPoints: [],
      weaponSpawns: [],
    });

    expect(errors.some((error) => error.includes('/height'))).toBe(true);
  });

  it('rejects a spawn point inside a blocking obstacle', () => {
    const map = createValidMap({
      spawnPoints: [{ id: 'spawn_inside_wall', x: 120, y: 120 }],
    });

    expect(validateMapConfig(map)).toContain(
      'spawn point "spawn_inside_wall" overlaps blocking obstacle "wall_a"'
    );
  });

  it('rejects a weapon spawn inside a blocking obstacle', () => {
    const map = createValidMap({
      weaponSpawns: [{ id: 'weapon_inside_wall', x: 120, y: 120, weaponType: 'ak47' }],
    });

    expect(validateMapConfig(map)).toContain(
      'weapon spawn "weapon_inside_wall" overlaps blocking obstacle "wall_a"'
    );
  });

  it('rejects positive-area obstacle overlap', () => {
    const map = createValidMap({
      obstacles: [
        {
          id: 'wall_a',
          type: 'wall',
          shape: 'rectangle',
          x: 100,
          y: 100,
          width: 100,
          height: 100,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
        {
          id: 'wall_b',
          type: 'wall',
          shape: 'rectangle',
          x: 150,
          y: 120,
          width: 100,
          height: 80,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ],
    });

    expect(validateMapConfig(map)).toContain(
      'obstacles "wall_a" and "wall_b" overlap with positive area'
    );
  });

  it('rejects out-of-bounds authored geometry', () => {
    const map = createValidMap({
      obstacles: [
        {
          id: 'wall_oob',
          type: 'wall',
          shape: 'rectangle',
          x: 760,
          y: 100,
          width: 80,
          height: 80,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ],
      spawnPoints: [{ id: 'spawn_oob', x: 805, y: 500 }],
      weaponSpawns: [{ id: 'weapon_oob', x: 300, y: 605, weaponType: 'uzi' }],
    });

    expect(validateMapConfig(map)).toEqual(
      expect.arrayContaining([
        'obstacle "wall_oob" lies outside map bounds',
        'spawn point "spawn_oob" lies outside map bounds',
        'weapon spawn "weapon_oob" lies outside map bounds',
      ])
    );
  });
});
