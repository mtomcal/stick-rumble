import { describe, expect, it } from 'vitest';
import {
  getDefaultMatchMapContext,
  getFirstBlockingObstacleContact,
  getMatchMapContext,
  isPointInsideBlockingObstacle,
} from './maps';

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

  it('returns the first blocking obstacle contact along a segment', () => {
    const contact = getFirstBlockingObstacleContact(
      { x: 0, y: 10 },
      { x: 80, y: 10 },
      [
        {
          id: 'far',
          type: 'wall',
          shape: 'rectangle',
          x: 40,
          y: 0,
          width: 10,
          height: 20,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
        {
          id: 'near',
          type: 'wall',
          shape: 'rectangle',
          x: 20,
          y: 0,
          width: 10,
          height: 20,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ]
    );

    expect(contact).toEqual(
      expect.objectContaining({
        x: 20,
        y: 10,
        distance: 20,
        obstacle: expect.objectContaining({ id: 'near' }),
      })
    );
  });

  it('treats a segment starting inside a blocker as immediately obstructed', () => {
    const contact = getFirstBlockingObstacleContact(
      { x: 25, y: 10 },
      { x: 80, y: 10 },
      [
        {
          id: 'near',
          type: 'wall',
          shape: 'rectangle',
          x: 20,
          y: 0,
          width: 10,
          height: 20,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ]
    );

    expect(contact).toEqual(
      expect.objectContaining({
        x: 25,
        y: 10,
        distance: 0,
      })
    );
  });

  it('returns null when the ray misses all obstacles', () => {
    const contact = getFirstBlockingObstacleContact(
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      [
        {
          id: 'wall',
          type: 'wall',
          shape: 'rectangle',
          x: 100,
          y: 100,
          width: 10,
          height: 10,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ]
    );

    expect(contact).toBeNull();
  });

  it('skips obstacles that do not block projectiles', () => {
    const contact = getFirstBlockingObstacleContact(
      { x: 0, y: 10 },
      { x: 80, y: 10 },
      [
        {
          id: 'glass',
          type: 'wall',
          shape: 'rectangle',
          x: 20,
          y: 0,
          width: 10,
          height: 20,
          blocksMovement: false,
          blocksProjectiles: false,
          blocksLineOfSight: false,
        },
      ]
    );

    expect(contact).toBeNull();
  });

  it('detects contact on a leftward ray (negative dx)', () => {
    const contact = getFirstBlockingObstacleContact(
      { x: 80, y: 10 },
      { x: 0, y: 10 },
      [
        {
          id: 'wall',
          type: 'wall',
          shape: 'rectangle',
          x: 20,
          y: 0,
          width: 10,
          height: 20,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ]
    );

    expect(contact).toEqual(
      expect.objectContaining({
        x: 30,
        y: 10,
        distance: 50,
        obstacle: expect.objectContaining({ id: 'wall' }),
      })
    );
  });

  it('returns the entry boundary when a ray starts outside and ends inside an obstacle', () => {
    const contact = getFirstBlockingObstacleContact(
      { x: 0, y: 10 },
      { x: 25, y: 10 },
      [
        {
          id: 'wall',
          type: 'wall',
          shape: 'rectangle',
          x: 20,
          y: 0,
          width: 10,
          height: 20,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ]
    );

    expect(contact).toEqual(
      expect.objectContaining({
        x: 20,
        y: 10,
        distance: 20,
      })
    );
  });

  it('detects contact when a ray grazes a rectangle corner', () => {
    const contact = getFirstBlockingObstacleContact(
      { x: 0, y: 0 },
      { x: 30, y: 30 },
      [
        {
          id: 'wall',
          type: 'wall',
          shape: 'rectangle',
          x: 25,
          y: 25,
          width: 10,
          height: 10,
          blocksMovement: true,
          blocksProjectiles: true,
          blocksLineOfSight: true,
        },
      ]
    );

    // The ray from (0,0) to (30,30) touches the corner at (25,25)
    expect(contact).not.toBeNull();
    expect(contact).toEqual(
      expect.objectContaining({
        x: 25,
        y: 25,
      })
    );
  });
});
