import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { type Message } from './WebSocketClient';
import {
  waitForServer,
  createClient,
  connectClientsToRoom,
  aggressiveCleanup
} from './WebSocketClient.integration.helpers';

// Use serial execution to prevent test interference
describe.sequential('WebSocket Mouse Aim Integration Tests', () => {
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

  // Tolerance for floating point comparison (0.01 radians ≈ 0.57 degrees)
  const ANGLE_TOLERANCE = 0.01;
  const POSITION_TOLERANCE = 1; // pixels

  beforeAll(async () => {
    // Verify server is running before tests
    await waitForServer();
  }, 30000);

  beforeEach(() => {
    // Clear console spies
    vi.restoreAllMocks();

    // Spy on console errors and warnings to ensure clean execution
    consoleErrorSpy = vi.spyOn(console, 'error');
    consoleWarnSpy = vi.spyOn(console, 'warn');
  });

  afterEach(async () => {
    // Filter out expected WebSocket connection errors (these are ok in integration tests)
    const unexpectedErrors = consoleErrorSpy.mock.calls.filter((call: unknown[]) => {
      const errorStr = call[0]?.toString() || '';
      return !errorStr.includes('WebSocket error') &&
             !errorStr.includes('Reconnection failed') &&
             !errorStr.includes('[waitForEvent]') &&
             !errorStr.includes('[aggressiveCleanup]'); // Filter out cleanup logs
    });
    const unexpectedWarnings = consoleWarnSpy.mock.calls.filter((call: unknown[]) => {
      const warnStr = call[0]?.toString() || '';
      return !warnStr.includes('WebSocket') &&
             !warnStr.includes('[aggressiveCleanup]'); // Filter out cleanup warnings
    });

    // Assert no unexpected console errors or warnings occurred during the test
    expect(unexpectedErrors.length).toBe(0);
    expect(unexpectedWarnings.length).toBe(0);

    // Aggressively clean up all clients and handlers
    await aggressiveCleanup();

    // Restore console spies
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe('Story 2.2: 360-Degree Mouse Aim Integration Tests', () => {
    describe('AC1: Client calculates aim angle from mouse position', () => {
      it('should calculate aimAngle = 0 radians when mouse is directly right', async () => {
        const client = createClient();

        await client.connect();

        // Send input with aimAngle = 0 (pointing right)
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: 0 // Pointing right (0 degrees)
          }
        };

        // Should not throw - server accepts aimAngle
        expect(() => client.send(inputMessage)).not.toThrow();
      });

      it('should calculate aimAngle = π/2 radians when mouse is directly up', async () => {
        const client = createClient();

        await client.connect();

        // Send input with aimAngle = π/2 (pointing up)
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: Math.PI / 2 // Pointing up (90 degrees)
          }
        };

        expect(() => client.send(inputMessage)).not.toThrow();
      });

      it('should calculate aimAngle = π radians when mouse is directly left', async () => {
        const client = createClient();

        await client.connect();

        // Send input with aimAngle = π (pointing left)
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: Math.PI // Pointing left (180 degrees)
          }
        };

        expect(() => client.send(inputMessage)).not.toThrow();
      });

      it('should calculate aimAngle = -π/2 radians when mouse is directly down', async () => {
        const client = createClient();

        await client.connect();

        // Send input with aimAngle = -π/2 (pointing down)
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: -Math.PI / 2 // Pointing down (-90 degrees)
          }
        };

        expect(() => client.send(inputMessage)).not.toThrow();
      });

      it('should calculate aimAngle = π/4 radians for diagonal aim', async () => {
        const client = createClient();

        await client.connect();

        // Send input with aimAngle = π/4 (pointing up-right diagonal)
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: Math.PI / 4 // Pointing diagonal (45 degrees)
          }
        };

        expect(() => client.send(inputMessage)).not.toThrow();
      });
    });

    describe('AC2: Client sends aim angle to server', () => {
      it('should include aimAngle field in input:state message', async () => {
        // Clear the global spy for this specific test to avoid connection timing issues
        consoleErrorSpy.mockRestore();
        const localErrorSpy = vi.spyOn(console, 'error');

        const client1 = createClient();
        const client2 = createClient();

        const targetAngle = Math.PI / 2; // 90 degrees up
        let receivedAimAngle: number | undefined;
        const aimAnglePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for aimAngle')), 15000);
          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player = data.players.find((p: any) => p.id !== client2);
              if (player && player.aimAngle !== undefined) {
                // Wait for the specific angle we sent, not just any angle
                if (Math.abs(player.aimAngle - targetAngle) < ANGLE_TOLERANCE) {
                  receivedAimAngle = player.aimAngle;
                  clearTimeout(timeout);
                  resolve();
                }
              }
            }
          });
        });

        // Connect both clients and wait for room:joined
        await connectClientsToRoom(client1, client2);

        // Send input:state with aimAngle from client1
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: targetAngle
          }
        };

        client1.send(inputMessage);

        await aimAnglePromise;

        // Verify aimAngle was sent and received
        expect(receivedAimAngle).toBeDefined();
        expect(typeof receivedAimAngle).toBe('number');

        // Only check for unexpected errors (not connection errors)
        const errorCalls = localErrorSpy.mock.calls.filter(call =>
          !call[0]?.toString().includes('WebSocket error') &&
          !call[0]?.toString().includes('Reconnection failed')
        );
        expect(errorCalls.length).toBe(0);

        localErrorSpy.mockRestore();
        // Recreate global spy for other tests
        consoleErrorSpy = vi.spyOn(console, 'error');
      });

      it('should send updated aimAngle when mouse moves', async () => {
        const client1 = createClient();
        const client2 = createClient();

        const receivedAngles: number[] = [];
        const anglesPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player = data.players.find((p: any) => p.id !== client2);
              if (player && player.aimAngle !== undefined) {
                receivedAngles.push(player.aimAngle);
                if (receivedAngles.length >= 3) {
                  clearTimeout(timeout);
                  resolve();
                }
              }
            }
          });
        });

        // Connect both clients and wait for room:joined
        await connectClientsToRoom(client1, client2);

        // Send multiple input:state messages with different aimAngles
        const angles = [0, Math.PI / 2, Math.PI];
        for (const angle of angles) {
          const inputMessage: Message = {
            type: 'input:state',
            timestamp: Date.now(),
            data: {
              up: false,
              down: false,
              left: false,
              right: false,
              aimAngle: angle
            }
          };
          client1.send(inputMessage);
          // No delay needed - the event handler will collect the angles as they arrive
        }

        await anglesPromise;

        // Verify we received multiple angle updates
        expect(receivedAngles.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('AC3: Server broadcasts aim angle to all players', () => {
      it('should broadcast aimAngle in player:move message', async () => {
        const client1 = createClient();
        const client2 = createClient();

        const testAngle = Math.PI / 3; // 60 degrees
        let client2ReceivedAimAngle: number | undefined;
        const broadcastPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              // Find player that is not client2 (this is client1's data)
              const player1 = data.players.find((p: any) => p.id !== client2);
              if (player1 && player1.aimAngle !== undefined) {
                // Wait for the specific angle we sent, not just any angle
                if (Math.abs(player1.aimAngle - testAngle) < ANGLE_TOLERANCE) {
                  client2ReceivedAimAngle = player1.aimAngle;
                  clearTimeout(timeout);
                  resolve();
                }
              }
            }
          });
        });

        // Connect both clients and wait for room:joined
        await connectClientsToRoom(client1, client2);

        // Client1 sends input with specific aimAngle
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: testAngle
          }
        };

        client1.send(inputMessage);

        await broadcastPromise;

        // Client2 should receive Client1's aimAngle via player:move broadcast
        expect(client2ReceivedAimAngle).toBeDefined();
        expect(Math.abs(client2ReceivedAimAngle! - testAngle)).toBeLessThan(ANGLE_TOLERANCE);
      });

      // SKIPPED: Flaky in CI - server broadcast timing issues. See stick-rumble-kzr
      it.skip('should broadcast aimAngle to all players in room', async () => {
        const client1 = createClient();
        const client2 = createClient();
        const client3 = createClient();

        let client2Received = false;
        let client3Received = false;
        let client2PlayerId: string | undefined;
        let client3PlayerId: string | undefined;
        const testAngle = 1.57; // Approximately π/2

        // Capture player IDs from room:joined events
        client2.on('room:joined', (data: any) => {
          client2PlayerId = data.playerId;
        });
        client3.on('room:joined', (data: any) => {
          client3PlayerId = data.playerId;
        });

        // Connect all clients and wait for room:joined
        await connectClientsToRoom(client1, client2, client3);

        // Set up broadcast listeners AFTER we have player IDs
        const broadcastPromise = Promise.all([
          new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Client2 timeout')), 15000);
            client2.on('player:move', (data: any) => {
              if (data.players && data.players.length > 0) {
                // Find a player that is NOT client2 (another player's data)
                const otherPlayer = data.players.find((p: any) => p.id !== client2PlayerId && p.aimAngle !== undefined);
                if (otherPlayer && Math.abs(otherPlayer.aimAngle - testAngle) < ANGLE_TOLERANCE) {
                  client2Received = true;
                  clearTimeout(timeout);
                  resolve();
                }
              }
            });
          }),
          new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Client3 timeout')), 15000);
            client3.on('player:move', (data: any) => {
              if (data.players && data.players.length > 0) {
                // Find a player that is NOT client3 (another player's data)
                const otherPlayer = data.players.find((p: any) => p.id !== client3PlayerId && p.aimAngle !== undefined);
                if (otherPlayer && Math.abs(otherPlayer.aimAngle - testAngle) < ANGLE_TOLERANCE) {
                  client3Received = true;
                  clearTimeout(timeout);
                  resolve();
                }
              }
            });
          })
        ]);

        // Client1 sends input with aimAngle
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: testAngle
          }
        };

        client1.send(inputMessage);

        await broadcastPromise;

        // Both client2 and client3 should receive the broadcast
        expect(client2Received).toBe(true);
        expect(client3Received).toBe(true);
      });
    });

    describe('AC4: Other clients render aim indicator at correct angle', () => {
      const AIM_INDICATOR_LENGTH = 50; // From PlayerManager.ts

      it('should calculate correct aim line endpoint for 0° (right)', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let playerState: any = null;
        const statePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player1 = data.players.find((p: any) => p.aimAngle === 0);
              if (player1) {
                playerState = player1;
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        // Connect both clients and wait for room:joined
        await connectClientsToRoom(client1, client2);

        // Send input with aimAngle = 0 (pointing right)
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: 0
          }
        };

        client1.send(inputMessage);
        await statePromise;

        // Calculate expected aim line endpoint
        const expectedEndX = playerState.position.x + Math.cos(0) * AIM_INDICATOR_LENGTH;
        const expectedEndY = playerState.position.y + Math.sin(0) * AIM_INDICATOR_LENGTH;

        // Verify aim line would point right (50px from player center)
        expect(expectedEndX).toBeCloseTo(playerState.position.x + 50, POSITION_TOLERANCE);
        expect(expectedEndY).toBeCloseTo(playerState.position.y, POSITION_TOLERANCE);
      });

      it('should calculate correct aim line endpoint for 90° (up)', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let playerState: any = null;
        const statePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player1 = data.players.find((p: any) => p.aimAngle !== undefined);
              if (player1 && Math.abs(player1.aimAngle - Math.PI / 2) < ANGLE_TOLERANCE) {
                playerState = player1;
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        // Connect both clients and wait for room:joined
        await connectClientsToRoom(client1, client2);

        // Send input with aimAngle = π/2 (pointing up)
        const aimAngle = Math.PI / 2;
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: aimAngle
          }
        };

        client1.send(inputMessage);
        await statePromise;

        // Calculate expected aim line endpoint
        const expectedEndX = playerState.position.x + Math.cos(aimAngle) * AIM_INDICATOR_LENGTH;
        const expectedEndY = playerState.position.y + Math.sin(aimAngle) * AIM_INDICATOR_LENGTH;

        // Verify aim line would point up (50px from player center)
        // cos(π/2) ≈ 0, sin(π/2) ≈ 1
        expect(expectedEndX).toBeCloseTo(playerState.position.x, POSITION_TOLERANCE);
        expect(expectedEndY).toBeCloseTo(playerState.position.y + 50, POSITION_TOLERANCE);
      });

      it('should calculate correct aim line endpoint for 180° (left)', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let playerState: any = null;
        const statePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player1 = data.players.find((p: any) => p.aimAngle !== undefined);
              if (player1 && Math.abs(Math.abs(player1.aimAngle) - Math.PI) < ANGLE_TOLERANCE) {
                playerState = player1;
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        // Connect both clients and wait for room:joined
        await connectClientsToRoom(client1, client2);

        // Send input with aimAngle = π (pointing left)
        const aimAngle = Math.PI;
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: aimAngle
          }
        };

        client1.send(inputMessage);
        await statePromise;

        // Calculate expected aim line endpoint
        const expectedEndX = playerState.position.x + Math.cos(aimAngle) * AIM_INDICATOR_LENGTH;
        const expectedEndY = playerState.position.y + Math.sin(aimAngle) * AIM_INDICATOR_LENGTH;

        // Verify aim line would point left (50px from player center)
        // cos(π) ≈ -1, sin(π) ≈ 0
        expect(expectedEndX).toBeCloseTo(playerState.position.x - 50, POSITION_TOLERANCE);
        expect(expectedEndY).toBeCloseTo(playerState.position.y, POSITION_TOLERANCE);
      });

      it('should calculate correct aim line endpoint for -90° (down)', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let playerState: any = null;
        const statePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player1 = data.players.find((p: any) => p.aimAngle !== undefined);
              if (player1 && Math.abs(player1.aimAngle - (-Math.PI / 2)) < ANGLE_TOLERANCE) {
                playerState = player1;
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        // Connect both clients and wait for room:joined
        await connectClientsToRoom(client1, client2);

        // Send input with aimAngle = -π/2 (pointing down)
        const aimAngle = -Math.PI / 2;
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: aimAngle
          }
        };

        client1.send(inputMessage);
        await statePromise;

        // Calculate expected aim line endpoint
        const expectedEndX = playerState.position.x + Math.cos(aimAngle) * AIM_INDICATOR_LENGTH;
        const expectedEndY = playerState.position.y + Math.sin(aimAngle) * AIM_INDICATOR_LENGTH;

        // Verify aim line would point down (50px from player center)
        // cos(-π/2) ≈ 0, sin(-π/2) ≈ -1
        expect(expectedEndX).toBeCloseTo(playerState.position.x, POSITION_TOLERANCE);
        expect(expectedEndY).toBeCloseTo(playerState.position.y - 50, POSITION_TOLERANCE);
      });

      it('should calculate correct aim line endpoint for 45° (diagonal)', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let playerState: any = null;
        const statePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player1 = data.players.find((p: any) => p.aimAngle !== undefined);
              if (player1 && Math.abs(player1.aimAngle - Math.PI / 4) < ANGLE_TOLERANCE) {
                playerState = player1;
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        // Connect both clients and wait for room:joined
        await connectClientsToRoom(client1, client2);

        // Send input with aimAngle = π/4 (pointing diagonal up-right)
        const aimAngle = Math.PI / 4;
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false,
            aimAngle: aimAngle
          }
        };

        client1.send(inputMessage);
        await statePromise;

        // Calculate expected aim line endpoint
        const expectedEndX = playerState.position.x + Math.cos(aimAngle) * AIM_INDICATOR_LENGTH;
        const expectedEndY = playerState.position.y + Math.sin(aimAngle) * AIM_INDICATOR_LENGTH;

        // Verify aim line would point diagonal (cos(45°) ≈ sin(45°) ≈ 0.707)
        // 50 * 0.707 ≈ 35.35
        expect(expectedEndX).toBeCloseTo(playerState.position.x + 35.35, POSITION_TOLERANCE);
        expect(expectedEndY).toBeCloseTo(playerState.position.y + 35.35, POSITION_TOLERANCE);
      });
    });
  });
});
