/**
 * Tests for MeleeWeaponManager - manages melee weapon visuals per player
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { MeleeWeaponManager } from './MeleeWeaponManager';

describe('MeleeWeaponManager', () => {
  let scene: Phaser.Scene;
  let manager: MeleeWeaponManager;

  beforeEach(() => {
    // Create a minimal scene mock
    scene = {
      add: {
        graphics: vi.fn().mockReturnValue({
          clear: vi.fn().mockReturnThis(),
          lineStyle: vi.fn().mockReturnThis(),
          fillStyle: vi.fn().mockReturnThis(),
          beginPath: vi.fn().mockReturnThis(),
          moveTo: vi.fn().mockReturnThis(),
          lineTo: vi.fn().mockReturnThis(),
          arc: vi.fn().mockReturnThis(),
          closePath: vi.fn().mockReturnThis(),
          strokePath: vi.fn().mockReturnThis(),
          fillPath: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
          setVisible: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
        }),
      },
      time: {
        now: 0,
      },
    } as unknown as Phaser.Scene;

    manager = new MeleeWeaponManager(scene);
  });

  describe('Weapon creation', () => {
    it('should create Bat weapon for player on pickup', () => {
      const playerId = 'player-1';
      const position = { x: 100, y: 200 };

      manager.createWeapon(playerId, 'Bat', position);

      expect(manager.hasWeapon(playerId)).toBe(true);
      expect(manager.getWeaponType(playerId)).toBe('Bat');
    });

    it('should create Katana weapon for player on pickup', () => {
      const playerId = 'player-2';
      const position = { x: 150, y: 250 };

      manager.createWeapon(playerId, 'Katana', position);

      expect(manager.hasWeapon(playerId)).toBe(true);
      expect(manager.getWeaponType(playerId)).toBe('Katana');
    });

    it('should not create weapon for non-melee weapon types', () => {
      const playerId = 'player-3';
      const position = { x: 100, y: 200 };

      manager.createWeapon(playerId, 'Pistol', position);

      expect(manager.hasWeapon(playerId)).toBe(false);
    });

    it('should replace existing weapon when player picks up new one', () => {
      const playerId = 'player-1';
      const position = { x: 100, y: 200 };

      manager.createWeapon(playerId, 'Bat', position);
      expect(manager.getWeaponType(playerId)).toBe('Bat');

      manager.createWeapon(playerId, 'Katana', position);
      expect(manager.getWeaponType(playerId)).toBe('Katana');
    });

    it('should destroy old weapon when replacing', () => {
      const playerId = 'player-1';
      const position = { x: 100, y: 200 };

      manager.createWeapon(playerId, 'Bat', position);
      const firstGraphics = scene.add.graphics();

      manager.createWeapon(playerId, 'Pistol', position); // Switching to non-melee

      expect(firstGraphics.destroy).toHaveBeenCalled();
      expect(manager.hasWeapon(playerId)).toBe(false);
    });
  });

  describe('Swing animation', () => {
    beforeEach(() => {
      const playerId = 'player-1';
      const position = { x: 100, y: 200 };
      manager.createWeapon(playerId, 'Bat', position);
    });

    it('should trigger swing animation on melee attack', () => {
      const playerId = 'player-1';
      const aimAngle = Math.PI / 4; // 45 degrees

      const result = manager.startSwing(playerId, aimAngle);

      expect(result).toBe(true);
    });

    it('should not trigger swing if player has no melee weapon', () => {
      const playerId = 'player-without-weapon';
      const aimAngle = 0;

      const result = manager.startSwing(playerId, aimAngle);

      expect(result).toBe(false);
    });

    it('should prevent double swing during animation', () => {
      const playerId = 'player-1';
      const aimAngle = 0;

      manager.startSwing(playerId, aimAngle);
      const result = manager.startSwing(playerId, aimAngle);

      expect(result).toBe(false);
    });
  });

  describe('Position updates', () => {
    it('should update weapon position to follow player', () => {
      const playerId = 'player-1';
      const initialPos = { x: 100, y: 200 };
      manager.createWeapon(playerId, 'Bat', initialPos);

      const newPos = { x: 150, y: 250 };
      manager.updatePosition(playerId, newPos);

      // Position update should not throw
      expect(() => manager.update()).not.toThrow();
    });

    it('should handle position updates for non-existent weapons gracefully', () => {
      const playerId = 'player-without-weapon';
      const pos = { x: 100, y: 200 };

      expect(() => manager.updatePosition(playerId, pos)).not.toThrow();
    });
  });

  describe('Update loop', () => {
    it('should update all active weapon animations', () => {
      const player1 = 'player-1';
      const player2 = 'player-2';

      manager.createWeapon(player1, 'Bat', { x: 100, y: 200 });
      manager.createWeapon(player2, 'Katana', { x: 150, y: 250 });

      manager.startSwing(player1, 0);
      manager.startSwing(player2, Math.PI / 2);

      expect(() => manager.update()).not.toThrow();
    });

    it('should handle swing completion', () => {
      const playerId = 'player-1';
      manager.createWeapon(playerId, 'Bat', { x: 100, y: 200 });
      manager.startSwing(playerId, 0);

      // Simulate animation completion (200ms)
      scene.time.now = 200;
      manager.update();

      // Should be able to swing again
      const result = manager.startSwing(playerId, 0);
      expect(result).toBe(true);
    });
  });

  describe('Cleanup', () => {
    it('should destroy all weapons on manager destroy', () => {
      const player1 = 'player-1';
      const player2 = 'player-2';

      manager.createWeapon(player1, 'Bat', { x: 100, y: 200 });
      manager.createWeapon(player2, 'Katana', { x: 150, y: 250 });

      const graphics1 = scene.add.graphics();
      const graphics2 = scene.add.graphics();

      manager.destroy();

      expect(graphics1.destroy).toHaveBeenCalled();
      expect(graphics2.destroy).toHaveBeenCalled();
    });

    it('should clear all weapons from tracking', () => {
      const playerId = 'player-1';
      manager.createWeapon(playerId, 'Bat', { x: 100, y: 200 });

      manager.destroy();

      expect(manager.hasWeapon(playerId)).toBe(false);
    });
  });

  describe('Removal', () => {
    it('should remove specific player weapon', () => {
      const playerId = 'player-1';
      manager.createWeapon(playerId, 'Bat', { x: 100, y: 200 });

      manager.removeWeapon(playerId);

      expect(manager.hasWeapon(playerId)).toBe(false);
    });

    it('should destroy weapon graphics on removal', () => {
      const playerId = 'player-1';
      manager.createWeapon(playerId, 'Bat', { x: 100, y: 200 });
      const graphics = scene.add.graphics();

      manager.removeWeapon(playerId);

      expect(graphics.destroy).toHaveBeenCalled();
    });

    it('should handle removing non-existent weapon gracefully', () => {
      const playerId = 'player-without-weapon';

      expect(() => manager.removeWeapon(playerId)).not.toThrow();
    });
  });
});
