/**
 * Server-to-client message schemas.
 * These define the messages sent from the Go server to the TypeScript client.
 */
import { Type } from '@sinclair/typebox';
import { createTypedMessageSchema, PositionSchema, VelocitySchema } from './common.js';
// ============================================================================
// room:joined
// ============================================================================
/**
 * Room joined data payload.
 * Sent when a player successfully joins a room.
 */
export const RoomJoinedDataSchema = Type.Object({
    playerId: Type.String({ description: 'Unique identifier for the player', minLength: 1 }),
}, { $id: 'RoomJoinedData', description: 'Room joined event payload' });
/**
 * Complete room:joined message schema
 */
export const RoomJoinedMessageSchema = createTypedMessageSchema('room:joined', RoomJoinedDataSchema);
// ============================================================================
// player:left
// ============================================================================
/**
 * Player left data payload.
 * Sent when a player disconnects from the room.
 *
 * **Why this message exists:** When a player's WebSocket connection closes,
 * all other players in the room need to be notified so they can remove the
 * player's sprite from their local game state. Without this message, ghost
 * players would remain on screen after disconnection.
 */
export const PlayerLeftDataSchema = Type.Object({
    playerId: Type.String({ description: 'Unique identifier of the player who left', minLength: 1 }),
}, { $id: 'PlayerLeftData', description: 'Player left event payload' });
/**
 * Complete player:left message schema
 */
export const PlayerLeftMessageSchema = createTypedMessageSchema('player:left', PlayerLeftDataSchema);
// ============================================================================
// player:move
// ============================================================================
/**
 * Player state schema for move updates.
 */
export const PlayerStateSchema = Type.Object({
    id: Type.String({ description: 'Player unique identifier', minLength: 1 }),
    position: PositionSchema,
    velocity: VelocitySchema,
    health: Type.Number({ description: 'Current health', minimum: 0 }),
    maxHealth: Type.Number({ description: 'Maximum health', minimum: 0 }),
    rotation: Type.Number({ description: 'Player rotation in radians' }),
    isDead: Type.Boolean({ description: 'Whether the player is dead' }),
    isSprinting: Type.Boolean({ description: 'Whether the player is currently sprinting' }),
    isRolling: Type.Boolean({ description: 'Whether the player is currently dodge rolling' }),
}, { $id: 'PlayerState', description: 'Player state for movement updates' });
/**
 * Player move data payload.
 * Broadcasts current state of all players in the room.
 */
export const PlayerMoveDataSchema = Type.Object({
    players: Type.Array(PlayerStateSchema, { description: 'Array of player states' }),
    lastProcessedSequence: Type.Optional(Type.Record(Type.String({ description: 'Player ID' }), Type.Number({ description: 'Last processed input sequence number for this player', minimum: 0 }), { description: 'Map of player IDs to their last processed input sequence number for client-side prediction reconciliation' })),
}, { $id: 'PlayerMoveData', description: 'Player movement update payload' });
/**
 * Complete player:move message schema
 */
export const PlayerMoveMessageSchema = createTypedMessageSchema('player:move', PlayerMoveDataSchema);
// ============================================================================
// projectile:spawn
// ============================================================================
/**
 * Projectile spawn data payload.
 * Sent when a projectile is created.
 */
export const ProjectileSpawnDataSchema = Type.Object({
    id: Type.String({ description: 'Unique projectile identifier', minLength: 1 }),
    ownerId: Type.String({ description: 'Player who fired the projectile', minLength: 1 }),
    weaponType: Type.String({ description: 'Type of weapon that fired the projectile', minLength: 1 }),
    position: PositionSchema,
    velocity: VelocitySchema,
}, { $id: 'ProjectileSpawnData', description: 'Projectile spawn event payload' });
/**
 * Complete projectile:spawn message schema
 */
export const ProjectileSpawnMessageSchema = createTypedMessageSchema('projectile:spawn', ProjectileSpawnDataSchema);
// ============================================================================
// projectile:destroy
// ============================================================================
/**
 * Projectile destroy data payload.
 * Sent when a projectile is removed from the game.
 */
export const ProjectileDestroyDataSchema = Type.Object({
    id: Type.String({ description: 'Unique projectile identifier', minLength: 1 }),
}, { $id: 'ProjectileDestroyData', description: 'Projectile destroy event payload' });
/**
 * Complete projectile:destroy message schema
 */
export const ProjectileDestroyMessageSchema = createTypedMessageSchema('projectile:destroy', ProjectileDestroyDataSchema);
// ============================================================================
// weapon:state
// ============================================================================
/**
 * Weapon state data payload.
 * Sent when weapon state changes (ammo, reload status).
 */
export const WeaponStateDataSchema = Type.Object({
    currentAmmo: Type.Integer({ description: 'Current ammunition count', minimum: 0 }),
    maxAmmo: Type.Integer({ description: 'Maximum ammunition capacity', minimum: 0 }),
    isReloading: Type.Boolean({ description: 'Whether the weapon is currently reloading' }),
    canShoot: Type.Boolean({ description: 'Whether the weapon can currently shoot' }),
    weaponType: Type.String({ description: 'Name of the current weapon (e.g., "Pistol", "Bat", "Katana")', minLength: 1 }),
    isMelee: Type.Boolean({ description: 'Whether the current weapon is a melee weapon' }),
}, { $id: 'WeaponStateData', description: 'Weapon state payload' });
/**
 * Complete weapon:state message schema
 */
export const WeaponStateMessageSchema = createTypedMessageSchema('weapon:state', WeaponStateDataSchema);
// ============================================================================
// shoot:failed
// ============================================================================
/**
 * Shoot failed data payload.
 * Sent when a shoot attempt fails.
 */
export const ShootFailedDataSchema = Type.Object({
    reason: Type.String({ description: 'Reason why the shot failed', minLength: 1 }),
}, { $id: 'ShootFailedData', description: 'Shoot failed event payload' });
/**
 * Complete shoot:failed message schema
 */
export const ShootFailedMessageSchema = createTypedMessageSchema('shoot:failed', ShootFailedDataSchema);
// ============================================================================
// player:damaged
// ============================================================================
/**
 * Player damaged data payload.
 * Sent when a player takes damage.
 */
export const PlayerDamagedDataSchema = Type.Object({
    victimId: Type.String({ description: 'Player who took damage', minLength: 1 }),
    attackerId: Type.String({ description: 'Player who dealt damage', minLength: 1 }),
    damage: Type.Number({ description: 'Amount of damage dealt', minimum: 0 }),
    newHealth: Type.Number({ description: 'Victim health after damage', minimum: 0 }),
    projectileId: Type.String({ description: 'Projectile that caused damage', minLength: 1 }),
}, { $id: 'PlayerDamagedData', description: 'Player damaged event payload' });
/**
 * Complete player:damaged message schema
 */
export const PlayerDamagedMessageSchema = createTypedMessageSchema('player:damaged', PlayerDamagedDataSchema);
// ============================================================================
// hit:confirmed
// ============================================================================
/**
 * Hit confirmed data payload.
 * Sent to confirm a hit was registered on the server.
 */
export const HitConfirmedDataSchema = Type.Object({
    victimId: Type.String({ description: 'Player who was hit', minLength: 1 }),
    damage: Type.Number({ description: 'Amount of damage dealt', minimum: 0 }),
    projectileId: Type.String({ description: 'Projectile that hit', minLength: 1 }),
}, { $id: 'HitConfirmedData', description: 'Hit confirmed event payload' });
/**
 * Complete hit:confirmed message schema
 */
export const HitConfirmedMessageSchema = createTypedMessageSchema('hit:confirmed', HitConfirmedDataSchema);
// ============================================================================
// player:death
// ============================================================================
/**
 * Player death data payload.
 * Sent when a player is eliminated.
 */
export const PlayerDeathDataSchema = Type.Object({
    victimId: Type.String({ description: 'Player who died', minLength: 1 }),
    attackerId: Type.String({ description: 'Player who got the kill', minLength: 1 }),
}, { $id: 'PlayerDeathData', description: 'Player death event payload' });
/**
 * Complete player:death message schema
 */
export const PlayerDeathMessageSchema = createTypedMessageSchema('player:death', PlayerDeathDataSchema);
// ============================================================================
// player:kill_credit
// ============================================================================
/**
 * Player kill credit data payload.
 * Sent to update killer's stats after a kill.
 */
export const PlayerKillCreditDataSchema = Type.Object({
    killerId: Type.String({ description: 'Player who got the kill', minLength: 1 }),
    victimId: Type.String({ description: 'Player who died', minLength: 1 }),
    killerKills: Type.Integer({ description: 'Killer total kills', minimum: 0 }),
    killerXP: Type.Integer({ description: 'Killer total XP', minimum: 0 }),
}, { $id: 'PlayerKillCreditData', description: 'Player kill credit event payload' });
/**
 * Complete player:kill_credit message schema
 */
export const PlayerKillCreditMessageSchema = createTypedMessageSchema('player:kill_credit', PlayerKillCreditDataSchema);
// ============================================================================
// player:respawn
// ============================================================================
/**
 * Player respawn data payload.
 * Sent when a player respawns after death.
 */
export const PlayerRespawnDataSchema = Type.Object({
    playerId: Type.String({ description: 'Player who respawned', minLength: 1 }),
    position: PositionSchema,
    health: Type.Number({ description: 'Respawn health', minimum: 0 }),
}, { $id: 'PlayerRespawnData', description: 'Player respawn event payload' });
/**
 * Complete player:respawn message schema
 */
export const PlayerRespawnMessageSchema = createTypedMessageSchema('player:respawn', PlayerRespawnDataSchema);
// ============================================================================
// match:timer
// ============================================================================
/**
 * Match timer data payload.
 * Sent periodically with remaining match time.
 */
export const MatchTimerDataSchema = Type.Object({
    remainingSeconds: Type.Integer({ description: 'Seconds remaining in the match', minimum: 0 }),
}, { $id: 'MatchTimerData', description: 'Match timer event payload' });
/**
 * Complete match:timer message schema
 */
export const MatchTimerMessageSchema = createTypedMessageSchema('match:timer', MatchTimerDataSchema);
// ============================================================================
// match:ended
// ============================================================================
/**
 * Player score schema for match end results.
 * Contains individual player statistics from the match.
 */
export const PlayerScoreSchema = Type.Object({
    playerId: Type.String({ description: 'Player unique identifier', minLength: 1 }),
    kills: Type.Integer({ description: 'Number of kills', minimum: 0 }),
    deaths: Type.Integer({ description: 'Number of deaths', minimum: 0 }),
    xp: Type.Integer({ description: 'Total XP earned', minimum: 0 }),
}, { $id: 'PlayerScore', description: 'Player final score data' });
/**
 * Match ended data payload.
 * Sent when the match concludes.
 */
export const MatchEndedDataSchema = Type.Object({
    winners: Type.Array(Type.String(), { description: 'Array of winner player IDs' }),
    finalScores: Type.Array(PlayerScoreSchema, {
        description: 'Array of final player scores',
    }),
    reason: Type.String({ description: 'Reason the match ended', minLength: 1 }),
}, { $id: 'MatchEndedData', description: 'Match ended event payload' });
/**
 * Complete match:ended message schema
 */
export const MatchEndedMessageSchema = createTypedMessageSchema('match:ended', MatchEndedDataSchema);
// ============================================================================
// weapon:spawned
// ============================================================================
/**
 * Weapon crate schema for spawned weapons.
 */
export const WeaponCrateSchema = Type.Object({
    id: Type.String({ description: 'Unique crate identifier', minLength: 1 }),
    position: PositionSchema,
    weaponType: Type.String({ description: 'Type of weapon in the crate', minLength: 1 }),
    isAvailable: Type.Boolean({ description: 'Whether the crate is available for pickup' }),
}, { $id: 'WeaponCrate', description: 'Weapon crate state' });
/**
 * Weapon spawned data payload.
 * Sent when weapon crates are spawned in the map.
 */
export const WeaponSpawnedDataSchema = Type.Object({
    crates: Type.Array(WeaponCrateSchema, { description: 'Array of weapon crates' }),
}, { $id: 'WeaponSpawnedData', description: 'Weapon spawned event payload' });
/**
 * Complete weapon:spawned message schema
 */
export const WeaponSpawnedMessageSchema = createTypedMessageSchema('weapon:spawned', WeaponSpawnedDataSchema);
// ============================================================================
// weapon:pickup_confirmed
// ============================================================================
/**
 * Weapon pickup confirmed data payload.
 * Sent when a player successfully picks up a weapon.
 */
export const WeaponPickupConfirmedDataSchema = Type.Object({
    playerId: Type.String({ description: 'Player who picked up the weapon', minLength: 1 }),
    crateId: Type.String({ description: 'Crate that was picked up', minLength: 1 }),
    weaponType: Type.String({ description: 'Type of weapon picked up', minLength: 1 }),
    nextRespawnTime: Type.Integer({
        description: 'Time until the crate respawns (milliseconds)',
        minimum: 0,
    }),
}, { $id: 'WeaponPickupConfirmedData', description: 'Weapon pickup confirmed event payload' });
/**
 * Complete weapon:pickup_confirmed message schema
 */
export const WeaponPickupConfirmedMessageSchema = createTypedMessageSchema('weapon:pickup_confirmed', WeaponPickupConfirmedDataSchema);
// ============================================================================
// weapon:respawned
// ============================================================================
/**
 * Weapon respawned data payload.
 * Sent when a weapon crate respawns.
 */
export const WeaponRespawnedDataSchema = Type.Object({
    crateId: Type.String({ description: 'Crate that respawned', minLength: 1 }),
    weaponType: Type.String({ description: 'Type of weapon in the crate', minLength: 1 }),
    position: PositionSchema,
}, { $id: 'WeaponRespawnedData', description: 'Weapon respawned event payload' });
/**
 * Complete weapon:respawned message schema
 */
export const WeaponRespawnedMessageSchema = createTypedMessageSchema('weapon:respawned', WeaponRespawnedDataSchema);
// ============================================================================
// melee:hit
// ============================================================================
/**
 * Melee hit data payload.
 * Sent when a melee attack hits one or more players.
 */
export const MeleeHitDataSchema = Type.Object({
    attackerId: Type.String({ description: 'Player who performed the melee attack', minLength: 1 }),
    victims: Type.Array(Type.String({ minLength: 1 }), { description: 'Array of player IDs hit by the attack' }),
    knockbackApplied: Type.Boolean({ description: 'Whether knockback was applied (Bat only)' }),
}, { $id: 'MeleeHitData', description: 'Melee hit event payload' });
/**
 * Complete melee:hit message schema
 */
export const MeleeHitMessageSchema = createTypedMessageSchema('melee:hit', MeleeHitDataSchema);
// ============================================================================
// roll:start
// ============================================================================
/**
 * Roll start data payload.
 * Sent when a player starts a dodge roll.
 */
export const RollStartDataSchema = Type.Object({
    playerId: Type.String({ description: 'Player who started rolling', minLength: 1 }),
    direction: Type.Object({
        x: Type.Number({ description: 'Roll direction X component (normalized)' }),
        y: Type.Number({ description: 'Roll direction Y component (normalized)' }),
    }, { description: 'Roll direction vector' }),
    rollStartTime: Type.Integer({ description: 'Server timestamp when roll started (ms since epoch)', minimum: 0 }),
}, { $id: 'RollStartData', description: 'Roll start event payload' });
/**
 * Complete roll:start message schema
 */
export const RollStartMessageSchema = createTypedMessageSchema('roll:start', RollStartDataSchema);
// ============================================================================
// roll:end
// ============================================================================
/**
 * Roll end data payload.
 * Sent when a player's dodge roll completes or is cancelled.
 */
export const RollEndDataSchema = Type.Object({
    playerId: Type.String({ description: 'Player who stopped rolling', minLength: 1 }),
    reason: Type.String({ description: 'Reason roll ended (completed, wall_collision)', minLength: 1 }),
}, { $id: 'RollEndData', description: 'Roll end event payload' });
/**
 * Complete roll:end message schema
 */
export const RollEndMessageSchema = createTypedMessageSchema('roll:end', RollEndDataSchema);
// ============================================================================
// state:snapshot (Delta Compression - Full State Snapshot)
// ============================================================================
/**
 * Projectile snapshot schema for full state updates.
 */
export const ProjectileSnapshotSchema = Type.Object({
    id: Type.String({ description: 'Unique projectile identifier', minLength: 1 }),
    ownerId: Type.String({ description: 'Player who fired the projectile', minLength: 1 }),
    position: PositionSchema,
    velocity: VelocitySchema,
}, { $id: 'ProjectileSnapshot', description: 'Projectile state snapshot' });
/**
 * Weapon crate snapshot schema for full state updates.
 */
export const WeaponCrateSnapshotSchema = Type.Object({
    id: Type.String({ description: 'Unique crate identifier', minLength: 1 }),
    position: PositionSchema,
    weaponType: Type.String({ description: 'Type of weapon in the crate', minLength: 1 }),
    isAvailable: Type.Boolean({ description: 'Whether the crate is currently available for pickup' }),
}, { $id: 'WeaponCrateSnapshot', description: 'Weapon crate state snapshot' });
/**
 * Full state snapshot data payload.
 * Sent periodically (every 1 second) to prevent delta drift.
 * Contains the complete game state.
 */
export const StateSnapshotDataSchema = Type.Object({
    players: Type.Array(PlayerStateSchema, { description: 'Complete state of all players' }),
    projectiles: Type.Array(ProjectileSnapshotSchema, { description: 'Complete state of all projectiles' }),
    weaponCrates: Type.Array(WeaponCrateSnapshotSchema, { description: 'Complete state of all weapon crates' }),
}, { $id: 'StateSnapshotData', description: 'Full game state snapshot for delta compression' });
/**
 * Complete state:snapshot message schema
 */
export const StateSnapshotMessageSchema = createTypedMessageSchema('state:snapshot', StateSnapshotDataSchema);
// ============================================================================
// state:delta (Delta Compression - Incremental Updates)
// ============================================================================
/**
 * Delta state update data payload.
 * Contains only changed entities since last update.
 * Sent at high frequency (20Hz) between full snapshots.
 */
export const StateDeltaDataSchema = Type.Object({
    players: Type.Optional(Type.Array(PlayerStateSchema, { description: 'Players that changed state' })),
    projectilesAdded: Type.Optional(Type.Array(ProjectileSnapshotSchema, { description: 'New projectiles spawned' })),
    projectilesRemoved: Type.Optional(Type.Array(Type.String(), { description: 'IDs of destroyed projectiles' })),
}, { $id: 'StateDeltaData', description: 'Incremental state changes for delta compression' });
/**
 * Complete state:delta message schema
 */
export const StateDeltaMessageSchema = createTypedMessageSchema('state:delta', StateDeltaDataSchema);
//# sourceMappingURL=server-to-client.js.map