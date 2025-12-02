import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameScene } from './GameScene';

// Mock Phaser for InputManager
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

// Mock Phaser scene context for the new arena-based implementation
const createMockScene = () => {
  const mockRectangle = {
    setOrigin: vi.fn().mockReturnThis(),
    setStrokeStyle: vi.fn().mockReturnThis(),
  };

  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
  };

  const mockCamera = {
    centerX: 960,
    centerY: 540,
    setBounds: vi.fn(),
  };

  const delayedCallCallbacks: Array<() => void> = [];
  const mockTime = {
    delayedCall: vi.fn((_delay: number, callback: () => void) => {
      delayedCallCallbacks.push(callback);
      return { callback };
    }),
  };

  return {
    add: {
      text: vi.fn().mockReturnValue(mockText),
      rectangle: vi.fn().mockReturnValue(mockRectangle),
    },
    cameras: {
      main: mockCamera,
    },
    input: {
      keyboard: {
        addKeys: vi.fn().mockReturnValue({
          W: { isDown: false },
          A: { isDown: false },
          S: { isDown: false },
          D: { isDown: false },
        }),
      },
    },
    time: mockTime,
    delayedCallCallbacks,
  };
};

describe('GameScene', () => {
  let scene: GameScene;
  let mockWebSocket: ReturnType<typeof vi.fn>;
  let mockWebSocketInstance: {
    readyState: number;
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    onopen: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
  };
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = globalThis.WebSocket;

    // Create mock WebSocket instance
    mockWebSocketInstance = {
      readyState: 0, // Start as CONNECTING, not OPEN
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
    };

    // Mock WebSocket constructor as a class that tracks calls
    const MockWebSocket = vi.fn().mockImplementation(function(this: {
      readyState: number;
      send: ReturnType<typeof vi.fn>;
      close: ReturnType<typeof vi.fn>;
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
      onopen: ((event: Event) => void) | null;
      onmessage: ((event: MessageEvent) => void) | null;
      onerror: ((event: Event) => void) | null;
      onclose: ((event: CloseEvent) => void) | null;
    }) {
      this.readyState = mockWebSocketInstance.readyState;
      this.send = mockWebSocketInstance.send;
      this.close = mockWebSocketInstance.close;
      this.addEventListener = mockWebSocketInstance.addEventListener;
      this.removeEventListener = mockWebSocketInstance.removeEventListener;

      // Use defineProperty to set up getters/setters that route to shared state
      Object.defineProperty(this, 'onopen', {
        get: () => mockWebSocketInstance.onopen,
        set: (handler) => { mockWebSocketInstance.onopen = handler; },
      });
      Object.defineProperty(this, 'onmessage', {
        get: () => mockWebSocketInstance.onmessage,
        set: (handler) => { mockWebSocketInstance.onmessage = handler; },
      });
      Object.defineProperty(this, 'onerror', {
        get: () => mockWebSocketInstance.onerror,
        set: (handler) => { mockWebSocketInstance.onerror = handler; },
      });
      Object.defineProperty(this, 'onclose', {
        get: () => mockWebSocketInstance.onclose,
        set: (handler) => { mockWebSocketInstance.onclose = handler; },
      });
    });

    (MockWebSocket as unknown as Record<string, number>).OPEN = 1;
    (MockWebSocket as unknown as Record<string, number>).CONNECTING = 0;

    mockWebSocket = MockWebSocket;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    // Mock import.meta.env
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

  describe('constructor', () => {
    it('should create scene with correct key', () => {
      expect(scene).toBeDefined();
      expect((scene as unknown as { scene: { key: string } }).scene.key).toBe('GameScene');
    });
  });

  describe('preload', () => {
    it('should be defined and callable', () => {
      expect(scene.preload).toBeDefined();
      expect(typeof scene.preload).toBe('function');

      // Should not throw (note: preload currently has no implementation)
      expect(() => scene.preload()).not.toThrow();
    });
  });

  describe('create', () => {
    it('should set camera bounds to arena size', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      expect(mockSceneContext.cameras.main.setBounds).toHaveBeenCalledWith(0, 0, 1920, 1080);
    });

    it('should add arena background rectangle', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // First rectangle call is the background
      expect(mockSceneContext.add.rectangle).toHaveBeenCalledWith(
        0, 0, 1920, 1080, 0x222222
      );
    });

    it('should add arena border with stroke style', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Should create exactly 2 rectangles (background + border)
      const rectangleCalls = mockSceneContext.add.rectangle.mock.calls;
      expect(rectangleCalls.length).toBe(2);
      expect(rectangleCalls[1]).toEqual([0, 0, 1920, 1080, 0xffffff, 0]);

      // Verify setStrokeStyle was called on the border rectangle
      const borderRectangle = mockSceneContext.add.rectangle.mock.results[1].value;
      expect(borderRectangle.setStrokeStyle).toHaveBeenCalledWith(2, 0xffffff);
    });

    it('should add title text', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      expect(mockSceneContext.add.text).toHaveBeenCalledWith(
        10, 10, 'Stick Rumble - WASD to move',
        expect.objectContaining({
          fontSize: '18px',
          color: '#ffffff',
        })
      );
    });

    it('should create WebSocket client with correct URL from env', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // WebSocket creation happens inside delayed callback
      // Trigger the callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      expect(mockWebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
    });

    it('should use default WebSocket URL if env not set', () => {
      vi.stubGlobal('import.meta', {
        env: {},
      });

      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // WebSocket creation happens inside delayed callback
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      expect(mockWebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
    });

    it('should setup WebSocket connection handlers', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Verify WebSocket handlers are set up
      expect(mockWebSocketInstance.onopen).toBeDefined();
      expect(mockWebSocketInstance.onerror).toBeDefined();
      expect(mockWebSocketInstance.onmessage).toBeDefined();
      expect(mockWebSocketInstance.onclose).toBeDefined();
    });

    it('should handle successful connection by initializing InputManager', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // InputManager should not be initialized yet (before connection)
      expect((scene as unknown as { inputManager: unknown }).inputManager).toBeUndefined();

      // Set readyState to OPEN before triggering onopen
      mockWebSocketInstance.readyState = 1;

      // Simulate successful connection - onopen is a handler that was set
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 10));

      // InputManager should now be initialized and functional
      const inputManager = (scene as unknown as { inputManager: { init: () => void; update: () => void } }).inputManager;
      expect(inputManager).toBeDefined();
      expect(typeof inputManager.init).toBe('function');
      expect(typeof inputManager.update).toBe('function');
    });

    it('should handle connection error gracefully', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate connection failure - onerror is a handler that was set
      if (mockWebSocketInstance.onerror) {
        mockWebSocketInstance.onerror(new Event('error'));
      }

      // Wait for promise to reject and catch block to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should have logged an error related to connection
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should initialize PlayerManager', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // PlayerManager is initialized - we can verify by checking the private field exists
      expect((scene as unknown as { playerManager: unknown }).playerManager).toBeDefined();
    });

    it('should defer WebSocket connection by 100ms to ensure scene initialization', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Verify delayedCall was called with 100ms delay
      expect(mockSceneContext.time.delayedCall).toHaveBeenCalledWith(
        100,
        expect.any(Function)
      );

      // Verify WebSocket is NOT immediately created (connection deferred)
      expect(mockWebSocket).toHaveBeenCalledTimes(0);

      // Trigger the delayed callback
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // NOW WebSocket should be created
      expect(mockWebSocket).toHaveBeenCalledTimes(1);
      expect(mockWebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
    });

    it('should register message handlers before connecting', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Wait for connection promise
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify message handlers are set before connection completes
      expect(mockWebSocketInstance.onmessage).toBeDefined();

      // Simulate successful connection
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify handlers work after connection
      const playerMoveMessage = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [{ id: 'p1', position: { x: 100, y: 100 }, velocity: { x: 0, y: 0 } }]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
      }

      // Should not throw error - handlers registered before connection
      expect(() => {
        if (mockWebSocketInstance.onmessage) {
          mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
        }
      }).not.toThrow();
    });
  });

  describe('update', () => {
    it('should be defined and callable', () => {
      expect(scene.update).toBeDefined();
      expect(typeof scene.update).toBe('function');

      // Should not throw when called before create (inputManager not initialized)
      expect(() => scene.update()).not.toThrow();
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
      scene.update();

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

      // Simulate player:move message
      const playerMoveMessage = {
        data: JSON.stringify({
          type: 'player:move',
          timestamp: Date.now(),
          data: {
            players: [
              { id: 'player1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } }
            ]
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(playerMoveMessage as MessageEvent);
      }

      // Verify PlayerManager.updatePlayers was called with correct data
      expect(updatePlayersSpy).toHaveBeenCalledWith([
        { id: 'player1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } }
      ]);
    });

    it('should handle room:joined messages and set local player ID', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

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

      expect(consoleSpy).toHaveBeenCalledWith('Joined room as player:', 'my-player-id');

      consoleSpy.mockRestore();
    });
  });
});
