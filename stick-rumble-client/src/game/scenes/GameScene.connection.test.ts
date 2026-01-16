import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameScene } from './GameScene';
import { createMockScene, createMockWebSocket } from './GameScene.test.setup';

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

describe('GameScene - Connection & Initialization', () => {
  let scene: GameScene;
  let mockWebSocket: ReturnType<typeof vi.fn>;
  let mockWebSocketInstance: ReturnType<typeof createMockWebSocket>['mockWebSocketInstance'];
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = globalThis.WebSocket;

    // Create mock WebSocket
    const { MockWebSocket, mockWebSocketInstance: wsInstance } = createMockWebSocket();
    mockWebSocket = MockWebSocket;
    mockWebSocketInstance = wsInstance;
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

      // Should not throw and should load audio assets
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      expect(() => scene.preload()).not.toThrow();
      expect(mockSceneContext.load.audio).toHaveBeenCalledTimes(4);
      expect(mockSceneContext.load.audio).toHaveBeenCalledWith('uzi-fire', 'assets/audio/uzi-fire.mp3');
      expect(mockSceneContext.load.audio).toHaveBeenCalledWith('ak47-fire', 'assets/audio/ak47-fire.mp3');
      expect(mockSceneContext.load.audio).toHaveBeenCalledWith('shotgun-fire', 'assets/audio/shotgun-fire.mp3');
      expect(mockSceneContext.load.audio).toHaveBeenCalledWith('dodge-roll-whoosh', 'assets/audio/whoosh.mp3');
    });
  });

  describe('create', () => {
    it('should set world bounds to arena size', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      expect(mockSceneContext.physics.world.setBounds).toHaveBeenCalledWith(0, 0, 1920, 1080);
    });

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

      // Should create 5 rectangles (arena bg, arena border, health bar bg, health bar, damage flash)
      const rectangleCalls = mockSceneContext.add.rectangle.mock.calls;
      expect(rectangleCalls.length).toBe(5);
      // Second rectangle is the arena border
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

  describe('connection status display', () => {
    it('should display connection status text after successful connection', async () => {
      const mockSceneContext = createMockScene();
      mockSceneContext.input = {
        ...mockSceneContext.input,
        on: vi.fn(),
        keyboard: {
          addKey: vi.fn().mockReturnValue({ on: vi.fn() }),
          addKeys: mockSceneContext.input.keyboard.addKeys,
        },
      };
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to start connection (this creates WebSocket)
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Wait a tick for WebSocket setup
      await new Promise(resolve => setTimeout(resolve, 0));

      // Set readyState to OPEN and trigger onopen
      mockWebSocketInstance.readyState = 1;
      if (mockWebSocketInstance.onopen) {
        mockWebSocketInstance.onopen(new Event('open'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Check for green connection status text
      const textCalls = mockSceneContext.add.text.mock.calls;
      const connectionStatusCall = textCalls.find(
        (call: unknown[]) => {
          const text = call[2] as string | undefined;
          const style = call[3] as { color?: string } | undefined;
          return text?.includes('Connected') && style?.color === '#00ff00';
        }
      );
      expect(connectionStatusCall).toBeDefined();
    });

    it('should display error text after connection failure', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      scene.create();

      // Trigger the delayed callback to start connection
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate connection failure
      if (mockWebSocketInstance.onerror) {
        mockWebSocketInstance.onerror(new Event('error'));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      // Check for red error text
      const textCalls = mockSceneContext.add.text.mock.calls;
      const errorTextCall = textCalls.find(
        (call: unknown[]) => {
          const text = call[2] as string | undefined;
          const style = call[3] as { color?: string } | undefined;
          return text?.includes('Failed') && style?.color === '#ff0000';
        }
      );
      expect(errorTextCall).toBeDefined();

      consoleErrorSpy.mockRestore();
    });
  });
});
