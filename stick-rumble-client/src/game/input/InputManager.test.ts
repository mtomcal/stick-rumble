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
          SHIFT: 16,
        },
      },
    },
  },
}));

// Create mock Phaser scene with mouse support and camera
const createMockScene = () => {
  const mockKeys = {
    W: { isDown: false },
    A: { isDown: false },
    S: { isDown: false },
    D: { isDown: false },
    SHIFT: { isDown: false },
  };

  const mockActivePointer = {
    x: 0,
    y: 0,
    worldX: 0,
    worldY: 0,
  };

  // Mock camera with getWorldPoint method
  const mockCamera = {
    scrollX: 0,
    scrollY: 0,
    getWorldPoint: vi.fn((x: number, y: number) => {
      // Default implementation returns screen coords + scroll offset
      // This simulates basic coordinate transformation
      return {
        x: x + mockCamera.scrollX,
        y: y + mockCamera.scrollY,
      };
    }),
  };

  return {
    scene: mockKeys,
    input: {
      keyboard: {
        addKeys: vi.fn().mockReturnValue(mockKeys),
      },
      activePointer: mockActivePointer,
    },
    cameras: {
      main: mockCamera,
    },
    mockKeys,
    mockActivePointer,
    mockCamera,
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
        aimAngle: 0,
        isSprinting: false,
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
        SHIFT: expect.any(Number),
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
          aimAngle: expect.any(Number),
          isSprinting: false,
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
          aimAngle: expect.any(Number),
          isSprinting: false,
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
          aimAngle: expect.any(Number),
          isSprinting: false,
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
          aimAngle: expect.any(Number),
          isSprinting: false,
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
          aimAngle: expect.any(Number),
          isSprinting: false,
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
          aimAngle: expect.any(Number),
          isSprinting: false,
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
        aimAngle: expect.any(Number),
        isSprinting: false,
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

  describe('disable/enable', () => {
    beforeEach(() => {
      inputManager.init();
    });

    it('should disable input handling when disable() is called', () => {
      mockScene.mockKeys.W.isDown = true;

      // First update should send (enabled by default)
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);

      // Disable input
      inputManager.disable();

      // Release W and press D
      mockScene.mockKeys.W.isDown = false;
      mockScene.mockKeys.D.isDown = true;

      // Update should NOT send when disabled
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should enable input handling when enable() is called', () => {
      // Disable first
      inputManager.disable();

      mockScene.mockKeys.W.isDown = true;
      inputManager.update();
      expect(mockWsClient.send).not.toHaveBeenCalled();

      // Enable input
      inputManager.enable();

      // Now update should send
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledWith({
        type: 'input:state',
        timestamp: expect.any(Number),
        data: {
          up: true,
          down: false,
          left: false,
          right: false,
          aimAngle: expect.any(Number),
          isSprinting: false,
        },
      });
    });

    it('should be enabled by default', () => {
      mockScene.mockKeys.W.isDown = true;
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
    });

    it('should not send input when disabled even with state changes', () => {
      inputManager.disable();

      // Try various state changes
      mockScene.mockKeys.W.isDown = true;
      inputManager.update();
      mockScene.mockKeys.A.isDown = true;
      inputManager.update();
      mockScene.mockKeys.W.isDown = false;
      inputManager.update();

      // Should never send
      expect(mockWsClient.send).not.toHaveBeenCalled();
    });
  });

  describe('aim angle', () => {
    beforeEach(() => {
      inputManager.init();
    });

    it('should calculate aim angle based on mouse position relative to player', () => {
      // Set player position at center
      inputManager.setPlayerPosition(400, 300);

      // Mouse to the right of player (screen coordinates)
      mockScene.mockActivePointer.x = 500;
      mockScene.mockActivePointer.y = 300;

      inputManager.update();

      // Angle should be 0 (pointing right)
      expect(inputManager.getAimAngle()).toBeCloseTo(0, 2);

      // Verify getWorldPoint was called with screen coordinates
      expect(mockScene.mockCamera.getWorldPoint).toHaveBeenCalledWith(500, 300);
    });

    it('should calculate aim angle pointing up (negative Y)', () => {
      inputManager.setPlayerPosition(400, 300);

      // Mouse above player (screen coordinates)
      mockScene.mockActivePointer.x = 400;
      mockScene.mockActivePointer.y = 200;

      inputManager.update();

      // Angle should be -90 degrees (or -PI/2 radians)
      expect(inputManager.getAimAngle()).toBeCloseTo(-Math.PI / 2, 2);
    });

    it('should calculate aim angle pointing down', () => {
      inputManager.setPlayerPosition(400, 300);

      // Mouse below player (screen coordinates)
      mockScene.mockActivePointer.x = 400;
      mockScene.mockActivePointer.y = 400;

      inputManager.update();

      // Angle should be 90 degrees (or PI/2 radians)
      expect(inputManager.getAimAngle()).toBeCloseTo(Math.PI / 2, 2);
    });

    it('should calculate aim angle pointing left', () => {
      inputManager.setPlayerPosition(400, 300);

      // Mouse to the left of player (screen coordinates)
      mockScene.mockActivePointer.x = 300;
      mockScene.mockActivePointer.y = 300;

      inputManager.update();

      // Angle should be PI (pointing left)
      expect(Math.abs(inputManager.getAimAngle())).toBeCloseTo(Math.PI, 2);
    });

    it('should calculate aim angle for diagonal directions', () => {
      inputManager.setPlayerPosition(400, 300);

      // Mouse diagonally up-right (45 degrees, screen coordinates)
      mockScene.mockActivePointer.x = 500;
      mockScene.mockActivePointer.y = 200;

      inputManager.update();

      // Angle should be -45 degrees (or -PI/4 radians)
      expect(inputManager.getAimAngle()).toBeCloseTo(-Math.PI / 4, 2);
    });

    it('should include aim angle in input state message', () => {
      inputManager.setPlayerPosition(400, 300);

      // Mouse to the right (screen coordinates)
      mockScene.mockActivePointer.x = 500;
      mockScene.mockActivePointer.y = 300;

      // Press a key to trigger state change
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
          aimAngle: expect.any(Number),
          isSprinting: false,
        },
      });

      // Verify aim angle is approximately 0
      const call = mockWsClient.send.mock.calls[0][0];
      expect(call.data.aimAngle).toBeCloseTo(0, 2);
    });

    it('should send update when aim angle changes significantly', () => {
      inputManager.setPlayerPosition(400, 300);

      // Initial mouse position (screen coordinates)
      mockScene.mockActivePointer.x = 500;
      mockScene.mockActivePointer.y = 300;

      // Press key to trigger initial send
      mockScene.mockKeys.W.isDown = true;
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);

      // Move mouse significantly (more than threshold)
      mockScene.mockActivePointer.x = 400;
      mockScene.mockActivePointer.y = 200; // Now pointing up

      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(2);
    });

    it('should not send update for small aim angle changes', () => {
      inputManager.setPlayerPosition(400, 300);

      // Initial mouse position (screen coordinates)
      mockScene.mockActivePointer.x = 500;
      mockScene.mockActivePointer.y = 300;

      // Press key to trigger initial send
      mockScene.mockKeys.W.isDown = true;
      inputManager.update();
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);

      // Very small mouse movement (below threshold)
      mockScene.mockActivePointer.x = 501;
      mockScene.mockActivePointer.y = 301;

      inputManager.update();
      // Should not send because change is too small
      expect(mockWsClient.send).toHaveBeenCalledTimes(1);
    });

    it('should return 0 aim angle by default', () => {
      expect(inputManager.getAimAngle()).toBe(0);
    });

    it('should handle zero distance from player gracefully', () => {
      inputManager.setPlayerPosition(400, 300);

      // Mouse at exact player position (screen coordinates)
      mockScene.mockActivePointer.x = 400;
      mockScene.mockActivePointer.y = 300;

      inputManager.update();

      // Should not throw and should return last valid angle (0 by default)
      expect(() => inputManager.getAimAngle()).not.toThrow();
      expect(inputManager.getAimAngle()).toBe(0);
    });

    it('should use camera.getWorldPoint for coordinate transformation', () => {
      inputManager.setPlayerPosition(400, 300);

      // Set screen coordinates
      mockScene.mockActivePointer.x = 500;
      mockScene.mockActivePointer.y = 300;

      inputManager.update();

      // Verify getWorldPoint was called (not relying on worldX/worldY)
      expect(mockScene.mockCamera.getWorldPoint).toHaveBeenCalledWith(500, 300);
    });

    it('should handle camera scroll offset correctly', () => {
      // Set camera scroll offset
      mockScene.mockCamera.scrollX = 100;
      mockScene.mockCamera.scrollY = 50;

      // Player at (400, 300) in world space
      inputManager.setPlayerPosition(400, 300);

      // Mouse at (300, 250) in screen space
      // With scroll (100, 50), this becomes (400, 300) in world space
      mockScene.mockActivePointer.x = 300;
      mockScene.mockActivePointer.y = 250;

      inputManager.update();

      // getWorldPoint should be called with screen coordinates
      expect(mockScene.mockCamera.getWorldPoint).toHaveBeenCalledWith(300, 250);

      // With our mock, world point = (300 + 100, 250 + 50) = (400, 300)
      // This is same as player position, so angle shouldn't change (dx=0, dy=0)
      // The angle should remain at its previous value (0 by default)
      expect(inputManager.getAimAngle()).toBe(0);
    });
  });
});
