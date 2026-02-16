import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { GameSceneEventHandlers } from './GameSceneEventHandlers';
import { PredictionEngine } from '../physics/PredictionEngine';
import type { WebSocketClient } from '../network/WebSocketClient';
import type { PlayerManager } from '../entities/PlayerManager';
import type { ProjectileManager } from '../entities/ProjectileManager';
import type { InputManager } from '../input/InputManager';
import type { HealthBarUI } from '../ui/HealthBarUI';
import type { KillFeedUI } from '../ui/KillFeedUI';
import type { GameSceneUI } from './GameSceneUI';
import type { GameSceneSpectator } from './GameSceneSpectator';
import type { PlayerMoveData } from '../../../../events-schema/src/index.js';

describe('GameSceneEventHandlers - Client-Side Reconciliation', () => {
  let mockWsClient: WebSocketClient;
  let mockPlayerManager: PlayerManager;
  let mockProjectileManager: ProjectileManager;
  let mockInputManager: InputManager;
  let mockWeaponCrateManager: any;
  let mockPickupPromptUI: any;
  let mockMeleeWeaponManager: any;
  let mockHitEffectManager: any;
  let mockHealthBarUI: HealthBarUI;
  let mockKillFeedUI: KillFeedUI;
  let mockGameSceneUI: GameSceneUI;
  let mockGameSceneSpectator: GameSceneSpectator;
  let eventHandlers: GameSceneEventHandlers;
  let predictionEngine: PredictionEngine;
  let playerMoveHandler: (data: unknown) => void;

  beforeEach(() => {
    // Track registered handlers
    const handlers = new Map<string, (data: unknown) => void>();

    mockWsClient = {
      on: vi.fn((event: string, handler: (data: unknown) => void) => {
        handlers.set(event, handler);
      }),
      off: vi.fn(),
      send: vi.fn(),
    } as unknown as WebSocketClient;

    mockPlayerManager = {
      updatePlayers: vi.fn(),
      destroy: vi.fn(),
      setLocalPlayerId: vi.fn(),
      getLocalPlayerId: vi.fn().mockReturnValue('player-1'),
      getPlayerPosition: vi.fn().mockReturnValue({ x: 490, y: 490 }), // Close to server position (500, 500)
      getPlayerAimAngle: vi.fn().mockReturnValue(0),
      updatePlayerWeapon: vi.fn(),
      applyReconciledPosition: vi.fn(),
      setLocalPlayerPredictedPosition: vi.fn(),
      getPlayerState: vi.fn().mockReturnValue({ position: { x: 500, y: 500 }, velocity: { x: 0, y: 0 } }),
      getLocalPlayerPredictedState: vi.fn().mockReturnValue(null),
    } as unknown as PlayerManager;

    mockProjectileManager = {
      spawnProjectile: vi.fn(),
      removeProjectile: vi.fn(),
    } as unknown as ProjectileManager;

    mockInputManager = {
      getInputHistory: vi.fn().mockReturnValue([]),
      clearInputHistoryUpTo: vi.fn(),
      setPlayerPosition: vi.fn(),
      getCurrentSequence: vi.fn().mockReturnValue(5),
    } as unknown as InputManager;

    mockWeaponCrateManager = {
      spawnCrate: vi.fn(),
      markUnavailable: vi.fn(),
      markAvailable: vi.fn(),
    };

    mockPickupPromptUI = {
      show: vi.fn(),
      hide: vi.fn(),
      isVisible: vi.fn().mockReturnValue(false),
    };

    mockMeleeWeaponManager = {
      createWeapon: vi.fn(),
      updatePosition: vi.fn(),
      startSwing: vi.fn(),
      destroy: vi.fn(),
    };

    mockHitEffectManager = {
      showBulletImpact: vi.fn(),
      showMeleeHit: vi.fn(),
      showMuzzleFlash: vi.fn(),
      destroy: vi.fn(),
    };

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

    predictionEngine = new PredictionEngine();

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
      mockMeleeWeaponManager,
      mockHitEffectManager
    );

    // Inject dependencies
    eventHandlers.setInputManager(mockInputManager);
    eventHandlers.setPredictionEngine(predictionEngine);

    // Setup handlers
    eventHandlers.setupEventHandlers();

    // Extract the player:move handler for testing
    playerMoveHandler = handlers.get('player:move')!;
  });

  it('should process correctedPlayers field when local player is corrected', () => {
    const messageData: PlayerMoveData = {
      players: [
        {
          id: 'player-1',
          position: { x: 500, y: 500 },
          velocity: { x: 0, y: 0 },
          health: 100,
          maxHealth: 100,
          rotation: 0,
          isDead: false,
          isSprinting: false,
          isRolling: false,
        },
      ],
      lastProcessedSequence: { 'player-1': 3 },
      correctedPlayers: ['player-1'],
    };

    // Mock input history with pending inputs
    (mockInputManager.getInputHistory as Mock).mockReturnValue([
      { sequence: 1, input: { up: true, down: false, left: false, right: false, aimAngle: 0, isSprinting: false, sequence: 1 }, timestamp: 1000 },
      { sequence: 2, input: { up: true, down: false, left: false, right: false, aimAngle: 0, isSprinting: false, sequence: 2 }, timestamp: 1016 },
      { sequence: 3, input: { up: true, down: false, left: false, right: false, aimAngle: 0, isSprinting: false, sequence: 3 }, timestamp: 1032 },
      { sequence: 4, input: { up: true, down: false, left: false, right: false, aimAngle: 0, isSprinting: false, sequence: 4 }, timestamp: 1048 },
      { sequence: 5, input: { up: false, down: false, left: false, right: false, aimAngle: 0, isSprinting: false, sequence: 5 }, timestamp: 1064 },
    ]);

    playerMoveHandler(messageData);

    // Verify input history was cleared up to lastProcessedSequence
    expect(mockInputManager.clearInputHistoryUpTo).toHaveBeenCalledWith(3);

    // Verify PlayerManager was called to apply reconciled position
    expect(mockPlayerManager.applyReconciledPosition).toHaveBeenCalled();

    // Call should include player-1, reconciled position, and whether instant correction is needed
    const call = (mockPlayerManager.applyReconciledPosition as Mock).mock.calls[0];
    expect(call[0]).toBe('player-1');
    expect(call[1]).toMatchObject({
      position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      velocity: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
    });
    expect(call[2]).toBe(false); // Small correction, not instant
  });

  it('should request instant correction for large prediction errors (>=100px)', () => {
    const messageData: PlayerMoveData = {
      players: [
        {
          id: 'player-1',
          position: { x: 500, y: 500 }, // Server says we're at 500,500
          velocity: { x: 0, y: 0 },
          health: 100,
          maxHealth: 100,
          rotation: 0,
          isDead: false,
          isSprinting: false,
          isRolling: false,
        },
      ],
      lastProcessedSequence: { 'player-1': 3 },
      correctedPlayers: ['player-1'],
    };

    // Mock current predicted position far from server position (>100px error)
    (mockPlayerManager.getPlayerPosition as Mock).mockReturnValue({ x: 100, y: 100 });

    // Mock empty input history (all inputs already processed)
    (mockInputManager.getInputHistory as Mock).mockReturnValue([]);

    playerMoveHandler(messageData);

    // Verify instant correction flag is true for large error
    const call = (mockPlayerManager.applyReconciledPosition as Mock).mock.calls[0];
    expect(call[2]).toBe(true); // Large correction, instant teleport
  });

  it('should always reconcile local player even if not in correctedPlayers list (Story stick-rumble-nki)', () => {
    const messageData: PlayerMoveData = {
      players: [
        {
          id: 'player-1',
          position: { x: 500, y: 500 },
          velocity: { x: 0, y: 0 },
          health: 100,
          maxHealth: 100,
          rotation: 0,
          isDead: false,
          isSprinting: false,
          isRolling: false,
        },
      ],
      lastProcessedSequence: { 'player-1': 3 },
      correctedPlayers: ['player-2'], // Different player corrected
    };

    playerMoveHandler(messageData);

    // Verify reconciliation always happens for local player (Story stick-rumble-nki)
    expect(mockPlayerManager.applyReconciledPosition).toHaveBeenCalled();

    // Input history is still cleared (separate from correction logic)
    expect(mockInputManager.clearInputHistoryUpTo).toHaveBeenCalledWith(3);
  });

  it('should always reconcile local player even with missing correctedPlayers field (Story stick-rumble-nki)', () => {
    const messageData: PlayerMoveData = {
      players: [
        {
          id: 'player-1',
          position: { x: 500, y: 500 },
          velocity: { x: 0, y: 0 },
          health: 100,
          maxHealth: 100,
          rotation: 0,
          isDead: false,
          isSprinting: false,
          isRolling: false,
        },
      ],
      lastProcessedSequence: { 'player-1': 3 },
      // correctedPlayers is optional, may be undefined
    };

    playerMoveHandler(messageData);

    // Verify reconciliation always happens for local player (Story stick-rumble-nki)
    expect(mockPlayerManager.applyReconciledPosition).toHaveBeenCalled();
  });

  it('should clear input history even without correction', () => {
    const messageData: PlayerMoveData = {
      players: [
        {
          id: 'player-1',
          position: { x: 500, y: 500 },
          velocity: { x: 0, y: 0 },
          health: 100,
          maxHealth: 100,
          rotation: 0,
          isDead: false,
          isSprinting: false,
          isRolling: false,
        },
      ],
      lastProcessedSequence: { 'player-1': 3 },
      // No correctedPlayers
    };

    playerMoveHandler(messageData);

    // Input history should still be cleared
    expect(mockInputManager.clearInputHistoryUpTo).toHaveBeenCalledWith(3);
  });

  it('should handle missing lastProcessedSequence gracefully', () => {
    const messageData: PlayerMoveData = {
      players: [
        {
          id: 'player-1',
          position: { x: 500, y: 500 },
          velocity: { x: 0, y: 0 },
          health: 100,
          maxHealth: 100,
          rotation: 0,
          isDead: false,
          isSprinting: false,
          isRolling: false,
        },
      ],
      // lastProcessedSequence is optional
      correctedPlayers: ['player-1'],
    };

    // Should not throw
    expect(() => playerMoveHandler(messageData)).not.toThrow();

    // Should not attempt to clear history without lastProcessedSequence
    expect(mockInputManager.clearInputHistoryUpTo).not.toHaveBeenCalled();
  });

  it('should not reconcile if InputManager is null', () => {
    // Set InputManager to null
    eventHandlers.setInputManager(null as any);
    eventHandlers.setupEventHandlers();

    const messageData: PlayerMoveData = {
      players: [
        {
          id: 'player-1',
          position: { x: 500, y: 500 },
          velocity: { x: 0, y: 0 },
          health: 100,
          maxHealth: 100,
          rotation: 0,
          isDead: false,
          isSprinting: false,
          isRolling: false,
        },
      ],
      lastProcessedSequence: { 'player-1': 3 },
      correctedPlayers: ['player-1'],
    };

    // Should not throw
    expect(() => playerMoveHandler(messageData)).not.toThrow();

    // Should not call reconciliation without InputManager
    expect(mockPlayerManager.applyReconciledPosition).not.toHaveBeenCalled();
  });

  it('should not reconcile if PredictionEngine is null', () => {
    // Set PredictionEngine to null
    eventHandlers.setPredictionEngine(null as any);
    eventHandlers.setupEventHandlers();

    const messageData: PlayerMoveData = {
      players: [
        {
          id: 'player-1',
          position: { x: 500, y: 500 },
          velocity: { x: 0, y: 0 },
          health: 100,
          maxHealth: 100,
          rotation: 0,
          isDead: false,
          isSprinting: false,
          isRolling: false,
        },
      ],
      lastProcessedSequence: { 'player-1': 3 },
      correctedPlayers: ['player-1'],
    };

    // Should not throw
    expect(() => playerMoveHandler(messageData)).not.toThrow();

    // Should not call reconciliation without PredictionEngine
    expect(mockPlayerManager.applyReconciledPosition).not.toHaveBeenCalled();
  });

  it('should handle missing local player in server state', () => {
    const messageData: PlayerMoveData = {
      players: [
        {
          id: 'player-2', // Different player
          position: { x: 500, y: 500 },
          velocity: { x: 0, y: 0 },
          health: 100,
          maxHealth: 100,
          rotation: 0,
          isDead: false,
          isSprinting: false,
          isRolling: false,
        },
      ],
      lastProcessedSequence: { 'player-1': 3 },
      correctedPlayers: ['player-1'], // Player-1 is corrected but not in players array
    };

    // Should not throw
    expect(() => playerMoveHandler(messageData)).not.toThrow();

    // Should not call reconciliation if local player not found
    expect(mockPlayerManager.applyReconciledPosition).not.toHaveBeenCalled();
  });
});
