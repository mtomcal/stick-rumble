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
  let mockSpectatorText: any;
  let mockRespawnCountdownText: any;

  beforeEach(() => {
    // Create mock camera
    mockCamera = {
      width: 1920,
      height: 1080,
      scrollX: 0,
      scrollY: 0,
    };

    // Create mock text objects
    mockSpectatorText = {
      setOrigin: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setText: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    mockRespawnCountdownText = {
      setOrigin: vi.fn().mockReturnThis(),
      setScrollFactor: vi.fn().mockReturnThis(),
      setDepth: vi.fn().mockReturnThis(),
      setText: vi.fn().mockReturnThis(),
      destroy: vi.fn(),
    };

    // Create mock scene with a factory that returns different texts
    let textCallCount = 0;
    mockScene = {
      add: {
        text: vi.fn().mockImplementation(() => {
          textCallCount++;
          if (textCallCount === 1) {
            return mockSpectatorText;
          }
          return mockRespawnCountdownText;
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

  describe('enterSpectatorMode', () => {
    it('should set isSpectating to true', () => {
      spectator.enterSpectatorMode();
      expect(spectator.isActive()).toBe(true);
    });

    it('should call onStopCameraFollow callback', () => {
      spectator.enterSpectatorMode();
      expect(mockOnStopCameraFollow).toHaveBeenCalled();
    });

    it('should create spectator text UI element', () => {
      spectator.enterSpectatorMode();

      // First call should create spectator text
      expect(mockScene.add.text).toHaveBeenCalledWith(
        mockCamera.width / 2,
        mockCamera.height / 2 - 50,
        'Spectating...',
        expect.objectContaining({
          fontSize: '24px',
          color: '#ffffff',
        })
      );
    });

    it('should create respawn countdown text UI element', () => {
      spectator.enterSpectatorMode();

      // Second call should create respawn countdown text
      expect(mockScene.add.text).toHaveBeenCalledWith(
        mockCamera.width / 2,
        mockCamera.height / 2,
        'Respawning in 3...',
        expect.objectContaining({
          fontSize: '20px',
          color: '#00ff00',
        })
      );
    });

    it('should set text elements to not scroll with camera', () => {
      spectator.enterSpectatorMode();

      expect(mockSpectatorText.setScrollFactor).toHaveBeenCalledWith(0);
      expect(mockRespawnCountdownText.setScrollFactor).toHaveBeenCalledWith(0);
    });

    it('should set high depth for text elements', () => {
      spectator.enterSpectatorMode();

      expect(mockSpectatorText.setDepth).toHaveBeenCalledWith(1001);
      expect(mockRespawnCountdownText.setDepth).toHaveBeenCalledWith(1001);
    });
  });

  describe('exitSpectatorMode', () => {
    it('should set isSpectating to false', () => {
      spectator.enterSpectatorMode();
      spectator.exitSpectatorMode();

      expect(spectator.isActive()).toBe(false);
    });

    it('should destroy spectator text when it exists', () => {
      spectator.enterSpectatorMode();
      spectator.exitSpectatorMode();

      expect(mockSpectatorText.destroy).toHaveBeenCalled();
    });

    it('should destroy respawn countdown text when it exists', () => {
      spectator.enterSpectatorMode();
      spectator.exitSpectatorMode();

      expect(mockRespawnCountdownText.destroy).toHaveBeenCalled();
    });

    it('should handle exit when not in spectator mode gracefully', () => {
      // Should not throw when exiting without entering
      expect(() => spectator.exitSpectatorMode()).not.toThrow();
    });

    it('should clear death time on exit', () => {
      // Mock Date.now for consistent testing
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      spectator.enterSpectatorMode();
      spectator.exitSpectatorMode();

      // Need to create fresh mocks for second enterSpectatorMode
      // Reset the text mock
      mockSpectatorText = {
        setOrigin: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setText: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };
      mockRespawnCountdownText = {
        setOrigin: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setText: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };

      let textCallCount = 0;
      (mockScene.add.text as ReturnType<typeof vi.fn>).mockImplementation(() => {
        textCallCount++;
        if (textCallCount === 1) {
          return mockSpectatorText;
        }
        return mockRespawnCountdownText;
      });

      // Re-enter to verify death time is reset
      spectator.enterSpectatorMode();

      // Call update - it should use new death time
      spectator.updateSpectatorMode();

      // Respawn countdown should show near 3 seconds since we just re-entered
      expect(mockRespawnCountdownText.setText).toHaveBeenCalledWith('Respawning in 3.0...');
    });
  });

  describe('updateSpectatorMode', () => {
    it('should update respawn countdown text', () => {
      // Mock Date.now to control timing
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      spectator.enterSpectatorMode();

      // Advance time by 1 second
      vi.spyOn(Date, 'now').mockReturnValue(now + 1000);

      spectator.updateSpectatorMode();

      // Should show ~2 seconds remaining
      expect(mockRespawnCountdownText.setText).toHaveBeenCalledWith('Respawning in 2.0...');
    });

    it('should not update countdown when not in spectator mode', () => {
      spectator.updateSpectatorMode();

      // setText should not be called on respawnCountdownText since we're not spectating
      expect(mockRespawnCountdownText.setText).not.toHaveBeenCalled();
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
      // With lerp factor of 0.1, scrollX should move toward (500 - 960) from 0
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

    it('should update spectator text to show who is being watched', () => {
      const mockOtherPlayer = {
        id: 'other-player',
        position: { x: 500, y: 300 },
      };

      (mockPlayerManager.getLivingPlayers as ReturnType<typeof vi.fn>).mockReturnValue([mockOtherPlayer]);

      spectator.enterSpectatorMode();
      spectator.updateSpectatorMode();

      expect(mockSpectatorText.setText).toHaveBeenCalledWith('Spectating Player');
    });

    it('should show no players message when no living players available', () => {
      (mockPlayerManager.getLivingPlayers as ReturnType<typeof vi.fn>).mockReturnValue([]);

      spectator.enterSpectatorMode();
      spectator.updateSpectatorMode();

      expect(mockSpectatorText.setText).toHaveBeenCalledWith('No players to spectate');
    });

    it('should not update spectator text when only local player is alive (edge case)', () => {
      // Note: This is an edge case where local player is "alive" but in spectator mode
      // The code checks if livingPlayers.length > 0, then filters to otherPlayers
      // When only local player is alive, otherPlayers is empty but no text update happens
      // since the outer else only triggers when livingPlayers.length === 0
      const mockLocalPlayer = {
        id: 'local-player',
        position: { x: 100, y: 100 },
      };

      (mockPlayerManager.getLivingPlayers as ReturnType<typeof vi.fn>).mockReturnValue([mockLocalPlayer]);
      (mockPlayerManager.getLocalPlayerId as ReturnType<typeof vi.fn>).mockReturnValue('local-player');

      spectator.enterSpectatorMode();

      // Clear setText calls from enterSpectatorMode
      mockSpectatorText.setText.mockClear();

      spectator.updateSpectatorMode();

      // No text update happens in this edge case
      expect(mockSpectatorText.setText).not.toHaveBeenCalled();
    });

    it('should clamp countdown to 0 when time exceeds 3 seconds', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      spectator.enterSpectatorMode();

      // Advance time by 5 seconds (past 3 second respawn)
      vi.spyOn(Date, 'now').mockReturnValue(now + 5000);

      spectator.updateSpectatorMode();

      expect(mockRespawnCountdownText.setText).toHaveBeenCalledWith('Respawning in 0.0...');
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
  });

  describe('Cleanup', () => {
    it('should destroy spectator text when destroyed', () => {
      spectator.enterSpectatorMode();

      spectator.destroy();

      expect(mockSpectatorText.destroy).toHaveBeenCalled();
    });

    it('should destroy respawn countdown text when destroyed', () => {
      spectator.enterSpectatorMode();

      spectator.destroy();

      expect(mockRespawnCountdownText.destroy).toHaveBeenCalled();
    });

    it('should reset spectator state when destroyed', () => {
      spectator.enterSpectatorMode();
      expect(spectator.isActive()).toBe(true);

      spectator.destroy();

      expect(spectator.isActive()).toBe(false);
    });

    it('should handle destroy when not in spectator mode', () => {
      // Should not crash when destroying before entering spectator mode
      expect(() => {
        spectator.destroy();
      }).not.toThrow();

      // Texts should not be destroyed if never created
      expect(mockSpectatorText.destroy).not.toHaveBeenCalled();
      expect(mockRespawnCountdownText.destroy).not.toHaveBeenCalled();
    });
  });
});
