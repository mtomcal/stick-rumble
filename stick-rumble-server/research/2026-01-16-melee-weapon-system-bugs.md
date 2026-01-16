---
date: 2026-01-16T12:30:00-08:00
researcher: Claude Code
topic: "Melee Weapon System - Missing Visuals and Non-functional Attacks"
tags: [research, codebase, melee, weapons, bugs]
status: complete
---

# Research: Melee Weapon System - Missing Visuals and Non-functional Attacks

**Date**: 2026-01-16
**Researcher**: Claude Code

## Research Question
Investigate why katana and bat weapons are not appearing in animations, no swing animation occurs when clicking with a melee weapon, and no damage is dealt to other players.

## Summary

**ROOT CAUSE IDENTIFIED**: The server does NOT handle `player:melee_attack` messages. The message switch in `websocket_handler.go` has no case for `player:melee_attack`, so all melee attacks fall through to the default case and are simply broadcast without processing.

Additionally, there are **two separate issues**:

1. **Critical Server Bug**: `player:melee_attack` is not processed - no damage, no `melee:hit` broadcast
2. **Visual Issue**: Melee weapons only show swing arcs (brief 200ms animation), not persistent weapon sprites on players

## Detailed Findings

### Issue 1: Server Does Not Process Melee Attacks (CRITICAL)

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/network/websocket_handler.go`
**Lines 248-275**

The message switch statement handles:
- `input:state` ✓
- `player:shoot` ✓
- `player:reload` ✓
- `weapon:pickup_attempt` ✓
- `player:dodge_roll` ✓
- `player:melee_attack` ✗ **MISSING!**

```go
switch msg.Type {
case "input:state":
    h.handleInputState(playerID, msg.Data)
case "player:shoot":
    h.handlePlayerShoot(playerID, msg.Data)
case "player:reload":
    h.handlePlayerReload(playerID)
case "weapon:pickup_attempt":
    h.handleWeaponPickup(playerID, msg.Data)
case "player:dodge_roll":
    h.handlePlayerDodgeRoll(playerID)
default:
    // Broadcast other messages to room (for backward compatibility with tests)
    room := h.roomManager.GetRoomByPlayerID(playerID)
    if room != nil {
        room.Broadcast(messageBytes, playerID)
    }
}
```

**Impact**: When a player clicks with a melee weapon:
1. Client sends `player:melee_attack` message correctly
2. Server receives message but hits `default` case
3. Message is broadcast as-is (not processed)
4. `PerformMeleeAttack()` is **never called**
5. No damage is applied
6. No `melee:hit` event is broadcast
7. Client never receives `melee:hit` so no swing animation plays

### Issue 2: No Handler Function Exists

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/network/message_processor.go`

There is **no** `handlePlayerMeleeAttack()` function implemented. The file contains:
- `handleInputState()` ✓
- `handlePlayerShoot()` ✓
- `handlePlayerReload()` ✓
- `handleWeaponPickup()` ✓
- `handlePlayerDodgeRoll()` ✓
- `handlePlayerMeleeAttack()` ✗ **MISSING!**

### Issue 3: Melee Attack Logic Exists But Is Not Wired

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/game/melee_attack.go`

The `PerformMeleeAttack()` function is fully implemented with:
- Range checking (64px bat, 80px katana)
- Arc detection (90-degree cone)
- Damage application
- Knockback for bat (40px)
- Multi-target support (AoE)
- Comprehensive test coverage (449 lines of tests)

**But this function is never called because there's no message handler.**

### Issue 4: Client Swing Animation Only Shows on `melee:hit`

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`
**Lines 451-473**

The swing animation is only triggered when receiving `melee:hit` from the server:

```typescript
const meleeHitHandler = (data: unknown) => {
  const messageData = data as MeleeHitData;
  // ... get position and aim angle
  this.meleeWeaponManager.updatePosition(messageData.attackerId, attackerPos);
  this.meleeWeaponManager.startSwing(messageData.attackerId, aimAngle);
};
```

Since the server never broadcasts `melee:hit`, the client never shows the swing animation.

### Issue 5: No Persistent Weapon Visuals on Players

**Current Implementation**: Melee weapons only render as brief swing arc graphics (200ms duration).

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/entities/MeleeWeapon.ts`

The `MeleeWeapon` class renders:
- A semi-transparent arc (90 degrees)
- Only visible during swing (4 frames × 50ms = 200ms total)
- No persistent weapon sprite attached to player

**Historical Reference**: `/Users/mtomcal/Code/stick-rumble/docs/archive/20251125-055521-pre-bmm/game/objects/StickFigure.ts`

The archived code shows the previous implementation HAD weapon sprites:
- Bat: Silver rectangles (grip, body, end cap) - lines 128-131
- Katana: Handle, golden guard, white blade - lines 136-139
- Weapons attached to `weaponContainer` (rotatable with player aim)

This functionality was removed or not ported to the current implementation.

## Code References

- `stick-rumble-server/internal/network/websocket_handler.go:248-275` - Message switch missing melee case
- `stick-rumble-server/internal/network/message_processor.go` - No handlePlayerMeleeAttack function
- `stick-rumble-server/internal/game/melee_attack.go:15-56` - PerformMeleeAttack (implemented but unused)
- `stick-rumble-server/internal/game/melee_attack_test.go` - 449 lines of tests (all passing in isolation)
- `stick-rumble-client/src/game/input/ShootingManager.ts:230-251` - Client sends melee attack correctly
- `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts:451-473` - Swing animation handler (never triggered)
- `stick-rumble-client/src/game/entities/MeleeWeapon.ts` - Swing arc rendering only
- `stick-rumble-client/src/game/entities/PlayerManager.ts` - Players as simple rectangles (no weapon attachment)
- `events-schema/src/schemas/client-to-server.ts:80-96` - PlayerMeleeAttackData schema
- `events-schema/src/schemas/server-to-client.ts:475-498` - MeleeHitData schema

## Architecture Insights

1. **Incomplete Integration**: The melee system was designed and tested in isolation but never wired into the message processing pipeline.

2. **Client-Server Flow**: The expected flow is:
   ```
   Client click → player:melee_attack → Server processes → melee:hit broadcast → Client animates
   ```
   Currently broken at step 2 (server doesn't process).

3. **Weapon Visual Architecture**: The current player rendering is simplified (rectangles only). The archived code shows a more complex stick figure with weapon attachment points that was not carried forward.

## Required Fixes

### Fix 1: Add Server Message Handler (CRITICAL)

Create `handlePlayerMeleeAttack()` in `message_processor.go`:
```go
func (h *WebSocketHandler) handlePlayerMeleeAttack(playerID string, data any) {
    // 1. Validate schema
    // 2. Get player state and weapon
    // 3. Call PerformMeleeAttack()
    // 4. Broadcast melee:hit to all players if hits occurred
    // 5. Handle damage/death events
}
```

Add case to `websocket_handler.go` switch:
```go
case "player:melee_attack":
    h.handlePlayerMeleeAttack(playerID, msg.Data)
```

### Fix 2: Broadcast melee:hit Event

After `PerformMeleeAttack()` returns hit players, broadcast:
```go
meleeHitData := map[string]interface{}{
    "attackerId": playerID,
    "victims": victimIDs,
    "knockbackApplied": result.KnockbackApplied,
}
// Broadcast to room
```

### Fix 3 (Optional): Add Persistent Weapon Visuals

Port weapon sprite rendering from archived `StickFigure.ts` to current `PlayerManager.ts`:
- Add weapon container to player sprites
- Render bat/katana graphics
- Rotate with aim angle

## Open Questions

1. Why was the melee handler never added? Was this an oversight or intentional deferral?
2. Should weapon visuals be persistent or only shown during attacks?
3. Should the client show a "swing" animation immediately on click (client-side prediction) before server confirms?

## Sources

- [Phaser 3 Graphics Visibility](https://photonstorm.github.io/phaser3-docs/Phaser.GameObjects.Components.Visible.html)
- [Phaser Invisible Sprite Troubleshooting](https://phaser.discourse.group/t/invisible-player-sprite/1211)
