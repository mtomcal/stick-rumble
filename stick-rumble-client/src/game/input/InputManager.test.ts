import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InputManager } from './InputManager';
import type { WebSocketClient } from '../network/WebSocketClient';

// Mock Phaser KeyCodes
vi.mock('phaser', () => ({
  default: {
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

// Create mock Phaser scene
const createMockScene = () => {
  const mockKeys = {
    W: { isDown: false },
    A: { isDown: false },
    S: { isDown: false },
    D: { isDown: false },
  };

  return {
    scene: mockKeys,
    input: {
      keyboard: {
        addKeys: vi.fn().mockReturnValue(mockKeys),
      },
    },
    mockKeys,
  };
};

// Create mock WebSocketClient
const createMockWsClient = () => ({
  send: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
});

describe('InputManager', () => {
  let inputManager: InputManager;
  let mockScene: ReturnType<typeof createMockScene>;
  let mockWsClient: ReturnType<typeof createMockWsClient>;

  beforeEach(() => {
    mockScene = createMockScene();
    mockWsClient = createMockWsClient();
    inputManager = new InputManager(
      mockScene as unknown as Phaser.Scene,
      mockWsClient as unknown as WebSocketClient
    );
  });

  describe('constructor', () => {
    it('should initialize with default input state', () => {
      const state = inputManager.getState();
      expect(state).toEqual({
        up: false,
        down: false,
        left: false,
        right: false,
      });
    });
  });

  describe('init', () => {
    it('should setup WASD keys from scene input', () => {
      inputManager.init();

      expect(mockScene.input.keyboard.addKeys).toHaveBeenCalledWith({
        W: expect.any(Number),
        A: expect.any(Number),
        S: expect.any(Number),
        D: expect.any(Number),
      });
    });

    it('should handle missing keyboard input gracefully', () => {
      const sceneWithoutKeyboard = {
        input: {
          keyboard: null,
        },
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const manager = new InputManager(
        sceneWithoutKeyboard as unknown as Phaser.Scene,
        mockWsClient as unknown as WebSocketClient
      );

      expect(() => manager.init()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Keyboard input not available');

      consoleSpy.mockRestore();
    });

    it('should handle missing scene.input gracefully', () => {
      const sceneWithoutInput = {} as Phaser.Scene;

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const manager = new InputManager(
        sceneWithoutInput as unknown as Phaser.Scene,
        mockWsClient as unknown as WebSocketClient
      );

      expect(() => manager.init()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Keyboard input not available');

      consoleSpy.mockRestore();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      inputManager.init();
    });

    it('should not send input state if keys not initialized', () => {
      const uninitializedManager = new InputManager(
        mockScene as unknown as Phaser.Scene,
        mockWsClient as unknown as WebSocketClient
      );

      uninitializedManager.update();

      expect(mockWsClient.send).not.toHaveBeenCalled();
    });

    it('should send input state when W key is pressed', () => {
      mockScene.mockKeys.W.isDown = true;

      inputManager.update();

      expect(mockWsClient.send).toHaveBeenCalledWith({
        type: 'input:state',
        timestamp: expect.any(Number),
        data: {
          up: true,
          down: false,
          left: false,
          right: false,
        },
      });
    });

    it('should send input state when A key is pressed', () => {
      mockScene.mockKeys.A.isDown = true;

      inputManager.update();

      expect(mockWsClient.send).toHaveBeenCalledWith({
        type: 'input:state',
        timestamp: expect.any(Number),
        data: {
          up: false,
          down: false,
          left: true,
          right: false,
        },
      });
    });

    it('should send input state when S key is pressed', () => {
      mockScene.mockKeys.S.isDown = true;

      inputManager.update();

      expect(mockWsClient.send).toHaveBeenCalledWith({
        type: 'input:state',
        timestamp: expect.any(Number),
        data: {
          up: false,
          down: true,
          left: false,
          right: false,
        },
      });
    });

    it('should send input state when D key is pressed', () => {
      mockScene.mockKeys.D.isDown = true;

      inputManager.update();

      expect(mockWsClient.send).toHaveBeenCalledWith({
        type: 'input:state',
        timestamp: expect.any(Number),
        data: {
          up: false,
          down: false,
          left: false,
          right: true,
        },
      });
    });

    it('should send input state with multiple keys pressed', () => {
      mockScene.mockKeys.W.isDown = true;
      mockScene.mockKeys.D.isDown = true;

      inputManager.update();

      expect(mockWsClient.send).toHaveBeenCalledWith({
        type: 'input:state',
        timestamp: expect.any(Number),
        data: {
          up: true,
          down: false,
          left: false,
          right: true,
        },
      });
    });

    it('should not send input state if state has not changed', () => {
      // First update - sends initial state change
      mockScene.mockKeys.W.isDown = true;
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);

      // Second update - same state, should not send
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
    });

    it('should send input state when key is released', () => {
      // Press key
      mockScene.mockKeys.W.isDown = true;
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);

      // Release key
      mockScene.mockKeys.W.isDown = false;
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(2);

      expect(mockWsClient.send).toHaveBeenLastCalledWith({
        type: 'input:state',
        timestamp: expect.any(Number),
        data: {
          up: false,
          down: false,
          left: false,
          right: false,
        },
      });
    });

    it('should detect state changes for each key independently', () => {
      // Press W
      mockScene.mockKeys.W.isDown = true;
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);

      // Also press D (state changed)
      mockScene.mockKeys.D.isDown = true;
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(2);

      // Release W (state changed)
      mockScene.mockKeys.W.isDown = false;
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(3);

      // Same state (no change)
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(3);
    });
  });

  describe('getState', () => {
    beforeEach(() => {
      inputManager.init();
    });

    it('should return current input state', () => {
      mockScene.mockKeys.W.isDown = true;
      mockScene.mockKeys.A.isDown = true;

      inputManager.update();

      const state = inputManager.getState();
      expect(state).toEqual({
        up: true,
        down: false,
        left: true,
        right: false,
      });
    });

    it('should return a copy of the state (not reference)', () => {
      inputManager.update();

      const state1 = inputManager.getState();
      const state2 = inputManager.getState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe('destroy', () => {
    it('should be callable without error', () => {
      inputManager.init();
      expect(() => inputManager.destroy()).not.toThrow();
    });
  });
});
