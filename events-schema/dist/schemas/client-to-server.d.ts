/**
 * Client-to-server message schemas.
 * These define the messages sent from the TypeScript client to the Go server.
 */
import { type Static } from '@sinclair/typebox';
/**
 * Input state data payload.
 * Represents keyboard input state for player movement and aim.
 */
export declare const InputStateDataSchema: import("@sinclair/typebox").TObject<{
    up: import("@sinclair/typebox").TBoolean;
    down: import("@sinclair/typebox").TBoolean;
    left: import("@sinclair/typebox").TBoolean;
    right: import("@sinclair/typebox").TBoolean;
    aimAngle: import("@sinclair/typebox").TNumber;
    isSprinting: import("@sinclair/typebox").TBoolean;
    sequence: import("@sinclair/typebox").TNumber;
}>;
export type InputStateData = Static<typeof InputStateDataSchema>;
/**
 * Complete input:state message schema
 */
export declare const InputStateMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        up: import("@sinclair/typebox").TBoolean;
        down: import("@sinclair/typebox").TBoolean;
        left: import("@sinclair/typebox").TBoolean;
        right: import("@sinclair/typebox").TBoolean;
        aimAngle: import("@sinclair/typebox").TNumber;
        isSprinting: import("@sinclair/typebox").TBoolean;
        sequence: import("@sinclair/typebox").TNumber;
    }>;
}>;
export type InputStateMessage = Static<typeof InputStateMessageSchema>;
/**
 * Player shoot data payload.
 * Sent when player attempts to shoot.
 */
export declare const PlayerShootDataSchema: import("@sinclair/typebox").TObject<{
    aimAngle: import("@sinclair/typebox").TNumber;
}>;
export type PlayerShootData = Static<typeof PlayerShootDataSchema>;
/**
 * Complete player:shoot message schema
 */
export declare const PlayerShootMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        aimAngle: import("@sinclair/typebox").TNumber;
    }>;
}>;
export type PlayerShootMessage = Static<typeof PlayerShootMessageSchema>;
/**
 * Complete player:reload message schema (no data payload)
 */
export declare const PlayerReloadMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
}>;
export type PlayerReloadMessage = Static<typeof PlayerReloadMessageSchema>;
/**
 * Weapon pickup attempt data payload.
 * Sent when player attempts to pick up a weapon crate.
 */
export declare const WeaponPickupAttemptDataSchema: import("@sinclair/typebox").TObject<{
    crateId: import("@sinclair/typebox").TString;
}>;
export type WeaponPickupAttemptData = Static<typeof WeaponPickupAttemptDataSchema>;
/**
 * Complete weapon:pickup_attempt message schema
 */
export declare const WeaponPickupAttemptMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        crateId: import("@sinclair/typebox").TString;
    }>;
}>;
export type WeaponPickupAttemptMessage = Static<typeof WeaponPickupAttemptMessageSchema>;
/**
 * Player melee attack data payload.
 * Sent when player attempts a melee attack.
 */
export declare const PlayerMeleeAttackDataSchema: import("@sinclair/typebox").TObject<{
    aimAngle: import("@sinclair/typebox").TNumber;
}>;
export type PlayerMeleeAttackData = Static<typeof PlayerMeleeAttackDataSchema>;
/**
 * Complete player:melee_attack message schema
 */
export declare const PlayerMeleeAttackMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TObject<{
        aimAngle: import("@sinclair/typebox").TNumber;
    }>;
}>;
export type PlayerMeleeAttackMessage = Static<typeof PlayerMeleeAttackMessageSchema>;
/**
 * Complete player:dodge_roll message schema (no data payload)
 * Client requests to initiate a dodge roll.
 */
export declare const PlayerDodgeRollMessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
}>;
export type PlayerDodgeRollMessage = Static<typeof PlayerDodgeRollMessageSchema>;
//# sourceMappingURL=client-to-server.d.ts.map