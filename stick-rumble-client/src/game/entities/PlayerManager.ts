import Phaser from 'phaser';
import { PLAYER } from '../../shared/constants';
import type { Clock } from '../utils/Clock';
import { RealClock } from '../utils/Clock';
import { ProceduralPlayerGraphics } from './ProceduralPlayerGraphics';
import { ProceduralWeaponGraphics } from './ProceduralWeaponGraphics';
import { HealthBar } from './HealthBar';
import { InterpolationEngine } from '../physics/InterpolationEngine';

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
  isRolling?: boolean; // Whether player is currently dodge rolling
}

// Length of the aim indicator line in pixels
const AIM_INDICATOR_LENGTH = 50;

/**
 * PlayerManager handles rendering and updating all players
 */
export class PlayerManager {
  private scene: Phaser.Scene;
  // Clock is used for interpolation timing and future client-side prediction
  private _clock: Clock;
  private players: Map<string, ProceduralPlayerGraphics> = new Map();
  private playerLabels: Map<string, Phaser.GameObjects.Text> = new Map();
  private aimIndicators: Map<string, Phaser.GameObjects.Line> = new Map();
  private weaponGraphics: Map<string, ProceduralWeaponGraphics> = new Map();
  private weaponTypes: Map<string, string> = new Map();
  private healthBars: Map<string, HealthBar> = new Map();
  private localPlayerId: string | null = null;
  private playerStates: Map<string, PlayerState> = new Map();
  // Interpolation engine for smooth movement of other players (Story 4.3)
  private interpolationEngine: InterpolationEngine = new InterpolationEngine();

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
   * Check if scene is valid and active for rendering
   */
  private isSceneValid(): boolean {
    return this.scene && this.scene.sys && this.scene.sys.isActive();
  }

  /**
   * Update all players from server state.
   * For other players: stores snapshots in interpolation engine
   * For local player: immediately applies position (prediction handled elsewhere)
   *
   * @param playerStates - Array of player states from server
   * @param options - Optional settings for delta vs snapshot handling
   * @param options.isDelta - When true, merge incoming states (don't clear missing players).
   *                          When false (default), treat as full roster and destroy missing players.
   */
  updatePlayers(playerStates: PlayerState[], options?: { isDelta?: boolean }): void {
    // Skip if scene is not active (destroyed or transitioning)
    if (!this.isSceneValid()) {
      return;
    }

    const isDelta = options?.isDelta ?? false;
    const currentPlayerIds = new Set(playerStates.map(p => p.id));

    // Store player states for death tracking
    // In delta mode: merge into existing states (don't clear)
    // In snapshot mode: replace all states
    if (!isDelta) {
      this.playerStates.clear();
    }
    for (const state of playerStates) {
      this.playerStates.set(state.id, state);

      // Store snapshots for other players in interpolation engine
      // Local player uses client-side prediction, not interpolation
      if (state.id !== this.localPlayerId) {
        this.interpolationEngine.addSnapshot(state.id, {
          position: { ...state.position },
          velocity: { ...state.velocity },
          timestamp: this._clock.now(),
        });
      }
    }

    // Remove players that no longer exist (only in snapshot mode)
    // In delta mode, missing players are simply unchanged, not disconnected
    if (!isDelta) {
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

          const weaponGraphics = this.weaponGraphics.get(id);
          if (weaponGraphics) {
            weaponGraphics.destroy();
            this.weaponGraphics.delete(id);
          }

          const healthBar = this.healthBars.get(id);
          if (healthBar) {
            healthBar.destroy();
            this.healthBars.delete(id);
          }

          this.weaponTypes.delete(id);

          // Clear interpolation data for removed player
          this.interpolationEngine.clearPlayer(id);
        }
      }
    }

    // Update or create players
    for (const state of playerStates) {
      let playerGraphics = this.players.get(state.id);

      if (!playerGraphics) {
        // Check if scene.add is available
        if (!this.scene.add) {
          console.error('Scene add system not available');
          continue;
        }

        // Create new player graphics (procedural stick figure)
        const isLocal = state.id === this.localPlayerId;
        const color = isLocal ? 0x00ff00 : 0xff0000; // Green for local, red for others

        playerGraphics = new ProceduralPlayerGraphics(
          this.scene,
          state.position.x,
          state.position.y,
          color
        );

        this.players.set(state.id, playerGraphics);

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

        // Create weapon graphics (default to Pistol)
        const weaponType = this.weaponTypes.get(state.id) ?? 'Pistol';
        const weaponOffsetX = Math.cos(aimAngle) * 10;
        const weaponOffsetY = Math.sin(aimAngle) * 10;
        const weaponGraphics = new ProceduralWeaponGraphics(
          this.scene,
          state.position.x + weaponOffsetX,
          state.position.y + weaponOffsetY,
          weaponType
        );
        weaponGraphics.setRotation(aimAngle);
        this.weaponGraphics.set(state.id, weaponGraphics);

        // Create health bar (positioned 8 pixels above player head)
        const healthBarY = state.position.y - PLAYER.HEIGHT / 2 - 8;
        const healthBar = new HealthBar(this.scene, state.position.x, healthBarY);
        healthBar.setHealth(state.health ?? 100); // Default to 100 health if undefined
        this.healthBars.set(state.id, healthBar);
      }

      // DO NOT set position here - update() is the sole position writer
      // This prevents flickering caused by dual position writers competing
      // Position updates happen in update() via interpolation or server state

      // Apply dodge roll visual effects (rotation during roll)
      if (state.isRolling) {
        // Apply 360° rotation animation (simulated with angle update)
        const rollAngle = ((this._clock.now() % 400) / 400) * Math.PI * 2; // 360° rotation over 0.4s
        playerGraphics.setRotation(rollAngle);

        // Apply transparency during invincibility frames (first 0.2s)
        // Note: Server tracks actual i-frame timing, this is visual only
        playerGraphics.setVisible(this._clock.now() % 200 < 100); // Flicker effect
      } else {
        // Clear rotation when not rolling
        playerGraphics.setRotation(0);
        playerGraphics.setVisible(true);
      }

      // Apply death visual effects
      if (state.deathTime !== undefined) {
        // Dead player: gray color
        playerGraphics.setColor(0x888888);
      } else if (!state.isRolling) {
        // Alive player (not rolling): restore original color
        const isLocal = state.id === this.localPlayerId;
        const color = isLocal ? 0x00ff00 : 0xff0000;
        playerGraphics.setColor(color);
      } else {
        // Alive player (rolling): keep original color
        const isLocal = state.id === this.localPlayerId;
        const color = isLocal ? 0x00ff00 : 0xff0000;
        playerGraphics.setColor(color);
      }

      // DO NOT update label, aim indicator, weapon, or health bar positions here
      // Position updates are handled in update() loop as the sole position writer

      // Only update non-positional properties here:

      // Update walk cycle animation based on movement (non-positional)
      const isMoving = Math.sqrt(state.velocity.x ** 2 + state.velocity.y ** 2) > 0.1;
      playerGraphics.update(16, isMoving); // Assume 60 FPS (16ms delta)

      // Update weapon rotation (non-positional)
      const weaponGraphics = this.weaponGraphics.get(state.id);
      if (weaponGraphics) {
        const aimAngle = state.aimAngle ?? 0;
        weaponGraphics.setRotation(aimAngle);

        // Flip weapon vertically when aiming left
        // Angle is in radians: left is between π/2 (90°) and 3π/2 (270°)
        const angleInDegrees = (aimAngle * 180) / Math.PI;
        const normalizedAngle = ((angleInDegrees % 360) + 360) % 360; // Normalize to 0-360
        const isAimingLeft = normalizedAngle > 90 && normalizedAngle < 270;
        weaponGraphics.setFlipY(isAimingLeft);
      }

      // Update health value (non-positional)
      const healthBar = this.healthBars.get(state.id);
      if (healthBar) {
        healthBar.setHealth(state.health ?? 100);
      }
    }
  }

  /**
   * Update player visual state every frame with interpolation.
   * Uses interpolation for other players, immediate rendering for local player.
   * Call this method from Phaser's update loop (typically 60 FPS).
   *
   * @param delta - Delta time in milliseconds since last frame
   */
  update(delta: number): void {
    // Skip if scene is not active
    if (!this.isSceneValid()) {
      return;
    }

    for (const [playerId, playerGraphics] of this.players) {
      const state = this.playerStates.get(playerId);
      if (!state) {
        continue;
      }

      let renderPosition: { x: number; y: number };
      let renderVelocity: { x: number; y: number };

      // Use interpolation for remote players, raw state for local player
      if (playerId !== this.localPlayerId) {
        const interpolated = this.interpolationEngine.getInterpolatedPosition(
          playerId,
          this._clock.now()
        );

        if (interpolated) {
          renderPosition = interpolated.position;
          renderVelocity = interpolated.velocity;
        } else {
          // Fallback to raw state if interpolation not ready
          renderPosition = state.position;
          renderVelocity = state.velocity;
        }
      } else {
        // Local player: use raw server state (prediction will override this in the future)
        renderPosition = state.position;
        renderVelocity = state.velocity;
      }

      // SOLE POSITION WRITER: Update player sprite position
      playerGraphics.setPosition(renderPosition.x, renderPosition.y);

      // Update label position
      const label = this.playerLabels.get(playerId);
      if (label) {
        label.setPosition(
          renderPosition.x,
          renderPosition.y - PLAYER.HEIGHT / 2 - 10
        );
      }

      // Update aim indicator
      const aimIndicator = this.aimIndicators.get(playerId);
      if (aimIndicator) {
        const aimAngle = state.aimAngle ?? 0;
        const endX = renderPosition.x + Math.cos(aimAngle) * AIM_INDICATOR_LENGTH;
        const endY = renderPosition.y + Math.sin(aimAngle) * AIM_INDICATOR_LENGTH;
        aimIndicator.setTo(
          renderPosition.x, renderPosition.y,
          endX, endY
        );
      }

      // Update weapon graphics position
      const weaponGraphics = this.weaponGraphics.get(playerId);
      if (weaponGraphics) {
        const aimAngle = state.aimAngle ?? 0;
        const weaponOffsetX = Math.cos(aimAngle) * 10;
        const weaponOffsetY = Math.sin(aimAngle) * 10;
        weaponGraphics.setPosition(
          renderPosition.x + weaponOffsetX,
          renderPosition.y + weaponOffsetY
        );
      }

      // Update health bar position
      const healthBar = this.healthBars.get(playerId);
      if (healthBar) {
        const healthBarY = renderPosition.y - PLAYER.HEIGHT / 2 - 8;
        healthBar.setPosition(renderPosition.x, healthBarY);
      }

      // Update walk cycle animation based on velocity
      const isMoving = Math.sqrt(renderVelocity.x ** 2 + renderVelocity.y ** 2) > 0.1;
      playerGraphics.update(delta, isMoving);
    }
  }

  /**
   * Cleanup all players
   */
  destroy(): void {
    for (const playerGraphics of this.players.values()) {
      playerGraphics.destroy();
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

    for (const weaponGraphics of this.weaponGraphics.values()) {
      weaponGraphics.destroy();
    }
    this.weaponGraphics.clear();

    for (const healthBar of this.healthBars.values()) {
      healthBar.destroy();
    }
    this.healthBars.clear();

    this.weaponTypes.clear();
    this.playerStates.clear();

    // Reset localPlayerId so new room:joined can set it fresh
    this.localPlayerId = null;
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
   * Get the local player's Graphics object for camera follow
   * Returns null if local player doesn't exist yet
   */
  getLocalPlayerSprite(): Phaser.GameObjects.Graphics | null {
    if (!this.localPlayerId) {
      return null;
    }
    const playerGraphics = this.players.get(this.localPlayerId);
    return playerGraphics ? playerGraphics.getGraphics() : null;
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

    // Update weapon graphics immediately for responsive client-side feedback
    const weaponGraphics = this.weaponGraphics.get(this.localPlayerId);
    if (weaponGraphics && playerState) {
      const weaponOffsetX = Math.cos(aimAngle) * 10;
      const weaponOffsetY = Math.sin(aimAngle) * 10;
      weaponGraphics.setPosition(
        playerState.position.x + weaponOffsetX,
        playerState.position.y + weaponOffsetY
      );
      weaponGraphics.setRotation(aimAngle);

      // Flip weapon vertically when aiming left
      // Angle is in radians: left is between π/2 (90°) and 3π/2 (270°)
      const angleInDegrees = (aimAngle * 180) / Math.PI;
      const normalizedAngle = ((angleInDegrees % 360) + 360) % 360; // Normalize to 0-360
      const isAimingLeft = normalizedAngle > 90 && normalizedAngle < 270;
      weaponGraphics.setFlipY(isAimingLeft);
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

  /**
   * Update the weapon type for a specific player
   * This changes the weapon graphics displayed for the player
   */
  updatePlayerWeapon(playerId: string, weaponType: string): void {
    // Store weapon type
    this.weaponTypes.set(playerId, weaponType);

    // Update weapon graphics if player exists
    const weaponGraphics = this.weaponGraphics.get(playerId);
    if (weaponGraphics) {
      weaponGraphics.setWeapon(weaponType);
    }
  }

  /**
   * Apply reconciled position from client-side prediction (Story 4.2)
   * Used when server sends correction to fix prediction error
   *
   * @param playerId - Player to update
   * @param reconciledState - Position and velocity after replaying inputs
   * @param needsInstant - Whether to teleport instantly or smooth lerp
   */
  applyReconciledPosition(
    playerId: string,
    reconciledState: { position: { x: number; y: number }; velocity: { x: number; y: number } },
    needsInstant: boolean
  ): void {
    const sprite = this.players.get(playerId);
    if (!sprite) {
      return;
    }

    if (needsInstant) {
      // Large error (>=100px): Instant teleport
      // TODO: Add visual flash effect in future story
      sprite.setPosition(reconciledState.position.x, reconciledState.position.y);
    } else {
      // Small error (<100px): Smooth lerp will be handled by next update cycle
      // For now, just apply the position directly (lerp will be added in polish story)
      sprite.setPosition(reconciledState.position.x, reconciledState.position.y);
    }

    // Update stored player state
    const playerState = this.playerStates.get(playerId);
    if (playerState) {
      playerState.position = { ...reconciledState.position };
      playerState.velocity = { ...reconciledState.velocity };
    }
  }
}
