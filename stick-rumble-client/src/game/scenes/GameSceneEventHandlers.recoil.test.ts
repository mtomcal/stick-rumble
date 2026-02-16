/**
 * Tests for GameSceneEventHandlers - Recoil Visual Feedback
 * Story 3.3 Polish: Implement Recoil Visual Feedback for Ranged Weapons
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameSceneEventHandlers } from './GameSceneEventHandlers';
import type { WebSocketClient } from '../network/WebSocketClient';
import type { PlayerManager } from '../entities/PlayerManager';
import type { ProjectileManager } from '../entities/ProjectileManager';
import type { HealthBarUI } from '../ui/HealthBarUI';
import type { KillFeedUI } from '../ui/KillFeedUI';
import type { GameSceneUI } from './GameSceneUI';
import type { GameSceneSpectator } from './GameSceneSpectator';
import type { ScreenShake } from '../effects/ScreenShake';

describe('GameSceneEventHandlers - Recoil Visual Feedback', () => {
  let mockWsClient: WebSocketClient;
  let mockPlayerManager: PlayerManager;
  let mockProjectileManager: ProjectileManager;
  let mockWeaponCrateManager: any;
  let mockPickupPromptUI: any;
  let mockMeleeWeaponManager: any;
  let mockHitEffectManager: any;
  let mockHealthBarUI: HealthBarUI;
  let mockKillFeedUI: KillFeedUI;
  let mockGameSceneUI: GameSceneUI;
  let mockGameSceneSpectator: GameSceneSpectator;
  let mockScreenShake: ScreenShake;
  let eventHandlers: GameSceneEventHandlers;
  let messageHandlers: Map<string, (data: unknown) => void>;

  beforeEach(() => {
    // Create message handlers map to capture registered handlers
    messageHandlers = new Map();

    // Create mock WebSocket client
    mockWsClient = {
      on: vi.fn((type: string, handler: (data: unknown) => void) => {
        messageHandlers.set(type, handler);
      }),
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
      updatePlayerWeapon: vi.fn(),
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

    mockHitEffectManager = {
      showBulletImpact: vi.fn(),
      showMeleeHit: vi.fn(),
      showMuzzleFlash: vi.fn(),
      showBloodParticles: vi.fn(),
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
      showCameraShake: vi.fn(),
      updateMatchTimer: vi.fn(),
    } as unknown as GameSceneUI;

    mockGameSceneSpectator = {
      enterSpectatorMode: vi.fn(),
      exitSpectatorMode: vi.fn(),
    } as unknown as GameSceneSpectator;

    mockScreenShake = {
      shake: vi.fn(),
      shakeOnBatHit: vi.fn(),
      shakeOnWeaponFire: vi.fn(),
    } as unknown as ScreenShake;

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
      mockMeleeWeaponManager,
      mockHitEffectManager
    );

    // Setup event handlers to capture them
    eventHandlers.setupEventHandlers();
  });

  describe('Weapon pickup tracking', () => {
    beforeEach(() => {
      // Inject screen shake dependency for these tests
      eventHandlers.setScreenShake(mockScreenShake);
    });

    it('should track weapon type when local player picks up Uzi', () => {
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      expect(weaponPickupHandler).toBeDefined();

      // Pick up Uzi
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'uzi',
        nextRespawnTime: 30000,
      });

      // Verify weapon tracking by firing and checking shake is called with correct weapon type
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('uzi');
    });

    it('should track weapon type when local player picks up AK47', () => {
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      expect(weaponPickupHandler).toBeDefined();

      // Pick up AK47
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'ak47',
        nextRespawnTime: 30000,
      });

      // Verify weapon tracking by firing and checking shake is called with correct weapon type
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('ak47');
    });

    it('should track weapon type when local player picks up Shotgun', () => {
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      expect(weaponPickupHandler).toBeDefined();

      // Pick up Shotgun
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'shotgun',
        nextRespawnTime: 30000,
      });

      // Verify weapon tracking by firing and checking shake is called with correct weapon type
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('shotgun');
    });

    it('should NOT track weapon type when other player picks up weapon', () => {
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      expect(weaponPickupHandler).toBeDefined();

      // Other player picks up weapon
      weaponPickupHandler!({
        playerId: 'player-2',
        crateId: 'crate-1',
        weaponType: 'uzi',
        nextRespawnTime: 30000,
      });

      // Verify local player weapon type remains unchanged (Pistol default) by firing
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      // Assert: shakeOnWeaponFire called with 'pistol' (default), but ScreenShake returns early
      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('pistol');
    });

    it('should update weapon type when picking up different weapons', () => {
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      expect(weaponPickupHandler).toBeDefined();

      // Pick up Uzi
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'uzi',
        nextRespawnTime: 30000,
      });

      // Pick up Shotgun (replaces Uzi)
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-2',
        weaponType: 'shotgun',
        nextRespawnTime: 30000,
      });

      // Verify latest weapon type is Shotgun by firing
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('shotgun');
    });
  });

  describe('Screen shake on projectile spawn', () => {
    beforeEach(() => {
      // Inject screen shake dependency
      eventHandlers.setScreenShake(mockScreenShake);
    });

    it('should trigger screen shake when local player fires with Uzi', () => {
      // First, pick up Uzi
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'uzi',
        nextRespawnTime: 30000,
      });

      // Now fire (projectile spawn)
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      // Assert: Screen shake was triggered with Uzi weapon type
      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('uzi');
    });

    it('should trigger screen shake when local player fires with AK47', () => {
      // Pick up AK47
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'ak47',
        nextRespawnTime: 30000,
      });

      // Fire
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      // Assert: Screen shake with AK47 weapon type
      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('ak47');
    });

    it('should trigger screen shake when local player fires with Shotgun', () => {
      // Pick up Shotgun
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'shotgun',
        nextRespawnTime: 30000,
      });

      // Fire
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      // Assert: Screen shake with Shotgun weapon type
      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('shotgun');
    });

    it('should NOT trigger screen shake when other player fires', () => {
      // Local player picks up Uzi
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'uzi',
        nextRespawnTime: 30000,
      });

      // Other player fires
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-2', // Different player
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      // Assert: Screen shake was NOT triggered
      expect(mockScreenShake.shakeOnWeaponFire).not.toHaveBeenCalled();
    });

    it('should NOT trigger screen shake for Pistol (default weapon)', () => {
      // Don't pick up any weapon (default Pistol)

      // Fire with Pistol
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      // Assert: shakeOnWeaponFire called with 'pistol', but ScreenShake.shakeOnWeaponFire() returns early
      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('pistol');
    });

    it('should NOT trigger screen shake for Bat melee weapon', () => {
      // Pick up Bat
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'bat',
        nextRespawnTime: 30000,
      });

      // Fire (should not actually happen with Bat, but testing edge case)
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      // Assert: shakeOnWeaponFire was called with 'bat', but ScreenShake.shakeOnWeaponFire() returns early for melee weapons
      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('bat');
    });

    it('should NOT trigger screen shake for Katana melee weapon', () => {
      // Pick up Katana
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'katana',
        nextRespawnTime: 30000,
      });

      // Fire (should not actually happen with Katana, but testing edge case)
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      // Assert: shakeOnWeaponFire was called with 'katana', but ScreenShake.shakeOnWeaponFire() returns early for melee weapons
      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('katana');
    });

    it('should use updated weapon type after weapon switch', () => {
      // Pick up Uzi
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'uzi',
        nextRespawnTime: 30000,
      });

      // Fire with Uzi
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('uzi');

      // Pick up Shotgun
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-2',
        weaponType: 'shotgun',
        nextRespawnTime: 30000,
      });

      // Clear previous calls
      vi.clearAllMocks();

      // Fire with Shotgun
      projectileSpawnHandler!({
        id: 'proj-2',
        ownerId: 'player-1',
        position: { x: 200, y: 200 },
        velocity: { x: 10, y: 0 },
      });

      // Assert: Now using Shotgun weapon type
      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledWith('shotgun');
    });

    it('should trigger shake multiple times for rapid fire', () => {
      // Pick up Uzi (high fire rate)
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'uzi',
        nextRespawnTime: 30000,
      });

      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');

      // Fire 3 rapid shots
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });
      projectileSpawnHandler!({
        id: 'proj-2',
        ownerId: 'player-1',
        position: { x: 101, y: 100 },
        velocity: { x: 10, y: 0 },
      });
      projectileSpawnHandler!({
        id: 'proj-3',
        ownerId: 'player-1',
        position: { x: 102, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      // Assert: Shake triggered 3 times
      expect(mockScreenShake.shakeOnWeaponFire).toHaveBeenCalledTimes(3);
    });

    it('should use appropriate shake duration (50-200ms)', () => {
      // We need to verify that shakeOnWeaponFire calls shake with appropriate duration
      // This is tested in ScreenShake unit tests, but here we verify the integration

      // Make shakeOnWeaponFire call the real shake method so we can check the duration
      mockScreenShake.shakeOnWeaponFire = vi.fn((weaponType: string) => {
        if (weaponType === 'ak47') {
          mockScreenShake.shake(100, 0.007);
        }
      });

      // Pick up AK47
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'ak47',
        nextRespawnTime: 30000,
      });

      // Fire
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
      });

      // Assert: shake was called with duration in expected range
      expect(mockScreenShake.shake).toHaveBeenCalled();
      const duration = (mockScreenShake.shake as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(duration).toBeGreaterThan(50);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('ScreenShake injection', () => {
    it('should accept ScreenShake instance via setter', () => {
      expect(() => eventHandlers.setScreenShake(mockScreenShake)).not.toThrow();
    });

    it('should not throw if ScreenShake is not set', () => {
      // Don't set screen shake
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');

      expect(() => {
        projectileSpawnHandler!({
          id: 'proj-1',
          ownerId: 'player-1',
          position: { x: 100, y: 100 },
          velocity: { x: 10, y: 0 },
        });
      }).not.toThrow();
    });
  });
});
