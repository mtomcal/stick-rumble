/**
 * Server-to-client message schemas.
 * These define the messages sent from the Go server to the TypeScript client.
 */
import { type Static } from '@sinclair/typebox';
/**
 * Room joined data payload.
 * Sent when a player successfully joins a room.
 */
export declare const RoomJoinedDataSchema: import("@sinclair/typebox").TObject<{
    playerId: import("@sinclair/typebox").TString;
}>;
export type RoomJoinedData = Static<typeof RoomJoinedDataSchema>;
/**
 * Complete room:joined message schema
 */
export declare const RoomJoinedMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        playerId: import("@sinclair/typebox").TString;
    }>;
}>;
export type RoomJoinedMessage = Static<typeof RoomJoinedMessageSchema>;
/**
 * Player left data payload.
 * Sent when a player disconnects from the room.
 *
 * **Why this message exists:** When a player's WebSocket connection closes,
 * all other players in the room need to be notified so they can remove the
 * player's sprite from their local game state. Without this message, ghost
 * players would remain on screen after disconnection.
 */
export declare const PlayerLeftDataSchema: import("@sinclair/typebox").TObject<{
    playerId: import("@sinclair/typebox").TString;
}>;
export type PlayerLeftData = Static<typeof PlayerLeftDataSchema>;
/**
 * Complete player:left message schema
 */
export declare const PlayerLeftMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        playerId: import("@sinclair/typebox").TString;
    }>;
}>;
export type PlayerLeftMessage = Static<typeof PlayerLeftMessageSchema>;
/**
 * Player state schema for move updates.
 */
export declare const PlayerStateSchema: import("@sinclair/typebox").TObject<{
    id: import("@sinclair/typebox").TString;
    position: import("@sinclair/typebox").TObject<{
        x: import("@sinclair/typebox").TNumber;
        y: import("@sinclair/typebox").TNumber;
    }>;
    velocity: import("@sinclair/typebox").TObject<{
        x: import("@sinclair/typebox").TNumber;
        y: import("@sinclair/typebox").TNumber;
    }>;
    health: import("@sinclair/typebox").TNumber;
    maxHealth: import("@sinclair/typebox").TNumber;
    rotation: import("@sinclair/typebox").TNumber;
    isDead: import("@sinclair/typebox").TBoolean;
    isSprinting: import("@sinclair/typebox").TBoolean;
    isRolling: import("@sinclair/typebox").TBoolean;
}>;
export type PlayerState = Static<typeof PlayerStateSchema>;
/**
 * Player move data payload.
 * Broadcasts current state of all players in the room.
 */
export declare const PlayerMoveDataSchema: import("@sinclair/typebox").TObject<{
    players: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
        id: import("@sinclair/typebox").TString;
        position: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        velocity: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        health: import("@sinclair/typebox").TNumber;
        maxHealth: import("@sinclair/typebox").TNumber;
        rotation: import("@sinclair/typebox").TNumber;
        isDead: import("@sinclair/typebox").TBoolean;
        isSprinting: import("@sinclair/typebox").TBoolean;
        isRolling: import("@sinclair/typebox").TBoolean;
    }>>;
    lastProcessedSequence: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TRecord<import("@sinclair/typebox").TString, import("@sinclair/typebox").TNumber>>;
}>;
export type PlayerMoveData = Static<typeof PlayerMoveDataSchema>;
/**
 * Complete player:move message schema
 */
export declare const PlayerMoveMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        players: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
            id: import("@sinclair/typebox").TString;
            position: import("@sinclair/typebox").TObject<{
                x: import("@sinclair/typebox").TNumber;
                y: import("@sinclair/typebox").TNumber;
            }>;
            velocity: import("@sinclair/typebox").TObject<{
                x: import("@sinclair/typebox").TNumber;
                y: import("@sinclair/typebox").TNumber;
            }>;
            health: import("@sinclair/typebox").TNumber;
            maxHealth: import("@sinclair/typebox").TNumber;
            rotation: import("@sinclair/typebox").TNumber;
            isDead: import("@sinclair/typebox").TBoolean;
            isSprinting: import("@sinclair/typebox").TBoolean;
            isRolling: import("@sinclair/typebox").TBoolean;
        }>>;
        lastProcessedSequence: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TRecord<import("@sinclair/typebox").TString, import("@sinclair/typebox").TNumber>>;
    }>;
}>;
export type PlayerMoveMessage = Static<typeof PlayerMoveMessageSchema>;
/**
 * Projectile spawn data payload.
 * Sent when a projectile is created.
 */
export declare const ProjectileSpawnDataSchema: import("@sinclair/typebox").TObject<{
    id: import("@sinclair/typebox").TString;
    ownerId: import("@sinclair/typebox").TString;
    weaponType: import("@sinclair/typebox").TString;
    position: import("@sinclair/typebox").TObject<{
        x: import("@sinclair/typebox").TNumber;
        y: import("@sinclair/typebox").TNumber;
    }>;
    velocity: import("@sinclair/typebox").TObject<{
        x: import("@sinclair/typebox").TNumber;
        y: import("@sinclair/typebox").TNumber;
    }>;
}>;
export type ProjectileSpawnData = Static<typeof ProjectileSpawnDataSchema>;
/**
 * Complete projectile:spawn message schema
 */
export declare const ProjectileSpawnMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        id: import("@sinclair/typebox").TString;
        ownerId: import("@sinclair/typebox").TString;
        weaponType: import("@sinclair/typebox").TString;
        position: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        velocity: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
    }>;
}>;
export type ProjectileSpawnMessage = Static<typeof ProjectileSpawnMessageSchema>;
/**
 * Projectile destroy data payload.
 * Sent when a projectile is removed from the game.
 */
export declare const ProjectileDestroyDataSchema: import("@sinclair/typebox").TObject<{
    id: import("@sinclair/typebox").TString;
}>;
export type ProjectileDestroyData = Static<typeof ProjectileDestroyDataSchema>;
/**
 * Complete projectile:destroy message schema
 */
export declare const ProjectileDestroyMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        id: import("@sinclair/typebox").TString;
    }>;
}>;
export type ProjectileDestroyMessage = Static<typeof ProjectileDestroyMessageSchema>;
/**
 * Weapon state data payload.
 * Sent when weapon state changes (ammo, reload status).
 */
export declare const WeaponStateDataSchema: import("@sinclair/typebox").TObject<{
    currentAmmo: import("@sinclair/typebox").TInteger;
    maxAmmo: import("@sinclair/typebox").TInteger;
    isReloading: import("@sinclair/typebox").TBoolean;
    canShoot: import("@sinclair/typebox").TBoolean;
    weaponType: import("@sinclair/typebox").TString;
    isMelee: import("@sinclair/typebox").TBoolean;
}>;
export type WeaponStateData = Static<typeof WeaponStateDataSchema>;
/**
 * Complete weapon:state message schema
 */
export declare const WeaponStateMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        currentAmmo: import("@sinclair/typebox").TInteger;
        maxAmmo: import("@sinclair/typebox").TInteger;
        isReloading: import("@sinclair/typebox").TBoolean;
        canShoot: import("@sinclair/typebox").TBoolean;
        weaponType: import("@sinclair/typebox").TString;
        isMelee: import("@sinclair/typebox").TBoolean;
    }>;
}>;
export type WeaponStateMessage = Static<typeof WeaponStateMessageSchema>;
/**
 * Shoot failed data payload.
 * Sent when a shoot attempt fails.
 */
export declare const ShootFailedDataSchema: import("@sinclair/typebox").TObject<{
    reason: import("@sinclair/typebox").TString;
}>;
export type ShootFailedData = Static<typeof ShootFailedDataSchema>;
/**
 * Complete shoot:failed message schema
 */
export declare const ShootFailedMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        reason: import("@sinclair/typebox").TString;
    }>;
}>;
export type ShootFailedMessage = Static<typeof ShootFailedMessageSchema>;
/**
 * Player damaged data payload.
 * Sent when a player takes damage.
 */
export declare const PlayerDamagedDataSchema: import("@sinclair/typebox").TObject<{
    victimId: import("@sinclair/typebox").TString;
    attackerId: import("@sinclair/typebox").TString;
    damage: import("@sinclair/typebox").TNumber;
    newHealth: import("@sinclair/typebox").TNumber;
    projectileId: import("@sinclair/typebox").TString;
}>;
export type PlayerDamagedData = Static<typeof PlayerDamagedDataSchema>;
/**
 * Complete player:damaged message schema
 */
export declare const PlayerDamagedMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        victimId: import("@sinclair/typebox").TString;
        attackerId: import("@sinclair/typebox").TString;
        damage: import("@sinclair/typebox").TNumber;
        newHealth: import("@sinclair/typebox").TNumber;
        projectileId: import("@sinclair/typebox").TString;
    }>;
}>;
export type PlayerDamagedMessage = Static<typeof PlayerDamagedMessageSchema>;
/**
 * Hit confirmed data payload.
 * Sent to confirm a hit was registered on the server.
 */
export declare const HitConfirmedDataSchema: import("@sinclair/typebox").TObject<{
    victimId: import("@sinclair/typebox").TString;
    damage: import("@sinclair/typebox").TNumber;
    projectileId: import("@sinclair/typebox").TString;
}>;
export type HitConfirmedData = Static<typeof HitConfirmedDataSchema>;
/**
 * Complete hit:confirmed message schema
 */
export declare const HitConfirmedMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        victimId: import("@sinclair/typebox").TString;
        damage: import("@sinclair/typebox").TNumber;
        projectileId: import("@sinclair/typebox").TString;
    }>;
}>;
export type HitConfirmedMessage = Static<typeof HitConfirmedMessageSchema>;
/**
 * Player death data payload.
 * Sent when a player is eliminated.
 */
export declare const PlayerDeathDataSchema: import("@sinclair/typebox").TObject<{
    victimId: import("@sinclair/typebox").TString;
    attackerId: import("@sinclair/typebox").TString;
}>;
export type PlayerDeathData = Static<typeof PlayerDeathDataSchema>;
/**
 * Complete player:death message schema
 */
export declare const PlayerDeathMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        victimId: import("@sinclair/typebox").TString;
        attackerId: import("@sinclair/typebox").TString;
    }>;
}>;
export type PlayerDeathMessage = Static<typeof PlayerDeathMessageSchema>;
/**
 * Player kill credit data payload.
 * Sent to update killer's stats after a kill.
 */
export declare const PlayerKillCreditDataSchema: import("@sinclair/typebox").TObject<{
    killerId: import("@sinclair/typebox").TString;
    victimId: import("@sinclair/typebox").TString;
    killerKills: import("@sinclair/typebox").TInteger;
    killerXP: import("@sinclair/typebox").TInteger;
}>;
export type PlayerKillCreditData = Static<typeof PlayerKillCreditDataSchema>;
/**
 * Complete player:kill_credit message schema
 */
export declare const PlayerKillCreditMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        killerId: import("@sinclair/typebox").TString;
        victimId: import("@sinclair/typebox").TString;
        killerKills: import("@sinclair/typebox").TInteger;
        killerXP: import("@sinclair/typebox").TInteger;
    }>;
}>;
export type PlayerKillCreditMessage = Static<typeof PlayerKillCreditMessageSchema>;
/**
 * Player respawn data payload.
 * Sent when a player respawns after death.
 */
export declare const PlayerRespawnDataSchema: import("@sinclair/typebox").TObject<{
    playerId: import("@sinclair/typebox").TString;
    position: import("@sinclair/typebox").TObject<{
        x: import("@sinclair/typebox").TNumber;
        y: import("@sinclair/typebox").TNumber;
    }>;
    health: import("@sinclair/typebox").TNumber;
}>;
export type PlayerRespawnData = Static<typeof PlayerRespawnDataSchema>;
/**
 * Complete player:respawn message schema
 */
export declare const PlayerRespawnMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        playerId: import("@sinclair/typebox").TString;
        position: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        health: import("@sinclair/typebox").TNumber;
    }>;
}>;
export type PlayerRespawnMessage = Static<typeof PlayerRespawnMessageSchema>;
/**
 * Match timer data payload.
 * Sent periodically with remaining match time.
 */
export declare const MatchTimerDataSchema: import("@sinclair/typebox").TObject<{
    remainingSeconds: import("@sinclair/typebox").TInteger;
}>;
export type MatchTimerData = Static<typeof MatchTimerDataSchema>;
/**
 * Complete match:timer message schema
 */
export declare const MatchTimerMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        remainingSeconds: import("@sinclair/typebox").TInteger;
    }>;
}>;
export type MatchTimerMessage = Static<typeof MatchTimerMessageSchema>;
/**
 * Player score schema for match end results.
 * Contains individual player statistics from the match.
 */
export declare const PlayerScoreSchema: import("@sinclair/typebox").TObject<{
    playerId: import("@sinclair/typebox").TString;
    kills: import("@sinclair/typebox").TInteger;
    deaths: import("@sinclair/typebox").TInteger;
    xp: import("@sinclair/typebox").TInteger;
}>;
export type PlayerScore = Static<typeof PlayerScoreSchema>;
/**
 * Match ended data payload.
 * Sent when the match concludes.
 */
export declare const MatchEndedDataSchema: import("@sinclair/typebox").TObject<{
    winners: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>;
    finalScores: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
        playerId: import("@sinclair/typebox").TString;
        kills: import("@sinclair/typebox").TInteger;
        deaths: import("@sinclair/typebox").TInteger;
        xp: import("@sinclair/typebox").TInteger;
    }>>;
    reason: import("@sinclair/typebox").TString;
}>;
export type MatchEndedData = Static<typeof MatchEndedDataSchema>;
/**
 * Complete match:ended message schema
 */
export declare const MatchEndedMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        winners: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>;
        finalScores: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
            playerId: import("@sinclair/typebox").TString;
            kills: import("@sinclair/typebox").TInteger;
            deaths: import("@sinclair/typebox").TInteger;
            xp: import("@sinclair/typebox").TInteger;
        }>>;
        reason: import("@sinclair/typebox").TString;
    }>;
}>;
export type MatchEndedMessage = Static<typeof MatchEndedMessageSchema>;
/**
 * Weapon crate schema for spawned weapons.
 */
export declare const WeaponCrateSchema: import("@sinclair/typebox").TObject<{
    id: import("@sinclair/typebox").TString;
    position: import("@sinclair/typebox").TObject<{
        x: import("@sinclair/typebox").TNumber;
        y: import("@sinclair/typebox").TNumber;
    }>;
    weaponType: import("@sinclair/typebox").TString;
    isAvailable: import("@sinclair/typebox").TBoolean;
}>;
export type WeaponCrate = Static<typeof WeaponCrateSchema>;
/**
 * Weapon spawned data payload.
 * Sent when weapon crates are spawned in the map.
 */
export declare const WeaponSpawnedDataSchema: import("@sinclair/typebox").TObject<{
    crates: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
        id: import("@sinclair/typebox").TString;
        position: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        weaponType: import("@sinclair/typebox").TString;
        isAvailable: import("@sinclair/typebox").TBoolean;
    }>>;
}>;
export type WeaponSpawnedData = Static<typeof WeaponSpawnedDataSchema>;
/**
 * Complete weapon:spawned message schema
 */
export declare const WeaponSpawnedMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        crates: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
            id: import("@sinclair/typebox").TString;
            position: import("@sinclair/typebox").TObject<{
                x: import("@sinclair/typebox").TNumber;
                y: import("@sinclair/typebox").TNumber;
            }>;
            weaponType: import("@sinclair/typebox").TString;
            isAvailable: import("@sinclair/typebox").TBoolean;
        }>>;
    }>;
}>;
export type WeaponSpawnedMessage = Static<typeof WeaponSpawnedMessageSchema>;
/**
 * Weapon pickup confirmed data payload.
 * Sent when a player successfully picks up a weapon.
 */
export declare const WeaponPickupConfirmedDataSchema: import("@sinclair/typebox").TObject<{
    playerId: import("@sinclair/typebox").TString;
    crateId: import("@sinclair/typebox").TString;
    weaponType: import("@sinclair/typebox").TString;
    nextRespawnTime: import("@sinclair/typebox").TInteger;
}>;
export type WeaponPickupConfirmedData = Static<typeof WeaponPickupConfirmedDataSchema>;
/**
 * Complete weapon:pickup_confirmed message schema
 */
export declare const WeaponPickupConfirmedMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        playerId: import("@sinclair/typebox").TString;
        crateId: import("@sinclair/typebox").TString;
        weaponType: import("@sinclair/typebox").TString;
        nextRespawnTime: import("@sinclair/typebox").TInteger;
    }>;
}>;
export type WeaponPickupConfirmedMessage = Static<typeof WeaponPickupConfirmedMessageSchema>;
/**
 * Weapon respawned data payload.
 * Sent when a weapon crate respawns.
 */
export declare const WeaponRespawnedDataSchema: import("@sinclair/typebox").TObject<{
    crateId: import("@sinclair/typebox").TString;
    weaponType: import("@sinclair/typebox").TString;
    position: import("@sinclair/typebox").TObject<{
        x: import("@sinclair/typebox").TNumber;
        y: import("@sinclair/typebox").TNumber;
    }>;
}>;
export type WeaponRespawnedData = Static<typeof WeaponRespawnedDataSchema>;
/**
 * Complete weapon:respawned message schema
 */
export declare const WeaponRespawnedMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        crateId: import("@sinclair/typebox").TString;
        weaponType: import("@sinclair/typebox").TString;
        position: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
    }>;
}>;
export type WeaponRespawnedMessage = Static<typeof WeaponRespawnedMessageSchema>;
/**
 * Melee hit data payload.
 * Sent when a melee attack hits one or more players.
 */
export declare const MeleeHitDataSchema: import("@sinclair/typebox").TObject<{
    attackerId: import("@sinclair/typebox").TString;
    victims: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>;
    knockbackApplied: import("@sinclair/typebox").TBoolean;
}>;
export type MeleeHitData = Static<typeof MeleeHitDataSchema>;
/**
 * Complete melee:hit message schema
 */
export declare const MeleeHitMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        attackerId: import("@sinclair/typebox").TString;
        victims: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>;
        knockbackApplied: import("@sinclair/typebox").TBoolean;
    }>;
}>;
export type MeleeHitMessage = Static<typeof MeleeHitMessageSchema>;
/**
 * Roll start data payload.
 * Sent when a player starts a dodge roll.
 */
export declare const RollStartDataSchema: import("@sinclair/typebox").TObject<{
    playerId: import("@sinclair/typebox").TString;
    direction: import("@sinclair/typebox").TObject<{
        x: import("@sinclair/typebox").TNumber;
        y: import("@sinclair/typebox").TNumber;
    }>;
    rollStartTime: import("@sinclair/typebox").TInteger;
}>;
export type RollStartData = Static<typeof RollStartDataSchema>;
/**
 * Complete roll:start message schema
 */
export declare const RollStartMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        playerId: import("@sinclair/typebox").TString;
        direction: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        rollStartTime: import("@sinclair/typebox").TInteger;
    }>;
}>;
export type RollStartMessage = Static<typeof RollStartMessageSchema>;
/**
 * Roll end data payload.
 * Sent when a player's dodge roll completes or is cancelled.
 */
export declare const RollEndDataSchema: import("@sinclair/typebox").TObject<{
    playerId: import("@sinclair/typebox").TString;
    reason: import("@sinclair/typebox").TString;
}>;
export type RollEndData = Static<typeof RollEndDataSchema>;
/**
 * Complete roll:end message schema
 */
export declare const RollEndMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        playerId: import("@sinclair/typebox").TString;
        reason: import("@sinclair/typebox").TString;
    }>;
}>;
export type RollEndMessage = Static<typeof RollEndMessageSchema>;
/**
 * Projectile snapshot schema for full state updates.
 */
export declare const ProjectileSnapshotSchema: import("@sinclair/typebox").TObject<{
    id: import("@sinclair/typebox").TString;
    ownerId: import("@sinclair/typebox").TString;
    position: import("@sinclair/typebox").TObject<{
        x: import("@sinclair/typebox").TNumber;
        y: import("@sinclair/typebox").TNumber;
    }>;
    velocity: import("@sinclair/typebox").TObject<{
        x: import("@sinclair/typebox").TNumber;
        y: import("@sinclair/typebox").TNumber;
    }>;
}>;
export type ProjectileSnapshot = Static<typeof ProjectileSnapshotSchema>;
/**
 * Weapon crate snapshot schema for full state updates.
 */
export declare const WeaponCrateSnapshotSchema: import("@sinclair/typebox").TObject<{
    id: import("@sinclair/typebox").TString;
    position: import("@sinclair/typebox").TObject<{
        x: import("@sinclair/typebox").TNumber;
        y: import("@sinclair/typebox").TNumber;
    }>;
    weaponType: import("@sinclair/typebox").TString;
    isAvailable: import("@sinclair/typebox").TBoolean;
}>;
export type WeaponCrateSnapshot = Static<typeof WeaponCrateSnapshotSchema>;
/**
 * Full state snapshot data payload.
 * Sent periodically (every 1 second) to prevent delta drift.
 * Contains the complete game state.
 */
export declare const StateSnapshotDataSchema: import("@sinclair/typebox").TObject<{
    players: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
        id: import("@sinclair/typebox").TString;
        position: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        velocity: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        health: import("@sinclair/typebox").TNumber;
        maxHealth: import("@sinclair/typebox").TNumber;
        rotation: import("@sinclair/typebox").TNumber;
        isDead: import("@sinclair/typebox").TBoolean;
        isSprinting: import("@sinclair/typebox").TBoolean;
        isRolling: import("@sinclair/typebox").TBoolean;
    }>>;
    projectiles: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
        id: import("@sinclair/typebox").TString;
        ownerId: import("@sinclair/typebox").TString;
        position: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        velocity: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
    }>>;
    weaponCrates: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
        id: import("@sinclair/typebox").TString;
        position: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        weaponType: import("@sinclair/typebox").TString;
        isAvailable: import("@sinclair/typebox").TBoolean;
    }>>;
}>;
export type StateSnapshotData = Static<typeof StateSnapshotDataSchema>;
/**
 * Complete state:snapshot message schema
 */
export declare const StateSnapshotMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        players: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
            id: import("@sinclair/typebox").TString;
            position: import("@sinclair/typebox").TObject<{
                x: import("@sinclair/typebox").TNumber;
                y: import("@sinclair/typebox").TNumber;
            }>;
            velocity: import("@sinclair/typebox").TObject<{
                x: import("@sinclair/typebox").TNumber;
                y: import("@sinclair/typebox").TNumber;
            }>;
            health: import("@sinclair/typebox").TNumber;
            maxHealth: import("@sinclair/typebox").TNumber;
            rotation: import("@sinclair/typebox").TNumber;
            isDead: import("@sinclair/typebox").TBoolean;
            isSprinting: import("@sinclair/typebox").TBoolean;
            isRolling: import("@sinclair/typebox").TBoolean;
        }>>;
        projectiles: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
            id: import("@sinclair/typebox").TString;
            ownerId: import("@sinclair/typebox").TString;
            position: import("@sinclair/typebox").TObject<{
                x: import("@sinclair/typebox").TNumber;
                y: import("@sinclair/typebox").TNumber;
            }>;
            velocity: import("@sinclair/typebox").TObject<{
                x: import("@sinclair/typebox").TNumber;
                y: import("@sinclair/typebox").TNumber;
            }>;
        }>>;
        weaponCrates: import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
            id: import("@sinclair/typebox").TString;
            position: import("@sinclair/typebox").TObject<{
                x: import("@sinclair/typebox").TNumber;
                y: import("@sinclair/typebox").TNumber;
            }>;
            weaponType: import("@sinclair/typebox").TString;
            isAvailable: import("@sinclair/typebox").TBoolean;
        }>>;
    }>;
}>;
export type StateSnapshotMessage = Static<typeof StateSnapshotMessageSchema>;
/**
 * Delta state update data payload.
 * Contains only changed entities since last update.
 * Sent at high frequency (20Hz) between full snapshots.
 */
export declare const StateDeltaDataSchema: import("@sinclair/typebox").TObject<{
    players: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
        id: import("@sinclair/typebox").TString;
        position: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        velocity: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        health: import("@sinclair/typebox").TNumber;
        maxHealth: import("@sinclair/typebox").TNumber;
        rotation: import("@sinclair/typebox").TNumber;
        isDead: import("@sinclair/typebox").TBoolean;
        isSprinting: import("@sinclair/typebox").TBoolean;
        isRolling: import("@sinclair/typebox").TBoolean;
    }>>>;
    projectilesAdded: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
        id: import("@sinclair/typebox").TString;
        ownerId: import("@sinclair/typebox").TString;
        position: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
        velocity: import("@sinclair/typebox").TObject<{
            x: import("@sinclair/typebox").TNumber;
            y: import("@sinclair/typebox").TNumber;
        }>;
    }>>>;
    projectilesRemoved: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
}>;
export type StateDeltaData = Static<typeof StateDeltaDataSchema>;
/**
 * Complete state:delta message schema
 */
export declare const StateDeltaMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        players: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
            id: import("@sinclair/typebox").TString;
            position: import("@sinclair/typebox").TObject<{
                x: import("@sinclair/typebox").TNumber;
                y: import("@sinclair/typebox").TNumber;
            }>;
            velocity: import("@sinclair/typebox").TObject<{
                x: import("@sinclair/typebox").TNumber;
                y: import("@sinclair/typebox").TNumber;
            }>;
            health: import("@sinclair/typebox").TNumber;
            maxHealth: import("@sinclair/typebox").TNumber;
            rotation: import("@sinclair/typebox").TNumber;
            isDead: import("@sinclair/typebox").TBoolean;
            isSprinting: import("@sinclair/typebox").TBoolean;
            isRolling: import("@sinclair/typebox").TBoolean;
        }>>>;
        projectilesAdded: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TObject<{
            id: import("@sinclair/typebox").TString;
            ownerId: import("@sinclair/typebox").TString;
            position: import("@sinclair/typebox").TObject<{
                x: import("@sinclair/typebox").TNumber;
                y: import("@sinclair/typebox").TNumber;
            }>;
            velocity: import("@sinclair/typebox").TObject<{
                x: import("@sinclair/typebox").TNumber;
                y: import("@sinclair/typebox").TNumber;
            }>;
        }>>>;
        projectilesRemoved: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TArray<import("@sinclair/typebox").TString>>;
    }>;
}>;
export type StateDeltaMessage = Static<typeof StateDeltaMessageSchema>;
//# sourceMappingURL=server-to-client.d.ts.map