import Phaser from 'phaser';
import { PLAYER } from '../../shared/constants';
import type { Clock } from '../utils/Clock';
import { RealClock } from '../utils/Clock';

/**
 * Player state from server
 */
export interface PlayerState {
  id: string;
  position: {
    x: number;
    y: number;
  };
  velocity: {
    x: number;
    y: number;
  };
  aimAngle?: number; // Aim angle in radians (optional for backward compatibility)
  deathTime?: number; // Timestamp when player died (ms since epoch), undefined if alive
  health?: number; // Current health (0-100)
  isRegenerating?: boolean; // Whether health is currently regenerating
}

// Length of the aim indicator line in pixels
const AIM_INDICATOR_LENGTH = 50;

/**
 * PlayerManager handles rendering and updating all players
 */
export class PlayerManager {
  private scene: Phaser.Scene;
  // Clock is injected for future use in client-side prediction (Phase 2: GameSimulation)
  // Currently, all timing is server-authoritative
  private _clock: Clock;
  private players: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private playerLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private aimIndicators: Map<string, Phaser.GameObjects.Line> = new Map();
  private localPlayerId: string | null = null;
  private playerStates: Map<string, PlayerState> = new Map();

  constructor(scene: Phaser.Scene, clock: Clock = new RealClock()) {
    this.scene = scene;
    this._clock = clock;
  }

  /**
   * Get the clock instance (for testing and future use in client-side prediction)
   */
  getClock(): Clock {
    return this._clock;
  }

  /**
   * Set the local player ID to differentiate from other players
   */
  setLocalPlayerId(playerId: string): void {
    this.localPlayerId = playerId;
  }

  /**
   * Get the local player ID
   */
  getLocalPlayerId(): string | null {
    return this.localPlayerId;
  }

  /**
   * Update all players from server state
   */
  updatePlayers(playerStates: PlayerState[]): void {
    const currentPlayerIds = new Set(playerStates.map(p => p.id));

    // Store player states for death tracking
    this.playerStates.clear();
    for (const state of playerStates) {
      this.playerStates.set(state.id, state);
    }

    // Remove players that no longer exist
    for (const [id, sprite] of this.players) {
      if (!currentPlayerIds.has(id)) {
        sprite.destroy();
        this.players.delete(id);

        const label = this.playerLabels.get(id);
        if (label) {
          label.destroy();
          this.playerLabels.delete(id);
        }

        const aimIndicator = this.aimIndicators.get(id);
        if (aimIndicator) {
          aimIndicator.destroy();
          this.aimIndicators.delete(id);
        }
      }
    }

    // Update or create players
    for (const state of playerStates) {
      let sprite = this.players.get(state.id);

      if (!sprite) {
        // Check if scene.add is available
        if (!this.scene.add) {
          console.error('Scene add system not available');
          continue;
        }

        // Create new player sprite
        const isLocal = state.id === this.localPlayerId;
        const color = isLocal ? 0x00ff00 : 0xff0000;

        sprite = this.scene.add.rectangle(
          state.position.x,
          state.position.y,
          PLAYER.WIDTH,
          PLAYER.HEIGHT,
          color
        );

        this.players.set(state.id, sprite);

        // Add label
        const label = this.scene.add.text(
          state.position.x,
          state.position.y - PLAYER.HEIGHT / 2 - 10,
          isLocal ? 'You' : 'Player',
          {
            fontSize: '14px',
            color: '#ffffff',
          }
        );
        label.setOrigin(0.5);
        this.playerLabels.set(state.id, label);

        // Create aim indicator line
        const aimAngle = state.aimAngle ?? 0;
        const endX = state.position.x + Math.cos(aimAngle) * AIM_INDICATOR_LENGTH;
        const endY = state.position.y + Math.sin(aimAngle) * AIM_INDICATOR_LENGTH;
        const aimLine = this.scene.add.line(
          0, 0, // Origin point (line coordinates are absolute)
          state.position.x, state.position.y, // Start point
          endX, endY, // End point
          isLocal ? 0x00ff00 : 0xffff00 // Green for local, yellow for others
        );
        this.aimIndicators.set(state.id, aimLine);
      }

      // Update position
      sprite.setPosition(state.position.x, state.position.y);

      // Apply death visual effects
      if (state.deathTime !== undefined) {
        // Dead player: fade to 50% opacity and gray color
        sprite.setAlpha(0.5);
        sprite.setFillStyle(0x888888);
      } else {
        // Alive player: full opacity and restore original color
        sprite.setAlpha(1.0);
        const isLocal = state.id === this.localPlayerId;
        const color = isLocal ? 0x00ff00 : 0xff0000;
        sprite.setFillStyle(color);
      }

      // Update label position
      const label = this.playerLabels.get(state.id);
      if (label) {
        label.setPosition(
          state.position.x,
          state.position.y - PLAYER.HEIGHT / 2 - 10
        );
      }

      // Update aim indicator
      const aimIndicator = this.aimIndicators.get(state.id);
      if (aimIndicator) {
        const aimAngle = state.aimAngle ?? 0;
        const endX = state.position.x + Math.cos(aimAngle) * AIM_INDICATOR_LENGTH;
        const endY = state.position.y + Math.sin(aimAngle) * AIM_INDICATOR_LENGTH;
        aimIndicator.setTo(
          state.position.x, state.position.y,
          endX, endY
        );
      }
    }
  }

  /**
   * Cleanup all players
   */
  destroy(): void {
    for (const sprite of this.players.values()) {
      sprite.destroy();
    }
    this.players.clear();

    for (const label of this.playerLabels.values()) {
      label.destroy();
    }
    this.playerLabels.clear();

    for (const aimIndicator of this.aimIndicators.values()) {
      aimIndicator.destroy();
    }
    this.aimIndicators.clear();

    this.playerStates.clear();
  }

  /**
   * Get list of living players (excludes dead players)
   */
  getLivingPlayers(): PlayerState[] {
    const livingPlayers: PlayerState[] = [];
    for (const state of this.playerStates.values()) {
      if (state.deathTime === undefined) {
        livingPlayers.push(state);
      }
    }
    return livingPlayers;
  }

  /**
   * Check if the local player is dead
   */
  isLocalPlayerDead(): boolean {
    if (!this.localPlayerId) {
      return false;
    }
    const localPlayerState = this.playerStates.get(this.localPlayerId);
    return localPlayerState?.deathTime !== undefined;
  }

  /**
   * Get a player's current position by ID
   * Returns null if player not found
   */
  getPlayerPosition(playerId: string): { x: number; y: number } | null {
    const playerState = this.playerStates.get(playerId);
    return playerState ? playerState.position : null;
  }

  /**
   * Get a player's aim angle
   * Returns null if player doesn't exist or aim angle is not set
   */
  getPlayerAimAngle(playerId: string): number | null {
    const playerState = this.playerStates.get(playerId);
    return playerState?.aimAngle ?? null;
  }

  /**
   * Get the local player's sprite (for camera follow)
   * Returns null if local player doesn't exist yet
   */
  getLocalPlayerSprite(): Phaser.GameObjects.Rectangle | null {
    if (!this.localPlayerId) {
      return null;
    }
    return this.players.get(this.localPlayerId) ?? null;
  }

  /**
   * Get the local player's current position
   * Returns undefined if local player doesn't exist yet
   */
  getLocalPlayerPosition(): { x: number; y: number } | undefined {
    if (!this.localPlayerId) {
      return undefined;
    }
    return this.getPlayerPosition(this.localPlayerId) ?? undefined;
  }

  /**
   * Update local player's aim indicator from current aim angle
   * This provides immediate visual feedback without waiting for server echo
   */
  updateLocalPlayerAim(aimAngle: number): void {
    if (!this.localPlayerId) {
      return;
    }

    const aimIndicator = this.aimIndicators.get(this.localPlayerId);
    const playerState = this.playerStates.get(this.localPlayerId);

    if (aimIndicator && playerState) {
      const endX = playerState.position.x + Math.cos(aimAngle) * AIM_INDICATOR_LENGTH;
      const endY = playerState.position.y + Math.sin(aimAngle) * AIM_INDICATOR_LENGTH;
      aimIndicator.setTo(
        playerState.position.x, playerState.position.y,
        endX, endY
      );
    }
  }

  /**
   * Check if the local player is currently moving
   * A player is considered moving if their velocity is above a threshold
   */
  isLocalPlayerMoving(): boolean {
    if (!this.localPlayerId) {
      return false;
    }

    const playerState = this.playerStates.get(this.localPlayerId);
    if (!playerState) {
      return false;
    }

    const MOVEMENT_THRESHOLD = 0.1; // Velocity threshold to consider as moving
    const velocityMagnitude = Math.sqrt(
      playerState.velocity.x ** 2 + playerState.velocity.y ** 2
    );

    return velocityMagnitude > MOVEMENT_THRESHOLD;
  }
}
