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
