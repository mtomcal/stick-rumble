import type { WebSocketClient } from '../network/WebSocketClient';
import type { PlayerManager, PlayerState } from '../entities/PlayerManager';
import type { ProjectileManager, ProjectileData } from '../entities/ProjectileManager';
import type { InputManager } from '../input/InputManager';
import type { ShootingManager, WeaponState } from '../input/ShootingManager';
import type { HealthBarUI } from '../ui/HealthBarUI';
import type { KillFeedUI } from '../ui/KillFeedUI';
import type { GameSceneUI } from './GameSceneUI';
import type { GameSceneSpectator } from './GameSceneSpectator';

/**
 * GameSceneEventHandlers - Manages all WebSocket event handlers
 * Responsibility: Network message handling and routing
 */
export class GameSceneEventHandlers {
  private wsClient: WebSocketClient;
  private playerManager: PlayerManager;
  private projectileManager: ProjectileManager;
  private inputManager: InputManager | null = null;
  private shootingManager: ShootingManager | null = null;
  private getHealthBarUI: () => HealthBarUI;
  private killFeedUI: KillFeedUI;
  private ui: GameSceneUI;
  private spectator: GameSceneSpectator;
  private localPlayerHealth: number = 100;
  private onCameraFollowNeeded: () => void;
  private handlerRefs: Map<string, (data: unknown) => void> = new Map();

  constructor(
    wsClient: WebSocketClient,
    playerManager: PlayerManager,
    projectileManager: ProjectileManager,
    getHealthBarUI: () => HealthBarUI,
    killFeedUI: KillFeedUI,
    ui: GameSceneUI,
    spectator: GameSceneSpectator,
    onCameraFollowNeeded: () => void
  ) {
    this.wsClient = wsClient;
    this.playerManager = playerManager;
    this.projectileManager = projectileManager;
    this.getHealthBarUI = getHealthBarUI;
    this.killFeedUI = killFeedUI;
    this.ui = ui;
    this.spectator = spectator;
    this.onCameraFollowNeeded = onCameraFollowNeeded;
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
      const messageData = data as { players: PlayerState[] };
      if (messageData.players) {
        this.playerManager.updatePlayers(messageData.players);

        // Update input manager with local player position for aim calculation
        if (this.inputManager && this.playerManager.getLocalPlayerId()) {
          const localPlayer = messageData.players.find(
            p => p.id === this.playerManager.getLocalPlayerId()
          );
          if (localPlayer) {
            this.inputManager.setPlayerPosition(
              localPlayer.position.x,
              localPlayer.position.y
            );

            // Update health bar from server state (including regeneration)
            if (localPlayer.health !== undefined) {
              this.localPlayerHealth = localPlayer.health;
              this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100, localPlayer.isRegenerating ?? false);
            }
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
      const messageData = data as { playerId: string };
      console.log('Joined room as player:', messageData.playerId);

      // Clear existing players to prevent duplication if room:joined fires multiple times
      // This handles reconnect scenarios and future match restart functionality
      this.playerManager.destroy();

      // Set local player ID so we can highlight our player
      if (messageData.playerId) {
        this.playerManager.setLocalPlayerId(messageData.playerId);
        // Initialize health bar to full health on join
        this.localPlayerHealth = 100;
        this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100, false);
      }
    };
    this.handlerRefs.set('room:joined', roomJoinedHandler);
    this.wsClient.on('room:joined', roomJoinedHandler);

    // Store and register projectile:spawn handler
    const projectileSpawnHandler = (data: unknown) => {
      const projectileData = data as ProjectileData;
      this.projectileManager.spawnProjectile(projectileData);

      // Create muzzle flash at projectile origin
      this.projectileManager.createMuzzleFlash(
        projectileData.position.x,
        projectileData.position.y
      );
    };
    this.handlerRefs.set('projectile:spawn', projectileSpawnHandler);
    this.wsClient.on('projectile:spawn', projectileSpawnHandler);

    // Store and register projectile:destroy handler
    const projectileDestroyHandler = (data: unknown) => {
      const { id } = data as { id: string };
      this.projectileManager.removeProjectile(id);
    };
    this.handlerRefs.set('projectile:destroy', projectileDestroyHandler);
    this.wsClient.on('projectile:destroy', projectileDestroyHandler);

    // Store and register weapon:state handler
    const weaponStateHandler = (data: unknown) => {
      const weaponState = data as WeaponState;
      if (this.shootingManager) {
        this.shootingManager.updateWeaponState(weaponState);
        this.ui.updateAmmoDisplay(this.shootingManager);
      }
    };
    this.handlerRefs.set('weapon:state', weaponStateHandler);
    this.wsClient.on('weapon:state', weaponStateHandler);

    // Store and register shoot:failed handler
    const shootFailedHandler = (data: unknown) => {
      const { reason } = data as { reason: string };
      if (reason === 'empty') {
        // TODO: Play empty click sound in future story
        console.log('Click! Magazine empty');
      }
    };
    this.handlerRefs.set('shoot:failed', shootFailedHandler);
    this.wsClient.on('shoot:failed', shootFailedHandler);

    // Store and register player:damaged handler
    const playerDamagedHandler = (data: unknown) => {
      const damageData = data as {
        victimId: string;
        attackerId: string;
        damage: number;
        newHealth: number;
        projectileId: string;
      };
      console.log(
        `Player ${damageData.victimId} took ${damageData.damage} damage from ${damageData.attackerId} (health: ${damageData.newHealth})`
      );

      // Update health bar if local player was damaged
      if (damageData.victimId === this.playerManager.getLocalPlayerId()) {
        this.localPlayerHealth = damageData.newHealth;
        this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100, false); // Not regenerating when damaged
        this.ui.showDamageFlash();
      }

      // Show damage numbers above damaged player
      this.ui.showDamageNumber(this.playerManager, damageData.victimId, damageData.damage);
    };
    this.handlerRefs.set('player:damaged', playerDamagedHandler);
    this.wsClient.on('player:damaged', playerDamagedHandler);

    // Store and register hit:confirmed handler
    const hitConfirmedHandler = (data: unknown) => {
      const hitData = data as {
        victimId: string;
        damage: number;
        projectileId: string;
      };
      console.log(`Hit confirmed! Dealt ${hitData.damage} damage to ${hitData.victimId}`);
      this.ui.showHitMarker();
      // TODO: Audio feedback (ding sound) - deferred to audio story
    };
    this.handlerRefs.set('hit:confirmed', hitConfirmedHandler);
    this.wsClient.on('hit:confirmed', hitConfirmedHandler);

    // Store and register player:death handler
    const playerDeathHandler = (data: unknown) => {
      const deathData = data as {
        victimId: string;
        attackerId: string;
      };
      console.log(`Player ${deathData.victimId} was killed by ${deathData.attackerId}`);

      // If local player died, enter spectator mode
      if (deathData.victimId === this.playerManager.getLocalPlayerId()) {
        this.spectator.enterSpectatorMode();
      }
    };
    this.handlerRefs.set('player:death', playerDeathHandler);
    this.wsClient.on('player:death', playerDeathHandler);

    // Store and register player:kill_credit handler
    const playerKillCreditHandler = (data: unknown) => {
      const killData = data as {
        killerId: string;
        victimId: string;
        killerKills: number;
        killerXP: number;
      };
      console.log(`Kill credit: ${killData.killerId} killed ${killData.victimId} (Kills: ${killData.killerKills}, XP: ${killData.killerXP})`);

      // Add kill to feed (using player IDs for now - will be replaced with names later)
      this.killFeedUI.addKill(killData.killerId.substring(0, 8), killData.victimId.substring(0, 8));
    };
    this.handlerRefs.set('player:kill_credit', playerKillCreditHandler);
    this.wsClient.on('player:kill_credit', playerKillCreditHandler);

    // Store and register player:respawn handler
    const playerRespawnHandler = (data: unknown) => {
      const respawnData = data as {
        playerId: string;
        position: { x: number; y: number };
        health: number;
      };
      console.log(`Player ${respawnData.playerId} respawned at (${respawnData.position.x}, ${respawnData.position.y})`);

      // If local player respawned, exit spectator mode and reset health
      if (respawnData.playerId === this.playerManager.getLocalPlayerId()) {
        this.localPlayerHealth = respawnData.health;
        this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100, false); // Not regenerating on respawn
        this.spectator.exitSpectatorMode();

        // Camera follow will be restarted automatically on next player:move
        // via startCameraFollowIfNeeded() since isCameraFollowing was reset
      }
    };
    this.handlerRefs.set('player:respawn', playerRespawnHandler);
    this.wsClient.on('player:respawn', playerRespawnHandler);

    // Store and register match:timer handler
    const matchTimerHandler = (data: unknown) => {
      const timerData = data as { remainingSeconds: number };
      this.ui.updateMatchTimer(timerData.remainingSeconds);
    };
    this.handlerRefs.set('match:timer', matchTimerHandler);
    this.wsClient.on('match:timer', matchTimerHandler);

    // Store and register match:ended handler
    const matchEndedHandler = (data: unknown) => {
      const matchEndData = data as {
        winners: string[];
        finalScores: Array<{ playerId: string; kills: number; deaths: number; xp: number }>;
        reason: string;
      };
      console.log(`Match ended! Reason: ${matchEndData.reason}, Winners:`, matchEndData.winners);
      console.log('Final scores:', matchEndData.finalScores);

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
        window.onMatchEnd(matchEndData, localPlayerId);
      }
    };
    this.handlerRefs.set('match:ended', matchEndedHandler);
    this.wsClient.on('match:ended', matchEndedHandler);
  }
}
