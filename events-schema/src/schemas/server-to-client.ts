/**
 * Server-to-client message schemas.
 * These define the messages sent from the Go server to the TypeScript client.
 */
import { Type, type Static } from '@sinclair/typebox';
import { createTypedMessageSchema, PositionSchema, VelocitySchema } from './common.js';

// ============================================================================
// room:joined
// ============================================================================

/**
 * Room joined data payload.
 * Sent when a player successfully joins a room.
 */
export const RoomJoinedDataSchema = Type.Object(
  {
    playerId: Type.String({ description: 'Unique identifier for the player', minLength: 1 }),
  },
  { $id: 'RoomJoinedData', description: 'Room joined event payload' }
);

export type RoomJoinedData = Static<typeof RoomJoinedDataSchema>;

/**
 * Complete room:joined message schema
 */
export const RoomJoinedMessageSchema = createTypedMessageSchema('room:joined', RoomJoinedDataSchema);
export type RoomJoinedMessage = Static<typeof RoomJoinedMessageSchema>;

// ============================================================================
// player:move
// ============================================================================

/**
 * Player state schema for move updates.
 */
export const PlayerStateSchema = Type.Object(
  {
    id: Type.String({ description: 'Player unique identifier', minLength: 1 }),
    position: PositionSchema,
    velocity: VelocitySchema,
    health: Type.Number({ description: 'Current health', minimum: 0 }),
    maxHealth: Type.Number({ description: 'Maximum health', minimum: 0 }),
    rotation: Type.Number({ description: 'Player rotation in radians' }),
    isDead: Type.Boolean({ description: 'Whether the player is dead' }),
    isSprinting: Type.Boolean({ description: 'Whether the player is currently sprinting' }),
    isRolling: Type.Boolean({ description: 'Whether the player is currently dodge rolling' }),
  },
  { $id: 'PlayerState', description: 'Player state for movement updates' }
);

export type PlayerState = Static<typeof PlayerStateSchema>;

/**
 * Player move data payload.
 * Broadcasts current state of all players in the room.
 */
export const PlayerMoveDataSchema = Type.Object(
  {
    players: Type.Array(PlayerStateSchema, { description: 'Array of player states' }),
  },
  { $id: 'PlayerMoveData', description: 'Player movement update payload' }
);

export type PlayerMoveData = Static<typeof PlayerMoveDataSchema>;

/**
 * Complete player:move message schema
 */
export const PlayerMoveMessageSchema = createTypedMessageSchema('player:move', PlayerMoveDataSchema);
export type PlayerMoveMessage = Static<typeof PlayerMoveMessageSchema>;

// ============================================================================
// projectile:spawn
// ============================================================================

/**
 * Projectile spawn data payload.
 * Sent when a projectile is created.
 */
export const ProjectileSpawnDataSchema = Type.Object(
  {
    id: Type.String({ description: 'Unique projectile identifier', minLength: 1 }),
    ownerId: Type.String({ description: 'Player who fired the projectile', minLength: 1 }),
    weaponType: Type.String({ description: 'Type of weapon that fired the projectile', minLength: 1 }),
    position: PositionSchema,
    velocity: VelocitySchema,
  },
  { $id: 'ProjectileSpawnData', description: 'Projectile spawn event payload' }
);

export type ProjectileSpawnData = Static<typeof ProjectileSpawnDataSchema>;

/**
 * Complete projectile:spawn message schema
 */
export const ProjectileSpawnMessageSchema = createTypedMessageSchema(
  'projectile:spawn',
  ProjectileSpawnDataSchema
);
export type ProjectileSpawnMessage = Static<typeof ProjectileSpawnMessageSchema>;

// ============================================================================
// projectile:destroy
// ============================================================================

/**
 * Projectile destroy data payload.
 * Sent when a projectile is removed from the game.
 */
export const ProjectileDestroyDataSchema = Type.Object(
  {
    id: Type.String({ description: 'Unique projectile identifier', minLength: 1 }),
  },
  { $id: 'ProjectileDestroyData', description: 'Projectile destroy event payload' }
);

export type ProjectileDestroyData = Static<typeof ProjectileDestroyDataSchema>;

/**
 * Complete projectile:destroy message schema
 */
export const ProjectileDestroyMessageSchema = createTypedMessageSchema(
  'projectile:destroy',
  ProjectileDestroyDataSchema
);
export type ProjectileDestroyMessage = Static<typeof ProjectileDestroyMessageSchema>;

// ============================================================================
// weapon:state
// ============================================================================

/**
 * Weapon state data payload.
 * Sent when weapon state changes (ammo, reload status).
 */
export const WeaponStateDataSchema = Type.Object(
  {
    currentAmmo: Type.Integer({ description: 'Current ammunition count', minimum: 0 }),
    maxAmmo: Type.Integer({ description: 'Maximum ammunition capacity', minimum: 0 }),
    isReloading: Type.Boolean({ description: 'Whether the weapon is currently reloading' }),
    canShoot: Type.Boolean({ description: 'Whether the weapon can currently shoot' }),
    weaponType: Type.String({ description: 'Name of the current weapon (e.g., "Pistol", "Bat", "Katana")', minLength: 1 }),
    isMelee: Type.Boolean({ description: 'Whether the current weapon is a melee weapon' }),
  },
  { $id: 'WeaponStateData', description: 'Weapon state payload' }
);

export type WeaponStateData = Static<typeof WeaponStateDataSchema>;

/**
 * Complete weapon:state message schema
 */
export const WeaponStateMessageSchema = createTypedMessageSchema('weapon:state', WeaponStateDataSchema);
export type WeaponStateMessage = Static<typeof WeaponStateMessageSchema>;

// ============================================================================
// shoot:failed
// ============================================================================

/**
 * Shoot failed data payload.
 * Sent when a shoot attempt fails.
 */
export const ShootFailedDataSchema = Type.Object(
  {
    reason: Type.String({ description: 'Reason why the shot failed', minLength: 1 }),
  },
  { $id: 'ShootFailedData', description: 'Shoot failed event payload' }
);

export type ShootFailedData = Static<typeof ShootFailedDataSchema>;

/**
 * Complete shoot:failed message schema
 */
export const ShootFailedMessageSchema = createTypedMessageSchema('shoot:failed', ShootFailedDataSchema);
export type ShootFailedMessage = Static<typeof ShootFailedMessageSchema>;

// ============================================================================
// player:damaged
// ============================================================================

/**
 * Player damaged data payload.
 * Sent when a player takes damage.
 */
export const PlayerDamagedDataSchema = Type.Object(
  {
    victimId: Type.String({ description: 'Player who took damage', minLength: 1 }),
    attackerId: Type.String({ description: 'Player who dealt damage', minLength: 1 }),
    damage: Type.Number({ description: 'Amount of damage dealt', minimum: 0 }),
    newHealth: Type.Number({ description: 'Victim health after damage', minimum: 0 }),
    projectileId: Type.String({ description: 'Projectile that caused damage', minLength: 1 }),
  },
  { $id: 'PlayerDamagedData', description: 'Player damaged event payload' }
);

export type PlayerDamagedData = Static<typeof PlayerDamagedDataSchema>;

/**
 * Complete player:damaged message schema
 */
export const PlayerDamagedMessageSchema = createTypedMessageSchema('player:damaged', PlayerDamagedDataSchema);
export type PlayerDamagedMessage = Static<typeof PlayerDamagedMessageSchema>;

// ============================================================================
// hit:confirmed
// ============================================================================

/**
 * Hit confirmed data payload.
 * Sent to confirm a hit was registered on the server.
 */
export const HitConfirmedDataSchema = Type.Object(
  {
    victimId: Type.String({ description: 'Player who was hit', minLength: 1 }),
    damage: Type.Number({ description: 'Amount of damage dealt', minimum: 0 }),
    projectileId: Type.String({ description: 'Projectile that hit', minLength: 1 }),
  },
  { $id: 'HitConfirmedData', description: 'Hit confirmed event payload' }
);

export type HitConfirmedData = Static<typeof HitConfirmedDataSchema>;

/**
 * Complete hit:confirmed message schema
 */
export const HitConfirmedMessageSchema = createTypedMessageSchema('hit:confirmed', HitConfirmedDataSchema);
export type HitConfirmedMessage = Static<typeof HitConfirmedMessageSchema>;

// ============================================================================
// player:death
// ============================================================================

/**
 * Player death data payload.
 * Sent when a player is eliminated.
 */
export const PlayerDeathDataSchema = Type.Object(
  {
    victimId: Type.String({ description: 'Player who died', minLength: 1 }),
    attackerId: Type.String({ description: 'Player who got the kill', minLength: 1 }),
  },
  { $id: 'PlayerDeathData', description: 'Player death event payload' }
);

export type PlayerDeathData = Static<typeof PlayerDeathDataSchema>;

/**
 * Complete player:death message schema
 */
export const PlayerDeathMessageSchema = createTypedMessageSchema('player:death', PlayerDeathDataSchema);
export type PlayerDeathMessage = Static<typeof PlayerDeathMessageSchema>;

// ============================================================================
// player:kill_credit
// ============================================================================

/**
 * Player kill credit data payload.
 * Sent to update killer's stats after a kill.
 */
export const PlayerKillCreditDataSchema = Type.Object(
  {
    killerId: Type.String({ description: 'Player who got the kill', minLength: 1 }),
    victimId: Type.String({ description: 'Player who died', minLength: 1 }),
    killerKills: Type.Integer({ description: 'Killer total kills', minimum: 0 }),
    killerXP: Type.Integer({ description: 'Killer total XP', minimum: 0 }),
  },
  { $id: 'PlayerKillCreditData', description: 'Player kill credit event payload' }
);

export type PlayerKillCreditData = Static<typeof PlayerKillCreditDataSchema>;

/**
 * Complete player:kill_credit message schema
 */
export const PlayerKillCreditMessageSchema = createTypedMessageSchema(
  'player:kill_credit',
  PlayerKillCreditDataSchema
);
export type PlayerKillCreditMessage = Static<typeof PlayerKillCreditMessageSchema>;

// ============================================================================
// player:respawn
// ============================================================================

/**
 * Player respawn data payload.
 * Sent when a player respawns after death.
 */
export const PlayerRespawnDataSchema = Type.Object(
  {
    playerId: Type.String({ description: 'Player who respawned', minLength: 1 }),
    position: PositionSchema,
    health: Type.Number({ description: 'Respawn health', minimum: 0 }),
  },
  { $id: 'PlayerRespawnData', description: 'Player respawn event payload' }
);

export type PlayerRespawnData = Static<typeof PlayerRespawnDataSchema>;

/**
 * Complete player:respawn message schema
 */
export const PlayerRespawnMessageSchema = createTypedMessageSchema('player:respawn', PlayerRespawnDataSchema);
export type PlayerRespawnMessage = Static<typeof PlayerRespawnMessageSchema>;

// ============================================================================
// match:timer
// ============================================================================

/**
 * Match timer data payload.
 * Sent periodically with remaining match time.
 */
export const MatchTimerDataSchema = Type.Object(
  {
    remainingSeconds: Type.Integer({ description: 'Seconds remaining in the match', minimum: 0 }),
  },
  { $id: 'MatchTimerData', description: 'Match timer event payload' }
);

export type MatchTimerData = Static<typeof MatchTimerDataSchema>;

/**
 * Complete match:timer message schema
 */
export const MatchTimerMessageSchema = createTypedMessageSchema('match:timer', MatchTimerDataSchema);
export type MatchTimerMessage = Static<typeof MatchTimerMessageSchema>;

// ============================================================================
// match:ended
// ============================================================================

/**
 * Player score schema for match end results.
 * Contains individual player statistics from the match.
 */
export const PlayerScoreSchema = Type.Object(
  {
    playerId: Type.String({ description: 'Player unique identifier', minLength: 1 }),
    kills: Type.Integer({ description: 'Number of kills', minimum: 0 }),
    deaths: Type.Integer({ description: 'Number of deaths', minimum: 0 }),
    xp: Type.Integer({ description: 'Total XP earned', minimum: 0 }),
  },
  { $id: 'PlayerScore', description: 'Player final score data' }
);

export type PlayerScore = Static<typeof PlayerScoreSchema>;

/**
 * Match ended data payload.
 * Sent when the match concludes.
 */
export const MatchEndedDataSchema = Type.Object(
  {
    winners: Type.Array(Type.String(), { description: 'Array of winner player IDs' }),
    finalScores: Type.Array(PlayerScoreSchema, {
      description: 'Array of final player scores',
    }),
    reason: Type.String({ description: 'Reason the match ended', minLength: 1 }),
  },
  { $id: 'MatchEndedData', description: 'Match ended event payload' }
);

export type MatchEndedData = Static<typeof MatchEndedDataSchema>;

/**
 * Complete match:ended message schema
 */
export const MatchEndedMessageSchema = createTypedMessageSchema('match:ended', MatchEndedDataSchema);
export type MatchEndedMessage = Static<typeof MatchEndedMessageSchema>;

// ============================================================================
// weapon:spawned
// ============================================================================

/**
 * Weapon crate schema for spawned weapons.
 */
export const WeaponCrateSchema = Type.Object(
  {
    id: Type.String({ description: 'Unique crate identifier', minLength: 1 }),
    position: PositionSchema,
    weaponType: Type.String({ description: 'Type of weapon in the crate', minLength: 1 }),
    isAvailable: Type.Boolean({ description: 'Whether the crate is available for pickup' }),
  },
  { $id: 'WeaponCrate', description: 'Weapon crate state' }
);

export type WeaponCrate = Static<typeof WeaponCrateSchema>;

/**
 * Weapon spawned data payload.
 * Sent when weapon crates are spawned in the map.
 */
export const WeaponSpawnedDataSchema = Type.Object(
  {
    crates: Type.Array(WeaponCrateSchema, { description: 'Array of weapon crates' }),
  },
  { $id: 'WeaponSpawnedData', description: 'Weapon spawned event payload' }
);

export type WeaponSpawnedData = Static<typeof WeaponSpawnedDataSchema>;

/**
 * Complete weapon:spawned message schema
 */
export const WeaponSpawnedMessageSchema = createTypedMessageSchema('weapon:spawned', WeaponSpawnedDataSchema);
export type WeaponSpawnedMessage = Static<typeof WeaponSpawnedMessageSchema>;

// ============================================================================
// weapon:pickup_confirmed
// ============================================================================

/**
 * Weapon pickup confirmed data payload.
 * Sent when a player successfully picks up a weapon.
 */
export const WeaponPickupConfirmedDataSchema = Type.Object(
  {
    playerId: Type.String({ description: 'Player who picked up the weapon', minLength: 1 }),
    crateId: Type.String({ description: 'Crate that was picked up', minLength: 1 }),
    weaponType: Type.String({ description: 'Type of weapon picked up', minLength: 1 }),
    nextRespawnTime: Type.Integer({
      description: 'Time until the crate respawns (milliseconds)',
      minimum: 0,
    }),
  },
  { $id: 'WeaponPickupConfirmedData', description: 'Weapon pickup confirmed event payload' }
);

export type WeaponPickupConfirmedData = Static<typeof WeaponPickupConfirmedDataSchema>;

/**
 * Complete weapon:pickup_confirmed message schema
 */
export const WeaponPickupConfirmedMessageSchema = createTypedMessageSchema(
  'weapon:pickup_confirmed',
  WeaponPickupConfirmedDataSchema
);
export type WeaponPickupConfirmedMessage = Static<typeof WeaponPickupConfirmedMessageSchema>;

// ============================================================================
// weapon:respawned
// ============================================================================

/**
 * Weapon respawned data payload.
 * Sent when a weapon crate respawns.
 */
export const WeaponRespawnedDataSchema = Type.Object(
  {
    crateId: Type.String({ description: 'Crate that respawned', minLength: 1 }),
    weaponType: Type.String({ description: 'Type of weapon in the crate', minLength: 1 }),
    position: PositionSchema,
  },
  { $id: 'WeaponRespawnedData', description: 'Weapon respawned event payload' }
);

export type WeaponRespawnedData = Static<typeof WeaponRespawnedDataSchema>;

/**
 * Complete weapon:respawned message schema
 */
export const WeaponRespawnedMessageSchema = createTypedMessageSchema(
  'weapon:respawned',
  WeaponRespawnedDataSchema
);
export type WeaponRespawnedMessage = Static<typeof WeaponRespawnedMessageSchema>;

// ============================================================================
// melee:hit
// ============================================================================

/**
 * Melee hit data payload.
 * Sent when a melee attack hits one or more players.
 */
export const MeleeHitDataSchema = Type.Object(
  {
    attackerId: Type.String({ description: 'Player who performed the melee attack', minLength: 1 }),
    victims: Type.Array(Type.String({ minLength: 1 }), { description: 'Array of player IDs hit by the attack' }),
    knockbackApplied: Type.Boolean({ description: 'Whether knockback was applied (Bat only)' }),
  },
  { $id: 'MeleeHitData', description: 'Melee hit event payload' }
);

export type MeleeHitData = Static<typeof MeleeHitDataSchema>;

/**
 * Complete melee:hit message schema
 */
export const MeleeHitMessageSchema = createTypedMessageSchema('melee:hit', MeleeHitDataSchema);
export type MeleeHitMessage = Static<typeof MeleeHitMessageSchema>;

// ============================================================================
// roll:start
// ============================================================================

/**
 * Roll start data payload.
 * Sent when a player starts a dodge roll.
 */
export const RollStartDataSchema = Type.Object(
  {
    playerId: Type.String({ description: 'Player who started rolling', minLength: 1 }),
    direction: Type.Object(
      {
        x: Type.Number({ description: 'Roll direction X component (normalized)' }),
        y: Type.Number({ description: 'Roll direction Y component (normalized)' }),
      },
      { description: 'Roll direction vector' }
    ),
    rollStartTime: Type.Integer({ description: 'Server timestamp when roll started (ms since epoch)', minimum: 0 }),
  },
  { $id: 'RollStartData', description: 'Roll start event payload' }
);

export type RollStartData = Static<typeof RollStartDataSchema>;

/**
 * Complete roll:start message schema
 */
export const RollStartMessageSchema = createTypedMessageSchema('roll:start', RollStartDataSchema);
export type RollStartMessage = Static<typeof RollStartMessageSchema>;

// ============================================================================
// roll:end
// ============================================================================

/**
 * Roll end data payload.
 * Sent when a player's dodge roll completes or is cancelled.
 */
export const RollEndDataSchema = Type.Object(
  {
    playerId: Type.String({ description: 'Player who stopped rolling', minLength: 1 }),
    reason: Type.String({ description: 'Reason roll ended (completed, wall_collision)', minLength: 1 }),
  },
  { $id: 'RollEndData', description: 'Roll end event payload' }
);

export type RollEndData = Static<typeof RollEndDataSchema>;

/**
 * Complete roll:end message schema
 */
export const RollEndMessageSchema = createTypedMessageSchema('roll:end', RollEndDataSchema);
export type RollEndMessage = Static<typeof RollEndMessageSchema>;
