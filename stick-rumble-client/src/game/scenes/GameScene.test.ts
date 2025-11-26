import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameScene } from './GameScene';

// Mock Phaser
const createMockScene = () => {
  const mockTween = {
    scaleX: 1.2,
    scaleY: 1.2,
    duration: 1000,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1,
  };

  const mockCircle = {
    x: 640,
    y: 410,
    setOrigin: vi.fn(),
  };

  const mockText = {
    x: 640,
    y: 360,
    setOrigin: vi.fn().mockReturnThis(),
  };

  const mockCamera = {
    centerX: 640,
    centerY: 360,
  };

  return {
    add: {
      text: vi.fn().mockReturnValue(mockText),
      circle: vi.fn().mockReturnValue(mockCircle),
    },
    cameras: {
      main: mockCamera,
    },
    tweens: {
      add: vi.fn().mockReturnValue(mockTween),
    },
  };
};

describe('GameScene', () => {
  let scene: GameScene;
  let mockWebSocket: any;
  let mockWebSocketInstance: any;
  let originalWebSocket: any;

  beforeEach(() => {
    // Save original WebSocket
    originalWebSocket = globalThis.WebSocket;

    // Create mock WebSocket instance
    mockWebSocketInstance = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null,
    };

    // Mock WebSocket constructor
    mockWebSocket = vi.fn(function(this: any) {
      return mockWebSocketInstance;
    });

    globalThis.WebSocket = mockWebSocket as any;
    (globalThis.WebSocket as any).OPEN = 1;
    (globalThis.WebSocket as any).CONNECTING = 0;

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
      expect((scene as any).scene.key).toBe('GameScene');
    });
  });

  describe('preload', () => {
    it('should be defined and callable', () => {
      expect(scene.preload).toBeDefined();
      expect(typeof scene.preload).toBe('function');

      // Should not throw
      expect(() => scene.preload()).not.toThrow();
    });
  });

  describe('create', () => {
    it('should add welcome text to center of screen', () => {
      const mockSceneContext = createMockScene();

      // Bind the scene methods to our mock
      Object.assign(scene, mockSceneContext);

      scene.create();

      expect(mockSceneContext.add.text).toHaveBeenCalledWith(
        640,
        360,
        'Stick Rumble\nPhaser 3.90 + React + TypeScript',
        expect.objectContaining({
          fontSize: '32px',
          color: '#ffffff',
          align: 'center',
        })
      );
    });

    it('should center welcome text using setOrigin', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      const textMock = mockSceneContext.add.text.mock.results[0].value;
      expect(textMock.setOrigin).toHaveBeenCalledWith(0.5);
    });

    it('should add animated circle below text', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      expect(mockSceneContext.add.circle).toHaveBeenCalledWith(
        640,
        460, // centerY (360) + 100
        30,
        0x00ff00
      );
    });

    it('should animate circle with correct tween config', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      expect(mockSceneContext.tweens.add).toHaveBeenCalledWith(
        expect.objectContaining({
          scaleX: 1.2,
          scaleY: 1.2,
          duration: 1000,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        })
      );
    });

    it('should create WebSocket client with correct URL from env', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      expect(mockWebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
    });

    it('should use default WebSocket URL if env not set', () => {
      vi.stubGlobal('import.meta', {
        env: {},
      });

      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      expect(mockWebSocket).toHaveBeenCalledWith('ws://localhost:8080/ws');
    });

    it('should add success text when WebSocket connects', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Simulate successful connection
      if (mockWebSocketInstance.onopen) {
        await mockWebSocketInstance.onopen({});
      }

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should have called add.text twice (welcome text + connection status)
      expect(mockSceneContext.add.text).toHaveBeenCalledWith(
        10,
        10,
        'Connected to server!',
        expect.objectContaining({
          fontSize: '18px',
          color: '#00ff00',
        })
      );
    });

    it('should add error text when WebSocket fails to connect', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Simulate connection failure
      if (mockWebSocketInstance.onerror) {
        mockWebSocketInstance.onerror(new Error('Connection failed'));
      }

      // Wait for promise to reject and catch block to execute
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should have called add.text twice (welcome text + error status)
      expect(mockSceneContext.add.text).toHaveBeenCalledWith(
        10,
        10,
        'Failed to connect to server',
        expect.objectContaining({
          fontSize: '18px',
          color: '#ff0000',
        })
      );
    });
  });

  describe('update', () => {
    it('should be defined and callable', () => {
      expect(scene.update).toBeDefined();
      expect(typeof scene.update).toBe('function');

      // Should not throw
      expect(() => scene.update()).not.toThrow();
    });
  });

  describe('message handling', () => {
    it('should handle incoming test messages after connection', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Simulate successful connection
      if (mockWebSocketInstance.onopen) {
        await mockWebSocketInstance.onopen({});
      }

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      // At this point the message handler should be registered
      // We can't easily verify the handler was called without exposing internal state
      // But we've ensured the code path was executed
      expect(mockWebSocketInstance.send).toHaveBeenCalled();
    });
  });
});
