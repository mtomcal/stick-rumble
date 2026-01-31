/**
 * Common TypeBox schemas for shared types used across WebSocket events.
 * These schemas compile to valid JSON Schema and provide TypeScript type inference.
 */
import { Type, type Static } from '@sinclair/typebox';
/**
 * Position schema representing a 2D coordinate.
 * Used for player positions, projectile positions, spawn points, etc.
 */
export declare const PositionSchema: import("@sinclair/typebox").TObject<{
    x: import("@sinclair/typebox").TNumber;
    y: import("@sinclair/typebox").TNumber;
}>;
/**
 * TypeScript type inferred from PositionSchema
 */
export type Position = Static<typeof PositionSchema>;
/**
 * Velocity schema representing 2D velocity/direction.
 * Used for player movement, projectile direction, etc.
 */
export declare const VelocitySchema: import("@sinclair/typebox").TObject<{
    x: import("@sinclair/typebox").TNumber;
    y: import("@sinclair/typebox").TNumber;
}>;
/**
 * TypeScript type inferred from VelocitySchema
 */
export type Velocity = Static<typeof VelocitySchema>;
/**
 * Base message wrapper schema factory.
 * Creates a message schema with the standard type, timestamp, and optional data fields.
 *
 * @param messageType - The literal type string for this message
 * @param dataSchema - Optional schema for the data payload
 * @returns A TypeBox schema for the complete message
 */
export declare const MessageSchema: import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TString;
    timestamp: import("@sinclair/typebox").TInteger;
    data: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TUnknown>;
}>;
/**
 * TypeScript type inferred from MessageSchema
 */
export type Message = Static<typeof MessageSchema>;
/**
 * Factory function to create typed message schemas with specific data payloads.
 * This preserves type inference while ensuring all messages follow the standard format.
 *
 * @param messageType - The literal string type for this message
 * @param dataSchema - The TypeBox schema for the data payload
 * @returns A new TypeBox schema for the typed message
 */
export declare function createTypedMessageSchema<T extends ReturnType<typeof Type.Object>>(messageType: string, dataSchema: T): import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
    data: T;
}>;
/**
 * Factory function to create typed message schemas without data payloads.
 *
 * @param messageType - The literal string type for this message
 * @returns A new TypeBox schema for the typed message without data
 */
export declare function createTypedMessageSchemaNoData(messageType: string): import("@sinclair/typebox").TObject<{
    type: import("@sinclair/typebox").TLiteral<string>;
    timestamp: import("@sinclair/typebox").TInteger;
}>;
//# sourceMappingURL=common.d.ts.map