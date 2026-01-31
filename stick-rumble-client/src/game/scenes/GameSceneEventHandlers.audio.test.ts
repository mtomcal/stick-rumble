/**
 * Tests for GameSceneEventHandlers - Audio Integration
 * Story 3.3 Polish: Implement Weapon-Specific Firing Sounds
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
import type { AudioManager } from '../audio/AudioManager';

describe('GameSceneEventHandlers - Audio Integration', () => {
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
  let mockAudioManager: AudioManager;
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
      getLocalPlayerPosition: vi.fn().mockReturnValue({ x: 100, y: 100 }),
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

    mockAudioManager = {
      playWeaponSound: vi.fn(),
      playWeaponSoundPositional: vi.fn(),
      setVolume: vi.fn(),
      getVolume: vi.fn().mockReturnValue(1),
      setMuted: vi.fn(),
      isMuted: vi.fn().mockReturnValue(false),
      destroy: vi.fn(),
    } as unknown as AudioManager;

    // Create event handlers instance
    eventHandlers = new GameSceneEventHandlers(
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

    // Setup event handlers to register message handlers
    eventHandlers.setupEventHandlers();
  });

  describe('Weapon firing sounds', () => {
    it('should play local weapon sound when local player fires', () => {
      // Set audio manager
      eventHandlers.setAudioManager(mockAudioManager);

      // Trigger projectile:spawn for local player
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      expect(projectileSpawnHandler).toBeDefined();

      projectileSpawnHandler!({
        id: 'proj-1',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
        damage: 10,
      });

      // Should play local weapon sound
      expect(mockAudioManager.playWeaponSound).toHaveBeenCalledWith('pistol');
      expect(mockAudioManager.playWeaponSoundPositional).not.toHaveBeenCalled();
    });

    it('should play positional weapon sound when remote player fires', () => {
      // Set audio manager
      eventHandlers.setAudioManager(mockAudioManager);

      // Trigger projectile:spawn for remote player
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      expect(projectileSpawnHandler).toBeDefined();

      projectileSpawnHandler!({
        id: 'proj-2',
        ownerId: 'player-2',
        position: { x: 300, y: 200 },
        velocity: { x: -10, y: 0 },
        damage: 10,
      });

      // Should play positional weapon sound
      expect(mockAudioManager.playWeaponSoundPositional).toHaveBeenCalledWith(
        'pistol',
        300,
        200,
        100,
        100
      );
      expect(mockAudioManager.playWeaponSound).not.toHaveBeenCalled();
    });

    it('should not play sound when audio manager is not set', () => {
      // Don't set audio manager
      // Trigger projectile:spawn
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      expect(projectileSpawnHandler).toBeDefined();

      projectileSpawnHandler!({
        id: 'proj-3',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
        damage: 10,
      });

      // Should not crash or call audio methods
      expect(mockAudioManager.playWeaponSound).not.toHaveBeenCalled();
      expect(mockAudioManager.playWeaponSoundPositional).not.toHaveBeenCalled();
    });

    it('should not play positional sound when local player position is not available', () => {
      // Set audio manager
      eventHandlers.setAudioManager(mockAudioManager);

      // Mock getLocalPlayerPosition to return null
      mockPlayerManager.getLocalPlayerPosition = vi.fn().mockReturnValue(null);

      // Trigger projectile:spawn for remote player
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      expect(projectileSpawnHandler).toBeDefined();

      projectileSpawnHandler!({
        id: 'proj-4',
        ownerId: 'player-2',
        position: { x: 300, y: 200 },
        velocity: { x: -10, y: 0 },
        damage: 10,
      });

      // Should not play positional sound (no local player position)
      expect(mockAudioManager.playWeaponSoundPositional).not.toHaveBeenCalled();
      expect(mockAudioManager.playWeaponSound).not.toHaveBeenCalled();
    });

    it('should use current weapon type for sound', () => {
      // Set audio manager
      eventHandlers.setAudioManager(mockAudioManager);

      // Change weapon type (simulated by weapon:pickup_confirmed event)
      expect(eventHandlers.getCurrentWeaponType()).toBe('pistol');

      // Trigger projectile:spawn
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-5',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
        damage: 10,
      });

      // Should use current weapon type (pistol by default)
      expect(mockAudioManager.playWeaponSound).toHaveBeenCalledWith('pistol');
    });

    it('should update weapon type and use it for sounds after weapon pickup', () => {
      // Set audio manager
      eventHandlers.setAudioManager(mockAudioManager);

      // Simulate weapon pickup for local player
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      expect(weaponPickupHandler).toBeDefined();

      weaponPickupHandler!({
        playerId: 'player-1',
        crateId: 'crate-1',
        weaponType: 'Uzi',
      });

      // Verify weapon type changed
      expect(eventHandlers.getCurrentWeaponType()).toBe('Uzi');

      // Trigger projectile:spawn
      const projectileSpawnHandler = messageHandlers.get('projectile:spawn');
      projectileSpawnHandler!({
        id: 'proj-6',
        ownerId: 'player-1',
        position: { x: 100, y: 100 },
        velocity: { x: 10, y: 0 },
        damage: 10,
      });

      // Should use updated weapon type
      expect(mockAudioManager.playWeaponSound).toHaveBeenCalledWith('Uzi');
    });

    it('should not update weapon type for remote player weapon pickup', () => {
      // Set audio manager
      eventHandlers.setAudioManager(mockAudioManager);

      // Simulate weapon pickup for remote player
      const weaponPickupHandler = messageHandlers.get('weapon:pickup_confirmed');
      expect(weaponPickupHandler).toBeDefined();

      weaponPickupHandler!({
        playerId: 'player-2',
        crateId: 'crate-1',
        weaponType: 'Shotgun',
      });

      // Weapon type should not change (still pistol)
      expect(eventHandlers.getCurrentWeaponType()).toBe('pistol');
    });
  });

  describe('Audio manager lifecycle', () => {
    it('should allow setting audio manager', () => {
      expect(() => eventHandlers.setAudioManager(mockAudioManager)).not.toThrow();
    });

    it('should allow getting current weapon type', () => {
      expect(eventHandlers.getCurrentWeaponType()).toBe('pistol');
    });
  });
});
