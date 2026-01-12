/**
 * Tests for WebSocketClient message validation with JSON Schema
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketClient } from './WebSocketClient';
import type {
  InputStateData,
  PlayerShootData,
  WeaponPickupAttemptData,
} from '@stick-rumble/events-schema';

describe('WebSocketClient Schema Validation', () => {
  let client: WebSocketClient;
  let mockWebSocketInstance: any;
  let originalWebSocket: any;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Save original WebSocket
    originalWebSocket = globalThis.WebSocket;

    // Create mock WebSocket instance
    mockWebSocketInstance = {
      readyState: 1, // WebSocket.OPEN
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
    const mockWebSocket = vi.fn(function (this: any) {
      return mockWebSocketInstance;
    });

    globalThis.WebSocket = mockWebSocket as any;
    (globalThis.WebSocket as any).OPEN = 1;

    // Spy on console methods
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    client = new WebSocketClient('ws://localhost:8080/ws', true);

    // Connect the client
    const connectPromise = client.connect();
    if (mockWebSocketInstance.onopen) {
      mockWebSocketInstance.onopen();
    }
    await connectPromise;
  });

  afterEach(() => {
    client.disconnect();
    globalThis.WebSocket = originalWebSocket;
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('sendInputState', () => {
    it('should send valid input state message', () => {
      const inputState: InputStateData = {
        up: true,
        down: false,
        left: false,
        right: true,
        aimAngle: 1.57,
      };

      client.sendInputState(inputState);

      expect(mockWebSocketInstance.send).toHaveBeenCalledOnce();
      const sentMessage = JSON.parse(mockWebSocketInstance.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('input:state');
      expect(sentMessage.data).toEqual(inputState);
      expect(sentMessage.timestamp).toBeGreaterThan(0);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should reject invalid input state with missing fields', () => {
      const invalidState = {
        up: true,
        down: false,
        // missing left, right, aimAngle
      } as any;

      client.sendInputState(invalidState);

      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed for input:state'),
        expect.any(Array)
      );
    });

    it('should reject invalid input state with wrong types', () => {
      const invalidState = {
        up: 'true', // should be boolean
        down: false,
        left: false,
        right: true,
        aimAngle: 1.57,
      } as any;

      client.sendInputState(invalidState);

      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed for input:state'),
        expect.any(Array)
      );
    });

    it('should reject input state with non-numeric aimAngle', () => {
      const invalidState = {
        up: true,
        down: false,
        left: false,
        right: true,
        aimAngle: 'not-a-number' as any,
      };

      client.sendInputState(invalidState);

      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('sendShoot', () => {
    it('should send valid shoot message', () => {
      const shootData: PlayerShootData = {
        aimAngle: 3.14,
      };

      client.sendShoot(shootData);

      expect(mockWebSocketInstance.send).toHaveBeenCalledOnce();
      const sentMessage = JSON.parse(mockWebSocketInstance.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('player:shoot');
      expect(sentMessage.data).toEqual(shootData);
      expect(sentMessage.timestamp).toBeGreaterThan(0);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should reject shoot message with missing aimAngle', () => {
      const invalidData = {} as any;

      client.sendShoot(invalidData);

      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed for player:shoot'),
        expect.any(Array)
      );
    });

    it('should reject shoot message with non-numeric aimAngle', () => {
      const invalidData = {
        aimAngle: 'invalid' as any,
      };

      client.sendShoot(invalidData);

      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('sendReload', () => {
    it('should send valid reload message', () => {
      client.sendReload();

      expect(mockWebSocketInstance.send).toHaveBeenCalledOnce();
      const sentMessage = JSON.parse(mockWebSocketInstance.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('player:reload');
      expect(sentMessage.data).toBeUndefined();
      expect(sentMessage.timestamp).toBeGreaterThan(0);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('sendWeaponPickupAttempt', () => {
    it('should send valid weapon pickup attempt message', () => {
      const pickupData: WeaponPickupAttemptData = {
        crateId: 'crate-123',
      };

      client.sendWeaponPickupAttempt(pickupData);

      expect(mockWebSocketInstance.send).toHaveBeenCalledOnce();
      const sentMessage = JSON.parse(mockWebSocketInstance.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('weapon:pickup_attempt');
      expect(sentMessage.data).toEqual(pickupData);
      expect(sentMessage.timestamp).toBeGreaterThan(0);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should reject weapon pickup with missing crateId', () => {
      const invalidData = {} as any;

      client.sendWeaponPickupAttempt(invalidData);

      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed for weapon:pickup_attempt'),
        expect.any(Array)
      );
    });

    it('should reject weapon pickup with empty crateId', () => {
      const invalidData = {
        crateId: '',
      };

      client.sendWeaponPickupAttempt(invalidData);

      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should reject weapon pickup with non-string crateId', () => {
      const invalidData = {
        crateId: 123 as any,
      };

      client.sendWeaponPickupAttempt(invalidData);

      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('send (fallback for legacy usage)', () => {
    it('should still support legacy send method', () => {
      const message = {
        type: 'test',
        timestamp: Date.now(),
        data: { test: true },
      };

      client.send(message);

      expect(mockWebSocketInstance.send).toHaveBeenCalledOnce();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should warn when WebSocket is not connected', () => {
      mockWebSocketInstance.readyState = 0; // CONNECTING
      const message = {
        type: 'test',
        timestamp: Date.now(),
      };

      client.send(message);

      expect(mockWebSocketInstance.send).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('WebSocket not connected')
      );
    });
  });

  describe('edge cases', () => {
    it('should handle all boolean combinations for input state', () => {
      const testCases = [
        { up: false, down: false, left: false, right: false, aimAngle: 0 },
        { up: true, down: true, left: true, right: true, aimAngle: 3.14 },
        { up: true, down: false, left: true, right: false, aimAngle: -1.57 },
      ];

      testCases.forEach((testCase) => {
        client.sendInputState(testCase);
      });

      expect(mockWebSocketInstance.send).toHaveBeenCalledTimes(3);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle various numeric aimAngle values', () => {
      const testCases = [0, 1.57, 3.14, -1.57, 6.28, Math.PI];

      testCases.forEach((aimAngle) => {
        client.sendShoot({ aimAngle });
      });

      expect(mockWebSocketInstance.send).toHaveBeenCalledTimes(6);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle various valid crateId formats', () => {
      const testCases = ['crate-123', 'CRATE_456', 'abc', 'a1b2c3'];

      testCases.forEach((crateId) => {
        client.sendWeaponPickupAttempt({ crateId });
      });

      expect(mockWebSocketInstance.send).toHaveBeenCalledTimes(4);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
