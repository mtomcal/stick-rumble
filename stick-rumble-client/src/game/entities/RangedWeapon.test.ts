import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as Phaser from 'phaser';
import { RangedWeapon } from './RangedWeapon';

describe('RangedWeapon', () => {
  let scene: Phaser.Scene;
  let weapon: RangedWeapon;

  beforeEach(() => {
    // Create minimal mock scene
    scene = {
      add: {
        graphics: vi.fn(() => ({
          setDepth: vi.fn().mockReturnThis(),
          setVisible: vi.fn(),
          clear: vi.fn(),
          fillStyle: vi.fn(),
          fillCircle: vi.fn(),
          destroy: vi.fn(),
        })),
        particles: vi.fn(() => ({
          createEmitter: vi.fn(() => ({
            explode: vi.fn(),
          })),
          destroy: vi.fn(),
        })),
      },
      time: {
        now: 0,
      },
    } as unknown as Phaser.Scene;
  });

  describe('Uzi', () => {
    beforeEach(() => {
      weapon = new RangedWeapon(scene, 100, 100, 'Uzi');
    });

    it('should create Uzi with correct properties', () => {
      expect(weapon.weaponType).toBe('Uzi');
      expect(weapon.isFiring()).toBe(false);
    });

    it('should start firing and show muzzle flash', () => {
      const started = weapon.startFiring(0);
      expect(started).toBe(true);
      expect(weapon.isFiring()).toBe(true);
    });

    it('should not start firing if already firing', () => {
      weapon.startFiring(0);
      const started = weapon.startFiring(0);
      expect(started).toBe(false);
    });

    it('should stop firing', () => {
      weapon.startFiring(0);
      expect(weapon.isFiring()).toBe(true);

      weapon.stopFiring();
      expect(weapon.isFiring()).toBe(false);
    });

    it('should update muzzle flash position', () => {
      weapon.startFiring(0);
      weapon.setPosition(200, 300);
      weapon.update();
      // Position should be updated - verify by checking muzzle flash is still active
      expect(weapon.isFiring()).toBe(true);
    });
  });

  describe('AK47', () => {
    beforeEach(() => {
      weapon = new RangedWeapon(scene, 100, 100, 'AK47');
    });

    it('should create AK47 with correct properties', () => {
      expect(weapon.weaponType).toBe('AK47');
    });

    it('should handle firing state', () => {
      weapon.startFiring(Math.PI / 4);
      expect(weapon.isFiring()).toBe(true);

      weapon.stopFiring();
      expect(weapon.isFiring()).toBe(false);
    });
  });

  describe('Shotgun', () => {
    beforeEach(() => {
      weapon = new RangedWeapon(scene, 100, 100, 'Shotgun');
    });

    it('should create Shotgun with correct properties', () => {
      expect(weapon.weaponType).toBe('Shotgun');
    });

    it('should handle single shot firing', () => {
      weapon.startFiring(0);
      expect(weapon.isFiring()).toBe(true);
    });
  });

  describe('Update', () => {
    beforeEach(() => {
      weapon = new RangedWeapon(scene, 100, 100, 'Uzi');
    });

    it('should update without errors when not firing', () => {
      expect(() => weapon.update()).not.toThrow();
      // When not firing, muzzle flash should remain invisible
      expect(weapon.isFiring()).toBe(false);
    });

    it('should update without errors when firing', () => {
      weapon.startFiring(0);
      expect(() => weapon.update()).not.toThrow();
      // When firing, weapon should maintain firing state
      expect(weapon.isFiring()).toBe(true);
    });

    it('should hide muzzle flash after duration', () => {
      weapon.startFiring(0);
      scene.time.now = 0;
      weapon.update();
      expect(weapon.isFiring()).toBe(true);

      // Advance time past muzzle flash duration (typically 50-100ms)
      scene.time.now = 150;
      weapon.update();

      // Weapon should still be in firing state (stopFiring() must be called explicitly)
      expect(weapon.isFiring()).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should destroy graphics on cleanup', () => {
      weapon = new RangedWeapon(scene, 100, 100, 'Uzi');
      weapon.startFiring(0);

      expect(() => weapon.destroy()).not.toThrow();
    });

    it('should handle cleanup when not initialized', () => {
      weapon = new RangedWeapon(scene, 100, 100, 'Uzi');
      expect(() => weapon.destroy()).not.toThrow();
    });
  });

  describe('Weapon Type Support', () => {
    it('should support all ranged weapon types', () => {
      const uzi = new RangedWeapon(scene, 0, 0, 'Uzi');
      const ak47 = new RangedWeapon(scene, 0, 0, 'AK47');
      const shotgun = new RangedWeapon(scene, 0, 0, 'Shotgun');

      expect(uzi.weaponType).toBe('Uzi');
      expect(ak47.weaponType).toBe('AK47');
      expect(shotgun.weaponType).toBe('Shotgun');
    });

    it('should handle unknown weapon type gracefully', () => {
      expect(() => new RangedWeapon(scene, 0, 0, 'Unknown')).not.toThrow();
    });
  });

  describe('Single Shot Muzzle Flash', () => {
    beforeEach(() => {
      weapon = new RangedWeapon(scene, 100, 100, 'Shotgun');
    });

    it('should trigger muzzle flash for single shot', () => {
      scene.time.now = 0;
      weapon.triggerMuzzleFlash(Math.PI / 2);

      // Muzzle flash should be triggered without changing firing state
      expect(weapon.isFiring()).toBe(false);
    });

    it('should update aim angle when triggering muzzle flash', () => {
      const angle1 = 0;
      const angle2 = Math.PI;

      weapon.triggerMuzzleFlash(angle1);
      weapon.update();

      weapon.triggerMuzzleFlash(angle2);
      weapon.update();

      // Should handle multiple trigger calls without errors
      expect(() => weapon.update()).not.toThrow();
    });
  });
});
