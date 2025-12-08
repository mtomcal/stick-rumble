import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Phaser from 'phaser';
import { GameSceneUI } from './GameSceneUI';
import type { ShootingManager } from '../input/ShootingManager';
import type { PlayerManager } from '../entities/PlayerManager';

// Mock Phaser
vi.mock('phaser', () => ({
  default: {
    Scene: class {
      scene = { key: '' };
      constructor(config: { key: string }) {
        this.scene.key = config.key;
      }
    },
  },
}));

describe('GameSceneUI', () => {
  let ui: GameSceneUI;
  let mockScene: Phaser.Scene;
  let mockCamera: any;
  let mockDamageFlashOverlay: any;
  let mockLine: any;
  let createdTexts: any[];

  beforeEach(() => {
    createdTexts = [];

    // Create mock camera
    mockCamera = {
      width: 1920,
      height: 1080,
      scrollX: 100,
      scrollY: 50,
    };

    // Create mock damage flash overlay
    mockDamageFlashOverlay = {
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
    };

    // Create mock line
    mockLine = {
      setDepth: vi.fn().mockReturnThis(),
      setLineWidth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Create mock scene
    mockScene = {
      add: {
        text: vi.fn().mockImplementation(() => {
          const text = {
            setOrigin: vi.fn().mockReturnThis(),
            setScrollFactor: vi.fn().mockReturnThis(),
            setText: vi.fn().mockReturnThis(),
            setColor: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          };
          createdTexts.push(text);
          return text;
        }),
        rectangle: vi.fn().mockReturnValue(mockDamageFlashOverlay),
        line: vi.fn().mockReturnValue(mockLine),
      },
      cameras: {
        main: mockCamera,
      },
      tweens: {
        add: vi.fn().mockImplementation((config) => {
          // Immediately call onComplete if provided
          if (config.onComplete) {
            config.onComplete();
          }
          return { remove: vi.fn() };
        }),
      },
    } as unknown as Phaser.Scene;

    // Create UI instance
    ui = new GameSceneUI(mockScene);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createMatchTimer', () => {
    it('should create match timer text at specified position', () => {
      ui.createMatchTimer(960, 10);

      expect(mockScene.add.text).toHaveBeenCalledWith(960, 10, '7:00', expect.any(Object));
      expect(createdTexts[0].setOrigin).toHaveBeenCalledWith(0.5, 0);
      expect(createdTexts[0].setScrollFactor).toHaveBeenCalledWith(0);
    });
  });

  describe('createDamageFlashOverlay', () => {
    it('should create damage flash overlay with specified dimensions', () => {
      ui.createDamageFlashOverlay(1920, 1080);

      expect(mockScene.add.rectangle).toHaveBeenCalledWith(960, 540, 1920, 1080, 0xff0000, 0);
      expect(mockDamageFlashOverlay.setScrollFactor).toHaveBeenCalledWith(0);
      expect(mockDamageFlashOverlay.setDepth).toHaveBeenCalledWith(999);
    });
  });

  describe('createAmmoDisplay', () => {
    it('should create ammo text display at specified position', () => {
      ui.createAmmoDisplay(10, 50);

      expect(mockScene.add.text).toHaveBeenCalledWith(10, 50, '15/15', expect.any(Object));
      expect(createdTexts[0].setScrollFactor).toHaveBeenCalledWith(0);
    });
  });

  describe('updateAmmoDisplay', () => {
    it('should update ammo text when shooting manager is provided', () => {
      ui.createAmmoDisplay(10, 50);

      const mockShootingManager = {
        getAmmoInfo: vi.fn().mockReturnValue([10, 15]),
        isReloading: vi.fn().mockReturnValue(false),
      } as unknown as ShootingManager;

      ui.updateAmmoDisplay(mockShootingManager);

      expect(createdTexts[0].setText).toHaveBeenCalledWith('10/15');
    });

    it('should show RELOADING indicator when reloading', () => {
      ui.createAmmoDisplay(10, 50);

      const mockShootingManager = {
        getAmmoInfo: vi.fn().mockReturnValue([5, 15]),
        isReloading: vi.fn().mockReturnValue(true),
      } as unknown as ShootingManager;

      ui.updateAmmoDisplay(mockShootingManager);

      expect(createdTexts[0].setText).toHaveBeenCalledWith('5/15 [RELOADING]');
    });

    it('should not update if ammo text not created', () => {
      const mockShootingManager = {
        getAmmoInfo: vi.fn().mockReturnValue([10, 15]),
        isReloading: vi.fn().mockReturnValue(false),
      } as unknown as ShootingManager;

      // Don't create ammo display first
      ui.updateAmmoDisplay(mockShootingManager);

      // Should not throw and getAmmoInfo should not be called
      expect(mockShootingManager.getAmmoInfo).not.toHaveBeenCalled();
    });

    it('should not update if shooting manager is null', () => {
      ui.createAmmoDisplay(10, 50);
      const textBeforeUpdate = createdTexts[0];

      // Clear setText mock from createAmmoDisplay
      textBeforeUpdate.setText.mockClear();

      ui.updateAmmoDisplay(null as unknown as ShootingManager);

      expect(textBeforeUpdate.setText).not.toHaveBeenCalled();
    });
  });

  describe('updateMatchTimer', () => {
    it('should format time correctly at 7:00', () => {
      ui.createMatchTimer(960, 10);
      const timerText = createdTexts[0];

      ui.updateMatchTimer(420);

      expect(timerText.setText).toHaveBeenCalledWith('7:00');
      expect(timerText.setColor).toHaveBeenCalledWith('#ffffff');
    });

    it('should format time correctly at 1:30 (yellow)', () => {
      ui.createMatchTimer(960, 10);
      const timerText = createdTexts[0];

      ui.updateMatchTimer(90);

      expect(timerText.setText).toHaveBeenCalledWith('1:30');
      expect(timerText.setColor).toHaveBeenCalledWith('#ffff00');
    });

    it('should format time correctly at 0:30 (red)', () => {
      ui.createMatchTimer(960, 10);
      const timerText = createdTexts[0];

      ui.updateMatchTimer(30);

      expect(timerText.setText).toHaveBeenCalledWith('0:30');
      expect(timerText.setColor).toHaveBeenCalledWith('#ff0000');
    });

    it('should format time correctly at 0:00', () => {
      ui.createMatchTimer(960, 10);
      const timerText = createdTexts[0];

      ui.updateMatchTimer(0);

      expect(timerText.setText).toHaveBeenCalledWith('0:00');
      expect(timerText.setColor).toHaveBeenCalledWith('#ff0000');
    });

    it('should handle exactly 120 seconds (white color)', () => {
      ui.createMatchTimer(960, 10);
      const timerText = createdTexts[0];

      ui.updateMatchTimer(120);

      expect(timerText.setText).toHaveBeenCalledWith('2:00');
      expect(timerText.setColor).toHaveBeenCalledWith('#ffffff');
    });

    it('should handle exactly 60 seconds (yellow color boundary)', () => {
      ui.createMatchTimer(960, 10);
      const timerText = createdTexts[0];

      ui.updateMatchTimer(60);

      expect(timerText.setText).toHaveBeenCalledWith('1:00');
      expect(timerText.setColor).toHaveBeenCalledWith('#ffff00');
    });

    it('should handle 119 seconds (yellow color)', () => {
      ui.createMatchTimer(960, 10);
      const timerText = createdTexts[0];

      ui.updateMatchTimer(119);

      expect(timerText.setText).toHaveBeenCalledWith('1:59');
      expect(timerText.setColor).toHaveBeenCalledWith('#ffff00');
    });

    it('should handle 59 seconds (red color)', () => {
      ui.createMatchTimer(960, 10);
      const timerText = createdTexts[0];

      ui.updateMatchTimer(59);

      expect(timerText.setText).toHaveBeenCalledWith('0:59');
      expect(timerText.setColor).toHaveBeenCalledWith('#ff0000');
    });

    it('should not update if match timer text not created', () => {
      // Don't create match timer first
      // Should not throw
      expect(() => ui.updateMatchTimer(420)).not.toThrow();
    });
  });

  describe('showDamageFlash', () => {
    it('should show damage flash with fade out animation', () => {
      ui.createDamageFlashOverlay(1920, 1080);

      ui.showDamageFlash();

      expect(mockDamageFlashOverlay.setAlpha).toHaveBeenCalledWith(0.5);
      expect(mockScene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: mockDamageFlashOverlay,
          alpha: 0,
          duration: 200,
          ease: 'Linear',
        })
      );
    });

    it('should not throw if damage flash overlay not created', () => {
      // Don't create damage flash overlay first
      expect(() => ui.showDamageFlash()).not.toThrow();
    });
  });

  describe('showHitMarker', () => {
    it('should create 4 crosshair lines at screen center', () => {
      ui.showHitMarker();

      // Should create 4 lines (top, bottom, left, right)
      expect(mockScene.add.line).toHaveBeenCalledTimes(4);
    });

    it('should set high depth on all lines', () => {
      ui.showHitMarker();

      // Each line should have depth set
      expect(mockLine.setDepth).toHaveBeenCalledWith(1001);
      expect(mockLine.setDepth).toHaveBeenCalledTimes(4);
    });

    it('should set line width on all lines', () => {
      ui.showHitMarker();

      expect(mockLine.setLineWidth).toHaveBeenCalledWith(3);
      expect(mockLine.setLineWidth).toHaveBeenCalledTimes(4);
    });

    it('should animate and destroy lines', () => {
      ui.showHitMarker();

      // Tween should be created with fade out
      expect(mockScene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          alpha: 0,
          duration: 200,
          ease: 'Cubic.easeOut',
        })
      );

      // Lines should be destroyed after animation (mock calls onComplete immediately)
      expect(mockLine.destroy).toHaveBeenCalledTimes(4);
    });
  });

  describe('showDamageNumber', () => {
    it('should show damage number above damaged player', () => {
      const mockPlayerManager = {
        getPlayerPosition: vi.fn().mockReturnValue({ x: 500, y: 300 }),
      } as unknown as PlayerManager;

      ui.showDamageNumber(mockPlayerManager, 'victim-1', 25);

      expect(mockScene.add.text).toHaveBeenCalledWith(
        500,
        270, // y - 30
        '-25',
        expect.objectContaining({
          fontSize: '24px',
          color: '#ff0000',
        })
      );
    });

    it('should animate damage number floating up and fading', () => {
      const mockPlayerManager = {
        getPlayerPosition: vi.fn().mockReturnValue({ x: 500, y: 300 }),
      } as unknown as PlayerManager;

      ui.showDamageNumber(mockPlayerManager, 'victim-1', 25);

      expect(mockScene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          y: 220, // position.y - 80 = 300 - 80 = 220
          alpha: 0,
          duration: 1000,
          ease: 'Cubic.easeOut',
        })
      );
    });

    it('should destroy damage text after animation', () => {
      const mockPlayerManager = {
        getPlayerPosition: vi.fn().mockReturnValue({ x: 500, y: 300 }),
      } as unknown as PlayerManager;

      ui.showDamageNumber(mockPlayerManager, 'victim-1', 25);

      // The text created for damage should be destroyed
      expect(createdTexts[0].destroy).toHaveBeenCalled();
    });

    it('should not show damage number if player position not found', () => {
      const mockPlayerManager = {
        getPlayerPosition: vi.fn().mockReturnValue(null),
      } as unknown as PlayerManager;

      ui.showDamageNumber(mockPlayerManager, 'nonexistent', 25);

      // Should not create any text
      expect(mockScene.add.text).not.toHaveBeenCalled();
    });

    it('should set origin on damage text', () => {
      const mockPlayerManager = {
        getPlayerPosition: vi.fn().mockReturnValue({ x: 500, y: 300 }),
      } as unknown as PlayerManager;

      ui.showDamageNumber(mockPlayerManager, 'victim-1', 25);

      expect(createdTexts[0].setOrigin).toHaveBeenCalledWith(0.5);
    });
  });
});
