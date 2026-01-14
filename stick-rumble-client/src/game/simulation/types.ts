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

/**
 * Input frame captured at a specific tick
 * Used for recording and replaying player inputs
 */
export interface InputFrame {
  tick: number;
  playerId: string;
  input: InputState;
}

/**
 * Player spawn configuration for scenarios
 */
export interface PlayerSpawn {
  id: string;
  startPosition: Vector2;
}

/**
 * Scenario definition for deterministic replay testing
 */
export interface Scenario {
  name: string;
  description?: string;
  players: PlayerSpawn[];
  inputs: InputFrame[];
  duration: number; // Duration in ticks
}

/**
 * Assertion to check during scenario replay
 */
export interface Assertion {
  tick: number;
  description: string;
  check: (sim: GameSimulationLike) => boolean;
}

/**
 * Minimal interface for GameSimulation to avoid circular dependency
 */
export interface GameSimulationLike {
  getPlayerState(id: string): SimulatedPlayerState | undefined;
  getAllPlayers(): SimulatedPlayerState[];
  getActiveProjectiles(): Projectile[];
  spawnProjectile(ownerId: string, aimAngle: number): Projectile;
}

/**
 * Result of a single assertion
 */
export interface AssertionResult {
  tick: number;
  description: string;
  passed: boolean;
  error?: string;
}

/**
 * Result of running a scenario
 */
export interface ScenarioResult {
  scenarioName: string;
  passed: boolean;
  assertions: AssertionResult[];
  duration: number; // Duration in ms
}

/**
 * Metadata for a recording session
 */
export interface RecordingMetadata {
  name: string;
  description?: string;
  recordedAt: string; // ISO timestamp
  playerCount: number;
  duration: number; // Duration in ticks
}
