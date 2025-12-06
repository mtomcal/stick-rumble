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

describe('GameScene - Player Movement', () => {
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

  describe('update', () => {
    it('should be defined and callable', () => {
      expect(scene.update).toBeDefined();
      expect(typeof scene.update).toBe('function');

      // Should not throw when called before create (inputManager not initialized)
      expect(() => scene.update(0, 16.67)).not.toThrow();
    });

    it('should call inputManager.update when connected', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Spy on inputManager.update to verify it gets called
      const updateSpy = vi.spyOn(scene['inputManager'], 'update');

      // Call scene.update which should call inputManager.update
      scene.update(0, 16.67);

      // Verify inputManager.update was called
      expect(updateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('message handling', () => {
    it('should handle player:move messages and update players', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Spy on PlayerManager.updatePlayers to verify it gets called
      const updatePlayersSpy = vi.spyOn(scene['playerManager'], 'updatePlayers');

      // Spy on InputManager.setPlayerPosition to verify aim calculation setup
      const setPlayerPositionSpy = vi.spyOn(scene['inputManager'], 'setPlayerPosition');

      // Simulate player:move message with aim angle
      const playerMoveMessage = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [
              { id: 'player1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 1.57 }
            ]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
      }

      // Verify PlayerManager.updatePlayers was called with correct data including aim angle
      expect(updatePlayersSpy).toHaveBeenCalledWith([
        { id: 'player1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, aimAngle: 1.57 }
      ]);

      // Verify InputManager.setPlayerPosition is NOT called (player ID doesn't match local player)
      expect(setPlayerPositionSpy).not.toHaveBeenCalled();
    });

    it('should update InputManager position when local player moves', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Set local player ID
      scene['playerManager'].setLocalPlayerId('local-player-id');

      // Spy on InputManager.setPlayerPosition and mock updatePlayers to avoid scene.add issues
      const setPlayerPositionSpy = vi.spyOn(scene['inputManager'], 'setPlayerPosition');
      const updatePlayersSpy = vi.spyOn(scene['playerManager'], 'updatePlayers').mockImplementation(() => {});

      // Simulate player:move message with local player
      const playerMoveMessage = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [
              { id: 'local-player-id', position: { x: 300, y: 400 }, velocity: { x: 10, y: 20 }, aimAngle: 0.5 }
            ]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
      }

      // Verify PlayerManager.updatePlayers was called with the correct data
      expect(updatePlayersSpy).toHaveBeenCalledWith([
        { id: 'local-player-id', position: { x: 300, y: 400 }, velocity: { x: 10, y: 20 }, aimAngle: 0.5 }
      ]);

      // Verify InputManager.setPlayerPosition was called with local player's position for aim calculation
      expect(setPlayerPositionSpy).toHaveBeenCalledWith(300, 400);
    });
  });

  describe('update with projectiles', () => {
    it('should update projectileManager on each frame', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Spy on projectileManager.update
      const updateSpy = vi.spyOn(scene['projectileManager'], 'update');

      // Call update with 16.67ms delta (60 FPS)
      scene.update(0, 16.67);

      // Verify projectileManager.update was called with delta in seconds
      expect(updateSpy).toHaveBeenCalledWith(0.01667);
    });
  });
});
