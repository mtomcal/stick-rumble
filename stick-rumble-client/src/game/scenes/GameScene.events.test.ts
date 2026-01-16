import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameScene } from './GameScene';
import { createMockScene, createMockWebSocket } from './GameScene.test.setup';

// Mock Phaser for InputManager - MUST BE AT TOP LEVEL
vi.mock('phaser', () => ({
  default: {
    Scene: class {
      scene = { key: '' };
      constructor(config: { key: string }) {
        this.scene.key = config.key;
      }
    },
    Input: {
      Keyboard: {
        KeyCodes: {
          W: 87,
          A: 65,
          S: 83,
          D: 68,
        },
      },
    },
  },
}));

describe('GameScene - Events', () => {
  let scene: GameScene;
  let mockWebSocketInstance: ReturnType<typeof createMockWebSocket>['mockWebSocketInstance'];
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    const { MockWebSocket, mockWebSocketInstance: wsInstance } = createMockWebSocket();
    mockWebSocketInstance = wsInstance;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    vi.stubGlobal('import.meta', {
      env: {
        VITE_WS_URL: 'ws://localhost:8080/ws',
      },
    });

    scene = new GameScene();
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('message handling', () => {
    it('should handle room:joined messages and set local player ID', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate room:joined message - handlers are registered during create(), not just after connection
      const roomJoinedMessage = {
        data: JSON.stringify({
          type: 'room:joined',
          timestamp: Date.now(),
          data: {
            playerId: 'my-player-id'
          }
        })
      };

      // Trigger message handler directly
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(roomJoinedMessage as MessageEvent);
      }

      // Verify local player ID was set in PlayerManager
      expect(scene['playerManager'].getLocalPlayerId()).toBe('my-player-id');
    });

    it('should handle weapon:state messages and update shooting manager', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Connect successfully to initialize shootingManager
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      // Spy on shootingManager.updateWeaponState
      const updateWeaponStateSpy = vi.spyOn(scene['shootingManager'], 'updateWeaponState');

      // Simulate weapon:state message
      const weaponStateMessage = {
        data: JSON.stringify({
          type: 'weapon:state',
          timestamp: Date.now(),
          data: {
            currentAmmo: 10,
            maxAmmo: 15,
            isReloading: false,
            canShoot: true
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(weaponStateMessage as MessageEvent);
      }

      expect(updateWeaponStateSpy).toHaveBeenCalledWith({
        currentAmmo: 10,
        maxAmmo: 15,
        isReloading: false,
        canShoot: true
      });
    });

    it('should handle shoot:failed messages with empty reason', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate shoot:failed message with empty reason
      const shootFailedMessage = {
        data: JSON.stringify({
          type: 'shoot:failed',
          timestamp: Date.now(),
          data: {
            reason: 'empty'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(shootFailedMessage as MessageEvent);
      }

      expect(consoleSpy).toHaveBeenCalledWith('Click! Magazine empty');

      consoleSpy.mockRestore();
    });

    it('should not log for shoot:failed with non-empty reason', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate shoot:failed message with cooldown reason
      const shootFailedMessage = {
        data: JSON.stringify({
          type: 'shoot:failed',
          timestamp: Date.now(),
          data: {
            reason: 'cooldown'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(shootFailedMessage as MessageEvent);
      }

      // Should NOT log the empty click message
      expect(consoleSpy).not.toHaveBeenCalledWith('Click! Magazine empty');

      consoleSpy.mockRestore();
    });

    it('should handle match:ended messages and freeze gameplay', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Connect successfully to initialize inputManager and shootingManager
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      // Spy on disable methods
      const inputManagerDisableSpy = vi.spyOn(scene['inputManager'], 'disable');
      const shootingManagerDisableSpy = vi.spyOn(scene['shootingManager'], 'disable');

      // Simulate match:ended message
      const matchEndedMessage = {
        data: JSON.stringify({
          type: 'match:ended',
          timestamp: Date.now(),
          data: {
            winners: ['player-1', 'player-2'],
            finalScores: [
              { playerId: 'player-1', kills: 20, deaths: 5, xp: 300 },
              { playerId: 'player-2', kills: 20, deaths: 6, xp: 290 },
              { playerId: 'player-3', kills: 15, deaths: 10, xp: 200 }
            ],
            reason: 'kill_target'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(matchEndedMessage as MessageEvent);
      }

      // Verify console logs
      expect(consoleSpy).toHaveBeenCalledWith(
        'Match ended! Reason: kill_target, Winners:',
        ['player-1', 'player-2']
      );
      expect(consoleSpy).toHaveBeenCalledWith('Final scores:', [
        { playerId: 'player-1', kills: 20, deaths: 5, xp: 300 },
        { playerId: 'player-2', kills: 20, deaths: 6, xp: 290 },
        { playerId: 'player-3', kills: 15, deaths: 10, xp: 200 }
      ]);

      // Verify input freeze
      expect(inputManagerDisableSpy).toHaveBeenCalled();
      expect(shootingManagerDisableSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle match:ended with time_limit reason', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Connect successfully to initialize inputManager and shootingManager
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      // Simulate match:ended message with time_limit
      const matchEndedMessage = {
        data: JSON.stringify({
          type: 'match:ended',
          timestamp: Date.now(),
          data: {
            winners: ['player-1'],
            finalScores: [
              { playerId: 'player-1', kills: 18, deaths: 3, xp: 280 },
              { playerId: 'player-2', kills: 15, deaths: 5, xp: 220 }
            ],
            reason: 'time_limit'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(matchEndedMessage as MessageEvent);
      }

      // Verify console logs with time_limit reason
      expect(consoleSpy).toHaveBeenCalledWith(
        'Match ended! Reason: time_limit, Winners:',
        ['player-1']
      );

      consoleSpy.mockRestore();
    });
  });
});
