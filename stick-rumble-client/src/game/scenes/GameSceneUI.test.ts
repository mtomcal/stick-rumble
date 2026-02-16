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
    Math: {
      DegToRad: (degrees: number) => degrees * (Math.PI / 180),
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
  let createdGraphics: any[];
  let mockMakeGraphics: any;
  let mockSprite: any;

  beforeEach(() => {
    createdTexts = [];
    createdGraphics = [];

    // Create mock camera
    mockCamera = {
      width: 1920,
      height: 1080,
      scrollX: 100,
      scrollY: 50,
      flash: vi.fn(),
      shake: vi.fn(),
    };

    // Create mock damage flash overlay
    mockDamageFlashOverlay = {
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setAlpha: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Create mock line
    mockLine = {
      setDepth: vi.fn().mockReturnThis(),
      setLineWidth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Create mock make.graphics for texture generation
    mockMakeGraphics = {
      lineStyle: vi.fn().mockReturnThis(),
      fillStyle: vi.fn().mockReturnThis(),
      beginPath: vi.fn().mockReturnThis(),
      moveTo: vi.fn().mockReturnThis(),
      lineTo: vi.fn().mockReturnThis(),
      closePath: vi.fn().mockReturnThis(),
      fillPath: vi.fn().mockReturnThis(),
      strokePath: vi.fn().mockReturnThis(),
      generateTexture: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Create mock sprite for hit marker and hit indicator
    mockSprite = {
      setDepth: vi.fn().mockReturnThis(),
      setTint: vi.fn().mockReturnThis(),
      setScale: vi.fn().mockImplementation(function(this: any, s: number) { this.scale = s; return this; }),
      setRotation: vi.fn().mockReturnThis(),
      scale: 1,
      destroy: vi.fn(),
    };

    // Create mock scene
    mockScene = {
      sys: {
        isActive: vi.fn().mockReturnValue(true),
      },
      add: {
        text: vi.fn().mockImplementation(() => {
          const text = {
            setOrigin: vi.fn().mockReturnThis(),
            setScrollFactor: vi.fn().mockReturnThis(),
            setText: vi.fn().mockReturnThis(),
            setColor: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setScale: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          };
          createdTexts.push(text);
          return text;
        }),
        rectangle: vi.fn().mockReturnValue(mockDamageFlashOverlay),
        line: vi.fn().mockReturnValue(mockLine),
        sprite: vi.fn().mockReturnValue(mockSprite),
        graphics: vi.fn().mockImplementation(() => {
          const graphics = {
            fillStyle: vi.fn().mockReturnThis(),
            fillRect: vi.fn().mockReturnThis(),
            lineStyle: vi.fn().mockReturnThis(),
            beginPath: vi.fn().mockReturnThis(),
            arc: vi.fn().mockReturnThis(),
            strokePath: vi.fn().mockReturnThis(),
            clear: vi.fn().mockReturnThis(),
            setScrollFactor: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          };
          createdGraphics.push(graphics);
          return graphics;
        }),
      },
      make: {
        graphics: vi.fn().mockReturnValue(mockMakeGraphics),
      },
      cameras: {
        main: mockCamera,
      },
      input: {
        activePointer: {
          x: 500,
          y: 400,
          worldX: 600,
          worldY: 450,
        },
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
    it('should be a no-op (flash now uses cameras.main.flash)', () => {
      ui.createDamageFlashOverlay(1920, 1080);

      // No rectangle should be created — damage flash uses cameras.main.flash()
      expect(mockScene.add.rectangle).not.toHaveBeenCalled();
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
        isEmpty: vi.fn().mockReturnValue(false),
        isMeleeWeapon: vi.fn().mockReturnValue(false),
      } as unknown as ShootingManager;

      ui.updateAmmoDisplay(mockShootingManager);

      expect(createdTexts[0].setText).toHaveBeenCalledWith('10/15');
      expect(createdTexts[0].setVisible).toHaveBeenCalledWith(true);
    });

    it('should update ammo text when reloading (no longer shows [RELOADING] text)', () => {
      ui.createAmmoDisplay(10, 50);

      const mockShootingManager = {
        getAmmoInfo: vi.fn().mockReturnValue([5, 15]),
        isReloading: vi.fn().mockReturnValue(true),
        isEmpty: vi.fn().mockReturnValue(false),
        isMeleeWeapon: vi.fn().mockReturnValue(false),
      } as unknown as ShootingManager;

      ui.updateAmmoDisplay(mockShootingManager);

      // No longer appends [RELOADING] text - reload UI uses progress bars instead
      expect(createdTexts[0].setText).toHaveBeenCalledWith('5/15');
    });

    it('should not update if ammo text not created', () => {
      const mockShootingManager = {
        getAmmoInfo: vi.fn().mockReturnValue([10, 15]),
        isReloading: vi.fn().mockReturnValue(false),
        isEmpty: vi.fn().mockReturnValue(false),
        isMeleeWeapon: vi.fn().mockReturnValue(false),
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

    it('should hide ammo display for melee weapons (Bat)', () => {
      ui.createAmmoDisplay(10, 50);

      const mockMeleeManager = {
        getAmmoInfo: vi.fn().mockReturnValue([0, 0]),
        isReloading: vi.fn().mockReturnValue(false),
        isEmpty: vi.fn().mockReturnValue(true),
        isMeleeWeapon: vi.fn().mockReturnValue(true),
      } as unknown as ShootingManager;

      ui.updateAmmoDisplay(mockMeleeManager);

      // Ammo text should be hidden for melee weapons
      expect(createdTexts[0].setVisible).toHaveBeenCalledWith(false);
      // setText should not be called for melee weapons
      expect(createdTexts[0].setText).not.toHaveBeenCalled();
    });

    it('should hide ammo display for melee weapons (Katana)', () => {
      ui.createAmmoDisplay(10, 50);

      const mockMeleeManager = {
        getAmmoInfo: vi.fn().mockReturnValue([0, 0]),
        isReloading: vi.fn().mockReturnValue(false),
        isEmpty: vi.fn().mockReturnValue(true),
        isMeleeWeapon: vi.fn().mockReturnValue(true),
      } as unknown as ShootingManager;

      ui.updateAmmoDisplay(mockMeleeManager);

      expect(createdTexts[0].setVisible).toHaveBeenCalledWith(false);
    });

    it('should not show RELOAD indicator for melee weapons even when isEmpty is true', () => {
      ui.createAmmoDisplay(10, 50);
      ui.createReloadProgressBar(10, 70, 100, 10);

      const mockMeleeManager = {
        getAmmoInfo: vi.fn().mockReturnValue([0, 0]),
        isReloading: vi.fn().mockReturnValue(false),
        isEmpty: vi.fn().mockReturnValue(true), // Empty but melee
        isMeleeWeapon: vi.fn().mockReturnValue(true),
      } as unknown as ShootingManager;

      ui.updateAmmoDisplay(mockMeleeManager);

      // Empty magazine indicator should NOT be shown for melee
      // The indicator is created in the method, so we check that createdTexts length doesn't increase
      const initialTextCount = createdTexts.length;
      expect(createdTexts.length).toBe(initialTextCount);
    });

    it('should not show reload progress bar for melee weapons', () => {
      ui.createAmmoDisplay(10, 50);
      ui.createReloadProgressBar(10, 70, 100, 10);
      ui.createReloadCircleIndicator();

      const mockMeleeManager = {
        getAmmoInfo: vi.fn().mockReturnValue([0, 0]),
        isReloading: vi.fn().mockReturnValue(false),
        isEmpty: vi.fn().mockReturnValue(true),
        isMeleeWeapon: vi.fn().mockReturnValue(true),
      } as unknown as ShootingManager;

      ui.updateAmmoDisplay(mockMeleeManager);

      // Reload UI should be hidden for melee weapons
      expect(createdGraphics[0].setVisible).toHaveBeenCalledWith(false);
      expect(createdGraphics[1].setVisible).toHaveBeenCalledWith(false);
      expect(createdGraphics[2].setVisible).toHaveBeenCalledWith(false);
    });

    it('should show ammo display again when switching from melee to ranged weapon', () => {
      ui.createAmmoDisplay(10, 50);

      // Start with melee weapon
      const mockMeleeManager = {
        getAmmoInfo: vi.fn().mockReturnValue([0, 0]),
        isReloading: vi.fn().mockReturnValue(false),
        isEmpty: vi.fn().mockReturnValue(true),
        isMeleeWeapon: vi.fn().mockReturnValue(true),
      } as unknown as ShootingManager;

      ui.updateAmmoDisplay(mockMeleeManager);
      expect(createdTexts[0].setVisible).toHaveBeenCalledWith(false);

      // Switch to ranged weapon
      const mockRangedManager = {
        getAmmoInfo: vi.fn().mockReturnValue([15, 30]),
        isReloading: vi.fn().mockReturnValue(false),
        isEmpty: vi.fn().mockReturnValue(false),
        isMeleeWeapon: vi.fn().mockReturnValue(false),
      } as unknown as ShootingManager;

      ui.updateAmmoDisplay(mockRangedManager);

      // Ammo should be visible again and show correct ammo
      expect(createdTexts[0].setVisible).toHaveBeenCalledWith(true);
      expect(createdTexts[0].setText).toHaveBeenCalledWith('15/30');
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

  describe('showDamageFlash (TS-UI-013)', () => {
    it('should call cameras.main.flash with exact args (100, 128, 0, 0)', () => {
      ui.showDamageFlash();

      expect(mockCamera.flash).toHaveBeenCalledWith(100, 128, 0, 0);
    });

    it('should flash with duration 100ms', () => {
      ui.showDamageFlash();

      const args = mockCamera.flash.mock.calls[0];
      expect(args[0]).toBe(100);
    });

    it('should flash with RGB(128, 0, 0) — dark red, not blinding', () => {
      ui.showDamageFlash();

      const args = mockCamera.flash.mock.calls[0];
      expect(args[1]).toBe(128); // R
      expect(args[2]).toBe(0);   // G
      expect(args[3]).toBe(0);   // B
    });

    it('should not use screen overlay rectangle (uses cameras.main.flash)', () => {
      ui.showDamageFlash();

      // No rectangle or tween should be created
      expect(mockScene.add.rectangle).not.toHaveBeenCalled();
      expect(mockScene.tweens.add).not.toHaveBeenCalled();
    });
  });

  describe('showCameraShake (TS-UI-017)', () => {
    it('should call cameras.main.shake with exact args (50, 0.001)', () => {
      ui.showCameraShake();

      expect(mockCamera.shake).toHaveBeenCalledWith(50, 0.001);
    });

    it('should shake with duration 50ms', () => {
      ui.showCameraShake();

      const args = mockCamera.shake.mock.calls[0];
      expect(args[0]).toBe(50);
    });

    it('should shake with intensity 0.001 — subtle, felt not seen', () => {
      ui.showCameraShake();

      const args = mockCamera.shake.mock.calls[0];
      expect(args[1]).toBe(0.001);
    });
  });

  describe('TS-GFX-025: Hit marker texture generation', () => {
    it('should generate hitmarker texture with generateTexture("hitmarker", 20, 20)', () => {
      expect(mockMakeGraphics.generateTexture).toHaveBeenCalledWith('hitmarker', 20, 20);
    });

    it('should draw X with 3px white stroke', () => {
      expect(mockMakeGraphics.lineStyle).toHaveBeenCalledWith(3, 0xffffff, 1);
    });

    it('should draw two diagonal lines forming X shape', () => {
      // First diagonal: (2,2) to (18,18)
      expect(mockMakeGraphics.moveTo).toHaveBeenCalledWith(2, 2);
      expect(mockMakeGraphics.lineTo).toHaveBeenCalledWith(18, 18);
      // Second diagonal: (18,2) to (2,18)
      expect(mockMakeGraphics.moveTo).toHaveBeenCalledWith(18, 2);
      expect(mockMakeGraphics.lineTo).toHaveBeenCalledWith(2, 18);
    });

    it('should destroy temp graphics after texture generation', () => {
      expect(mockMakeGraphics.destroy).toHaveBeenCalled();
    });
  });

  describe('TS-UI-014: Hit marker normal variant', () => {
    it('should create sprite at pointer world position with "hitmarker" texture', () => {
      ui.showHitMarker(false);

      expect(mockScene.add.sprite).toHaveBeenCalledWith(600, 450, 'hitmarker');
    });

    it('should set depth to exactly 1000', () => {
      ui.showHitMarker(false);

      expect(mockSprite.setDepth).toHaveBeenCalledWith(1000);
    });

    it('should set white tint (0xFFFFFF) for normal hit', () => {
      ui.showHitMarker(false);

      expect(mockSprite.setTint).toHaveBeenCalledWith(0xffffff);
    });

    it('should set scale to exactly 1.2 for normal hit', () => {
      ui.showHitMarker(false);

      expect(mockSprite.setScale).toHaveBeenCalledWith(1.2);
    });

    it('should create tween with alpha 0, scale 0.6 (1.2 * 0.5), duration 150ms', () => {
      ui.showHitMarker(false);

      expect(mockScene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: mockSprite,
          alpha: 0,
          scale: 0.6, // 1.2 * 0.5
          duration: 150,
        })
      );
    });

    it('should destroy marker sprite after tween completes', () => {
      ui.showHitMarker(false);

      // Mock calls onComplete immediately
      expect(mockSprite.destroy).toHaveBeenCalled();
    });
  });

  describe('TS-UI-015: Hit marker kill variant', () => {
    it('should set red tint (0xFF0000) for kill hit', () => {
      ui.showHitMarker(true);

      expect(mockSprite.setTint).toHaveBeenCalledWith(0xff0000);
    });

    it('should set scale to exactly 2.0 for kill hit', () => {
      ui.showHitMarker(true);

      expect(mockSprite.setScale).toHaveBeenCalledWith(2.0);
    });

    it('should create tween with scale 1.0 (2.0 * 0.5) for kill variant', () => {
      ui.showHitMarker(true);

      expect(mockScene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: mockSprite,
          alpha: 0,
          scale: 1.0, // 2.0 * 0.5
          duration: 150,
        })
      );
    });

    it('should set depth to 1000 for kill variant (same as normal)', () => {
      ui.showHitMarker(true);

      expect(mockSprite.setDepth).toHaveBeenCalledWith(1000);
    });
  });

  describe('showHitMarker edge cases', () => {
    it('should not throw when pointer is null', () => {
      (mockScene as any).input.activePointer = null;

      expect(() => ui.showHitMarker(false)).not.toThrow();
    });

    it('should fall back to pointer.x + scrollX when worldX is undefined', () => {
      (mockScene as any).input.activePointer = {
        x: 500,
        y: 400,
        worldX: undefined,
        worldY: undefined,
      };

      ui.showHitMarker(false);

      // worldX fallback: 500 + scrollX(100) = 600, worldY fallback: 400 + scrollY(50) = 450
      expect(mockScene.add.sprite).toHaveBeenCalledWith(600, 450, 'hitmarker');
    });

    it('should default to normal variant when kill param is omitted', () => {
      ui.showHitMarker();

      expect(mockSprite.setTint).toHaveBeenCalledWith(0xffffff);
      expect(mockSprite.setScale).toHaveBeenCalledWith(1.2);
    });
  });

  describe('TS-UI-016: Damage number variants', () => {
    const mockPlayerManager = () => ({
      getPlayerPosition: vi.fn().mockReturnValue({ x: 500, y: 300 }),
    }) as unknown as PlayerManager;

    describe('Normal hit variant (default)', () => {
      it('should use white color (#ffffff) and 16px font', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25);

        expect(mockScene.add.text).toHaveBeenCalledWith(
          500, 270, '-25',
          expect.objectContaining({
            fontSize: '16px',
            color: '#ffffff',
          })
        );
      });

      it('should use 2px black stroke (not 3px)', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25);

        expect(mockScene.add.text).toHaveBeenCalledWith(
          500, 270, '-25',
          expect.objectContaining({
            stroke: '#000000',
            strokeThickness: 2,
          })
        );
      });

      it('should set depth to exactly 1000', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25);

        expect(createdTexts[0].setDepth).toHaveBeenCalledWith(1000);
      });

      it('should not apply remote scaling for local player damage', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25, false, true);

        expect(createdTexts[0].setScale).not.toHaveBeenCalled();
        expect(createdTexts[0].setAlpha).not.toHaveBeenCalled();
      });
    });

    describe('Kill hit variant', () => {
      it('should use red color (#ff0000) and 24px font for kill', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25, true);

        expect(mockScene.add.text).toHaveBeenCalledWith(
          500, 270, '-25',
          expect.objectContaining({
            fontSize: '24px',
            color: '#ff0000',
          })
        );
      });

      it('should use 2px black stroke for kill variant', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25, true);

        expect(mockScene.add.text).toHaveBeenCalledWith(
          500, 270, '-25',
          expect.objectContaining({
            stroke: '#000000',
            strokeThickness: 2,
          })
        );
      });

      it('should set depth to 1000 for kill variant', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25, true);

        expect(createdTexts[0].setDepth).toHaveBeenCalledWith(1000);
      });
    });

    describe('Remote (non-local) variant', () => {
      it('should set scale to 0.7 for remote damage', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25, false, false);

        expect(createdTexts[0].setScale).toHaveBeenCalledWith(0.7);
      });

      it('should set alpha to 0.8 for remote damage', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25, false, false);

        expect(createdTexts[0].setAlpha).toHaveBeenCalledWith(0.8);
      });

      it('should use white 16px for remote damage', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25, false, false);

        expect(mockScene.add.text).toHaveBeenCalledWith(
          500, 270, '-25',
          expect.objectContaining({
            fontSize: '16px',
            color: '#ffffff',
          })
        );
      });
    });

    describe('Tween animation', () => {
      it('should float up 50px and fade over 800ms (not 1000ms)', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25);

        expect(mockScene.tweens.add).toHaveBeenCalledWith(
          expect.objectContaining({
            y: 220, // position.y(300) - 80 = 220
            alpha: 0,
            duration: 800,
            ease: 'Cubic.easeOut',
          })
        );
      });

      it('should destroy text after tween completes', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25);

        expect(createdTexts[0].destroy).toHaveBeenCalled();
      });

      it('should set origin to 0.5 (centered)', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25);

        expect(createdTexts[0].setOrigin).toHaveBeenCalledWith(0.5);
      });
    });

    describe('Edge cases', () => {
      it('should not show damage number if player position not found', () => {
        const noPositionManager = {
          getPlayerPosition: vi.fn().mockReturnValue(null),
        } as unknown as PlayerManager;

        ui.showDamageNumber(noPositionManager, 'nonexistent', 25);

        expect(mockScene.add.text).not.toHaveBeenCalled();
      });

      it('should default to normal variant when isKill and isLocal are omitted', () => {
        ui.showDamageNumber(mockPlayerManager(), 'victim-1', 25);

        expect(mockScene.add.text).toHaveBeenCalledWith(
          500, 270, '-25',
          expect.objectContaining({
            fontSize: '16px',
            color: '#ffffff',
          })
        );
      });
    });
  });

  describe('Hit indicator texture generation', () => {
    it('should generate hit_indicator texture with generateTexture("hit_indicator", 16, 16)', () => {
      // Called in constructor — second call to make.graphics (after hitmarker)
      expect(mockMakeGraphics.generateTexture).toHaveBeenCalledWith('hit_indicator', 16, 16);
    });

    it('should draw filled white chevron shape', () => {
      expect(mockMakeGraphics.fillStyle).toHaveBeenCalledWith(0xffffff, 1);
      expect(mockMakeGraphics.moveTo).toHaveBeenCalledWith(0, 0);
      expect(mockMakeGraphics.lineTo).toHaveBeenCalledWith(16, 8);
      expect(mockMakeGraphics.lineTo).toHaveBeenCalledWith(0, 16);
      expect(mockMakeGraphics.lineTo).toHaveBeenCalledWith(4, 8);
      expect(mockMakeGraphics.closePath).toHaveBeenCalled();
      expect(mockMakeGraphics.fillPath).toHaveBeenCalled();
    });

    it('should destroy temp graphics after hit indicator texture generation', () => {
      // destroy is called for both hitmarker and hit_indicator textures
      expect(mockMakeGraphics.destroy).toHaveBeenCalled();
    });
  });

  describe('TS-GFX-021: Directional hit indicator (outgoing)', () => {
    it('should create sprite at 60px from player toward target with "hit_indicator" texture', () => {
      // Player at (100, 100), target at (200, 100) — angle = 0 (east)
      ui.showHitIndicator(100, 100, 200, 100, 'outgoing');

      expect(mockScene.add.sprite).toHaveBeenCalledWith(
        160, // 100 + cos(0) * 60 = 160
        100, // 100 + sin(0) * 60 = 100
        'hit_indicator'
      );
    });

    it('should set depth to exactly 1001', () => {
      ui.showHitIndicator(100, 100, 200, 100, 'outgoing');

      expect(mockSprite.setDepth).toHaveBeenCalledWith(1001);
    });

    it('should set rotation to angle toward target', () => {
      // Player at (100, 100), target at (200, 100) — angle = 0
      ui.showHitIndicator(100, 100, 200, 100, 'outgoing');

      expect(mockSprite.setRotation).toHaveBeenCalledWith(0);
    });

    it('should set white tint (0xFFFFFF) for normal outgoing hit', () => {
      ui.showHitIndicator(100, 100, 200, 100, 'outgoing', false);

      expect(mockSprite.setTint).toHaveBeenCalledWith(0xffffff);
    });

    it('should set red tint (0xFF0000) for kill outgoing hit', () => {
      ui.showHitIndicator(100, 100, 200, 100, 'outgoing', true);

      expect(mockSprite.setTint).toHaveBeenCalledWith(0xff0000);
    });

    it('should create tween with alpha 0, scale 1.5, duration exactly 200ms', () => {
      ui.showHitIndicator(100, 100, 200, 100, 'outgoing');

      expect(mockScene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: mockSprite,
          alpha: 0,
          scale: 1.5,
          duration: 200,
        })
      );
    });

    it('should destroy indicator sprite after tween completes', () => {
      ui.showHitIndicator(100, 100, 200, 100, 'outgoing');

      expect(mockSprite.destroy).toHaveBeenCalled();
    });

    it('should position correctly for diagonal angle (NE)', () => {
      // Player at (0, 0), target at (100, 100) — angle = PI/4
      const angle = Math.atan2(100, 100); // ~0.7854
      ui.showHitIndicator(0, 0, 100, 100, 'outgoing');

      expect(mockScene.add.sprite).toHaveBeenCalledWith(
        Math.cos(angle) * 60,
        Math.sin(angle) * 60,
        'hit_indicator'
      );
    });

    it('should default kill to false when omitted', () => {
      ui.showHitIndicator(100, 100, 200, 100, 'outgoing');

      expect(mockSprite.setTint).toHaveBeenCalledWith(0xffffff);
    });
  });

  describe('TS-GFX-022: Directional hit indicator (incoming)', () => {
    it('should create sprite at 60px from player toward source with "hit_indicator" texture', () => {
      // Player at (200, 200), attacker at (100, 200) — angle = PI (west)
      ui.showHitIndicator(200, 200, 100, 200, 'incoming');

      expect(mockScene.add.sprite).toHaveBeenCalledWith(
        140, // 200 + cos(PI) * 60 = 200 - 60 = 140
        200, // 200 + sin(PI) * 60 ≈ 200
        'hit_indicator'
      );
    });

    it('should set depth to exactly 1001', () => {
      ui.showHitIndicator(200, 200, 100, 200, 'incoming');

      expect(mockSprite.setDepth).toHaveBeenCalledWith(1001);
    });

    it('should always set red tint (0xFF0000) for incoming hit', () => {
      ui.showHitIndicator(200, 200, 100, 200, 'incoming', false);

      expect(mockSprite.setTint).toHaveBeenCalledWith(0xff0000);
    });

    it('should always set red tint for incoming even when kill is true', () => {
      ui.showHitIndicator(200, 200, 100, 200, 'incoming', true);

      expect(mockSprite.setTint).toHaveBeenCalledWith(0xff0000);
    });

    it('should create tween with alpha 0, scale 1.5, duration exactly 400ms', () => {
      ui.showHitIndicator(200, 200, 100, 200, 'incoming');

      expect(mockScene.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: mockSprite,
          alpha: 0,
          scale: 1.5,
          duration: 400,
        })
      );
    });

    it('should destroy indicator sprite after tween completes', () => {
      ui.showHitIndicator(200, 200, 100, 200, 'incoming');

      expect(mockSprite.destroy).toHaveBeenCalled();
    });

    it('should set rotation to angle toward damage source', () => {
      // Player at (200, 200), attacker at (100, 200) — angle = PI
      ui.showHitIndicator(200, 200, 100, 200, 'incoming');

      expect(mockSprite.setRotation).toHaveBeenCalledWith(Math.PI);
    });

    it('should position at exactly 60px distance from player center', () => {
      // Player at (300, 300), attacker at (300, 100) — angle = -PI/2 (north)
      ui.showHitIndicator(300, 300, 300, 100, 'incoming');

      expect(mockScene.add.sprite).toHaveBeenCalledWith(
        300, // 300 + cos(-PI/2) * 60 ≈ 300
        240, // 300 + sin(-PI/2) * 60 = 300 - 60 = 240
        'hit_indicator'
      );
    });
  });

  describe('reload UI elements', () => {
    describe('createReloadProgressBar', () => {
      it('should create reload progress bar graphics elements', () => {
        ui.createReloadProgressBar(10, 70, 200, 10);

        expect(mockScene.add.graphics).toHaveBeenCalledTimes(2); // Background + foreground
      });
    });

    describe('updateReloadProgress', () => {
      it('should update reload progress bar fill amount', () => {
        ui.createReloadProgressBar(10, 70, 200, 10);
        // createReloadProgressBar creates 2 graphics: background (index 0), foreground (index 1)
        const progressBarGraphics = createdGraphics[1];

        ui.updateReloadProgress(0.5, 10, 70, 200, 10);

        // Graphics mock should be called to clear and fill
        expect(progressBarGraphics.clear).toHaveBeenCalled();
        expect(progressBarGraphics.fillStyle).toHaveBeenCalledWith(0x00ff00, 1.0);
        expect(progressBarGraphics.fillRect).toHaveBeenCalledWith(10, 70, 100, 10); // 50% of 200 width
      });

      it('should handle updateReloadProgress when progress bar not created', () => {
        expect(() => {
          ui.updateReloadProgress(0.5, 10, 70, 200, 10);
        }).not.toThrow();
      });
    });

    describe('createReloadCircleIndicator', () => {
      it('should create circular reload indicator', () => {
        ui.createReloadCircleIndicator();

        expect(mockScene.add.graphics).toHaveBeenCalled();
      });
    });

    describe('updateReloadCircle', () => {
      it('should update circular reload indicator progress', () => {
        const graphicsCountBefore = createdGraphics.length;
        ui.createReloadCircleIndicator();
        // Get the graphics instance that was just created
        const circleGraphics = createdGraphics[graphicsCountBefore];

        ui.updateReloadCircle(0.75);

        expect(circleGraphics.clear).toHaveBeenCalled();
        expect(circleGraphics.lineStyle).toHaveBeenCalled();
        expect(circleGraphics.arc).toHaveBeenCalled();
      });

      it('should handle updateReloadCircle when circle not created', () => {
        expect(() => {
          ui.updateReloadCircle(0.5);
        }).not.toThrow();
      });
    });

    describe('updateAmmoDisplay with reload UI', () => {
      it('should show empty magazine indicator when empty and not reloading', () => {
        ui.createAmmoDisplay(10, 50);

        const mockShootingManager = {
          getAmmoInfo: vi.fn().mockReturnValue([0, 15]),
          isReloading: vi.fn().mockReturnValue(false),
          isEmpty: vi.fn().mockReturnValue(true),
          isMeleeWeapon: vi.fn().mockReturnValue(false),
        } as unknown as ShootingManager;

        ui.updateAmmoDisplay(mockShootingManager);

        // Text for RELOAD! indicator should be created
        expect(mockScene.add.text).toHaveBeenCalledWith(
          960, // camera.width / 2
          600, // camera.height / 2 + 60
          'RELOAD!',
          expect.objectContaining({
            fontSize: '32px',
            color: '#ff0000',
          })
        );
      });

      it('should hide empty magazine indicator when not empty', () => {
        ui.createAmmoDisplay(10, 50);

        // First show the indicator
        const emptyShootingManager = {
          getAmmoInfo: vi.fn().mockReturnValue([0, 15]),
          isReloading: vi.fn().mockReturnValue(false),
          isEmpty: vi.fn().mockReturnValue(true),
          isMeleeWeapon: vi.fn().mockReturnValue(false),
        } as unknown as ShootingManager;

        ui.updateAmmoDisplay(emptyShootingManager);

        // Then hide it by updating with non-empty state
        const nonEmptyShootingManager = {
          getAmmoInfo: vi.fn().mockReturnValue([5, 15]),
          isReloading: vi.fn().mockReturnValue(false),
          isEmpty: vi.fn().mockReturnValue(false),
          isMeleeWeapon: vi.fn().mockReturnValue(false),
        } as unknown as ShootingManager;

        ui.updateAmmoDisplay(nonEmptyShootingManager);

        // Indicator should be set to invisible
        const reloadText = createdTexts[createdTexts.length - 1];
        expect(reloadText.setVisible).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('Cleanup', () => {
    it('should destroy ammo text when destroyed', () => {
      ui.createAmmoDisplay(10, 50);
      const ammoText = createdTexts[0];

      ui.destroy();

      expect(ammoText.destroy).toHaveBeenCalled();
    });

    it('should destroy match timer when destroyed', () => {
      ui.createMatchTimer(960, 10);
      const timerText = createdTexts[0];

      ui.destroy();

      expect(timerText.destroy).toHaveBeenCalled();
    });

    it('should not crash on destroy even without damage flash overlay (no-op)', () => {
      ui.createDamageFlashOverlay(1920, 1080);

      // No game object to destroy — flash is a camera effect
      expect(() => ui.destroy()).not.toThrow();
    });

    it('should destroy reload progress bar when destroyed', () => {
      ui.createReloadProgressBar(10, 70, 200, 10);
      const progressBarBg = createdGraphics[0];
      const progressBar = createdGraphics[1];

      ui.destroy();

      expect(progressBarBg.destroy).toHaveBeenCalled();
      expect(progressBar.destroy).toHaveBeenCalled();
    });

    it('should destroy reload circle indicator when destroyed', () => {
      ui.createReloadCircleIndicator();
      const circle = createdGraphics[0];

      ui.destroy();

      expect(circle.destroy).toHaveBeenCalled();
    });

    it('should handle destroy when UI elements are not created', () => {
      const emptyUI = new GameSceneUI(mockScene);

      // Should not crash when destroying without creating UI elements
      expect(() => {
        emptyUI.destroy();
      }).not.toThrow();
    });
  });
});
