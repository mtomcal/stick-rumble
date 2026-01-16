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
  let mockWeaponCrateManager: any;
  let mockPickupPromptUI: any;
  let mockMeleeWeaponManager: any;
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
      getPlayerPosition: vi.fn().mockReturnValue({ x: 100, y: 200 }),
      getPlayerAimAngle: vi.fn().mockReturnValue(0),
    } as unknown as PlayerManager;

    mockProjectileManager = {
      spawnProjectile: vi.fn(),
      createMuzzleFlash: vi.fn(),
      removeProjectile: vi.fn(),
    } as unknown as ProjectileManager;

    mockWeaponCrateManager = {
      spawnCrate: vi.fn(),
      markUnavailable: vi.fn(),
      markAvailable: vi.fn(),
    } as any;

    mockPickupPromptUI = {
      show: vi.fn(),
      hide: vi.fn(),
      isVisible: vi.fn().mockReturnValue(false),
    } as any;

    mockMeleeWeaponManager = {
      createWeapon: vi.fn(),
      updatePosition: vi.fn(),
      startSwing: vi.fn(),
      update: vi.fn(),
      destroy: vi.fn(),
    } as any;

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
      vi.fn(), // onCameraFollowNeeded
      mockWeaponCrateManager,
      mockPickupPromptUI,
      mockMeleeWeaponManager
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
      expect(mockWsClient.on).toHaveBeenCalledWith('weapon:spawned', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('weapon:pickup_confirmed', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('weapon:respawned', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('melee:hit', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('roll:start', expect.any(Function));
      expect(mockWsClient.on).toHaveBeenCalledWith('roll:end', expect.any(Function));
    });

    it('should not accumulate handlers when called multiple times', () => {
      // First call
      eventHandlers.setupEventHandlers();
      const firstCallCount = (mockWsClient.on as ReturnType<typeof vi.fn>).mock.calls.length;

      // Second call should cleanup first, then register again
      eventHandlers.setupEventHandlers();
      const secondCallCount = (mockWsClient.on as ReturnType<typeof vi.fn>).mock.calls.length;

      // Should have registered handlers twice (17 event types × 2 calls)
      expect(secondCallCount).toBe(firstCallCount * 2);

      // But off() should have been called to remove previous handlers
      expect(mockWsClient.off).toHaveBeenCalledTimes(19); // 19 event types cleaned up (16 base + melee:hit + roll:start + roll:end)
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

      // Verify all handlers were removed (19 event types including roll:start and roll:end)
      expect(mockWsClient.off).toHaveBeenCalledTimes(19);
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
      expect(mockWsClient.off).toHaveBeenCalledWith('weapon:spawned', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('weapon:pickup_confirmed', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('weapon:respawned', expect.any(Function));
      expect(mockWsClient.off).toHaveBeenCalledWith('melee:hit', expect.any(Function));
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

      // Verify all handlers were removed (19 event types including roll:start and roll:end)
      expect(mockWsClient.off).toHaveBeenCalledTimes(19);
    });
  });

  describe('handler reference storage', () => {
    it('should store handler references for all event types', () => {
      eventHandlers.setupEventHandlers();

      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;

      // Verify all 19 event types have stored references (including roll:start and roll:end)
      expect(handlerRefs.size).toBe(19);
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

  describe('audio integration', () => {
    let mockAudioManager: any;

    beforeEach(() => {
      mockAudioManager = {
        playWeaponSound: vi.fn(),
        playWeaponSoundPositional: vi.fn(),
      };
      eventHandlers.setAudioManager(mockAudioManager);
      eventHandlers.setupEventHandlers();
    });

    it('should play local player weapon sound on projectile:spawn', () => {
      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const projectileSpawnHandler = handlerRefs.get('projectile:spawn');

      const data = {
        id: 'proj-123',
        ownerId: 'player-1', // Local player ID
        position: { x: 100, y: 200 },
        velocity: { x: 10, y: 0 },
        damage: 25,
      };

      projectileSpawnHandler?.(data);

      // Should play local player sound (not positional)
      expect(mockAudioManager.playWeaponSound).toHaveBeenCalledWith('pistol'); // Default weapon type
      expect(mockAudioManager.playWeaponSoundPositional).not.toHaveBeenCalled();
    });

    it('should play positional audio for remote player weapon sound on projectile:spawn', () => {
      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const projectileSpawnHandler = handlerRefs.get('projectile:spawn');

      // Mock local player position
      mockPlayerManager.getLocalPlayerPosition = vi.fn().mockReturnValue({ x: 500, y: 500 });

      const data = {
        id: 'proj-456',
        ownerId: 'other-player', // Remote player
        position: { x: 100, y: 200 },
        velocity: { x: 10, y: 0 },
        damage: 25,
      };

      projectileSpawnHandler?.(data);

      // Should play positional audio
      expect(mockAudioManager.playWeaponSound).not.toHaveBeenCalled();
      expect(mockAudioManager.playWeaponSoundPositional).toHaveBeenCalledWith(
        'pistol', // Default weapon type
        100, // soundX
        200, // soundY
        500, // listenerX
        500  // listenerY
      );
    });

    it('should not play positional audio when local player position is null', () => {
      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const projectileSpawnHandler = handlerRefs.get('projectile:spawn');

      // Mock local player position as null
      mockPlayerManager.getLocalPlayerPosition = vi.fn().mockReturnValue(null);

      const data = {
        id: 'proj-789',
        ownerId: 'other-player',
        position: { x: 100, y: 200 },
        velocity: { x: 10, y: 0 },
        damage: 25,
      };

      projectileSpawnHandler?.(data);

      // Should not play any audio
      expect(mockAudioManager.playWeaponSound).not.toHaveBeenCalled();
      expect(mockAudioManager.playWeaponSoundPositional).not.toHaveBeenCalled();
    });

    it('should not crash when audioManager is null on projectile:spawn', () => {
      // Create event handlers without audio manager
      const eventHandlersNoAudio = new GameSceneEventHandlers(
        mockWsClient,
        mockPlayerManager,
        mockProjectileManager,
        () => mockHealthBarUI,
        mockKillFeedUI,
        mockGameSceneUI,
        mockGameSceneSpectator,
        vi.fn(),
        mockWeaponCrateManager,
        mockPickupPromptUI,
      mockMeleeWeaponManager
      );

      eventHandlersNoAudio.setupEventHandlers();

      const handlerRefs = (eventHandlersNoAudio as any).handlerRefs as Map<string, (data: unknown) => void>;
      const projectileSpawnHandler = handlerRefs.get('projectile:spawn');

      const data = {
        id: 'proj-999',
        ownerId: 'player-1',
        position: { x: 100, y: 200 },
        velocity: { x: 10, y: 0 },
        damage: 25,
      };

      // Should not throw when audioManager is null
      expect(() => {
        projectileSpawnHandler?.(data);
      }).not.toThrow();
    });

    it('should use currentWeaponType for audio playback', () => {
      // Set a different weapon type
      (eventHandlers as any).currentWeaponType = 'Uzi';

      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const projectileSpawnHandler = handlerRefs.get('projectile:spawn');

      const data = {
        id: 'proj-111',
        ownerId: 'player-1',
        position: { x: 100, y: 200 },
        velocity: { x: 10, y: 0 },
        damage: 25,
      };

      projectileSpawnHandler?.(data);

      // Should play Uzi sound
      expect(mockAudioManager.playWeaponSound).toHaveBeenCalledWith('Uzi');
    });
  });

  describe('event handler branches', () => {
    beforeEach(() => {
      eventHandlers.setupEventHandlers();
    });

    it('should handle shoot:failed with non-empty reason', () => {
      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const shootFailedHandler = handlerRefs.get('shoot:failed');

      // Test with reason other than 'empty'
      const data = { reason: 'reloading' };

      expect(() => {
        shootFailedHandler?.(data);
      }).not.toThrow();

      // Should not log the 'empty' message
      // (In real code, it would log nothing or handle differently)
    });

    it('should handle shoot:failed with empty reason', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const shootFailedHandler = handlerRefs.get('shoot:failed');

      // Test with reason = 'empty'
      const data = { reason: 'empty' };
      shootFailedHandler?.(data);

      expect(consoleSpy).toHaveBeenCalledWith('Click! Magazine empty');

      consoleSpy.mockRestore();
    });

    it('should handle player:damaged when victim is not local player', () => {
      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const playerDamagedHandler = handlerRefs.get('player:damaged');

      const data = {
        victimId: 'other-player',
        attackerId: 'attacker',
        damage: 25,
        newHealth: 75,
        projectileId: 'proj-123',
      };

      // Should not update health bar for non-local player
      playerDamagedHandler?.(data);

      // Health bar should not be updated (still at initial 100 from setup)
      expect(mockHealthBarUI.updateHealth).not.toHaveBeenCalled();

      // Should still show damage numbers for other players
      expect(mockGameSceneUI.showDamageNumber).toHaveBeenCalledWith(
        mockPlayerManager,
        'other-player',
        25
      );
    });

    it('should handle player:damaged when victim is local player', () => {
      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const playerDamagedHandler = handlerRefs.get('player:damaged');

      const data = {
        victimId: 'player-1', // Local player ID from mock
        attackerId: 'attacker',
        damage: 25,
        newHealth: 75,
        projectileId: 'proj-123',
      };

      playerDamagedHandler?.(data);

      // Should update health bar for local player
      expect(mockHealthBarUI.updateHealth).toHaveBeenCalledWith(75, 100, false);
      expect(mockGameSceneUI.showDamageFlash).toHaveBeenCalled();
    });

    it('should trigger swing animation when melee:hit received with valid data', () => {
      eventHandlers.setupEventHandlers();

      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const meleeHitHandler = handlerRefs.get('melee:hit');

      const data = {
        attackerId: 'player-2',
        victimId: 'player-3',
        damage: 50,
        weaponType: 'Bat',
      };

      meleeHitHandler?.(data);

      // Should update weapon position with attacker's position
      expect(mockMeleeWeaponManager.updatePosition).toHaveBeenCalledWith('player-2', { x: 100, y: 200 });

      // Should trigger swing with attacker's aim angle
      expect(mockMeleeWeaponManager.startSwing).toHaveBeenCalledWith('player-2', 0);
    });

    it('should not crash when melee:hit attackerId has no position', () => {
      eventHandlers.setupEventHandlers();

      // Mock getPlayerPosition to return null
      mockPlayerManager.getPlayerPosition = vi.fn().mockReturnValue(null);

      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const meleeHitHandler = handlerRefs.get('melee:hit');

      const data = {
        attackerId: 'player-unknown',
        victimId: 'player-3',
        damage: 50,
        weaponType: 'Bat',
      };

      // Should not throw when attackerPos is null
      expect(() => {
        meleeHitHandler?.(data);
      }).not.toThrow();

      // Should not call updatePosition or startSwing
      expect(mockMeleeWeaponManager.updatePosition).not.toHaveBeenCalled();
      expect(mockMeleeWeaponManager.startSwing).not.toHaveBeenCalled();
    });

    it('should not crash when melee:hit attackerId has no aim angle', () => {
      eventHandlers.setupEventHandlers();

      // Mock getPlayerAimAngle to return null
      mockPlayerManager.getPlayerAimAngle = vi.fn().mockReturnValue(null);

      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const meleeHitHandler = handlerRefs.get('melee:hit');

      const data = {
        attackerId: 'player-2',
        victimId: 'player-3',
        damage: 50,
        weaponType: 'Bat',
      };

      // Should not throw when aimAngle is null
      expect(() => {
        meleeHitHandler?.(data);
      }).not.toThrow();

      // Should not call updatePosition or startSwing (early return)
      expect(mockMeleeWeaponManager.updatePosition).not.toHaveBeenCalled();
      expect(mockMeleeWeaponManager.startSwing).not.toHaveBeenCalled();
    });

    it('should handle match:ended with null inputManager', () => {
      // Create event handlers without input manager
      const eventHandlersNoInput = new GameSceneEventHandlers(
        mockWsClient,
        mockPlayerManager,
        mockProjectileManager as any,
        () => mockHealthBarUI,
        mockKillFeedUI,
        mockGameSceneUI,
        mockGameSceneSpectator,
        vi.fn(),
        mockWeaponCrateManager,
        mockPickupPromptUI,
      mockMeleeWeaponManager
      );

      // Setup shooting manager but not input manager
      const mockShootingManager = {
        disable: vi.fn(),
      };
      eventHandlersNoInput.setShootingManager(mockShootingManager as any);
      eventHandlersNoInput.setupEventHandlers();

      const handlerRefs = (eventHandlersNoInput as any).handlerRefs as Map<string, (data: unknown) => void>;
      const matchEndedHandler = handlerRefs.get('match:ended');

      const data = {
        winners: ['player-1'],
        finalScores: [{ playerId: 'player-1', kills: 5, deaths: 2, xp: 500 }],
        reason: 'time_limit',
      };

      // Should not throw when inputManager is null
      expect(() => {
        matchEndedHandler?.(data);
      }).not.toThrow();

      // Shooting manager should still be disabled
      expect(mockShootingManager.disable).toHaveBeenCalled();
    });

    it('should handle match:ended with null shootingManager', () => {
      // Create event handlers without shooting manager
      const eventHandlersNoShooting = new GameSceneEventHandlers(
        mockWsClient,
        mockPlayerManager,
        mockProjectileManager as any,
        () => mockHealthBarUI,
        mockKillFeedUI,
        mockGameSceneUI,
        mockGameSceneSpectator,
        vi.fn(),
        mockWeaponCrateManager,
        mockPickupPromptUI,
      mockMeleeWeaponManager
      );

      // Setup input manager but not shooting manager
      const mockInputManager = {
        disable: vi.fn(),
      };
      eventHandlersNoShooting.setInputManager(mockInputManager as any);
      eventHandlersNoShooting.setupEventHandlers();

      const handlerRefs = (eventHandlersNoShooting as any).handlerRefs as Map<string, (data: unknown) => void>;
      const matchEndedHandler = handlerRefs.get('match:ended');

      const data = {
        winners: ['player-1'],
        finalScores: [{ playerId: 'player-1', kills: 5, deaths: 2, xp: 500 }],
        reason: 'time_limit',
      };

      // Should not throw when shootingManager is null
      expect(() => {
        matchEndedHandler?.(data);
      }).not.toThrow();

      // Input manager should still be disabled
      expect(mockInputManager.disable).toHaveBeenCalled();
    });

    it('should handle match:ended with both managers null', () => {
      // Create event handlers without any managers
      const eventHandlersNoManagers = new GameSceneEventHandlers(
        mockWsClient,
        mockPlayerManager,
        mockProjectileManager as any,
        () => mockHealthBarUI,
        mockKillFeedUI,
        mockGameSceneUI,
        mockGameSceneSpectator,
        vi.fn(),
        mockWeaponCrateManager,
        mockPickupPromptUI,
      mockMeleeWeaponManager
      );

      eventHandlersNoManagers.setupEventHandlers();

      const handlerRefs = (eventHandlersNoManagers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const matchEndedHandler = handlerRefs.get('match:ended');

      const data = {
        winners: ['player-1'],
        finalScores: [{ playerId: 'player-1', kills: 5, deaths: 2, xp: 500 }],
        reason: 'time_limit',
      };

      // Should not throw when both managers are null
      expect(() => {
        matchEndedHandler?.(data);
      }).not.toThrow();
    });

    it('should handle match:ended without window.onMatchEnd callback', () => {
      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const matchEndedHandler = handlerRefs.get('match:ended');

      // Ensure window.onMatchEnd is not set
      delete (window as any).onMatchEnd;

      const data = {
        winners: ['player-1'],
        finalScores: [{ playerId: 'player-1', kills: 5, deaths: 2, xp: 500 }],
        reason: 'time_limit',
      };

      // Should not throw when window.onMatchEnd is not defined
      expect(() => {
        matchEndedHandler?.(data);
      }).not.toThrow();
    });

    it('should handle player:move when inputManager is null', () => {
      // Create event handlers without inputManager
      const eventHandlersNoInput = new GameSceneEventHandlers(
        mockWsClient,
        mockPlayerManager,
        mockProjectileManager as any,
        () => mockHealthBarUI,
        mockKillFeedUI,
        mockGameSceneUI,
        mockGameSceneSpectator,
        vi.fn(),
        mockWeaponCrateManager,
        mockPickupPromptUI,
      mockMeleeWeaponManager
      );

      eventHandlersNoInput.setupEventHandlers();

      const handlerRefs = (eventHandlersNoInput as any).handlerRefs as Map<string, (data: unknown) => void>;
      const playerMoveHandler = handlerRefs.get('player:move');

      const data = {
        players: [
          { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, health: 100 },
        ],
      };

      // Should not throw when inputManager is null
      expect(() => {
        playerMoveHandler?.(data);
      }).not.toThrow();

      // Should still update players
      expect(mockPlayerManager.updatePlayers).toHaveBeenCalledWith(data.players);
    });

    it('should handle player:move when local player not found in list', () => {
      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const playerMoveHandler = handlerRefs.get('player:move');

      // Setup input manager
      const mockInputManager = { setPlayerPosition: vi.fn() };
      eventHandlers.setInputManager(mockInputManager as any);

      const data = {
        players: [
          { id: 'other-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 }, health: 100 },
        ],
      };

      // Should not throw when local player not in list
      expect(() => {
        playerMoveHandler?.(data);
      }).not.toThrow();

      // Should not update input manager position
      expect(mockInputManager.setPlayerPosition).not.toHaveBeenCalled();
    });

    it('should handle player:move when local player health is undefined', () => {
      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const playerMoveHandler = handlerRefs.get('player:move');

      // Setup input manager
      const mockInputManager = { setPlayerPosition: vi.fn() };
      eventHandlers.setInputManager(mockInputManager as any);

      const data = {
        players: [
          { id: 'player-1', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } }, // No health field
        ],
      };

      // Should not throw when health is undefined
      expect(() => {
        playerMoveHandler?.(data);
      }).not.toThrow();

      // Should update input manager position
      expect(mockInputManager.setPlayerPosition).toHaveBeenCalledWith(100, 200);

      // Should not update health bar
      expect(mockHealthBarUI.updateHealth).not.toHaveBeenCalled();
    });

    it('should handle player:move when messageData.players is falsy', () => {
      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const playerMoveHandler = handlerRefs.get('player:move');

      const data = { players: null };

      // Should not throw when players is null
      expect(() => {
        playerMoveHandler?.(data);
      }).not.toThrow();

      // Should not update players
      expect(mockPlayerManager.updatePlayers).not.toHaveBeenCalled();
    });

    it('should handle room:joined when playerId is falsy', () => {
      const handlerRefs = (eventHandlers as any).handlerRefs as Map<string, (data: unknown) => void>;
      const roomJoinedHandler = handlerRefs.get('room:joined');

      const data = { playerId: '' };

      // Should not throw when playerId is empty
      expect(() => {
        roomJoinedHandler?.(data);
      }).not.toThrow();

      // Should still destroy old players
      expect(mockPlayerManager.destroy).toHaveBeenCalled();

      // Should not set local player ID or update health bar
      expect(mockPlayerManager.setLocalPlayerId).not.toHaveBeenCalled();
    });

    it('should handle weapon:state when shootingManager is null', () => {
      // Create event handlers without shooting manager
      const eventHandlersNoShooting = new GameSceneEventHandlers(
        mockWsClient,
        mockPlayerManager,
        mockProjectileManager as any,
        () => mockHealthBarUI,
        mockKillFeedUI,
        mockGameSceneUI,
        mockGameSceneSpectator,
        vi.fn(),
        mockWeaponCrateManager,
        mockPickupPromptUI,
      mockMeleeWeaponManager
      );

      eventHandlersNoShooting.setupEventHandlers();

      const handlerRefs = (eventHandlersNoShooting as any).handlerRefs as Map<string, (data: unknown) => void>;
      const weaponStateHandler = handlerRefs.get('weapon:state');

      const data = {
        ammo: 10,
        maxAmmo: 30,
        isReloading: false,
      };

      // Should not throw when shootingManager is null
      expect(() => {
        weaponStateHandler?.(data);
      }).not.toThrow();

      // Should not update ammo display
      expect(mockGameSceneUI.updateAmmoDisplay).not.toHaveBeenCalled();
    });
  });
});
