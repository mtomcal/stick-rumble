import { describe, it, expect, beforeEach, vi } from 'vitest';
import Phaser from 'phaser';
import { Crosshair } from './Crosshair';

describe('Crosshair', () => {
  let scene: Phaser.Scene;
  let crosshair: Crosshair;
  let mockSprite: Phaser.GameObjects.Sprite;
  let mockMakeGraphics: any;

  beforeEach(() => {
    mockSprite = {
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      setScale: vi.fn().mockReturnThis(),
      setPosition: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    } as unknown as Phaser.GameObjects.Sprite;

    mockMakeGraphics = {
      lineStyle: vi.fn().mockReturnThis(),
      strokeCircle: vi.fn().mockReturnThis(),
      beginPath: vi.fn().mockReturnThis(),
      moveTo: vi.fn().mockReturnThis(),
      lineTo: vi.fn().mockReturnThis(),
      strokePath: vi.fn().mockReturnThis(),
      fillStyle: vi.fn().mockReturnThis(),
      fillCircle: vi.fn().mockReturnThis(),
      generateTexture: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    scene = {
      add: {
        sprite: vi.fn(() => mockSprite),
      },
      make: {
        graphics: vi.fn(() => mockMakeGraphics),
      },
      input: {
        activePointer: {
          x: 400,
          y: 300,
        },
      },
      tweens: {
        add: vi.fn(),
      },
    } as unknown as Phaser.Scene;

    crosshair = new Crosshair(scene);
  });

  describe('TS-GFX-023: Crosshair reticle texture renders correctly', () => {
    it('should generate reticle texture with generateTexture("reticle", 32, 32)', () => {
      expect(mockMakeGraphics.generateTexture).toHaveBeenCalledWith('reticle', 32, 32);
    });

    it('should NOT draw an outer ring or circle', () => {
      expect(mockMakeGraphics.strokeCircle).not.toHaveBeenCalled();
    });

    it('should draw the plus shape with 2px white stroke', () => {
      expect(mockMakeGraphics.lineStyle).toHaveBeenCalledWith(2, 0xffffff, 1);
    });

    it('should NOT draw red center dot', () => {
      expect(mockMakeGraphics.fillStyle).not.toHaveBeenCalledWith(0xff0000, 1);
      expect(mockMakeGraphics.fillCircle).not.toHaveBeenCalled();
    });

    it('should draw vertical bar from (16,6) to (16,26)', () => {
      expect(mockMakeGraphics.moveTo).toHaveBeenCalledWith(16, 6);
      expect(mockMakeGraphics.lineTo).toHaveBeenCalledWith(16, 26);
    });

    it('should draw horizontal bar from (6,16) to (26,16)', () => {
      expect(mockMakeGraphics.moveTo).toHaveBeenCalledWith(6, 16);
      expect(mockMakeGraphics.lineTo).toHaveBeenCalledWith(26, 16);
    });

    it('should create sprite with "reticle" texture', () => {
      expect(scene.add.sprite).toHaveBeenCalledWith(0, 0, 'reticle');
    });

    it('should set sprite depth to exactly 100', () => {
      expect(mockSprite.setDepth).toHaveBeenCalledWith(100);
    });

    it('should set sprite alpha to exactly 0.8', () => {
      expect(mockSprite.setAlpha).toHaveBeenCalledWith(0.8);
    });

    it('should set sprite scrollFactor to 0 (HUD element)', () => {
      expect(mockSprite.setScrollFactor).toHaveBeenCalledWith(0);
    });

    it('should destroy temp graphics after texture generation', () => {
      expect(mockMakeGraphics.destroy).toHaveBeenCalled();
    });
  });

  describe('No bloom / no dynamic sizing', () => {
    it('should NOT have a triggerBloom() method', () => {
      expect((crosshair as any).triggerBloom).toBeUndefined();
    });

    it('should NOT have EXPANDED_RADIUS or LERP_SPEED constants', () => {
      expect((crosshair as any).EXPANDED_RADIUS).toBeUndefined();
      expect((crosshair as any).LERP_SPEED).toBeUndefined();
    });

    it('should NOT have a currentScale property that changes', () => {
      // update() should not call setScale at all (fixed texture, no resizing)
      (mockSprite.setScale as ReturnType<typeof vi.fn>).mockClear();
      crosshair.update('Pistol');
      expect(mockSprite.setScale).not.toHaveBeenCalled();
    });
  });

  describe('constructor', () => {
    it('should initialize as visible by default', () => {
      expect(crosshair.isVisible()).toBe(true);
    });
  });

  describe('update', () => {
    it('should position sprite at cursor position', () => {
      scene.input.activePointer.x = 500;
      scene.input.activePointer.y = 400;

      crosshair.update('Pistol');

      expect(mockSprite.setPosition).toHaveBeenCalledWith(500, 400);
    });

    it('should not update when hidden', () => {
      crosshair.hide();
      (mockSprite.setPosition as ReturnType<typeof vi.fn>).mockClear();

      crosshair.update('Pistol');

      expect(mockSprite.setPosition).not.toHaveBeenCalled();
    });

    it('should not update when pointer is not available', () => {
      const sceneNoPointer = {
        add: { sprite: vi.fn(() => mockSprite) },
        make: { graphics: vi.fn(() => mockMakeGraphics) },
        input: { activePointer: null },
        tweens: { add: vi.fn() },
      } as unknown as Phaser.Scene;

      const crosshairNoPointer = new Crosshair(sceneNoPointer);
      (mockSprite.setPosition as ReturnType<typeof vi.fn>).mockClear();

      crosshairNoPointer.update('Pistol');

      expect(mockSprite.setPosition).not.toHaveBeenCalled();
    });

    it('should not throw when sprite is null (after destroy)', () => {
      crosshair.destroy();
      expect(() => crosshair.update('Pistol')).not.toThrow();
    });

    it('should hide crosshair for bat weapon via update', () => {
      crosshair.update('Bat');
      expect(crosshair.isVisible()).toBe(false);
    });

    it('should hide crosshair for katana weapon via update', () => {
      crosshair.update('Katana');
      expect(crosshair.isVisible()).toBe(false);
    });

    it('should show crosshair for pistol via update', () => {
      crosshair.update('Bat');
      crosshair.update('Pistol');
      expect(crosshair.isVisible()).toBe(true);
    });
  });

  describe('setWeaponType', () => {
    it('should accept Uzi weapon type', () => {
      crosshair.setWeaponType('Uzi');
      expect(crosshair.getWeaponType()).toBe('Uzi');
    });

    it('should accept AK47 weapon type', () => {
      crosshair.setWeaponType('AK47');
      expect(crosshair.getWeaponType()).toBe('AK47');
    });

    it('should accept Shotgun weapon type', () => {
      crosshair.setWeaponType('Shotgun');
      expect(crosshair.getWeaponType()).toBe('Shotgun');
    });

    it('should handle melee weapons by hiding crosshair', () => {
      crosshair.setWeaponType('Bat');
      expect(crosshair.isVisible()).toBe(false);
    });

    it('should handle katana by hiding crosshair', () => {
      crosshair.setWeaponType('Katana');
      expect(crosshair.isVisible()).toBe(false);
    });

    it('should show crosshair for ranged weapon after switching from melee', () => {
      crosshair.setWeaponType('Bat');
      expect(crosshair.isVisible()).toBe(false);
      crosshair.setWeaponType('Pistol');
      expect(crosshair.isVisible()).toBe(true);
    });
  });

  describe('show/hide', () => {
    it('should show crosshair', () => {
      crosshair.hide();
      crosshair.show();

      expect(mockSprite.setVisible).toHaveBeenCalledWith(true);
      expect(crosshair.isVisible()).toBe(true);
    });

    it('should hide crosshair', () => {
      crosshair.hide();

      expect(mockSprite.setVisible).toHaveBeenCalledWith(false);
      expect(crosshair.isVisible()).toBe(false);
    });

    it('should hide when spectating', () => {
      crosshair.setSpectating(true);
      expect(crosshair.isVisible()).toBe(false);
    });

    it('should show when exiting spectator mode', () => {
      crosshair.setSpectating(true);
      crosshair.setSpectating(false);
      expect(crosshair.isVisible()).toBe(true);
    });

    it('should not show melee weapon crosshair after exiting spectator mode', () => {
      crosshair.setWeaponType('Katana');
      crosshair.setSpectating(true);
      crosshair.setSpectating(false);
      expect(crosshair.isVisible()).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should destroy sprite', () => {
      crosshair.destroy();
      expect(mockSprite.destroy).toHaveBeenCalled();
    });

    it('should handle multiple destroy calls safely', () => {
      crosshair.destroy();
      expect(() => crosshair.destroy()).not.toThrow();
    });
  });
});
