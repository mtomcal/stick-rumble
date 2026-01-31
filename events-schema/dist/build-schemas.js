/**
 * Build script for generating JSON Schema files from TypeBox definitions.
 * TypeBox schemas ARE valid JSON Schema, so this script simply serializes them
 * to JSON files for use by other languages (Go) and tooling.
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
// Import schemas
import { PositionSchema, VelocitySchema, MessageSchema } from './schemas/common.js';
import { InputStateDataSchema, InputStateMessageSchema, PlayerShootDataSchema, PlayerShootMessageSchema, PlayerReloadMessageSchema, WeaponPickupAttemptDataSchema, WeaponPickupAttemptMessageSchema, PlayerMeleeAttackDataSchema, PlayerMeleeAttackMessageSchema, PlayerDodgeRollMessageSchema, } from './schemas/client-to-server.js';
import { RoomJoinedDataSchema, RoomJoinedMessageSchema, PlayerStateSchema, PlayerMoveDataSchema, PlayerMoveMessageSchema, ProjectileSpawnDataSchema, ProjectileSpawnMessageSchema, ProjectileDestroyDataSchema, ProjectileDestroyMessageSchema, WeaponStateDataSchema, WeaponStateMessageSchema, ShootFailedDataSchema, ShootFailedMessageSchema, PlayerDamagedDataSchema, PlayerDamagedMessageSchema, HitConfirmedDataSchema, HitConfirmedMessageSchema, PlayerDeathDataSchema, PlayerDeathMessageSchema, PlayerKillCreditDataSchema, PlayerKillCreditMessageSchema, PlayerRespawnDataSchema, PlayerRespawnMessageSchema, MatchTimerDataSchema, MatchTimerMessageSchema, MatchEndedDataSchema, MatchEndedMessageSchema, WeaponCrateSchema, WeaponSpawnedDataSchema, WeaponSpawnedMessageSchema, WeaponPickupConfirmedDataSchema, WeaponPickupConfirmedMessageSchema, WeaponRespawnedDataSchema, WeaponRespawnedMessageSchema, MeleeHitDataSchema, MeleeHitMessageSchema, RollStartDataSchema, RollStartMessageSchema, RollEndDataSchema, RollEndMessageSchema, } from './schemas/server-to-client.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const schemas = [
    {
        schema: PositionSchema,
        outputPath: 'schemas/common/position.json',
    },
    {
        schema: VelocitySchema,
        outputPath: 'schemas/common/velocity.json',
    },
    {
        schema: MessageSchema,
        outputPath: 'schemas/common/message.json',
    },
    // Client-to-server schemas
    {
        schema: InputStateDataSchema,
        outputPath: 'schemas/client-to-server/input-state-data.json',
    },
    {
        schema: InputStateMessageSchema,
        outputPath: 'schemas/client-to-server/input-state-message.json',
    },
    {
        schema: PlayerShootDataSchema,
        outputPath: 'schemas/client-to-server/player-shoot-data.json',
    },
    {
        schema: PlayerShootMessageSchema,
        outputPath: 'schemas/client-to-server/player-shoot-message.json',
    },
    {
        schema: PlayerReloadMessageSchema,
        outputPath: 'schemas/client-to-server/player-reload-message.json',
    },
    {
        schema: WeaponPickupAttemptDataSchema,
        outputPath: 'schemas/client-to-server/weapon-pickup-attempt-data.json',
    },
    {
        schema: WeaponPickupAttemptMessageSchema,
        outputPath: 'schemas/client-to-server/weapon-pickup-attempt-message.json',
    },
    {
        schema: PlayerMeleeAttackDataSchema,
        outputPath: 'schemas/client-to-server/player-melee-attack-data.json',
    },
    {
        schema: PlayerMeleeAttackMessageSchema,
        outputPath: 'schemas/client-to-server/player-melee-attack-message.json',
    },
    {
        schema: PlayerDodgeRollMessageSchema,
        outputPath: 'schemas/client-to-server/player-dodge-roll-message.json',
    },
    // Server-to-client schemas
    {
        schema: RoomJoinedDataSchema,
        outputPath: 'schemas/server-to-client/room-joined-data.json',
    },
    {
        schema: RoomJoinedMessageSchema,
        outputPath: 'schemas/server-to-client/room-joined-message.json',
    },
    {
        schema: PlayerStateSchema,
        outputPath: 'schemas/server-to-client/player-state.json',
    },
    {
        schema: PlayerMoveDataSchema,
        outputPath: 'schemas/server-to-client/player-move-data.json',
    },
    {
        schema: PlayerMoveMessageSchema,
        outputPath: 'schemas/server-to-client/player-move-message.json',
    },
    {
        schema: ProjectileSpawnDataSchema,
        outputPath: 'schemas/server-to-client/projectile-spawn-data.json',
    },
    {
        schema: ProjectileSpawnMessageSchema,
        outputPath: 'schemas/server-to-client/projectile-spawn-message.json',
    },
    {
        schema: ProjectileDestroyDataSchema,
        outputPath: 'schemas/server-to-client/projectile-destroy-data.json',
    },
    {
        schema: ProjectileDestroyMessageSchema,
        outputPath: 'schemas/server-to-client/projectile-destroy-message.json',
    },
    {
        schema: WeaponStateDataSchema,
        outputPath: 'schemas/server-to-client/weapon-state-data.json',
    },
    {
        schema: WeaponStateMessageSchema,
        outputPath: 'schemas/server-to-client/weapon-state-message.json',
    },
    {
        schema: ShootFailedDataSchema,
        outputPath: 'schemas/server-to-client/shoot-failed-data.json',
    },
    {
        schema: ShootFailedMessageSchema,
        outputPath: 'schemas/server-to-client/shoot-failed-message.json',
    },
    {
        schema: PlayerDamagedDataSchema,
        outputPath: 'schemas/server-to-client/player-damaged-data.json',
    },
    {
        schema: PlayerDamagedMessageSchema,
        outputPath: 'schemas/server-to-client/player-damaged-message.json',
    },
    {
        schema: HitConfirmedDataSchema,
        outputPath: 'schemas/server-to-client/hit-confirmed-data.json',
    },
    {
        schema: HitConfirmedMessageSchema,
        outputPath: 'schemas/server-to-client/hit-confirmed-message.json',
    },
    {
        schema: PlayerDeathDataSchema,
        outputPath: 'schemas/server-to-client/player-death-data.json',
    },
    {
        schema: PlayerDeathMessageSchema,
        outputPath: 'schemas/server-to-client/player-death-message.json',
    },
    {
        schema: PlayerKillCreditDataSchema,
        outputPath: 'schemas/server-to-client/player-kill-credit-data.json',
    },
    {
        schema: PlayerKillCreditMessageSchema,
        outputPath: 'schemas/server-to-client/player-kill-credit-message.json',
    },
    {
        schema: PlayerRespawnDataSchema,
        outputPath: 'schemas/server-to-client/player-respawn-data.json',
    },
    {
        schema: PlayerRespawnMessageSchema,
        outputPath: 'schemas/server-to-client/player-respawn-message.json',
    },
    {
        schema: MatchTimerDataSchema,
        outputPath: 'schemas/server-to-client/match-timer-data.json',
    },
    {
        schema: MatchTimerMessageSchema,
        outputPath: 'schemas/server-to-client/match-timer-message.json',
    },
    {
        schema: MatchEndedDataSchema,
        outputPath: 'schemas/server-to-client/match-ended-data.json',
    },
    {
        schema: MatchEndedMessageSchema,
        outputPath: 'schemas/server-to-client/match-ended-message.json',
    },
    {
        schema: WeaponCrateSchema,
        outputPath: 'schemas/server-to-client/weapon-crate.json',
    },
    {
        schema: WeaponSpawnedDataSchema,
        outputPath: 'schemas/server-to-client/weapon-spawned-data.json',
    },
    {
        schema: WeaponSpawnedMessageSchema,
        outputPath: 'schemas/server-to-client/weapon-spawned-message.json',
    },
    {
        schema: WeaponPickupConfirmedDataSchema,
        outputPath: 'schemas/server-to-client/weapon-pickup-confirmed-data.json',
    },
    {
        schema: WeaponPickupConfirmedMessageSchema,
        outputPath: 'schemas/server-to-client/weapon-pickup-confirmed-message.json',
    },
    {
        schema: WeaponRespawnedDataSchema,
        outputPath: 'schemas/server-to-client/weapon-respawned-data.json',
    },
    {
        schema: WeaponRespawnedMessageSchema,
        outputPath: 'schemas/server-to-client/weapon-respawned-message.json',
    },
    {
        schema: MeleeHitDataSchema,
        outputPath: 'schemas/server-to-client/melee-hit-data.json',
    },
    {
        schema: MeleeHitMessageSchema,
        outputPath: 'schemas/server-to-client/melee-hit-message.json',
    },
    {
        schema: RollStartDataSchema,
        outputPath: 'schemas/server-to-client/roll-start-data.json',
    },
    {
        schema: RollStartMessageSchema,
        outputPath: 'schemas/server-to-client/roll-start-message.json',
    },
    {
        schema: RollEndDataSchema,
        outputPath: 'schemas/server-to-client/roll-end-data.json',
    },
    {
        schema: RollEndMessageSchema,
        outputPath: 'schemas/server-to-client/roll-end-message.json',
    },
];
/**
 * Writes a schema to a JSON file
 */
function writeSchemaFile(schemaExport) {
    const fullPath = join(rootDir, schemaExport.outputPath);
    const dir = dirname(fullPath);
    // Ensure directory exists
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    // Write the schema as formatted JSON
    const jsonContent = JSON.stringify(schemaExport.schema, null, 2);
    writeFileSync(fullPath, jsonContent + '\n', 'utf8');
    console.log(`Generated: ${schemaExport.outputPath}`);
}
/**
 * Main build function
 */
export function buildSchemas() {
    console.log('Building JSON Schema files from TypeBox definitions...\n');
    for (const schemaExport of schemas) {
        writeSchemaFile(schemaExport);
    }
    console.log(`\nSuccessfully generated ${schemas.length} schema files.`);
}
// Run build when executed directly
buildSchemas();
//# sourceMappingURL=build-schemas.js.map