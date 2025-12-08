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

describe('GameScene - UI', () => {
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

  describe('ammo display', () => {
    it('should create ammo text display after connection', async () => {
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

      // Verify ammo text was created (multiple text calls: title, connection status, ammo)
      const textCalls = mockSceneContext.add.text.mock.calls;
      expect(textCalls.length).toBeGreaterThanOrEqual(3);

      // Check ammo text specifically (at position 10, 50)
      const ammoTextCall = textCalls.find((call: unknown[]) => call[0] === 10 && call[1] === 50);
      expect(ammoTextCall).toBeDefined();
    });

    it('should update ammo display when weapon:state received', async () => {
      const mockSceneContext = createMockScene();
      const mockAmmoText = {
        setText: vi.fn(),
        setOrigin: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
      };
      let textCallCount = 0;
      mockSceneContext.add.text = vi.fn().mockImplementation(() => {
        textCallCount++;
        // Fifth text call is the ammo display (after title, match timer, health bar text, connection status)
        if (textCallCount === 5) {
          return mockAmmoText;
        }
        return { setOrigin: vi.fn().mockReturnThis(), setScrollFactor: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setText: vi.fn(), setColor: vi.fn(), destroy: vi.fn() };
      });
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

      // Now send weapon:state message
      const weaponStateMessage = {
        data: JSON.stringify({
          type: 'weapon:state',
          timestamp: Date.now(),
          data: {
            currentAmmo: 10,
            maxAmmo: 15,
            isReloading: false,
            canShoot: true
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(weaponStateMessage as MessageEvent);
      }

      // Verify ammo text was updated
      expect(mockAmmoText.setText).toHaveBeenCalledWith('10/15');
    });

    it('should display RELOADING indicator when reloading', async () => {
      const mockSceneContext = createMockScene();
      const mockAmmoText = {
        setText: vi.fn(),
        setOrigin: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
      };
      let textCallCount = 0;
      mockSceneContext.add.text = vi.fn().mockImplementation(() => {
        textCallCount++;
        // Fifth text call is the ammo display (after title, match timer, health bar text, connection status)
        if (textCallCount === 5) {
          return mockAmmoText;
        }
        return { setOrigin: vi.fn().mockReturnThis(), setScrollFactor: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setText: vi.fn(), setColor: vi.fn(), destroy: vi.fn() };
      });
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

      // Send weapon:state with isReloading true
      const weaponStateMessage = {
        data: JSON.stringify({
          type: 'weapon:state',
          timestamp: Date.now(),
          data: {
            currentAmmo: 5,
            maxAmmo: 15,
            isReloading: true,
            canShoot: false
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(weaponStateMessage as MessageEvent);
      }

      // Verify ammo text shows reloading indicator
      expect(mockAmmoText.setText).toHaveBeenCalledWith('5/15 [RELOADING]');
    });
  });

  describe('message handling', () => {
    it('should handle match:timer messages and update timer display', async () => {
      const mockSceneContext = createMockScene();
      const mockTimerText = {
        setText: vi.fn(),
        setColor: vi.fn(),
        setOrigin: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };

      // Track text creation to identify match timer text (created during scene setup)
      let textCallCount = 0;
      mockSceneContext.add.text = vi.fn().mockImplementation(() => {
        textCallCount++;
        // Third text call is the match timer (after title text and health bar text)
        if (textCallCount === 3) {
          return mockTimerText;
        }
        return { setOrigin: vi.fn().mockReturnThis(), setText: vi.fn(), setColor: vi.fn(), setScrollFactor: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() };
      });

      Object.assign(scene, mockSceneContext);

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate match:timer message with 420 seconds (7:00)
      const timerMessage = {
        data: JSON.stringify({
          type: 'match:timer',
          timestamp: Date.now(),
          data: {
            remainingSeconds: 420
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(timerMessage as MessageEvent);
      }

      // Verify timer text was updated with formatted time
      expect(mockTimerText.setText).toHaveBeenCalledWith('7:00');

      // Verify color is white for > 2 minutes
      expect(mockTimerText.setColor).toHaveBeenCalledWith('#ffffff');
    });

    it('should update timer color to yellow when under 2 minutes', async () => {
      const mockSceneContext = createMockScene();
      const mockTimerText = {
        setText: vi.fn(),
        setColor: vi.fn(),
        setOrigin: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };

      let textCallCount = 0;
      mockSceneContext.add.text = vi.fn().mockImplementation(() => {
        textCallCount++;
        if (textCallCount === 3) {
          return mockTimerText;
        }
        return { setOrigin: vi.fn().mockReturnThis(), setText: vi.fn(), setColor: vi.fn(), setScrollFactor: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() };
      });

      Object.assign(scene, mockSceneContext);

      scene.create();

      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate match:timer message with 90 seconds (1:30)
      const timerMessage = {
        data: JSON.stringify({
          type: 'match:timer',
          timestamp: Date.now(),
          data: {
            remainingSeconds: 90
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(timerMessage as MessageEvent);
      }

      expect(mockTimerText.setText).toHaveBeenCalledWith('1:30');
      expect(mockTimerText.setColor).toHaveBeenCalledWith('#ffff00'); // Yellow
    });

    it('should update timer color to red when under 1 minute', async () => {
      const mockSceneContext = createMockScene();
      const mockTimerText = {
        setText: vi.fn(),
        setColor: vi.fn(),
        setOrigin: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };

      let textCallCount = 0;
      mockSceneContext.add.text = vi.fn().mockImplementation(() => {
        textCallCount++;
        if (textCallCount === 3) {
          return mockTimerText;
        }
        return { setOrigin: vi.fn().mockReturnThis(), setText: vi.fn(), setColor: vi.fn(), setScrollFactor: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() };
      });

      Object.assign(scene, mockSceneContext);

      scene.create();

      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate match:timer message with 30 seconds (0:30)
      const timerMessage = {
        data: JSON.stringify({
          type: 'match:timer',
          timestamp: Date.now(),
          data: {
            remainingSeconds: 30
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(timerMessage as MessageEvent);
      }

      expect(mockTimerText.setText).toHaveBeenCalledWith('0:30');
      expect(mockTimerText.setColor).toHaveBeenCalledWith('#ff0000'); // Red
    });

    it('should format timer correctly at 0:00', async () => {
      const mockSceneContext = createMockScene();
      const mockTimerText = {
        setText: vi.fn(),
        setColor: vi.fn(),
        setOrigin: vi.fn().mockReturnThis(),
        setScrollFactor: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      };

      let textCallCount = 0;
      mockSceneContext.add.text = vi.fn().mockImplementation(() => {
        textCallCount++;
        if (textCallCount === 3) {
          return mockTimerText;
        }
        return { setOrigin: vi.fn().mockReturnThis(), setText: vi.fn(), setColor: vi.fn(), setScrollFactor: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), destroy: vi.fn() };
      });

      Object.assign(scene, mockSceneContext);

      scene.create();

      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Simulate match:timer message with 0 seconds
      const timerMessage = {
        data: JSON.stringify({
          type: 'match:timer',
          timestamp: Date.now(),
          data: {
            remainingSeconds: 0
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(timerMessage as MessageEvent);
      }

      expect(mockTimerText.setText).toHaveBeenCalledWith('0:00');
      expect(mockTimerText.setColor).toHaveBeenCalledWith('#ff0000'); // Red
    });
  });

  describe('Health Bar UI', () => {
    it('should create health bar UI on scene creation', () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      scene.create();

      // Verify container was created (health bar uses container)
      expect(mockSceneContext.add.container).toHaveBeenCalled();
    });

    it('should update health bar when local player takes damage', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      // Create a mock updateHealth method
      const mockUpdateHealth = vi.fn();

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Wait for connection
      await vi.waitFor(() => {
        return mockWebSocketInstance !== null;
      });

      // Mock the health bar updateHealth method
      (scene as any).healthBarUI = { updateHealth: mockUpdateHealth };

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

      // Simulate local player taking damage
      const damagedMessage = {
        data: JSON.stringify({
          type: 'player:damaged',
          timestamp: Date.now(),
          data: {
            victimId: 'local-player',
            attackerId: 'attacker-1',
            damage: 25,
            newHealth: 75,
            projectileId: 'proj-1'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(damagedMessage as MessageEvent);
      }

      // Verify health bar was updated
      expect(mockUpdateHealth).toHaveBeenCalledWith(75, 100, false);
    });

    it('should not update health bar when other player takes damage', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      // Create a mock updateHealth method
      const mockUpdateHealth = vi.fn();

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Wait for connection
      await vi.waitFor(() => {
        return mockWebSocketInstance !== null;
      });

      // Mock the health bar updateHealth method
      (scene as any).healthBarUI = { updateHealth: mockUpdateHealth };

      // Set local player ID (this now triggers health bar initialization)
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

      // Verify room:joined initialized health bar to 100/100
      expect(mockUpdateHealth).toHaveBeenCalledWith(100, 100, false);
      expect(mockUpdateHealth).toHaveBeenCalledTimes(1);

      // Reset mock to check damage message behavior
      mockUpdateHealth.mockClear();

      // Simulate other player taking damage
      const damagedMessage = {
        data: JSON.stringify({
          type: 'player:damaged',
          timestamp: Date.now(),
          data: {
            victimId: 'other-player',
            attackerId: 'attacker-1',
            damage: 25,
            newHealth: 75,
            projectileId: 'proj-1'
          }
        })
      };

      if (mockWebSocketInstance.onmessage) {
        mockWebSocketInstance.onmessage(damagedMessage as MessageEvent);
      }

      // Verify health bar was NOT updated by the damage message (other player's damage)
      expect(mockUpdateHealth).not.toHaveBeenCalled();
    });

    it('should reset health bar to full on respawn', async () => {
      const mockSceneContext = createMockScene();
      Object.assign(scene, mockSceneContext);

      // Create a mock updateHealth method
      const mockUpdateHealth = vi.fn();

      scene.create();

      // Trigger the delayed callback to create WebSocket
      if (mockSceneContext.delayedCallCallbacks.length > 0) {
        mockSceneContext.delayedCallCallbacks[0]();
      }

      // Wait for connection
      await vi.waitFor(() => {
        return mockWebSocketInstance !== null;
      });

      // Mock the health bar updateHealth method
      (scene as any).healthBarUI = { updateHealth: mockUpdateHealth };

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

      // Verify health bar was updated to full health
      expect(mockUpdateHealth).toHaveBeenCalledWith(100, 100, false);
    });
  });
});
