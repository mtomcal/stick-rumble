import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WeaponCrateManager, type WeaponCrateData } from './WeaponCrateManager';
import Phaser from 'phaser';

describe('WeaponCrateManager', () => {
  let manager: WeaponCrateManager;
  let mockScene: Phaser.Scene;
  let mockSprite: Phaser.GameObjects.Rectangle;
  let mockGlow: Phaser.GameObjects.Arc;
  let mockTween: Phaser.Tweens.Tween;

  beforeEach(() => {
    // Create mock tween
    mockTween = {
      play: vi.fn(),
      stop: vi.fn(),
      remove: vi.fn(),
    } as unknown as Phaser.Tweens.Tween;

    // Create mock sprite
    mockSprite = {
      setAlpha: vi.fn().mockReturnThis(),
      setOrigin: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
      x: 0,
      y: 0,
    } as unknown as Phaser.GameObjects.Rectangle;

    // Create mock glow
    mockGlow = {
      setStrokeStyle: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    } as unknown as Phaser.GameObjects.Arc;

    // Create mock scene
    mockScene = {
      add: {
        rectangle: vi.fn().mockReturnValue(mockSprite),
        arc: vi.fn().mockReturnValue(mockGlow),
      },
      tweens: {
        add: vi.fn().mockReturnValue(mockTween),
      },
    } as unknown as Phaser.Scene;

    manager = new WeaponCrateManager(mockScene);
  });

  describe('spawnCrate', () => {
    it('should create sprite and glow for weapon crate', () => {
      const crateData: WeaponCrateData = {
        id: 'crate_uzi_1',
        position: { x: 500, y: 600 },
        weaponType: 'uzi',
        isAvailable: true,
      };

      manager.spawnCrate(crateData);

      expect(mockScene.add.rectangle).toHaveBeenCalledWith(
        500,
        600,
        48,
        48,
        0x996633
      );
      expect(mockScene.add.arc).toHaveBeenCalledWith(500, 600, 32, 0, 360, false, 0xffff00, 0);
      expect(mockGlow.setStrokeStyle).toHaveBeenCalledWith(2, 0xffff00, 0.5);
    });

    it('should add bobbing animation to sprite', () => {
      const crateData: WeaponCrateData = {
        id: 'crate_ak47_1',
        position: { x: 400, y: 540 },
        weaponType: 'ak47',
        isAvailable: true,
      };

      manager.spawnCrate(crateData);

      expect(mockScene.tweens.add).toHaveBeenCalledWith({
        targets: mockSprite,
        y: 535, // 540 - 5
        yoyo: true,
        duration: 1000,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    it('should set sprite origin to center', () => {
      const crateData: WeaponCrateData = {
        id: 'crate_shotgun_1',
        position: { x: 1520, y: 540 },
        weaponType: 'shotgun',
        isAvailable: true,
      };

      manager.spawnCrate(crateData);

      expect(mockSprite.setOrigin).toHaveBeenCalledWith(0.5, 0.5);
    });

    it('should store crate data in internal map', () => {
      const crateData: WeaponCrateData = {
        id: 'crate_katana_1',
        position: { x: 960, y: 880 },
        weaponType: 'katana',
        isAvailable: true,
      };

      manager.spawnCrate(crateData);

      const crate = manager.getCrate('crate_katana_1');
      expect(crate).toBeDefined();
      expect(crate?.isAvailable).toBe(true);
    });
  });

  describe('markUnavailable', () => {
    beforeEach(() => {
      const crateData: WeaponCrateData = {
        id: 'crate_test_1',
        position: { x: 500, y: 600 },
        weaponType: 'uzi',
        isAvailable: true,
      };
      manager.spawnCrate(crateData);
    });

    it('should fade sprite to 30% alpha', () => {
      manager.markUnavailable('crate_test_1');

      expect(mockSprite.setAlpha).toHaveBeenCalledWith(0.3);
    });

    it('should hide glow effect', () => {
      manager.markUnavailable('crate_test_1');

      expect(mockGlow.setVisible).toHaveBeenCalledWith(false);
    });

    it('should update isAvailable flag to false', () => {
      manager.markUnavailable('crate_test_1');

      const crate = manager.getCrate('crate_test_1');
      expect(crate?.isAvailable).toBe(false);
    });

    it('should do nothing for non-existent crate', () => {
      manager.markUnavailable('nonexistent_crate');

      // Should not throw error
      expect(mockSprite.setAlpha).toHaveBeenCalledTimes(0);
    });
  });

  describe('markAvailable', () => {
    beforeEach(() => {
      const crateData: WeaponCrateData = {
        id: 'crate_test_2',
        position: { x: 500, y: 600 },
        weaponType: 'ak47',
        isAvailable: false,
      };
      manager.spawnCrate(crateData);
      manager.markUnavailable('crate_test_2');

      // Reset mock call counts
      vi.clearAllMocks();
    });

    it('should restore sprite to 100% alpha', () => {
      manager.markAvailable('crate_test_2');

      expect(mockSprite.setAlpha).toHaveBeenCalledWith(1.0);
    });

    it('should show glow effect', () => {
      manager.markAvailable('crate_test_2');

      expect(mockGlow.setVisible).toHaveBeenCalledWith(true);
    });

    it('should update isAvailable flag to true', () => {
      manager.markAvailable('crate_test_2');

      const crate = manager.getCrate('crate_test_2');
      expect(crate?.isAvailable).toBe(true);
    });

    it('should do nothing for non-existent crate', () => {
      manager.markAvailable('nonexistent_crate');

      expect(mockSprite.setAlpha).toHaveBeenCalledTimes(0);
    });
  });

  describe('getCrate', () => {
    it('should return crate data if exists', () => {
      const crateData: WeaponCrateData = {
        id: 'crate_test_3',
        position: { x: 960, y: 200 },
        weaponType: 'uzi',
        isAvailable: true,
      };
      manager.spawnCrate(crateData);

      const crate = manager.getCrate('crate_test_3');

      expect(crate).toBeDefined();
      expect(crate?.isAvailable).toBe(true);
    });

    it('should return undefined if crate does not exist', () => {
      const crate = manager.getCrate('nonexistent_crate');

      expect(crate).toBeUndefined();
    });
  });

  describe('checkProximity', () => {
    beforeEach(() => {
      // Spawn multiple crates
      manager.spawnCrate({
        id: 'crate_near',
        position: { x: 100, y: 100 },
        weaponType: 'uzi',
        isAvailable: true,
      });
      manager.spawnCrate({
        id: 'crate_far',
        position: { x: 500, y: 500 },
        weaponType: 'ak47',
        isAvailable: true,
      });
      manager.spawnCrate({
        id: 'crate_unavailable',
        position: { x: 105, y: 105 },
        weaponType: 'shotgun',
        isAvailable: false,
      });
    });

    it('should return nearest available crate within 32px', () => {
      const playerPos = { x: 110, y: 110 };

      const nearest = manager.checkProximity(playerPos);

      expect(nearest).toBeDefined();
      expect(nearest?.id).toBe('crate_near');
    });

    it('should return null if no crates within 32px', () => {
      const playerPos = { x: 1000, y: 1000 };

      const nearest = manager.checkProximity(playerPos);

      expect(nearest).toBeNull();
    });

    it('should ignore unavailable crates', () => {
      const playerPos = { x: 105, y: 105 };

      const nearest = manager.checkProximity(playerPos);

      // crate_unavailable is closest but unavailable, should find crate_near
      expect(nearest?.id).toBe('crate_near');
    });

    it('should return null if player position is undefined', () => {
      const nearest = manager.checkProximity(undefined);

      expect(nearest).toBeNull();
    });

    it('should return crate exactly at 32px distance', () => {
      const playerPos = { x: 132, y: 100 }; // Exactly 32px from crate_near

      const nearest = manager.checkProximity(playerPos);

      expect(nearest).toBeDefined();
      expect(nearest?.id).toBe('crate_near');
    });

    it('should return null if closest crate is at 33px distance', () => {
      const playerPos = { x: 133, y: 100 }; // 33px from crate_near

      const nearest = manager.checkProximity(playerPos);

      expect(nearest).toBeNull();
    });
  });

  describe('destroy', () => {
    beforeEach(() => {
      manager.spawnCrate({
        id: 'crate_destroy_1',
        position: { x: 100, y: 100 },
        weaponType: 'uzi',
        isAvailable: true,
      });
      manager.spawnCrate({
        id: 'crate_destroy_2',
        position: { x: 200, y: 200 },
        weaponType: 'ak47',
        isAvailable: true,
      });
    });

    it('should destroy all sprites', () => {
      manager.destroy();

      expect(mockSprite.destroy).toHaveBeenCalled();
    });

    it('should destroy all glow effects', () => {
      manager.destroy();

      expect(mockGlow.destroy).toHaveBeenCalled();
    });

    it('should clear internal crate map', () => {
      manager.destroy();

      const crate = manager.getCrate('crate_destroy_1');
      expect(crate).toBeUndefined();
    });
  });

  describe('getAllCrates', () => {
    it('should return empty array when no crates exist', () => {
      const crates = manager.getAllCrates();

      expect(crates).toEqual([]);
    });

    it('should return all spawned crates', () => {
      manager.spawnCrate({
        id: 'crate_1',
        position: { x: 100, y: 100 },
        weaponType: 'uzi',
        isAvailable: true,
      });
      manager.spawnCrate({
        id: 'crate_2',
        position: { x: 200, y: 200 },
        weaponType: 'ak47',
        isAvailable: false,
      });

      const crates = manager.getAllCrates();

      expect(crates).toHaveLength(2);
      expect(crates.some(c => c.id === 'crate_1')).toBe(true);
      expect(crates.some(c => c.id === 'crate_2')).toBe(true);
    });
  });
});
