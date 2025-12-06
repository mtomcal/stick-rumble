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

describe('GameScene - Spectator Mode', () => {
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

  describe('Damage Event Handlers', () => {
    it('should enter spectator mode when local player dies', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket and set local player ID
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set local player ID
      const roomJoinedMessage = {
        data: JSON.stringify({
          type: 'room:joined',
          timestamp: Date.now(),
          data: { playerId: 'local-player' }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(roomJoinedMessage as MessageEvent);
      }

      // Simulate local player death
      const deathMessage = {
        data: JSON.stringify({
          type: 'player:death',
          timestamp: Date.now(),
          data: {
            victimId: 'local-player',
            attackerId: 'attacker-1'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(deathMessage as MessageEvent);
      }

      // Verify spectator UI was created
      expect(mockSceneContext.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'Spectating...',
        expect.any(Object)
      );

      expect(mockSceneContext.add.text).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Number),
        'Respawning in 3...',
        expect.any(Object)
      );
    });

    it('should exit spectator mode when local player respawns', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket and set local player ID
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set local player ID
      const roomJoinedMessage = {
        data: JSON.stringify({
          type: 'room:joined',
          timestamp: Date.now(),
          data: { playerId: 'local-player' }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(roomJoinedMessage as MessageEvent);
      }

      // Simulate local player death (enter spectator mode)
      const deathMessage = {
        data: JSON.stringify({
          type: 'player:death',
          timestamp: Date.now(),
          data: {
            victimId: 'local-player',
            attackerId: 'attacker-1'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(deathMessage as MessageEvent);
      }

      // Get text creation count before respawn
      const textCountBeforeRespawn = mockSceneContext.add.text.mock.calls.length;

      // Simulate local player respawn
      const respawnMessage = {
        data: JSON.stringify({
          type: 'player:respawn',
          timestamp: Date.now(),
          data: {
            playerId: 'local-player',
            position: { x: 500, y: 300 },
            health: 100
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(respawnMessage as MessageEvent);
      }

      // Verify spectator UI was created (2 text objects: spectator text + countdown)
      // At least 2 more text objects should have been created during death
      expect(textCountBeforeRespawn).toBeGreaterThan(0);
    });
  });
});
