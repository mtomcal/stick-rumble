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
          SHIFT: 16,
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

    it('should update spectator mode when spectator is active', async () => {
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

      // Mock spectator to be active
      const mockSpectator = {
        isActive: vi.fn().mockReturnValue(true),
        updateSpectatorMode: vi.fn()
      };
      (scene as any).spectator = mockSpectator;

      // Call scene.update which should call spectator.updateSpectatorMode
      scene.update(0, 16.67);

      // Verify spectator mode was updated
      expect(mockSpectator.updateSpectatorMode).toHaveBeenCalled();
    });
  });

  describe('weapon proximity', () => {
    it('should return early if managers are not initialized', () => {
      // Call checkWeaponProximity without initializing managers
      expect(() => {
        (scene as any).checkWeaponProximity();
      }).not.toThrow();
    });

    it('should show pickup prompt when near a weapon crate', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Mock weapon crate manager to return a nearby crate
      const mockCrate = { id: 'crate-1', weaponType: 'shotgun' };
      const mockWeaponCrateManager = {
        checkProximity: vi.fn().mockReturnValue(mockCrate)
      };
      (scene as any).weaponCrateManager = mockWeaponCrateManager;

      // Mock pickup prompt UI
      const mockPickupPromptUI = {
        show: vi.fn(),
        hide: vi.fn()
      };
      (scene as any).pickupPromptUI = mockPickupPromptUI;

      // Mock player manager to return local player position
      const mockPlayerManager = {
        getLocalPlayerPosition: vi.fn().mockReturnValue({ x: 100, y: 100 })
      };
      (scene as any).playerManager = mockPlayerManager;

      // Call checkWeaponProximity
      (scene as any).checkWeaponProximity();

      // Verify pickup prompt was shown
      expect(mockPickupPromptUI.show).toHaveBeenCalledWith('shotgun');
      expect((scene as any).nearbyWeaponCrate).toEqual(mockCrate);
    });

    it('should hide pickup prompt when no weapon crate nearby', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Mock weapon crate manager to return no nearby crate
      const mockWeaponCrateManager = {
        checkProximity: vi.fn().mockReturnValue(null)
      };
      (scene as any).weaponCrateManager = mockWeaponCrateManager;

      // Mock pickup prompt UI
      const mockPickupPromptUI = {
        show: vi.fn(),
        hide: vi.fn()
      };
      (scene as any).pickupPromptUI = mockPickupPromptUI;

      // Mock player manager
      const mockPlayerManager = {
        getLocalPlayerPosition: vi.fn().mockReturnValue({ x: 100, y: 100 })
      };
      (scene as any).playerManager = mockPlayerManager;

      // Set initial nearby crate
      (scene as any).nearbyWeaponCrate = { id: 'crate-1', weaponType: 'shotgun' };

      // Call checkWeaponProximity
      (scene as any).checkWeaponProximity();

      // Verify pickup prompt was hidden
      expect(mockPickupPromptUI.hide).toHaveBeenCalled();
      expect((scene as any).nearbyWeaponCrate).toBeNull();
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

      // First send room:joined to set local player ID (required before player:move is processed)
      const roomJoinedMessage = {
        data: JSON.stringify({
          type: 'room:joined',
          timestamp: Date.now(),
          data: { playerId: 'local-player', roomId: 'room-1' }
        })
      };
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(roomJoinedMessage as MessageEvent);
      }

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
      ], { isDelta: false });

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
      ], { isDelta: false });

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

  describe('client-side prediction', () => {
    it('should run prediction each frame for local player (Story stick-rumble-nki)', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Set local player ID
      scene['playerManager'].setLocalPlayerId('local-player');

      // Add local player state via server message
      const roomJoinedMessage = {
        data: JSON.stringify({
          type: 'room:joined',
          timestamp: Date.now(),
          data: { playerId: 'local-player', roomId: 'room-1' }
        })
      };
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(roomJoinedMessage as MessageEvent);
      }

      // Send initial player position
      const playerMoveMessage = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [
              { id: 'local-player', position: { x: 500, y: 500 }, velocity: { x: 0, y: 0 } }
            ]
          }
        })
      };
      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
      }

      // Spy on prediction engine and player manager
      const predictPositionSpy = vi.spyOn(scene['predictionEngine'], 'predictPosition');
      const setLocalPlayerPredictedPositionSpy = vi.spyOn(scene['playerManager'], 'setLocalPlayerPredictedPosition');

      // Call scene.update which should run prediction for local player
      scene.update(0, 16.67);

      // Verify prediction ran
      expect(predictPositionSpy).toHaveBeenCalled();

      // Verify prediction was called with correct arguments
      const predictionCall = predictPositionSpy.mock.calls[0];
      expect(predictionCall[0]).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })); // position
      expect(predictionCall[1]).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) })); // velocity
      expect(predictionCall[2]).toEqual(expect.objectContaining({ up: expect.any(Boolean), down: expect.any(Boolean) })); // input state
      expect(predictionCall[3]).toBeCloseTo(0.01667, 4); // delta time in seconds

      // Verify predicted position was applied to player manager
      expect(setLocalPlayerPredictedPositionSpy).toHaveBeenCalled();
    });
  });
});
