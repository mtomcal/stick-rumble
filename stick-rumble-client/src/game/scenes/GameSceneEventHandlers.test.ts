import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameSceneEventHandlers } from './GameSceneEventHandlers';
import type { WebSocketClient } from '../network/WebSocketClient';
import type { PlayerManager } from '../entities/PlayerManager';
import type { ProjectileManager } from '../entities/ProjectileManager';
import type { HealthBarUI } from '../ui/HealthBarUI';
import type { KillFeedUI } from '../ui/KillFeedUI';
import type { GameSceneUI } from './GameSceneUI';
import type { GameSceneSpectator } from './GameSceneSpectator';

describe('GameSceneEventHandlers', () => {
  let mockWsClient: WebSocketClient;
  let mockPlayerManager: PlayerManager;
  let mockProjectileManager: ProjectileManager;
  let mockHealthBarUI: HealthBarUI;
  let mockKillFeedUI: KillFeedUI;
  let mockGameSceneUI: GameSceneUI;
  let mockGameSceneSpectator: GameSceneSpectator;
  let eventHandlers: GameSceneEventHandlers;

  beforeEach(() => {
    // Create mock WebSocket client with handler tracking
    mockWsClient = {
      on: vi.fn(),
      off: vi.fn(),
      getTotalHandlerCount: vi.fn().mockReturnValue(0),
    } as unknown as WebSocketClient;

    // Create mock dependencies
    mockPlayerManager = {
      updatePlayers: vi.fn(),
      destroy: vi.fn(),
      setLocalPlayerId: vi.fn(),
      getLocalPlayerId: vi.fn().mockReturnValue('player-1'),
    } as unknown as PlayerManager;

    mockProjectileManager = {
      spawnProjectile: vi.fn(),
      createMuzzleFlash: vi.fn(),
      removeProjectile: vi.fn(),
    } as unknown as ProjectileManager;

    mockHealthBarUI = {
      updateHealth: vi.fn(),
    } as unknown as HealthBarUI;

    mockKillFeedUI = {
      addKill: vi.fn(),
    } as unknown as KillFeedUI;

    mockGameSceneUI = {
      updateAmmoDisplay: vi.fn(),
      showDamageFlash: vi.fn(),
      showDamageNumber: vi.fn(),
      showHitMarker: vi.fn(),
      updateMatchTimer: vi.fn(),
    } as unknown as GameSceneUI;

    mockGameSceneSpectator = {
      enterSpectatorMode: vi.fn(),
      exitSpectatorMode: vi.fn(),
    } as unknown as GameSceneSpectator;

    // Create event handlers instance
    eventHandlers = new GameSceneEventHandlers(
      mockWsClient,
      mockPlayerManager,
      mockProjectileManager,
      () => mockHealthBarUI,
      mockKillFeedUI,
      mockGameSceneUI,
      mockGameSceneSpectator,
      vi.fn() // onCameraFollowNeeded
    );
  });

  describe('setupEventHandlers', () => {
    it('should register all WebSocket event handlers', () => {
      eventHandlers.setupEventHandlers();

      // Verify all event types are registered
      expect(mockWsClient.on).toHaveBeenCalledWith('player:move', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('room:joined', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('projectile:spawn', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('projectile:destroy', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('weapon:state', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('shoot:failed', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('player:damaged', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('hit:confirmed', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('player:death', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('player:kill_credit', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('player:respawn', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('match:timer', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('match:ended', expect.any(Function));
    });

    it('should not accumulate handlers when called multiple times', () => {
      // First call
      eventHandlers.setupEventHandlers();
      const firstCallCount = (mockWsClient.on as ReturnType<typeof vi.fn>).mock.calls.length;

      // Second call should cleanup first, then register again
      eventHandlers.setupEventHandlers();
      const secondCallCount = (mockWsClient.on as ReturnType<typeof vi.fn>).mock.calls.length;

      // Should have registered handlers twice (13 event types × 2 calls)
      expect(secondCallCount).toBe(firstCallCount * 2);

      // But off() should have been called to remove previous handlers
      expect(mockWsClient.off).toHaveBeenCalledTimes(13); // 13 event types cleaned up
    });

    it('should call cleanupHandlers before registering new handlers', () => {
      // Setup spies to track call order
      const cleanupSpy = vi.spyOn(eventHandlers as any, 'cleanupHandlers');

      eventHandlers.setupEventHandlers();
      expect(cleanupSpy).toHaveBeenCalled();

      // Verify cleanup was called BEFORE on() was called
      const cleanupOrder = cleanupSpy.mock.invocationCallOrder[0];
      const onOrder = (mockWsClient.on as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
      expect(cleanupOrder).toBeLessThan(onOrder);
    });
  });

  describe('cleanupHandlers', () => {
    it('should remove all registered handlers', () => {
      // Register handlers first
      eventHandlers.setupEventHandlers();

      // Call cleanup
      (eventHandlers as any).cleanupHandlers();

      // Verify all handlers were removed (13 event types)
      expect(mockWsClient.off).toHaveBeenCalledTimes(13);
      expect(mockWsClient.off).toHaveBeenCalledWith('player:move', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('room:joined', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('projectile:spawn', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('projectile:destroy', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('weapon:state', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('shoot:failed', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('player:damaged', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('hit:confirmed', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('player:death', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('player:kill_credit', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('player:respawn', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('match:timer', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('match:ended', expect.any(Function));
    });

    it('should handle cleanup when no handlers are registered', () => {
      // Call cleanup without setup
      expect(() => {
        (eventHandlers as any).cleanupHandlers();
      }).not.toThrow();

      // Should not call off() since nothing was registered
      expect(mockWsClient.off).not.toHaveBeenCalled();
    });

    it('should clear handlerRefs map', () => {
      // Register handlers
      eventHandlers.setupEventHandlers();

      // Verify handlerRefs has entries
      const handlerRefs = (eventHandlers as any).handlerRefs;
      expect(handlerRefs.size).toBeGreaterThan(0);

      // Cleanup
      (eventHandlers as any).cleanupHandlers();

      // Verify handlerRefs is cleared
      expect(handlerRefs.size).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should call cleanupHandlers', () => {
      const cleanupSpy = vi.spyOn(eventHandlers as any, 'cleanupHandlers');

      eventHandlers.destroy();

      expect(cleanupSpy).toHaveBeenCalledOnce();
    });

    it('should remove all registered handlers via cleanupHandlers', () => {
      // Register handlers first
      eventHandlers.setupEventHandlers();

      // Destroy
      eventHandlers.destroy();

      // Verify all handlers were removed (13 event types)
      expect(mockWsClient.off).toHaveBeenCalledTimes(13);
    });
  });

  describe('handler reference storage', () => {
    it('should store handler references for all event types', () => {
      eventHandlers.setupEventHandlers();

      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;

      // Verify all 13 event types have stored references
      expect(handlerRefs.size).toBe(13);
      expect(handlerRefs.has('player:move')).toBe(true);
      expect(handlerRefs.has('room:joined')).toBe(true);
      expect(handlerRefs.has('projectile:spawn')).toBe(true);
      expect(handlerRefs.has('projectile:destroy')).toBe(true);
      expect(handlerRefs.has('weapon:state')).toBe(true);
      expect(handlerRefs.has('shoot:failed')).toBe(true);
      expect(handlerRefs.has('player:damaged')).toBe(true);
      expect(handlerRefs.has('hit:confirmed')).toBe(true);
      expect(handlerRefs.has('player:death')).toBe(true);
      expect(handlerRefs.has('player:kill_credit')).toBe(true);
      expect(handlerRefs.has('player:respawn')).toBe(true);
      expect(handlerRefs.has('match:timer')).toBe(true);
      expect(handlerRefs.has('match:ended')).toBe(true);
    });

    it('should use same handler reference when registering with wsClient', () => {
      eventHandlers.setupEventHandlers();

      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const playerMoveHandler = handlerRefs.get('player:move');

      // Verify wsClient.on was called with the same reference
      expect(mockWsClient.on).toHaveBeenCalledWith('player:move', playerMoveHandler);
    });
  });
});
