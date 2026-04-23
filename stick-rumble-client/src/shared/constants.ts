/**
 * Shared game constants for Stick Rumble
 * These values must match the server-side constants for consistent physics
 */

/**
 * Color palette constants (prototype art style)
 */
export const COLORS = {
  BACKGROUND: 0xC8CCC8,
  GRID_LINE: 0xD8DCD8,
  PLAYER_HEAD: 0x2A2A2A,
  ENEMY_HEAD: 0xFF0000,
  DEAD_HEAD: 0x888888,
  BODY: 0x000000,
  HEALTH_FULL: 0x00CC00,
  HEALTH_CRITICAL: 0xFF0000,
  HEALTH_DEPLETED_BG: 0x333333,
  AMMO_READY: 0xE0A030,
  AMMO_RELOADING: 0xCC5555,
  SCORE: 0xFFFFFF,
  KILL_COUNTER: 0xFF6666,
  DEBUG_OVERLAY: 0x00FF00,
  CHAT_SYSTEM: 0xBBA840,
  MUZZLE_FLASH: 0xFFD700,
  BULLET_TRAIL: 0xFFA500,
  DAMAGE_NUMBER: 0xFF4444,
  BLOOD: 0xCC3333,
  SPAWN_RING: 0xFFFF00,
  DAMAGE_FLASH: 0xFF0000,
  HIT_CHEVRON: 0xCC3333,
  WEAPON_CRATE: 0xCCCC00,
  HIT_TRAIL: 0xFFFFFF,
  MINIMAP_BORDER: 0x00CCCC,
  RELOAD_ARC: 0x00FF00,
} as const;

/**
 * Minimap display constants
 */
export const MINIMAP = {
  SIZE: 170,
  SCALE: 0.106,
  RADAR_RANGE: 600,
  BG_COLOR: 0x3A3A3A,
  BORDER_COLOR: 0x00CCCC,
  BORDER_STROKE: 2,
} as const;

/**
 * Hit confirmation trail constants
 */
export const HIT_TRAIL = {
  COLOR: 0xFFFFFF,
  STROKE: 1,
  ALPHA: 0.8,
  LINGER_DURATION: 300,
  FADE_DURATION: 200,
  DEPTH: 40,
} as const;

/**
 * Reload arc constants
 */
export const RELOAD_ARC = {
  RADIUS: 25,
  STROKE: 3,
  COLOR: 0x00FF00,
  START_ANGLE: 270,
  DEPTH: 45,
} as const;

/**
 * Player movement constants
 */
export const MOVEMENT = {
  /** Maximum movement speed in pixels per second */
  SPEED: 200,

  /** Maximum sprint speed in pixels per second (1.5x normal speed) */
  SPRINT_SPEED: 300,

  /** Acceleration rate in pixels per second squared (immediate-feeling response) */
  ACCELERATION: 6000,

  /** Deceleration rate when no input (near-instant stop) */
  DECELERATION: 6000,
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
  WIDTH: 48,

  /** Player sprite height (placeholder until actual sprites) */
  HEIGHT: 48,

  /** World-space health bar width in pixels */
  PLAYER_HEALTH_BAR_WIDTH: 32,

  /** HUD health bar width in pixels */
  HUD_HEALTH_BAR_WIDTH: 200,
} as const;

/**
 * Weapon constants (must match server-side values)
 */
export const WEAPON = {
  /** Pistol damage per shot */
  PISTOL_DAMAGE: 25,

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
