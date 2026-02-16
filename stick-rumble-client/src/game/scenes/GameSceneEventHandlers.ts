import type { WebSocketClient } from '../network/WebSocketClient';
import type { PlayerManager } from '../entities/PlayerManager';
import type { ProjectileManager } from '../entities/ProjectileManager';
import type { WeaponCrateManager } from '../entities/WeaponCrateManager';
import type { MeleeWeaponManager } from '../entities/MeleeWeaponManager';
import type { HitEffectManager } from '../entities/HitEffectManager';
import type { PickupPromptUI } from '../ui/PickupPromptUI';
import type { InputManager } from '../input/InputManager';
import type { ShootingManager } from '../input/ShootingManager';
import type { DodgeRollManager } from '../input/DodgeRollManager';
import type { HealthBarUI } from '../ui/HealthBarUI';
import type { KillFeedUI } from '../ui/KillFeedUI';
import type { GameSceneUI } from './GameSceneUI';
import type { GameSceneSpectator } from './GameSceneSpectator';
import type { ScreenShake } from '../effects/ScreenShake';
import type { AudioManager } from '../audio/AudioManager';
import type { PredictionEngine } from '../physics/PredictionEngine';
// Import generated schema types for server→client messages (replaces manual type assertions)
import type {
  RoomJoinedData,
  PlayerMoveData,
  ProjectileSpawnData,
  ProjectileDestroyData,
  WeaponStateData,
  ShootFailedData,
  PlayerDamagedData,
  HitConfirmedData,
  PlayerDeathData,
  PlayerKillCreditData,
  PlayerRespawnData,
  MatchTimerData,
  MatchEndedData,
  WeaponSpawnedData,
  WeaponPickupConfirmedData,
  WeaponRespawnedData,
  MeleeHitData,
  RollStartData,
  RollEndData,
} from '../../../../events-schema/src/index.js';

/**
 * GameSceneEventHandlers - Manages all WebSocket event handlers
 * Responsibility: Network message handling and routing
 */
export class GameSceneEventHandlers {
  private wsClient: WebSocketClient;
  private playerManager: PlayerManager;
  private projectileManager: ProjectileManager;
  private weaponCrateManager: WeaponCrateManager;
  private meleeWeaponManager: MeleeWeaponManager;
  private hitEffectManager: HitEffectManager;
  private pickupPromptUI: PickupPromptUI;
  private inputManager: InputManager | null = null;
  private shootingManager: ShootingManager | null = null;
  private dodgeRollManager: DodgeRollManager | null = null;
  private predictionEngine: PredictionEngine | null = null;
  private getHealthBarUI: () => HealthBarUI;
  private killFeedUI: KillFeedUI;
  private ui: GameSceneUI;
  private spectator: GameSceneSpectator;
  private localPlayerHealth: number = 100;
  private onCameraFollowNeeded: () => void;
  private handlerRefs: Map<string, (data: unknown) => void> = new Map();
  private screenShake: ScreenShake | null = null;
  private audioManager: AudioManager | null = null;
  private currentWeaponType: string = 'pistol'; // Default weapon
  private matchEnded: boolean = false; // Flag to stop processing player:move after match ends
  private pendingPlayerMoves: unknown[] = []; // Queue for player:move messages before room:joined
  private pendingWeaponSpawns: unknown[] = []; // Queue for weapon:spawned messages before room:joined

  constructor(
    wsClient: WebSocketClient,
    playerManager: PlayerManager,
    projectileManager: ProjectileManager,
    getHealthBarUI: () => HealthBarUI,
    killFeedUI: KillFeedUI,
    ui: GameSceneUI,
    spectator: GameSceneSpectator,
    onCameraFollowNeeded: () => void,
    weaponCrateManager: WeaponCrateManager,
    pickupPromptUI: PickupPromptUI,
    meleeWeaponManager: MeleeWeaponManager,
    hitEffectManager: HitEffectManager
  ) {
    this.wsClient = wsClient;
    this.playerManager = playerManager;
    this.projectileManager = projectileManager;
    this.getHealthBarUI = getHealthBarUI;
    this.killFeedUI = killFeedUI;
    this.ui = ui;
    this.spectator = spectator;
    this.onCameraFollowNeeded = onCameraFollowNeeded;
    this.weaponCrateManager = weaponCrateManager;
    this.pickupPromptUI = pickupPromptUI;
    this.meleeWeaponManager = meleeWeaponManager;
    this.hitEffectManager = hitEffectManager;
  }

  /**
   * Set input manager (called after connection)
   */
  setInputManager(inputManager: InputManager): void {
    this.inputManager = inputManager;
  }

  /**
   * Set shooting manager (called after connection)
   */
  setShootingManager(shootingManager: ShootingManager): void {
    this.shootingManager = shootingManager;
  }

  /**
   * Set screen shake instance for recoil feedback
   */
  setScreenShake(screenShake: ScreenShake): void {
    this.screenShake = screenShake;
  }

  /**
   * Set audio manager instance for weapon firing sounds
   */
  setAudioManager(audioManager: AudioManager): void {
    this.audioManager = audioManager;
  }

  /**
   * Set dodge roll manager (called after connection)
   */
  setDodgeRollManager(dodgeRollManager: DodgeRollManager): void {
    this.dodgeRollManager = dodgeRollManager;
  }

  /**
   * Set prediction engine for client-side reconciliation
   */
  setPredictionEngine(predictionEngine: PredictionEngine): void {
    this.predictionEngine = predictionEngine;
  }

  /**
   * Get the current weapon type
   */
  getCurrentWeaponType(): string {
    return this.currentWeaponType;
  }

  /**
   * Cleanup all registered event handlers
   * Called before re-registering handlers to prevent accumulation
   */
  private cleanupHandlers(): void {
    // Remove all registered handlers from WebSocket client
    for (const [eventType, handler] of this.handlerRefs) {
      this.wsClient.off(eventType, handler);
    }
    // Clear the handler references map
    this.handlerRefs.clear();
    // Reset match ended flag for potential future matches
    this.matchEnded = false;
    // Clear any pending message queues
    this.pendingPlayerMoves = [];
    this.pendingWeaponSpawns = [];
  }

  /**
   * Destroy event handlers (called on scene shutdown)
   * Public method to cleanup all registered handlers
   */
  destroy(): void {
    this.cleanupHandlers();
  }

  /**
   * Setup all WebSocket message handlers
   * Cleanup existing handlers first to prevent accumulation
   */
  setupEventHandlers(): void {
    // Cleanup existing handlers before registering new ones
    this.cleanupHandlers();

    // Store and register player:move handler
    const playerMoveHandler = (data: unknown) => {
      // Skip processing player:move after match has ended to prevent null reference errors
      if (this.matchEnded) {
        return;
      }
      // If no local player ID set, queue and wait for room:joined
      // The server assigns a NEW player ID on each connection.
      if (!this.playerManager.getLocalPlayerId()) {
        // Queue player:move until room:joined has set the local player ID
        // This prevents creating duplicate sprites when player:move arrives before room:joined
        // Limit queue size to prevent memory issues while waiting for room (keep only latest 10)
        if (this.pendingPlayerMoves.length >= 10) {
          this.pendingPlayerMoves.shift();
        }
        this.pendingPlayerMoves.push(data);
        return;
      }
      const messageData = data as PlayerMoveData & { isFullSnapshot?: boolean };
      if (messageData.players) {
        // When isFullSnapshot is explicitly false (delta), use merge mode to avoid destroying
        // sprites for players that are simply unchanged (not disconnected).
        // When isFullSnapshot is true or undefined (legacy player:move), use snapshot mode.
        const isDelta = messageData.isFullSnapshot === false;
        this.playerManager.updatePlayers(messageData.players, { isDelta });

        // Update melee weapon positions to follow players
        for (const player of messageData.players) {
          this.meleeWeaponManager.updatePosition(player.id, player.position);
        }

        // Update input manager with local player position for aim calculation
        if (this.inputManager && this.playerManager.getLocalPlayerId()) {
          const localPlayer = messageData.players.find(
            (p: { id: string }) => p.id === this.playerManager.getLocalPlayerId()
          );
          if (localPlayer) {
            this.inputManager.setPlayerPosition(
              localPlayer.position.x,
              localPlayer.position.y
            );

            // Update health bar from server state (including regeneration)
            if (localPlayer.health !== undefined) {
              this.localPlayerHealth = localPlayer.health;
              // isRegenerating is not in the schema, use optional chaining with type-safe accessor
              const isRegen = 'isRegenerating' in localPlayer ? (localPlayer as { isRegenerating?: boolean }).isRegenerating ?? false : false;
              this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100, isRegen);
            }
          }
        }

        // Client-side prediction reconciliation (Story 4.2 + stick-rumble-nki)
        // Always reconcile local player prediction with server state
        const localPlayerId = this.playerManager.getLocalPlayerId();
        if (localPlayerId && this.predictionEngine && this.inputManager) {
          // Always reconcile for local player to correct any prediction drift
          this.handleServerCorrection(messageData, localPlayerId);
        }

        // Clear input history up to server's last processed sequence (Story 4.2)
        // This prevents memory bloat from accumulating inputs
        if (localPlayerId && messageData.lastProcessedSequence && this.inputManager) {
          const lastProcessed = messageData.lastProcessedSequence[localPlayerId];
          if (lastProcessed !== undefined) {
            this.inputManager.clearInputHistoryUpTo(lastProcessed);
          }
        }

        // Start camera follow on local player sprite (if not already following)
        this.onCameraFollowNeeded();
      }
    };
    this.handlerRefs.set('player:move', playerMoveHandler);
    this.wsClient.on('player:move', playerMoveHandler);

    // Store and register room:joined handler
    const roomJoinedHandler = (data: unknown) => {
      const messageData = data as RoomJoinedData;

      // Reset match ended flag for new match
      this.matchEnded = false;

      // Clear existing players to prevent duplication if room:joined fires multiple times
      // This handles reconnect scenarios and future match restart functionality
      this.playerManager.destroy();

      // Set local player ID so we can highlight our player
      if (messageData.playerId) {
        this.playerManager.setLocalPlayerId(messageData.playerId);
        // Initialize health bar to full health on join
        this.localPlayerHealth = 100;
        this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100, false);

        // Clear any queued player:move messages - they are stale (captured before room was created)
        // The next player:move from the server will have the correct player list
        this.pendingPlayerMoves = [];

        // Process any queued weapon:spawned messages
        for (const pendingData of this.pendingWeaponSpawns) {
          const weaponData = pendingData as WeaponSpawnedData;
          if (weaponData.crates) {
            for (const crateData of weaponData.crates) {
              this.weaponCrateManager.spawnCrate(crateData);
            }
          }
        }
        this.pendingWeaponSpawns = [];
      }
    };
    this.handlerRefs.set('room:joined', roomJoinedHandler);
    this.wsClient.on('room:joined', roomJoinedHandler);

    // Store and register projectile:spawn handler
    const projectileSpawnHandler = (data: unknown) => {
      // Skip until room:joined has set local player ID (scene not ready)
      if (!this.playerManager.getLocalPlayerId()) {
        return;
      }
      const messageData = data as ProjectileSpawnData;
      this.projectileManager.spawnProjectile(messageData);

      // Create muzzle flash at projectile origin (Story 3.7B: Hit Effects)
      if (this.hitEffectManager) {
        // Calculate rotation from velocity direction
        const rotation = Math.atan2(messageData.velocity.y, messageData.velocity.x);
        this.hitEffectManager.showMuzzleFlash(
          messageData.position.x,
          messageData.position.y,
          rotation
        );
      }

      const isLocalPlayer = messageData.ownerId === this.playerManager.getLocalPlayerId();

      // Trigger screen shake for local player's weapon fire (Story 3.3 Polish)
      if (this.screenShake && isLocalPlayer) {
        this.screenShake.shakeOnWeaponFire(this.currentWeaponType);
      }

      // Play weapon firing sound (Story 3.3 Polish: Weapon-Specific Firing Sounds)
      if (this.audioManager) {
        if (isLocalPlayer) {
          // Local player: play normal sound using current weapon type
          this.audioManager.playWeaponSound(this.currentWeaponType);
        } else {
          // Remote player: play positional audio
          const localPlayerPosition = this.playerManager.getLocalPlayerPosition();
          if (localPlayerPosition) {
            this.audioManager.playWeaponSoundPositional(
              this.currentWeaponType,
              messageData.position.x,
              messageData.position.y,
              localPlayerPosition.x,
              localPlayerPosition.y
            );
          }
        }
      }
    };
    this.handlerRefs.set('projectile:spawn', projectileSpawnHandler);
    this.wsClient.on('projectile:spawn', projectileSpawnHandler);

    // Store and register projectile:destroy handler
    const projectileDestroyHandler = (data: unknown) => {
      const messageData = data as ProjectileDestroyData;
      this.projectileManager.removeProjectile(messageData.id);
    };
    this.handlerRefs.set('projectile:destroy', projectileDestroyHandler);
    this.wsClient.on('projectile:destroy', projectileDestroyHandler);

    // Store and register weapon:state handler
    const weaponStateHandler = (data: unknown) => {
      const messageData = data as WeaponStateData;
      if (this.shootingManager) {
        this.shootingManager.updateWeaponState(messageData);
        // Update weapon type for cooldown tracking if it's a melee weapon
        if (messageData.weaponType === 'Bat' || messageData.weaponType === 'Katana') {
          this.shootingManager.setWeaponType(messageData.weaponType as 'Bat' | 'Katana');
        }
        this.ui.updateAmmoDisplay(this.shootingManager);
      }
    };
    this.handlerRefs.set('weapon:state', weaponStateHandler);
    this.wsClient.on('weapon:state', weaponStateHandler);

    // Store and register shoot:failed handler
    const shootFailedHandler = (data: unknown) => {
      const messageData = data as ShootFailedData;
      if (messageData.reason === 'empty') {
        // TODO: Play empty click sound in future story
        console.log('Click! Magazine empty');
      }
    };
    this.handlerRefs.set('shoot:failed', shootFailedHandler);
    this.wsClient.on('shoot:failed', shootFailedHandler);

    // Store and register player:damaged handler
    const playerDamagedHandler = (data: unknown) => {
      const messageData = data as PlayerDamagedData;
      console.log(
        `Player ${messageData.victimId} took ${messageData.damage} damage from ${messageData.attackerId} (health: ${messageData.newHealth})`
      );

      // Update health bar if local player was damaged
      if (messageData.victimId === this.playerManager.getLocalPlayerId()) {
        this.localPlayerHealth = messageData.newHealth;
        this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100, false); // Not regenerating when damaged
        this.ui.showDamageFlash();
      }

      // Show damage numbers above damaged player
      this.ui.showDamageNumber(this.playerManager, messageData.victimId, messageData.damage);

      // Show hit effect at victim position (Story 3.7B: Hit Effects)
      const victimPos = this.playerManager.getPlayerPosition(messageData.victimId);
      if (victimPos && this.hitEffectManager) {
        // Determine effect type based on damage source
        // If damageType is 'melee', show melee hit effect, otherwise bullet impact
        const damageType = 'damageType' in messageData ? (messageData as { damageType?: string }).damageType : undefined;
        if (damageType === 'melee') {
          this.hitEffectManager.showMeleeHit(victimPos.x, victimPos.y);
        } else {
          this.hitEffectManager.showBulletImpact(victimPos.x, victimPos.y);
        }
      }
    };
    this.handlerRefs.set('player:damaged', playerDamagedHandler);
    this.wsClient.on('player:damaged', playerDamagedHandler);

    // Store and register hit:confirmed handler
    const hitConfirmedHandler = (data: unknown) => {
      const messageData = data as HitConfirmedData;
      console.log(`Hit confirmed! Dealt ${messageData.damage} damage to ${messageData.victimId}`);
      this.ui.showHitMarker();
      this.ui.showCameraShake();
      // TODO: Audio feedback (ding sound) - deferred to audio story
    };
    this.handlerRefs.set('hit:confirmed', hitConfirmedHandler);
    this.wsClient.on('hit:confirmed', hitConfirmedHandler);

    // Store and register player:death handler
    const playerDeathHandler = (data: unknown) => {
      const messageData = data as PlayerDeathData;
      console.log(`Player ${messageData.victimId} was killed by ${messageData.attackerId}`);

      // If local player died, hide sprite and enter spectator mode
      if (messageData.victimId === this.playerManager.getLocalPlayerId()) {
        this.playerManager.setPlayerVisible(messageData.victimId, false);
        this.spectator.enterSpectatorMode();
      }
    };
    this.handlerRefs.set('player:death', playerDeathHandler);
    this.wsClient.on('player:death', playerDeathHandler);

    // Store and register player:kill_credit handler
    const playerKillCreditHandler = (data: unknown) => {
      const messageData = data as PlayerKillCreditData;
      console.log(`Kill credit: ${messageData.killerId} killed ${messageData.victimId} (Kills: ${messageData.killerKills}, XP: ${messageData.killerXP})`);

      // Add kill to feed (using player IDs for now - will be replaced with names later)
      this.killFeedUI.addKill(messageData.killerId.substring(0, 8), messageData.victimId.substring(0, 8));
    };
    this.handlerRefs.set('player:kill_credit', playerKillCreditHandler);
    this.wsClient.on('player:kill_credit', playerKillCreditHandler);

    // Store and register player:respawn handler
    const playerRespawnHandler = (data: unknown) => {
      const messageData = data as PlayerRespawnData;
      console.log(`Player ${messageData.playerId} respawned at (${messageData.position.x}, ${messageData.position.y})`);

      // If local player respawned, teleport to spawn position, show, then exit spectator mode
      if (messageData.playerId === this.playerManager.getLocalPlayerId()) {
        this.localPlayerHealth = messageData.health;
        this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100, false); // Not regenerating on respawn

        // Teleport to spawn position before showing to prevent flicker
        this.playerManager.teleportPlayer(messageData.playerId, messageData.position);
        this.playerManager.setPlayerVisible(messageData.playerId, true);
        this.spectator.exitSpectatorMode();

        // Camera follow will be restarted automatically on next player:move
        // via startCameraFollowIfNeeded() since isCameraFollowing was reset
      }
    };
    this.handlerRefs.set('player:respawn', playerRespawnHandler);
    this.wsClient.on('player:respawn', playerRespawnHandler);

    // Store and register match:timer handler
    const matchTimerHandler = (data: unknown) => {
      // Skip if match has ended
      if (this.matchEnded) {
        return;
      }
      const messageData = data as MatchTimerData;
      this.ui.updateMatchTimer(messageData.remainingSeconds);
    };
    this.handlerRefs.set('match:timer', matchTimerHandler);
    this.wsClient.on('match:timer', matchTimerHandler);

    // Store and register match:ended handler
    const matchEndedHandler = (data: unknown) => {
      const messageData = data as MatchEndedData;
      console.log(`Match ended! Reason: ${messageData.reason}, Winners:`, messageData.winners);
      console.log('Final scores:', messageData.finalScores);

      // Set match ended flag to stop processing player:move messages
      this.matchEnded = true;

      // Freeze gameplay by disabling input handlers
      if (this.inputManager) {
        this.inputManager.disable();
      }
      if (this.shootingManager) {
        this.shootingManager.disable();
      }

      // Trigger match end UI via React callback
      const localPlayerId = this.playerManager.getLocalPlayerId();
      if (localPlayerId && window.onMatchEnd) {
        // Bridge between MatchEndedData schema and window.onMatchEnd type
        // Both schema and window.onMatchEnd now use PlayerScore[] for finalScores
        window.onMatchEnd(messageData as unknown as import('../../../src/shared/types.js').MatchEndData, localPlayerId);
      }
    };
    this.handlerRefs.set('match:ended', matchEndedHandler);
    this.wsClient.on('match:ended', matchEndedHandler);

    // Store and register weapon:spawned handler (initial weapon crate spawns)
    const weaponSpawnedHandler = (data: unknown) => {
      // Queue until room:joined has set local player ID (scene not ready)
      if (!this.playerManager.getLocalPlayerId()) {
        // Limit queue size to prevent memory issues (keep only latest 10)
        if (this.pendingWeaponSpawns.length >= 10) {
          this.pendingWeaponSpawns.shift();
        }
        this.pendingWeaponSpawns.push(data);
        return;
      }
      const messageData = data as WeaponSpawnedData;
      if (messageData.crates) {
        for (const crateData of messageData.crates) {
          this.weaponCrateManager.spawnCrate(crateData);
        }
      }
    };
    this.handlerRefs.set('weapon:spawned', weaponSpawnedHandler);
    this.wsClient.on('weapon:spawned', weaponSpawnedHandler);

    // Store and register weapon:pickup_confirmed handler
    const weaponPickupConfirmedHandler = (data: unknown) => {
      const messageData = data as WeaponPickupConfirmedData;
      // Mark crate as unavailable
      this.weaponCrateManager.markUnavailable(messageData.crateId);

      // Hide pickup prompt if it's the same crate
      if (this.pickupPromptUI.isVisible()) {
        this.pickupPromptUI.hide();
      }

      // Track weapon type for local player (Story 3.3 Polish - for recoil feedback)
      if (messageData.playerId === this.playerManager.getLocalPlayerId()) {
        this.currentWeaponType = messageData.weaponType;
      }

      // Update weapon sprite for the player (Story 3.7A - weapon sprites)
      this.playerManager.updatePlayerWeapon(messageData.playerId, messageData.weaponType);

      // Create melee weapon visual if picking up Bat or Katana
      const playerPos = this.playerManager.getPlayerPosition(messageData.playerId);
      if (playerPos) {
        this.meleeWeaponManager.createWeapon(
          messageData.playerId,
          messageData.weaponType,
          playerPos
        );
      }
    };
    this.handlerRefs.set('weapon:pickup_confirmed', weaponPickupConfirmedHandler);
    this.wsClient.on('weapon:pickup_confirmed', weaponPickupConfirmedHandler);

    // Store and register weapon:respawned handler
    const weaponRespawnedHandler = (data: unknown) => {
      const messageData = data as WeaponRespawnedData;
      // Mark crate as available again
      this.weaponCrateManager.markAvailable(messageData.crateId);
    };
    this.handlerRefs.set('weapon:respawned', weaponRespawnedHandler);
    this.wsClient.on('weapon:respawned', weaponRespawnedHandler);

    // Store and register melee:hit handler (triggers swing animation)
    const meleeHitHandler = (data: unknown) => {
      const messageData = data as MeleeHitData;

      // Get attacker's current aim angle and position
      const attackerPos = this.playerManager.getPlayerPosition(messageData.attackerId);
      if (!attackerPos) {
        return;
      }

      // Get attacker's aim angle (from player state)
      // We'll need to get this from the player manager
      const aimAngle = this.playerManager.getPlayerAimAngle(messageData.attackerId);
      if (aimAngle === null) {
        return;
      }

      // Update weapon position and trigger swing animation
      this.meleeWeaponManager.updatePosition(messageData.attackerId, attackerPos);
      this.meleeWeaponManager.startSwing(messageData.attackerId, aimAngle);

      // Show melee hit effect at attacker position (Story 3.7B: Hit Effects)
      // Effect will appear at the swing origin, actual damage is shown via player:damaged
      if (this.hitEffectManager) {
        // Calculate effect position in front of attacker based on aim angle
        const effectDistance = 30; // Distance in front of attacker
        const effectX = attackerPos.x + Math.cos(aimAngle) * effectDistance;
        const effectY = attackerPos.y + Math.sin(aimAngle) * effectDistance;
        this.hitEffectManager.showMeleeHit(effectX, effectY);
      }
    };
    this.handlerRefs.set('melee:hit', meleeHitHandler);
    this.wsClient.on('melee:hit', meleeHitHandler);

    // Store and register roll:start handler
    const rollStartHandler = (data: unknown) => {
      const messageData = data as RollStartData;
      console.log(`Player ${messageData.playerId} started dodge roll`);

      // Update dodge roll manager state
      if (this.dodgeRollManager && messageData.playerId === this.playerManager.getLocalPlayerId()) {
        this.dodgeRollManager.startRoll();
      }

      // Play whoosh sound effect
      if (this.audioManager) {
        this.audioManager.playDodgeRollSound();
      }

      // Roll animation with transparency is handled by PlayerManager
    };
    this.handlerRefs.set('roll:start', rollStartHandler);
    this.wsClient.on('roll:start', rollStartHandler);

    // Store and register roll:end handler
    const rollEndHandler = (data: unknown) => {
      const messageData = data as RollEndData;
      console.log(`Player ${messageData.playerId} ended dodge roll (reason: ${messageData.reason})`);

      // Update dodge roll manager state
      if (this.dodgeRollManager && messageData.playerId === this.playerManager.getLocalPlayerId()) {
        this.dodgeRollManager.endRoll();
      }

      // Roll animation reset is handled by PlayerManager
    };
    this.handlerRefs.set('roll:end', rollEndHandler);
    this.wsClient.on('roll:end', rollEndHandler);
  }

  /**
   * Handle server correction for client-side prediction (Story 4.2)
   * When server detects impossible movement, reconcile client state with server authority
   *
   * @param messageData - Player move data with correction info
   * @param localPlayerId - ID of the local player
   */
  private handleServerCorrection(messageData: PlayerMoveData, localPlayerId: string): void {
    // Ensure we have all required dependencies
    if (!this.inputManager || !this.predictionEngine) {
      return;
    }

    // Find local player in server state
    const localPlayer = messageData.players.find(p => p.id === localPlayerId);
    if (!localPlayer) {
      return;
    }

    // Get last processed sequence from server
    const lastProcessedSequence = messageData.lastProcessedSequence?.[localPlayerId];
    if (lastProcessedSequence === undefined) {
      // No sequence info - update predicted state and apply server position
      this.playerManager.setLocalPlayerPredictedPosition({
        position: localPlayer.position,
        velocity: localPlayer.velocity,
      });
      // Apply server position as the source of truth
      this.playerManager.applyReconciledPosition(
        localPlayerId,
        { position: localPlayer.position, velocity: localPlayer.velocity },
        false // Use smooth interpolation for updates without sequence info
      );
      return;
    }

    // Get pending inputs that need to be replayed
    const pendingInputs = this.inputManager.getInputHistory();

    // Reconcile: Start from server's authoritative state, replay pending inputs
    const reconciledState = this.predictionEngine.reconcile(
      localPlayer.position,
      localPlayer.velocity,
      lastProcessedSequence,
      pendingInputs
    );

    // Update predicted state with reconciled position
    this.playerManager.setLocalPlayerPredictedPosition(reconciledState);

    // Determine if correction needs instant teleport or smooth lerp
    const currentPosition = this.playerManager.getPlayerPosition(localPlayerId);
    const needsInstant = currentPosition
      ? this.predictionEngine.needsInstantCorrection(currentPosition, localPlayer.position)
      : false;

    // Apply reconciled state to player sprite
    this.playerManager.applyReconciledPosition(localPlayerId, reconciledState, needsInstant);
  }
}
