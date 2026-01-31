/**
 * CI check script to ensure generated JSON Schema files are up-to-date.
 * Compares in-memory schema generation with committed files.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
// Import schemas
import { PositionSchema, VelocitySchema, MessageSchema } from './schemas/common.js';
import { InputStateDataSchema, InputStateMessageSchema, PlayerShootDataSchema, PlayerShootMessageSchema, PlayerReloadMessageSchema, WeaponPickupAttemptDataSchema, WeaponPickupAttemptMessageSchema, } from './schemas/client-to-server.js';
import { RoomJoinedDataSchema, RoomJoinedMessageSchema, PlayerStateSchema, PlayerMoveDataSchema, PlayerMoveMessageSchema, ProjectileSpawnDataSchema, ProjectileSpawnMessageSchema, ProjectileDestroyDataSchema, ProjectileDestroyMessageSchema, WeaponStateDataSchema, WeaponStateMessageSchema, ShootFailedDataSchema, ShootFailedMessageSchema, PlayerDamagedDataSchema, PlayerDamagedMessageSchema, HitConfirmedDataSchema, HitConfirmedMessageSchema, PlayerDeathDataSchema, PlayerDeathMessageSchema, PlayerKillCreditDataSchema, PlayerKillCreditMessageSchema, PlayerRespawnDataSchema, PlayerRespawnMessageSchema, MatchTimerDataSchema, MatchTimerMessageSchema, MatchEndedDataSchema, MatchEndedMessageSchema, WeaponCrateSchema, WeaponSpawnedDataSchema, WeaponSpawnedMessageSchema, WeaponPickupConfirmedDataSchema, WeaponPickupConfirmedMessageSchema, WeaponRespawnedDataSchema, WeaponRespawnedMessageSchema, } from './schemas/server-to-client.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const schemas = [
    { schema: PositionSchema, outputPath: 'schemas/common/position.json' },
    { schema: VelocitySchema, outputPath: 'schemas/common/velocity.json' },
    { schema: MessageSchema, outputPath: 'schemas/common/message.json' },
    { schema: InputStateDataSchema, outputPath: 'schemas/client-to-server/input-state-data.json' },
    { schema: InputStateMessageSchema, outputPath: 'schemas/client-to-server/input-state-message.json' },
    { schema: PlayerShootDataSchema, outputPath: 'schemas/client-to-server/player-shoot-data.json' },
    { schema: PlayerShootMessageSchema, outputPath: 'schemas/client-to-server/player-shoot-message.json' },
    { schema: PlayerReloadMessageSchema, outputPath: 'schemas/client-to-server/player-reload-message.json' },
    { schema: WeaponPickupAttemptDataSchema, outputPath: 'schemas/client-to-server/weapon-pickup-attempt-data.json' },
    { schema: WeaponPickupAttemptMessageSchema, outputPath: 'schemas/client-to-server/weapon-pickup-attempt-message.json' },
    { schema: RoomJoinedDataSchema, outputPath: 'schemas/server-to-client/room-joined-data.json' },
    { schema: RoomJoinedMessageSchema, outputPath: 'schemas/server-to-client/room-joined-message.json' },
    { schema: PlayerStateSchema, outputPath: 'schemas/server-to-client/player-state.json' },
    { schema: PlayerMoveDataSchema, outputPath: 'schemas/server-to-client/player-move-data.json' },
    { schema: PlayerMoveMessageSchema, outputPath: 'schemas/server-to-client/player-move-message.json' },
    { schema: ProjectileSpawnDataSchema, outputPath: 'schemas/server-to-client/projectile-spawn-data.json' },
    { schema: ProjectileSpawnMessageSchema, outputPath: 'schemas/server-to-client/projectile-spawn-message.json' },
    { schema: ProjectileDestroyDataSchema, outputPath: 'schemas/server-to-client/projectile-destroy-data.json' },
    { schema: ProjectileDestroyMessageSchema, outputPath: 'schemas/server-to-client/projectile-destroy-message.json' },
    { schema: WeaponStateDataSchema, outputPath: 'schemas/server-to-client/weapon-state-data.json' },
    { schema: WeaponStateMessageSchema, outputPath: 'schemas/server-to-client/weapon-state-message.json' },
    { schema: ShootFailedDataSchema, outputPath: 'schemas/server-to-client/shoot-failed-data.json' },
    { schema: ShootFailedMessageSchema, outputPath: 'schemas/server-to-client/shoot-failed-message.json' },
    { schema: PlayerDamagedDataSchema, outputPath: 'schemas/server-to-client/player-damaged-data.json' },
    { schema: PlayerDamagedMessageSchema, outputPath: 'schemas/server-to-client/player-damaged-message.json' },
    { schema: HitConfirmedDataSchema, outputPath: 'schemas/server-to-client/hit-confirmed-data.json' },
    { schema: HitConfirmedMessageSchema, outputPath: 'schemas/server-to-client/hit-confirmed-message.json' },
    { schema: PlayerDeathDataSchema, outputPath: 'schemas/server-to-client/player-death-data.json' },
    { schema: PlayerDeathMessageSchema, outputPath: 'schemas/server-to-client/player-death-message.json' },
    { schema: PlayerKillCreditDataSchema, outputPath: 'schemas/server-to-client/player-kill-credit-data.json' },
    { schema: PlayerKillCreditMessageSchema, outputPath: 'schemas/server-to-client/player-kill-credit-message.json' },
    { schema: PlayerRespawnDataSchema, outputPath: 'schemas/server-to-client/player-respawn-data.json' },
    { schema: PlayerRespawnMessageSchema, outputPath: 'schemas/server-to-client/player-respawn-message.json' },
    { schema: MatchTimerDataSchema, outputPath: 'schemas/server-to-client/match-timer-data.json' },
    { schema: MatchTimerMessageSchema, outputPath: 'schemas/server-to-client/match-timer-message.json' },
    { schema: MatchEndedDataSchema, outputPath: 'schemas/server-to-client/match-ended-data.json' },
    { schema: MatchEndedMessageSchema, outputPath: 'schemas/server-to-client/match-ended-message.json' },
    { schema: WeaponCrateSchema, outputPath: 'schemas/server-to-client/weapon-crate.json' },
    { schema: WeaponSpawnedDataSchema, outputPath: 'schemas/server-to-client/weapon-spawned-data.json' },
    { schema: WeaponSpawnedMessageSchema, outputPath: 'schemas/server-to-client/weapon-spawned-message.json' },
    { schema: WeaponPickupConfirmedDataSchema, outputPath: 'schemas/server-to-client/weapon-pickup-confirmed-data.json' },
    { schema: WeaponPickupConfirmedMessageSchema, outputPath: 'schemas/server-to-client/weapon-pickup-confirmed-message.json' },
    { schema: WeaponRespawnedDataSchema, outputPath: 'schemas/server-to-client/weapon-respawned-data.json' },
    { schema: WeaponRespawnedMessageSchema, outputPath: 'schemas/server-to-client/weapon-respawned-message.json' },
];
/**
 * Check if a schema file matches its in-memory definition
 */
function checkSchemaUpToDate(schemaExport) {
    const fullPath = join(rootDir, schemaExport.outputPath);
    if (!existsSync(fullPath)) {
        console.error(`❌ Missing: ${schemaExport.outputPath}`);
        return false;
    }
    const expectedContent = JSON.stringify(schemaExport.schema, null, 2) + '\n';
    const actualContent = readFileSync(fullPath, 'utf8');
    if (expectedContent !== actualContent) {
        console.error(`❌ Stale: ${schemaExport.outputPath}`);
        return false;
    }
    console.log(`✓ ${schemaExport.outputPath}`);
    return true;
}
/**
 * Main check function
 */
export function checkSchemasUpToDate() {
    console.log('Checking if generated schemas are up-to-date...\n');
    let allUpToDate = true;
    for (const schemaExport of schemas) {
        if (!checkSchemaUpToDate(schemaExport)) {
            allUpToDate = false;
        }
    }
    if (!allUpToDate) {
        console.error('\n❌ Generated schemas are out of date.');
        console.error('Run: npm run build\n');
        return false;
    }
    console.log('\n✅ All schemas are up-to-date.');
    return true;
}
/**
 * CLI entry point
 */
export function runCheckCli() {
    const result = checkSchemasUpToDate();
    if (!result) {
        process.exit(1);
    }
}
// Run check when executed directly (but not when imported by tests)
/* c8 ignore start */
if (import.meta.url === `file://${process.argv[1]}`) {
    runCheckCli();
}
/* c8 ignore stop */
//# sourceMappingURL=check-schemas-up-to-date.js.map