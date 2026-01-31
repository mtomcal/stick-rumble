import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { ProceduralWeaponGraphics } from './ProceduralWeaponGraphics';

describe('ProceduralWeaponGraphics', () => {
  let scene: Phaser.Scene;
  let container: Phaser.GameObjects.Container;

  beforeEach(() => {
    scene = {
      add: {
        container: vi.fn(() => container),
        rectangle: vi.fn(() => ({
          setRotation: vi.fn(),
        })),
      },
    } as unknown as Phaser.Scene;

    container = {
      add: vi.fn(),
      removeAll: vi.fn(),
      setRotation: vi.fn(),
      setPosition: vi.fn(),
      destroy: vi.fn(),
      scaleY: 1,
    } as unknown as Phaser.GameObjects.Container;
  });

  describe('Weapon creation', () => {
    it('should create container for weapon', () => {
      new ProceduralWeaponGraphics(scene, 100, 100, 'Pistol');
      expect(scene.add.container).toHaveBeenCalledWith(100, 100);
    });

    it('should create Pistol with correct geometry', () => {
      new ProceduralWeaponGraphics(scene, 100, 100, 'Pistol');

      // Pistol should have 3 parts: handle, body, barrel
      expect(scene.add.rectangle).toHaveBeenCalledTimes(3);
    });

    it('should create Bat with correct geometry', () => {
      new ProceduralWeaponGraphics(scene, 100, 100, 'Bat');

      // Bat: handle (black), body (silver), tip (silver)
      expect(scene.add.rectangle).toHaveBeenCalledTimes(3);
      expect(scene.add.rectangle).toHaveBeenCalledWith(10, 0, 15, 4, 0x000000); // Handle
      expect(scene.add.rectangle).toHaveBeenCalledWith(30, 0, 35, 6, 0xcccccc); // Body
      expect(scene.add.rectangle).toHaveBeenCalledWith(48, 0, 5, 7, 0xcccccc); // Tip
    });

    it('should create Katana with correct geometry', () => {
      new ProceduralWeaponGraphics(scene, 100, 100, 'Katana');

      // Katana: handle, guard, blade
      expect(scene.add.rectangle).toHaveBeenCalledTimes(3);
      expect(scene.add.rectangle).toHaveBeenCalledWith(5, 0, 15, 4, 0x212121); // Handle
      expect(scene.add.rectangle).toHaveBeenCalledWith(15, 0, 4, 12, 0xd4af37); // Gold guard
      expect(scene.add.rectangle).toHaveBeenCalledWith(40, 0, 50, 3, 0xffffff); // White blade
    });

    it('should create Uzi with correct geometry', () => {
      new ProceduralWeaponGraphics(scene, 100, 100, 'Uzi');

      // Uzi: body, handle, barrel, mag
      expect(scene.add.rectangle).toHaveBeenCalledTimes(4);
      expect(scene.add.rectangle).toHaveBeenCalledWith(20, 0, 20, 10, 0x333333); // Body
      expect(scene.add.rectangle).toHaveBeenCalledWith(15, 5, 8, 8, 0x222222); // Handle
      expect(scene.add.rectangle).toHaveBeenCalledWith(32, -2, 8, 4, 0x111111); // Barrel
      expect(scene.add.rectangle).toHaveBeenCalledWith(22, 8, 6, 10, 0x111111); // Mag
    });

    it('should create AK47 with correct geometry', () => {
      new ProceduralWeaponGraphics(scene, 100, 100, 'AK47');

      // AK47: stock, body, barrel, handguard, curved mag
      expect(scene.add.rectangle).toHaveBeenCalledTimes(5);
      expect(scene.add.rectangle).toHaveBeenCalledWith(0, 0, 15, 6, 0x8d6e63); // Wood stock
      expect(scene.add.rectangle).toHaveBeenCalledWith(20, 0, 25, 6, 0x222222); // Metal body
      expect(scene.add.rectangle).toHaveBeenCalledWith(40, 0, 20, 3, 0x111111); // Barrel
      expect(scene.add.rectangle).toHaveBeenCalledWith(35, 0, 12, 5, 0x8d6e63); // Wood handguard
      expect(scene.add.rectangle).toHaveBeenCalledWith(25, 5, 6, 12, 0x111111); // Mag
    });

    it('should rotate AK47 magazine by -0.3 radians', () => {
      const mag = { setRotation: vi.fn() };
      (scene.add.rectangle as any).mockReturnValueOnce({}) // stock
        .mockReturnValueOnce({}) // body
        .mockReturnValueOnce({}) // barrel
        .mockReturnValueOnce({}) // handguard
        .mockReturnValueOnce(mag); // mag

      new ProceduralWeaponGraphics(scene, 100, 100, 'AK47');

      expect(mag.setRotation).toHaveBeenCalledWith(-0.3);
    });

    it('should create Shotgun with correct geometry', () => {
      new ProceduralWeaponGraphics(scene, 100, 100, 'Shotgun');

      // Shotgun: stock, body, barrel, pump
      expect(scene.add.rectangle).toHaveBeenCalledTimes(4);
      expect(scene.add.rectangle).toHaveBeenCalledWith(0, 0, 12, 6, 0x5d4037); // Wood stock
      expect(scene.add.rectangle).toHaveBeenCalledWith(18, 0, 20, 6, 0x333333); // Metal body
      expect(scene.add.rectangle).toHaveBeenCalledWith(38, -1, 18, 4, 0x111111); // Barrel
      expect(scene.add.rectangle).toHaveBeenCalledWith(32, 3, 8, 5, 0x5d4037); // Pump
    });

    it('should default to Pistol for unknown weapon type', () => {
      new ProceduralWeaponGraphics(scene, 100, 100, 'UnknownWeapon');

      // Should create Pistol geometry (3 parts)
      expect(scene.add.rectangle).toHaveBeenCalledTimes(3);
    });

    it('should be case-insensitive for weapon type', () => {
      new ProceduralWeaponGraphics(scene, 100, 100, 'uzi');

      // Should create Uzi geometry (4 parts)
      expect(scene.add.rectangle).toHaveBeenCalledTimes(4);
    });
  });

  describe('Weapon rotation', () => {
    it('should set rotation of container', () => {
      const weapon = new ProceduralWeaponGraphics(scene, 100, 100, 'Pistol');
      weapon.setRotation(Math.PI / 4);

      expect(container.setRotation).toHaveBeenCalledWith(Math.PI / 4);
    });

    it('should return rotation angle', () => {
      (container.setRotation as any).mockImplementation(function(this: any, angle: number) {
        this.rotation = angle;
      });
      (container as any).rotation = 0;

      const weapon = new ProceduralWeaponGraphics(scene, 100, 100, 'Pistol');
      weapon.setRotation(Math.PI / 2);

      expect(weapon.getRotation()).toBe(Math.PI / 2);
    });
  });

  describe('Weapon positioning', () => {
    it('should set position of container', () => {
      const weapon = new ProceduralWeaponGraphics(scene, 100, 100, 'Pistol');
      weapon.setPosition(200, 300);

      expect(container.setPosition).toHaveBeenCalledWith(200, 300);
    });
  });

  describe('Weapon switching', () => {
    it('should clear existing weapon parts', () => {
      const weapon = new ProceduralWeaponGraphics(scene, 100, 100, 'Pistol');
      weapon.setWeapon('Bat');

      expect(container.removeAll).toHaveBeenCalledWith(true);
    });

    it('should create new weapon geometry when switching', () => {
      const weapon = new ProceduralWeaponGraphics(scene, 100, 100, 'Pistol');
      (scene.add.rectangle as any).mockClear();

      weapon.setWeapon('Katana');

      // Katana has 3 parts
      expect(scene.add.rectangle).toHaveBeenCalledTimes(3);
    });

    it('should update weaponType property', () => {
      const weapon = new ProceduralWeaponGraphics(scene, 100, 100, 'Pistol');
      weapon.setWeapon('Shotgun');

      expect(weapon.weaponType).toBe('Shotgun');
    });
  });

  describe('Cleanup', () => {
    it('should destroy container', () => {
      const weapon = new ProceduralWeaponGraphics(scene, 100, 100, 'Pistol');
      weapon.destroy();

      expect(container.destroy).toHaveBeenCalled();
    });
  });

  describe('Flip handling', () => {
    it('should flip weapon vertically when aiming left', () => {
      const weapon = new ProceduralWeaponGraphics(scene, 100, 100, 'Pistol');
      weapon.setFlipY(true);

      expect(container.scaleY).toBe(-1);
    });

    it('should not flip weapon when aiming right', () => {
      const weapon = new ProceduralWeaponGraphics(scene, 100, 100, 'Pistol');
      weapon.setFlipY(false);

      expect(container.scaleY).toBe(1);
    });
  });
});
