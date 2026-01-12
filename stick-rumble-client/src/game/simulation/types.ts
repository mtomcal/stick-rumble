/**
 * Shared types for GameSimulation
 * Pure TypeScript types with no Phaser dependencies
 */

/**
 * 2D Vector for positions and velocities
 */
export interface Vector2 {
  x: number;
  y: number;
}

/**
 * Input state for player controls
 */
export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Player state in the simulation
 */
export interface SimulatedPlayerState {
  id: string;
  position: Vector2;
  velocity: Vector2;
  input: InputState;
  health: number;
  isAlive: boolean;
  isInvulnerable: boolean;
  deathTime?: number;
}

/**
 * Projectile state in the simulation
 */
export interface Projectile {
  id: string;
  ownerId: string;
  position: Vector2;
  velocity: Vector2;
  spawnPosition: Vector2;
  spawnTime: number;
  active: boolean;
}

/**
 * Hit event emitted when projectile hits player
 */
export interface HitEvent {
  projectileId: string;
  victimId: string;
  attackerId: string;
}

/**
 * Death event emitted when player dies
 */
export interface DeathEvent {
  playerId: string;
  killerId?: string;
}

/**
 * Weapon pickup event emitted when player picks up a weapon
 */
export interface WeaponPickupEvent {
  playerId: string;
  crateId: string;
  weaponType: string;
}
