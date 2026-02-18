import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Phaser from 'phaser';
import { GameSceneSpectator } from './GameSceneSpectator';
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

describe('GameSceneSpectator', () => {
  let spectator: GameSceneSpectator;
  let mockScene: Phaser.Scene;
  let mockPlayerManager: PlayerManager;
  let mockOnStopCameraFollow: () => void;
  let mockCamera: any;
  let mockOverlay: any;
  let mockDiedText: any;
  let mockStatsContainer: any;
  let mockTryAgainButton: any;
  let mockGraphics: any;
  let mockScoreText: any;
  let mockButtonBg: any;
  let mockButtonText: any;

  beforeEach(() => {
    // Create mock camera
    mockCamera = {
      width: 1920,
      height: 1080,
      scrollX: 0,
      scrollY: 0,
    };

    // Create mock overlay rectangle
    mockOverlay = {
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setStrokeStyle: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Create mock "YOU DIED" text
    mockDiedText = {
      setOrigin: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Create mock graphics for icons
    mockGraphics = {
      fillStyle: vi.fn().mockReturnThis(),
      fillCircle: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Create mock score text
    mockScoreText = {
      setOrigin: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Create mock stats container
    mockStatsContainer = {
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Create mock button background rectangle
    mockButtonBg = {
      setStrokeStyle: vi.fn().mockReturnThis(),
      setInteractive: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Create mock button text
    mockButtonText = {
      setOrigin: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Create mock try again button container
    mockTryAgainButton = {
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Track calls to add.rectangle, add.text, add.graphics, add.container
    let rectangleCallCount = 0;
    let textCallCount = 0;
    let containerCallCount = 0;

    mockScene = {
      add: {
        rectangle: vi.fn().mockImplementation(() => {
          rectangleCallCount++;
          if (rectangleCallCount === 1) {
            return mockOverlay;
          }
          return mockButtonBg;
        }),
        text: vi.fn().mockImplementation(() => {
          textCallCount++;
          if (textCallCount === 1) {
            return mockDiedText;
          }
          if (textCallCount === 2) {
            return mockScoreText;
          }
          return mockButtonText;
        }),
        graphics: vi.fn().mockReturnValue(mockGraphics),
        container: vi.fn().mockImplementation(() => {
          containerCallCount++;
          if (containerCallCount === 1) {
            return mockStatsContainer;
          }
          return mockTryAgainButton;
        }),
      },
      cameras: {
        main: mockCamera,
      },
    } as unknown as Phaser.Scene;

    // Create mock player manager
    mockPlayerManager = {
      getLivingPlayers: vi.fn().mockReturnValue([]),
      getLocalPlayerId: vi.fn().mockReturnValue('local-player'),
    } as unknown as PlayerManager;

    // Create mock callback
    mockOnStopCameraFollow = vi.fn();

    // Create spectator instance
    spectator = new GameSceneSpectator(mockScene, mockPlayerManager, mockOnStopCameraFollow);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isActive', () => {
    it('should return false when not in spectator mode', () => {
      expect(spectator.isActive()).toBe(false);
    });

    it('should return true after entering spectator mode', () => {
      spectator.enterSpectatorMode();
      expect(spectator.isActive()).toBe(true);
    });

    it('should return false after exiting spectator mode', () => {
      spectator.enterSpectatorMode();
      spectator.exitSpectatorMode();
      expect(spectator.isActive()).toBe(false);
    });
  });

  describe('setOnRespawnRequest', () => {
    it('should set the respawn request callback', () => {
      const callback = vi.fn();
      spectator.setOnRespawnRequest(callback);
      spectator.enterSpectatorMode();

      // Trigger button click via the stored callback on buttonBg
      const pointerdownCall = mockButtonBg.on.mock.calls.find(
        (call: [string, () => void]) => call[0] === 'pointerdown'
      );
      expect(pointerdownCall).toBeDefined();
      pointerdownCall![1]();

      expect(callback).toHaveBeenCalled();
    });
  });

  describe('enterSpectatorMode', () => {
    it('should set isSpectating to true', () => {
      spectator.enterSpectatorMode();
      expect(spectator.isActive()).toBe(true);
    });

    it('should call onStopCameraFollow callback', () => {
      spectator.enterSpectatorMode();
      expect(mockOnStopCameraFollow).toHaveBeenCalled();
    });

    it('should create dark overlay rectangle', () => {
      spectator.enterSpectatorMode();

      expect(mockScene.add.rectangle).toHaveBeenCalledWith(
        mockCamera.width / 2,
        mockCamera.height / 2,
        mockCamera.width,
        mockCamera.height,
        0x000000,
        0.7
      );
    });

    it('should set overlay to not scroll with camera', () => {
      spectator.enterSpectatorMode();
      expect(mockOverlay.setScrollFactor).toHaveBeenCalledWith(0);
    });

    it('should set overlay depth to 990', () => {
      spectator.enterSpectatorMode();
      expect(mockOverlay.setDepth).toHaveBeenCalledWith(990);
    });

    it('should create YOU DIED text', () => {
      spectator.enterSpectatorMode();

      expect(mockScene.add.text).toHaveBeenCalledWith(
        mockCamera.width / 2,
        mockCamera.height / 2 - 100,
        'YOU DIED',
        expect.objectContaining({
          fontSize: '72px',
          fontStyle: 'bold',
          color: '#FFFFFF',
        })
      );
    });

    it('should create stats container with graphics', () => {
      spectator.enterSpectatorMode();
      expect(mockScene.add.graphics).toHaveBeenCalled();
    });

    it('should draw gold trophy icon', () => {
      spectator.enterSpectatorMode();
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0xFFD700, 1);
    });

    it('should draw red skull icon', () => {
      spectator.enterSpectatorMode();
      expect(mockGraphics.fillStyle).toHaveBeenCalledWith(0xFF0000, 1);
    });

    it('should create score text in red with zero-padded score', () => {
      spectator.enterSpectatorMode(1234);

      expect(mockScene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        '001234',
        expect.objectContaining({ color: '#FF0000' })
      );
    });

    it('should create kills text in white', () => {
      spectator.enterSpectatorMode(0, 5);

      expect(mockScene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        '5',
        expect.objectContaining({ color: '#FFFFFF' })
      );
    });

    it('should create TRY AGAIN button', () => {
      spectator.enterSpectatorMode();

      expect(mockScene.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'TRY AGAIN',
        expect.objectContaining({ color: '#FFFFFF' })
      );
    });

    it('should make TRY AGAIN button interactive', () => {
      spectator.enterSpectatorMode();
      expect(mockButtonBg.setInteractive).toHaveBeenCalled();
    });

    it('should register pointerdown handler on TRY AGAIN button', () => {
      spectator.enterSpectatorMode();
      const pointerdownCall = mockButtonBg.on.mock.calls.find(
        (call: [string, () => void]) => call[0] === 'pointerdown'
      );
      expect(pointerdownCall).toBeDefined();
    });

    it('should call onRespawnRequest when TRY AGAIN is clicked', () => {
      const mockRespawnRequest = vi.fn();
      spectator = new GameSceneSpectator(
        mockScene,
        mockPlayerManager,
        mockOnStopCameraFollow,
        mockRespawnRequest
      );

      spectator.enterSpectatorMode();

      const pointerdownCall = mockButtonBg.on.mock.calls.find(
        (call: [string, () => void]) => call[0] === 'pointerdown'
      );
      pointerdownCall![1]();

      expect(mockRespawnRequest).toHaveBeenCalled();
    });

    it('should create two containers (stats + button)', () => {
      spectator.enterSpectatorMode();
      expect(mockScene.add.container).toHaveBeenCalledTimes(2);
    });
  });

  describe('exitSpectatorMode', () => {
    it('should set isSpectating to false', () => {
      spectator.enterSpectatorMode();
      spectator.exitSpectatorMode();

      expect(spectator.isActive()).toBe(false);
    });

    it('should destroy overlay when it exists', () => {
      spectator.enterSpectatorMode();
      spectator.exitSpectatorMode();

      expect(mockOverlay.destroy).toHaveBeenCalled();
    });

    it('should destroy YOU DIED text when it exists', () => {
      spectator.enterSpectatorMode();
      spectator.exitSpectatorMode();

      expect(mockDiedText.destroy).toHaveBeenCalled();
    });

    it('should destroy stats container when it exists', () => {
      spectator.enterSpectatorMode();
      spectator.exitSpectatorMode();

      expect(mockStatsContainer.destroy).toHaveBeenCalled();
    });

    it('should destroy try again button when it exists', () => {
      spectator.enterSpectatorMode();
      spectator.exitSpectatorMode();

      expect(mockTryAgainButton.destroy).toHaveBeenCalled();
    });

    it('should handle exit when not in spectator mode gracefully', () => {
      expect(() => spectator.exitSpectatorMode()).not.toThrow();
    });
  });

  describe('updateSpectatorMode', () => {
    it('should not update camera when not in spectator mode', () => {
      spectator.updateSpectatorMode();
      expect(mockCamera.scrollX).toBe(0);
      expect(mockCamera.scrollY).toBe(0);
    });

    it('should follow nearest living player with camera', () => {
      const mockLivingPlayer = {
        id: 'other-player',
        position: { x: 500, y: 300 },
      };

      (mockPlayerManager.getLivingPlayers as ReturnType<typeof vi.fn>).mockReturnValue([mockLivingPlayer]);

      spectator.enterSpectatorMode();
      spectator.updateSpectatorMode();

      // Camera should have been adjusted toward the player
      expect(mockCamera.scrollX).not.toBe(0);
    });

    it('should exclude local player from spectator camera targets', () => {
      const mockLocalPlayer = {
        id: 'local-player',
        position: { x: 100, y: 100 },
      };

      const mockOtherPlayer = {
        id: 'other-player',
        position: { x: 500, y: 300 },
      };

      (mockPlayerManager.getLivingPlayers as ReturnType<typeof vi.fn>).mockReturnValue([
        mockLocalPlayer,
        mockOtherPlayer,
      ]);

      spectator.enterSpectatorMode();

      // Reset camera position
      mockCamera.scrollX = 0;
      mockCamera.scrollY = 0;

      spectator.updateSpectatorMode();

      // Camera should follow other-player, not local-player
      // Target X = 500 - 960 = -460, lerped from 0 = -46
      expect(mockCamera.scrollX).toBeCloseTo(-46, 0);
    });

    it('should smoothly lerp camera position toward target', () => {
      const mockOtherPlayer = {
        id: 'other-player',
        position: { x: 1000, y: 600 },
      };

      (mockPlayerManager.getLivingPlayers as ReturnType<typeof vi.fn>).mockReturnValue([mockOtherPlayer]);

      spectator.enterSpectatorMode();

      // Initial camera position
      mockCamera.scrollX = 0;
      mockCamera.scrollY = 0;

      // First update
      spectator.updateSpectatorMode();

      const scrollXAfterFirstUpdate = mockCamera.scrollX;
      const scrollYAfterFirstUpdate = mockCamera.scrollY;

      // Target: x = 1000 - 960 = 40, y = 600 - 540 = 60
      // With 0.1 lerp: scrollX = 0 + (40 - 0) * 0.1 = 4
      expect(scrollXAfterFirstUpdate).toBeCloseTo(4, 0);
      expect(scrollYAfterFirstUpdate).toBeCloseTo(6, 0);

      // Second update should continue moving toward target
      spectator.updateSpectatorMode();

      expect(mockCamera.scrollX).toBeGreaterThan(scrollXAfterFirstUpdate);
      expect(mockCamera.scrollY).toBeGreaterThan(scrollYAfterFirstUpdate);
    });

    it('should not move camera when no other living players', () => {
      (mockPlayerManager.getLivingPlayers as ReturnType<typeof vi.fn>).mockReturnValue([]);

      spectator.enterSpectatorMode();
      mockCamera.scrollX = 0;
      mockCamera.scrollY = 0;

      spectator.updateSpectatorMode();

      expect(mockCamera.scrollX).toBe(0);
      expect(mockCamera.scrollY).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should destroy all elements when destroyed', () => {
      spectator.enterSpectatorMode();

      spectator.destroy();

      expect(mockOverlay.destroy).toHaveBeenCalled();
      expect(mockDiedText.destroy).toHaveBeenCalled();
      expect(mockStatsContainer.destroy).toHaveBeenCalled();
      expect(mockTryAgainButton.destroy).toHaveBeenCalled();
    });

    it('should reset spectator state when destroyed', () => {
      spectator.enterSpectatorMode();
      expect(spectator.isActive()).toBe(true);

      spectator.destroy();

      expect(spectator.isActive()).toBe(false);
    });

    it('should handle destroy when not in spectator mode', () => {
      expect(() => {
        spectator.destroy();
      }).not.toThrow();
    });
  });
});
