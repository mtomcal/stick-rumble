import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { type Message } from './WebSocketClient';
import {
  waitForServer,
  createClient,
  connectClientsToRoom,
  aggressiveCleanup
} from './WebSocketClient.integration.helpers';

// Use serial execution to prevent test interference
describe.sequential('WebSocket Player Movement Integration Tests', () => {
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

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

  describe('Story 2.1: Server-Authoritative Player Movement', () => {
    describe('AC: input:state message processing', () => {
      it('should send input:state messages with WASD key states', async () => {
        const client = createClient();

        await client.connect();

        // Send input:state message with WASD keys pressed
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: true,
            down: false,
            left: false,
            right: true
          }
        };

        // Should not throw when sending input state
        // Note: Server processing is verified in subsequent tests that check player:move broadcasts
        expect(() => client.send(inputMessage)).not.toThrow();
      });

      it('should accept input:state with all keys released', async () => {
        const client = createClient();

        await client.connect();

        // Send input:state with no keys pressed
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: false,
            down: false,
            left: false,
            right: false
          }
        };

        // Should not throw when sending no-input state
        // Note: Server processing is verified in subsequent tests that check player:move broadcasts
        expect(() => client.send(inputMessage)).not.toThrow();
      });
    });

    describe('AC: player:move broadcasts', () => {
      it('should receive player:move messages with player positions', async () => {
        const client = createClient();

        // Set up handler for player:move messages
        let receivedPlayerMove = false;
        let playerData: any = null;

        const movePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for player:move'));
          }, 15000);

          client.on('player:move', (data: any) => {
            receivedPlayerMove = true;
            playerData = data;
            clearTimeout(timeout);
            resolve();
          });
        });

        await client.connect();

        // Send input to trigger movement
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: {
            up: true,
            down: false,
            left: false,
            right: false
          }
        };

        client.send(inputMessage);

        // Wait for player:move broadcast (server broadcasts at 20Hz)
        await movePromise;

        expect(receivedPlayerMove).toBe(true);
        expect(playerData).toBeDefined();
        expect(playerData.players).toBeDefined();
        expect(Array.isArray(playerData.players)).toBe(true);
      });

      it('should receive player positions with nested position and velocity objects', async () => {
        const client = createClient();

        let playerState: any = null;

        const movePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for player:move'));
          }, 15000);

          client.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              playerState = data.players[0];
              clearTimeout(timeout);
              resolve();
            }
          });
        });

        await client.connect();

        // Send input to trigger movement
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: { up: true, down: false, left: false, right: false }
        };

        client.send(inputMessage);

        await movePromise;

        // Verify player state structure (nested position and velocity)
        expect(playerState).toBeDefined();
        expect(typeof playerState.id).toBe('string');
        expect(playerState.position).toBeDefined();
        expect(typeof playerState.position.x).toBe('number');
        expect(typeof playerState.position.y).toBe('number');
        expect(playerState.velocity).toBeDefined();
        expect(typeof playerState.velocity.x).toBe('number');
        expect(typeof playerState.velocity.y).toBe('number');
      });
    });

    describe('AC: Multi-player movement synchronization', () => {
      it('should broadcast player positions to all connected players', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let client1ReceivedMove = false;
        let client2ReceivedMove = false;

        const movePromises = Promise.all([
          new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Client1 timeout')), 15000);
            client1.on('player:move', () => {
              client1ReceivedMove = true;
              clearTimeout(timeout);
              resolve();
            });
          }),
          new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Client2 timeout')), 15000);
            client2.on('player:move', () => {
              client2ReceivedMove = true;
              clearTimeout(timeout);
              resolve();
            });
          })
        ]);

        // Connect both clients and wait for room:joined
        await connectClientsToRoom(client1, client2);

        // Send input from both clients
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: { up: true, down: false, left: false, right: false }
        };

        client1.send(inputMessage);
        client2.send(inputMessage);

        await movePromises;

        // Both clients should receive player:move broadcasts
        expect(client1ReceivedMove).toBe(true);
        expect(client2ReceivedMove).toBe(true);
      });

      it('should show movement when WASD keys are pressed', async () => {
        const client = createClient();

        let initialPosition: { x: number; y: number } | null = null;
        const positionsAfterInput: { x: number; y: number }[] = [];
        const velocitiesAfterInput: { x: number; y: number }[] = [];

        // First, wait for the initial player:move to establish baseline position
        const getInitialPosition = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout getting initial position')), 15000);
          client.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0 && !initialPosition) {
              const player = data.players[0];
              initialPosition = { x: player.position.x, y: player.position.y };
              clearTimeout(timeout);
              resolve();
            }
          });
        });

        await client.connect();
        await getInitialPosition;

        // Now collect positions AND velocities AFTER sending input
        const collectDataAfterInput = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout collecting data after input')), 15000);
          let count = 0;

          client.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player = data.players[0];
              positionsAfterInput.push({ x: player.position.x, y: player.position.y });
              velocitiesAfterInput.push({ x: player.velocity.x, y: player.velocity.y });
              count++;
              if (count >= 10) {
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        // Send input to move up (negative Y direction in most game engines)
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: { up: true, down: false, left: false, right: false }
        };

        client.send(inputMessage);
        await collectDataAfterInput;

        // Should have collected multiple position updates after input
        expect(positionsAfterInput.length).toBeGreaterThanOrEqual(10);
        expect(initialPosition).not.toBeNull();

        // Check if position changed OR velocity became non-zero (indicating movement intent was processed)
        const finalPosition = positionsAfterInput[positionsAfterInput.length - 1];
        const positionChanged = finalPosition.x !== initialPosition!.x || finalPosition.y !== initialPosition!.y;

        // Check if velocity is ever non-zero (movement is being applied)
        const hasNonZeroVelocity = velocitiesAfterInput.some(v => v.x !== 0 || v.y !== 0);

        // Either position should change OR velocity should be non-zero
        expect(positionChanged || hasNonZeroVelocity).toBe(true);
      });
    });

    describe('AC: Server validates movement bounds', () => {
      it('should keep player within arena bounds (0-1920, 0-1080)', async () => {
        const client = createClient();

        const positions: { x: number; y: number }[] = [];

        const collectPositions = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout')), 15000);
          let count = 0;

          client.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player = data.players[0];
              // Position is nested in position object
              positions.push({ x: player.position.x, y: player.position.y });
              count++;
              if (count >= 5) {
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        await client.connect();

        // Send input - player should stay within bounds
        const inputMessage: Message = {
          type: 'input:state',
          timestamp: Date.now(),
          data: { up: true, down: false, left: true, right: false }
        };

        client.send(inputMessage);

        await collectPositions;

        // All positions should be within bounds
        for (const pos of positions) {
          expect(pos.x).toBeGreaterThanOrEqual(0);
          expect(pos.x).toBeLessThanOrEqual(1920);
          expect(pos.y).toBeGreaterThanOrEqual(0);
          expect(pos.y).toBeLessThanOrEqual(1080);
        }
      });
    });
  });
});
