import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WeaponCrateManager } from './WeaponCrateManager';
import Phaser from 'phaser';

type GraphicsMock = Phaser.GameObjects.Graphics & {
  clear: ReturnType<typeof vi.fn>;
  setAlpha: ReturnType<typeof vi.fn>;
  setPosition: ReturnType<typeof vi.fn>;
  fillStyle: ReturnType<typeof vi.fn>;
  fillRect: ReturnType<typeof vi.fn>;
  lineStyle: ReturnType<typeof vi.fn>;
  strokeCircle: ReturnType<typeof vi.fn>;
  beginPath: ReturnType<typeof vi.fn>;
  moveTo: ReturnType<typeof vi.fn>;
  lineTo: ReturnType<typeof vi.fn>;
  strokePath: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

type ArcMock = Phaser.GameObjects.Arc & {
  setPosition: ReturnType<typeof vi.fn>;
  setStrokeStyle: ReturnType<typeof vi.fn>;
  setVisible: ReturnType<typeof vi.fn>;
  setAlpha: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
};

describe('WeaponCrateManager', () => {
  let manager: WeaponCrateManager;
  let mockScene: Phaser.Scene;
  let mockTween: Phaser.Tweens.Tween;
  let graphicsInstances: GraphicsMock[];
  let glowInstances: ArcMock[];

  const createGraphicsMock = (): GraphicsMock => ({
    clear: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    strokeCircle: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    x: 0,
    y: 0,
  } as unknown as GraphicsMock);

  const createArcMock = (): ArcMock => ({
    setPosition: vi.fn().mockReturnThis(),
    setStrokeStyle: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  } as unknown as ArcMock);

  beforeEach(() => {
    graphicsInstances = [];
    glowInstances = [];

    mockTween = {
      remove: vi.fn(),
    } as unknown as Phaser.Tweens.Tween;

    mockScene = {
      add: {
        graphics: vi.fn().mockImplementation(() => {
          const sprite = createGraphicsMock();
          graphicsInstances.push(sprite);
          return sprite;
        }),
        arc: vi.fn().mockImplementation(() => {
          const glow = createArcMock();
          glowInstances.push(glow);
          return glow;
        }),
      },
      tweens: {
        add: vi.fn().mockReturnValue(mockTween),
      },
    } as unknown as Phaser.Scene;

    manager = new WeaponCrateManager(mockScene);
  });

  describe('spawnCrate', () => {
    it('creates pickup visuals with persistent pickup-zone affordance', () => {
      manager.spawnCrate({
        id: 'crate_uzi_1',
        position: { x: 500, y: 600 },
        weaponType: 'uzi',
        isAvailable: true,
      });

      expect(mockScene.add.graphics).toHaveBeenCalledTimes(1);
      expect(mockScene.add.arc).toHaveBeenCalledWith(500, 600, 32, 0, 360, false, 0xffff00, 0);
      expect(glowInstances[0].setStrokeStyle).toHaveBeenCalledWith(2, 0xffff00, 0.5);
      expect(graphicsInstances[0].setPosition).toHaveBeenCalledWith(500, 600);
    });

    it('renders ranged pickup as literal weapon object instead of generic circle marker', () => {
      manager.spawnCrate({
        id: 'crate_ak47_1',
        position: { x: 400, y: 540 },
        weaponType: 'ak47',
        isAvailable: true,
      });

      const sprite = graphicsInstances[0];
      expect(sprite.fillRect).toHaveBeenCalledWith(-14, -3, 20, 6);
      expect(sprite.fillRect).toHaveBeenCalledWith(6, -2, 10, 4);
      expect(sprite.strokeCircle).not.toHaveBeenCalledWith(0, 0, 20);
    });

    it('renders katana pickup using blade-like linework', () => {
      manager.spawnCrate({
        id: 'crate_katana_1',
        position: { x: 960, y: 880 },
        weaponType: 'katana',
        isAvailable: true,
      });

      const sprite = graphicsInstances[0];
      expect(sprite.lineStyle).toHaveBeenCalledWith(2, 0xd9d9d9, 1);
      expect(sprite.moveTo).toHaveBeenCalledWith(-16, -1);
      expect(sprite.lineTo).toHaveBeenCalledWith(12, -1);
      expect(sprite.strokePath).toHaveBeenCalled();
      expect(sprite.fillRect).toHaveBeenCalledWith(-19, -3, 5, 4);
    });

    it('applies bobbing animation to pickup silhouette', () => {
      manager.spawnCrate({
        id: 'crate_uzi_1',
        position: { x: 500, y: 600 },
        weaponType: 'uzi',
        isAvailable: true,
      });

      expect(mockScene.tweens.add).toHaveBeenCalledWith({
        targets: graphicsInstances[0],
        y: 595,
        yoyo: true,
        duration: 1000,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    it('updates existing pickup position/type when respawned with same id', () => {
      manager.spawnCrate({
        id: 'crate_shared',
        position: { x: 100, y: 100 },
        weaponType: 'uzi',
        isAvailable: true,
      });

      manager.spawnCrate({
        id: 'crate_shared',
        position: { x: 220, y: 330 },
        weaponType: 'shotgun',
        isAvailable: false,
      });

      expect(graphicsInstances).toHaveLength(1);
      expect(glowInstances).toHaveLength(1);
      expect(graphicsInstances[0].setPosition).toHaveBeenLastCalledWith(220, 330);
      expect(glowInstances[0].setPosition).toHaveBeenCalledWith(220, 330);
      expect(manager.getCrate('crate_shared')?.isAvailable).toBe(false);
    });
  });

  describe('availability states', () => {
    beforeEach(() => {
      manager.spawnCrate({
        id: 'crate_state',
        position: { x: 500, y: 600 },
        weaponType: 'bat',
        isAvailable: true,
      });
      vi.clearAllMocks();
    });

    it('unavailable pickup remains visible but subdued', () => {
      manager.markUnavailable('crate_state');

      expect(graphicsInstances[0].setAlpha).toHaveBeenCalledWith(0.3);
      expect(glowInstances[0].setAlpha).toHaveBeenCalledWith(0.3);
      expect(manager.getCrate('crate_state')?.isAvailable).toBe(false);
    });

    it('available pickup restores full readability state', () => {
      manager.markUnavailable('crate_state');
      vi.clearAllMocks();

      manager.markAvailable('crate_state');

      expect(graphicsInstances[0].setAlpha).toHaveBeenCalledWith(1.0);
      expect(glowInstances[0].setAlpha).toHaveBeenCalledWith(1.0);
      expect(glowInstances[0].setVisible).toHaveBeenCalledWith(true);
      expect(manager.getCrate('crate_state')?.isAvailable).toBe(true);
    });

    it('missing crate ids are safe no-ops for availability updates', () => {
      manager.markUnavailable('missing_crate');
      manager.markAvailable('missing_crate');

      expect(graphicsInstances[0].setAlpha).not.toHaveBeenCalled();
      expect(glowInstances[0].setAlpha).not.toHaveBeenCalled();
    });
  });

  describe('proximity and lifecycle', () => {
    beforeEach(() => {
      manager.spawnCrate({ id: 'near', position: { x: 100, y: 100 }, weaponType: 'uzi', isAvailable: true });
      manager.spawnCrate({ id: 'far', position: { x: 500, y: 500 }, weaponType: 'ak47', isAvailable: true });
      manager.spawnCrate({ id: 'down', position: { x: 105, y: 105 }, weaponType: 'shotgun', isAvailable: false });
    });

    it('returns nearest available pickup within range', () => {
      expect(manager.checkProximity({ x: 110, y: 110 })?.id).toBe('near');
    });

    it('ignores unavailable pickups in proximity checks', () => {
      expect(manager.checkProximity({ x: 105, y: 105 })?.id).toBe('near');
    });

    it('honors pickup radius boundary checks', () => {
      expect(manager.checkProximity({ x: 132, y: 100 })?.id).toBe('near');
      expect(manager.checkProximity({ x: 133, y: 100 })).toBeNull();
    });

    it('returns null when player position is undefined', () => {
      expect(manager.checkProximity(undefined)).toBeNull();
    });

    it('destroys all pickup visuals and tweens', () => {
      manager.destroy();

      for (const sprite of graphicsInstances) {
        expect(sprite.destroy).toHaveBeenCalled();
      }
      for (const glow of glowInstances) {
        expect(glow.destroy).toHaveBeenCalled();
      }
      expect(mockTween.remove).toHaveBeenCalledTimes(3);
      expect(manager.getAllCrates()).toEqual([]);
    });
  });

  it('initializes disabled pickups from map weapon spawns', () => {
    manager.initializeFromMapWeaponSpawns([
      { id: 'map_uzi', x: 100, y: 100, weaponType: 'uzi' },
      { id: 'map_bat', x: 300, y: 300, weaponType: 'bat' },
    ]);

    expect(manager.getAllCrates()).toEqual([
      {
        id: 'map_uzi',
        position: { x: 100, y: 100 },
        weaponType: 'uzi',
        isAvailable: false,
      },
      {
        id: 'map_bat',
        position: { x: 300, y: 300 },
        weaponType: 'bat',
        isAvailable: false,
      },
    ]);
  });
});
