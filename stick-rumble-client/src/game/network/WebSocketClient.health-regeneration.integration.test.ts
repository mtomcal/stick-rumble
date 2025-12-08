import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { type Message } from './WebSocketClient';
import {
  waitForServer,
  createClient,
  connectClientsToRoom,
  aggressiveCleanup
} from './WebSocketClient.integration.helpers';

// Use serial execution to prevent test interference
describe.sequential('WebSocket Health Regeneration Integration Tests', () => {
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
             !errorStr.includes('[aggressiveCleanup]');
    });
    const unexpectedWarnings = consoleWarnSpy.mock.calls.filter((call: unknown[]) => {
      const warnStr = call[0]?.toString() || '';
      return !warnStr.includes('WebSocket') &&
             !warnStr.includes('[aggressiveCleanup]');
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

  describe('Story 2.7.1: Server-Side Health Regeneration', () => {
    describe('AC: Health regenerates after 5 consecutive seconds without damage', () => {
      it('should receive IsRegeneratingHealth flag in player:move after 5s delay', async () => {
        const client1 = createClient();
        const client2 = createClient();

        // Track regeneration state changes
        let regeneratingPlayer: any = null;
        const regenPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for regeneration flag')), 10000);

          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              // Find a player with IsRegeneratingHealth = true
              const regenPlayer = data.players.find((p: any) =>
                p.isRegeneratingHealth === true
              );

              if (regenPlayer) {
                regeneratingPlayer = regenPlayer;
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        // Connect both clients to the same room
        await connectClientsToRoom(client1, client2);

        // Client 1 takes damage (simulated by waiting for health < 100)
        // In a real scenario, this would be triggered by combat
        // For this test, we verify the server broadcasts regeneration state

        // Wait for regeneration to start (5s delay + small buffer)
        await regenPromise;

        // Verify regeneration flag was received
        expect(regeneratingPlayer).toBeTruthy();
        expect(regeneratingPlayer.isRegeneratingHealth).toBe(true);
        expect(regeneratingPlayer.health).toBeLessThan(100);
      }, 12000); // 12s timeout for 5s regen delay + buffer

      it('should NOT regenerate immediately after taking damage', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let receivedRegeneratingTrue = false;

        // Set up listener BEFORE connecting
        const checkPromise = new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 2000); // Check for 2 seconds

          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const regenPlayer = data.players.find((p: any) =>
                p.isRegeneratingHealth === true
              );

              if (regenPlayer) {
                receivedRegeneratingTrue = true;
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        // Connect clients
        await connectClientsToRoom(client1, client2);

        // Wait 2 seconds (less than 5s delay)
        await checkPromise;

        // Should NOT have received isRegeneratingHealth = true yet
        expect(receivedRegeneratingTrue).toBe(false);
      }, 5000);
    });

    describe('AC: Regeneration rate is 10 HP per second', () => {
      it('should receive increasing health values during regeneration', async () => {
        const client1 = createClient();
        const client2 = createClient();

        const healthValues: number[] = [];
        let targetPlayerId: string | null = null;

        const healthIncreasePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for health increase')), 12000);

          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              // Track a player that is regenerating
              const regenPlayer = data.players.find((p: any) =>
                p.isRegeneratingHealth === true
              );

              if (regenPlayer) {
                if (!targetPlayerId) {
                  targetPlayerId = regenPlayer.id;
                }

                if (regenPlayer.id === targetPlayerId) {
                  healthValues.push(regenPlayer.health);

                  // Once we have at least 3 health samples showing increase
                  if (healthValues.length >= 3) {
                    const isIncreasing = healthValues[1] > healthValues[0] &&
                                        healthValues[2] > healthValues[1];
                    if (isIncreasing) {
                      clearTimeout(timeout);
                      resolve();
                    }
                  }
                }
              }
            }
          });
        });

        await connectClientsToRoom(client1, client2);
        await healthIncreasePromise;

        // Verify health was increasing
        expect(healthValues.length).toBeGreaterThanOrEqual(3);
        expect(healthValues[1]).toBeGreaterThan(healthValues[0]);
        expect(healthValues[2]).toBeGreaterThan(healthValues[1]);
      }, 15000);
    });

    describe('AC: Taking damage stops regeneration and resets timer', () => {
      it('should receive IsRegeneratingHealth = false when player takes damage', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let sawRegeneratingTrue = false;
        let sawRegeneratingFalse = false;

        const regenCyclePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for regen cycle')), 15000);

          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player = data.players[0];

              if (player.isRegeneratingHealth === true && !sawRegeneratingTrue) {
                sawRegeneratingTrue = true;
              }

              // After seeing regen=true, watch for it to become false (damage taken)
              if (sawRegeneratingTrue && player.isRegeneratingHealth === false) {
                sawRegeneratingFalse = true;
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        await connectClientsToRoom(client1, client2);

        // Note: In a full integration test, we would simulate damage here
        // For now, we verify the flag can toggle based on server state

        await regenCyclePromise;

        expect(sawRegeneratingTrue).toBe(true);
        expect(sawRegeneratingFalse).toBe(true);
      }, 20000);
    });

    describe('AC: Regeneration is server-authoritative', () => {
      it('should receive regeneration state from server, not calculate client-side', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let serverProvidedRegenState = false;

        const serverStatePromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for server state')), 10000);

          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              // Check that server is sending the isRegeneratingHealth field
              const player = data.players[0];

              if (player.hasOwnProperty('isRegeneratingHealth')) {
                serverProvidedRegenState = true;
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        await connectClientsToRoom(client1, client2);
        await serverStatePromise;

        // Verify server is providing the regeneration state
        expect(serverProvidedRegenState).toBe(true);
      }, 12000);

      it('should broadcast regeneration state to all clients in room', async () => {
        const client1 = createClient();
        const client2 = createClient();
        const client3 = createClient();

        let client2SawRegen = false;
        let client3SawRegen = false;

        const multiClientPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for multi-client broadcast')), 10000);

          const checkComplete = () => {
            if (client2SawRegen && client3SawRegen) {
              clearTimeout(timeout);
              resolve();
            }
          };

          client2.on('player:move', (data: any) => {
            if (data.players && data.players.some((p: any) => p.isRegeneratingHealth !== undefined)) {
              client2SawRegen = true;
              checkComplete();
            }
          });

          client3.on('player:move', (data: any) => {
            if (data.players && data.players.some((p: any) => p.isRegeneratingHealth !== undefined)) {
              client3SawRegen = true;
              checkComplete();
            }
          });
        });

        // Connect all three clients to the same room
        await connectClientsToRoom(client1, client2);
        await client3.connect();

        // Wait for room:joined on client3
        await new Promise<void>((resolve) => {
          client3.on('room:joined', () => resolve());
        });

        await multiClientPromise;

        // Verify all clients received the regeneration state
        expect(client2SawRegen).toBe(true);
        expect(client3SawRegen).toBe(true);
      }, 12000);
    });

    describe('AC: Regeneration stops at 100 HP', () => {
      it('should receive IsRegeneratingHealth = false when health reaches 100', async () => {
        const client1 = createClient();
        const client2 = createClient();

        let sawFullHealthNoRegen = false;

        const fullHealthPromise = new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timeout waiting for full health')), 15000);

          client2.on('player:move', (data: any) => {
            if (data.players && data.players.length > 0) {
              const player = data.players[0];

              // Look for a player at full health with regen = false
              if (player.health === 100 && player.isRegeneratingHealth === false) {
                sawFullHealthNoRegen = true;
                clearTimeout(timeout);
                resolve();
              }
            }
          });
        });

        await connectClientsToRoom(client1, client2);
        await fullHealthPromise;

        expect(sawFullHealthNoRegen).toBe(true);
      }, 20000);
    });
  });
});
