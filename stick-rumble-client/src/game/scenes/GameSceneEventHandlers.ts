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
   * Setup all WebSocket message handlers
   */
  setupEventHandlers(): void {
    this.wsClient.on('player:move', (data) => {
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
          }
        }

        // Start camera follow on local player sprite (if not already following)
        this.onCameraFollowNeeded();
      }
    });

    this.wsClient.on('room:joined', (data) => {
      const messageData = data as { playerId: string };
      console.log('Joined room as player:', messageData.playerId);
      // Set local player ID so we can highlight our player
      if (messageData.playerId) {
        this.playerManager.setLocalPlayerId(messageData.playerId);
        // Initialize health bar to full health on join
        this.localPlayerHealth = 100;
        this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100);
      }
    });

    // Handle projectile spawn from server
    this.wsClient.on('projectile:spawn', (data) => {
      const projectileData = data as ProjectileData;
      this.projectileManager.spawnProjectile(projectileData);

      // Create muzzle flash at projectile origin
      this.projectileManager.createMuzzleFlash(
        projectileData.position.x,
        projectileData.position.y
      );
    });

    // Handle projectile destroy from server
    this.wsClient.on('projectile:destroy', (data) => {
      const { id } = data as { id: string };
      this.projectileManager.removeProjectile(id);
    });

    // Handle weapon state updates from server
    this.wsClient.on('weapon:state', (data) => {
      const weaponState = data as WeaponState;
      if (this.shootingManager) {
        this.shootingManager.updateWeaponState(weaponState);
        this.ui.updateAmmoDisplay(this.shootingManager);
      }
    });

    // Handle shoot failures (for empty click sound, etc.)
    this.wsClient.on('shoot:failed', (data) => {
      const { reason } = data as { reason: string };
      if (reason === 'empty') {
        // TODO: Play empty click sound in future story
        console.log('Click! Magazine empty');
      }
    });

    // Handle player damaged events
    this.wsClient.on('player:damaged', (data) => {
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
        this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100);
        this.ui.showDamageFlash();
      }

      // Show damage numbers above damaged player
      this.ui.showDamageNumber(this.playerManager, damageData.victimId, damageData.damage);
    });

    // Handle hit confirmation (for hit marker feedback)
    this.wsClient.on('hit:confirmed', (data) => {
      const hitData = data as {
        victimId: string;
        damage: number;
        projectileId: string;
      };
      console.log(`Hit confirmed! Dealt ${hitData.damage} damage to ${hitData.victimId}`);
      this.ui.showHitMarker();
      // TODO: Audio feedback (ding sound) - deferred to audio story
    });

    // Handle player death events
    this.wsClient.on('player:death', (data) => {
      const deathData = data as {
        victimId: string;
        attackerId: string;
      };
      console.log(`Player ${deathData.victimId} was killed by ${deathData.attackerId}`);

      // If local player died, enter spectator mode
      if (deathData.victimId === this.playerManager.getLocalPlayerId()) {
        this.spectator.enterSpectatorMode();
      }
    });

    // Handle player kill credit events
    this.wsClient.on('player:kill_credit', (data) => {
      const killData = data as {
        killerId: string;
        victimId: string;
        killerKills: number;
        killerXP: number;
      };
      console.log(`Kill credit: ${killData.killerId} killed ${killData.victimId} (Kills: ${killData.killerKills}, XP: ${killData.killerXP})`);

      // Add kill to feed (using player IDs for now - will be replaced with names later)
      this.killFeedUI.addKill(killData.killerId.substring(0, 8), killData.victimId.substring(0, 8));
    });

    // Handle player respawn events
    this.wsClient.on('player:respawn', (data) => {
      const respawnData = data as {
        playerId: string;
        position: { x: number; y: number };
        health: number;
      };
      console.log(`Player ${respawnData.playerId} respawned at (${respawnData.position.x}, ${respawnData.position.y})`);

      // If local player respawned, exit spectator mode and reset health
      if (respawnData.playerId === this.playerManager.getLocalPlayerId()) {
        this.localPlayerHealth = respawnData.health;
        this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100);
        this.spectator.exitSpectatorMode();

        // Camera follow will be restarted automatically on next player:move
        // via startCameraFollowIfNeeded() since isCameraFollowing was reset
      }
    });

    // Handle match timer updates
    this.wsClient.on('match:timer', (data) => {
      const timerData = data as { remainingSeconds: number };
      this.ui.updateMatchTimer(timerData.remainingSeconds);
    });

    // Handle match ended events
    this.wsClient.on('match:ended', (data) => {
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

      // TODO: Display match end UI with winners and scores in future story
    });
  }
}
