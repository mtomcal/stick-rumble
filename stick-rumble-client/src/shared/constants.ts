/**
 * Shared game constants for Stick Rumble
 * These values must match the server-side constants for consistent physics
 */

/**
 * Player movement constants
 */
export const MOVEMENT = {
  /** Maximum movement speed in pixels per second */
  SPEED: 200,

  /** Acceleration rate in pixels per second squared */
  ACCELERATION: 50,

  /** Deceleration rate when no input (same as acceleration for symmetric feel) */
  DECELERATION: 50,
} as const;

/**
 * Arena/World bounds
 */
export const ARENA = {
  /** Arena width in pixels */
  WIDTH: 1920,

  /** Arena height in pixels */
  HEIGHT: 1080,
} as const;

/**
 * Network update rates
 */
export const NETWORK = {
  /** Server physics tick rate in Hz */
  SERVER_TICK_RATE: 60,

  /** Client position update rate in Hz */
  CLIENT_UPDATE_RATE: 20,

  /** Milliseconds between client updates */
  CLIENT_UPDATE_INTERVAL: 1000 / 20, // 50ms
} as const;

/**
 * Player appearance constants
 */
export const PLAYER = {
  /** Player sprite width (placeholder until actual sprites) */
  WIDTH: 32,

  /** Player sprite height (placeholder until actual sprites) */
  HEIGHT: 64,
} as const;

/**
 * Weapon constants (must match server-side values)
 */
export const WEAPON = {
  /** Pistol damage per shot */
  PISTOL_DAMAGE: 15,

  /** Pistol fire rate in rounds per second */
  PISTOL_FIRE_RATE: 3,

  /** Pistol magazine size */
  PISTOL_MAGAZINE_SIZE: 15,

  /** Pistol reload time in milliseconds */
  PISTOL_RELOAD_TIME: 1500,

  /** Projectile speed in pixels per second */
  PROJECTILE_SPEED: 800,

  /** Maximum projectile lifetime in milliseconds */
  PROJECTILE_MAX_LIFETIME: 1000,
} as const;

/**
 * Visual effects constants
 */
export const EFFECTS = {
  /** Bullet tracer line width in pixels */
  TRACER_WIDTH: 2,

  /** Bullet tracer fade duration in milliseconds */
  TRACER_FADE_DURATION: 100,

  /** Muzzle flash radius in pixels */
  MUZZLE_FLASH_RADIUS: 8,

  /** Muzzle flash duration in milliseconds */
  MUZZLE_FLASH_DURATION: 50,

  /** Projectile diameter in pixels */
  PROJECTILE_DIAMETER: 4,
} as const;
