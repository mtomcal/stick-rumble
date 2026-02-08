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

describe('GameScene - Camera Follow', () => {
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

  describe('Camera Follow', () => {
    it('should start camera follow when local player sprite is created via player:move', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket
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

      // Mock playerManager.getLocalPlayerSprite to return a sprite
      const mockSprite = { x: 100, y: 100 };
      vi.spyOn(scene['playerManager'], 'getLocalPlayerSprite').mockReturnValue(mockSprite as any);
      vi.spyOn(scene['playerManager'], 'updatePlayers').mockImplementation(() => {});

      // Simulate player:move message
      const playerMoveMessage = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [
              { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } }
            ]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
      }

      // Verify camera.startFollow was called with the player sprite
      expect(mockSceneContext.cameras.main.startFollow).toHaveBeenCalledWith(
        mockSprite,
        true,
        0.1,
        0.1
      );
    });

    it('should not call startFollow multiple times (only once)', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket
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

      // Mock playerManager.getLocalPlayerSprite to return a sprite
      const mockSprite = { x: 100, y: 100 };
      vi.spyOn(scene['playerManager'], 'getLocalPlayerSprite').mockReturnValue(mockSprite as any);
      vi.spyOn(scene['playerManager'], 'updatePlayers').mockImplementation(() => {});

      // Simulate multiple player:move messages
      for (let i = 0; i < 5; i++) {
        const playerMoveMessage = {
          data: JSON.stringify({
            type: 'player:move',
            timestamp: Date.now(),
            data: {
              players: [
                { id: 'local-player', position: { x: 100 + i * 10, y: 200 }, velocity: { x: 0, y: 0 } }
              ]
            }
          })
        };

        if (mockWebSocketInstance.onmessage) {
          mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
        }
      }

      // Verify camera.startFollow was called only once
      expect(mockSceneContext.cameras.main.startFollow).toHaveBeenCalledTimes(1);
    });

    it('should stop camera follow when entering spectator mode', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket
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

      // Verify camera.stopFollow was called
      expect(mockSceneContext.cameras.main.stopFollow).toHaveBeenCalled();
    });

    it('should restart camera follow after respawn', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket
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

      // Mock playerManager.getLocalPlayerSprite to return a sprite
      const mockSprite = { x: 100, y: 100 };
      vi.spyOn(scene['playerManager'], 'getLocalPlayerSprite').mockReturnValue(mockSprite as any);
      vi.spyOn(scene['playerManager'], 'updatePlayers').mockImplementation(() => {});

      // First player:move to start following
      const playerMoveMessage1 = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [
              { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } }
            ]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage1 as MessageEvent);
      }

      // Verify initial follow
      expect(mockSceneContext.cameras.main.startFollow).toHaveBeenCalledTimes(1);

      // Simulate local player death (stops following)
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

      // Verify stop was called
      expect(mockSceneContext.cameras.main.stopFollow).toHaveBeenCalledTimes(1);

      // Simulate respawn
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

      // After respawn, next player:move should restart camera follow
      const playerMoveMessage2 = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [
              { id: 'local-player', position: { x: 500, y: 300 }, velocity: { x: 0, y: 0 } }
            ]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage2 as MessageEvent);
      }

      // Verify camera.startFollow was called again after respawn
      expect(mockSceneContext.cameras.main.startFollow).toHaveBeenCalledTimes(2);
    });

    it('should not start camera follow if no local player sprite exists', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Mock playerManager.getLocalPlayerSprite to return null (sprite not created yet)
      vi.spyOn(scene['playerManager'], 'getLocalPlayerSprite').mockReturnValue(null);
      vi.spyOn(scene['playerManager'], 'updatePlayers').mockImplementation(() => {});

      // Simulate player:move message
      const playerMoveMessage = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [
              { id: 'other-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } }
            ]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
      }

      // Verify camera.startFollow was NOT called
      expect(mockSceneContext.cameras.main.startFollow).not.toHaveBeenCalled();
    });

    it('should re-attach camera when sprite reference changes (recreated after delta destroy)', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket
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

      // Mock playerManager.getLocalPlayerSprite to return first sprite
      const mockSprite1 = { x: 100, y: 100 };
      const getSpriteSpy = vi.spyOn(scene['playerManager'], 'getLocalPlayerSprite');
      getSpriteSpy.mockReturnValue(mockSprite1 as any);
      vi.spyOn(scene['playerManager'], 'updatePlayers').mockImplementation(() => {});

      // First player:move - camera starts following sprite1
      const playerMoveMessage1 = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [
              { id: 'local-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } }
            ]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage1 as MessageEvent);
      }

      expect(mockSceneContext.cameras.main.startFollow).toHaveBeenCalledTimes(1);
      expect(mockSceneContext.cameras.main.startFollow).toHaveBeenCalledWith(
        mockSprite1, true, 0.1, 0.1
      );

      // Simulate sprite being recreated (different reference)
      const mockSprite2 = { x: 200, y: 200 };
      getSpriteSpy.mockReturnValue(mockSprite2 as any);

      // Second player:move - camera should re-attach to new sprite
      const playerMoveMessage2 = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [
              { id: 'local-player', position: { x: 200, y: 200 }, velocity: { x: 0, y: 0 } }
            ]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage2 as MessageEvent);
      }

      // Camera should have been re-attached (called twice total)
      expect(mockSceneContext.cameras.main.startFollow).toHaveBeenCalledTimes(2);
      expect(mockSceneContext.cameras.main.startFollow).toHaveBeenLastCalledWith(
        mockSprite2, true, 0.1, 0.1
      );
    });

    it('should center camera on arena initially', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Verify camera bounds match arena (1920x1080)
      expect(mockSceneContext.cameras.main.setBounds).toHaveBeenCalledWith(0, 0, 1920, 1080);
    });
  });
});
