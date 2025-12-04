---
date: 2025-12-04T09:05:00-08:00
researcher: Claude Code
topic: "Why the aimer doesn't follow mouse position"
tags: [research, codebase, input, phaser, camera, pointer-coordinates]
status: complete
---

# Research: Why the Aimer Doesn't Follow Mouse Position

**Date**: December 4, 2025 9:05 AM PST
**Researcher**: Claude Code (Senior Engineer)

## Research Question
Why doesn't the aim indicator follow the mouse cursor position correctly in the Stick Rumble game?

## Summary
The aimer fails to follow the mouse position due to a **coordinate space mismatch**. The current implementation uses `pointer.worldX` and `pointer.worldY` in `InputManager.ts:102-103`, which Phaser automatically converts from screen space to world space. However, this conversion does **not account for the game's scale mode** (`Phaser.Scale.FIT` with autoCenter) configured in `GameConfig.ts:18-21`.

**Root Cause**: When using `Phaser.Scale.FIT` mode, the game canvas is scaled and centered to fit the browser window while maintaining aspect ratio. The `pointer.worldX/worldY` values account for camera position but NOT for the scale transformation applied by the FIT mode, resulting in incorrect aim calculations.

**Solution**: Use `this.cameras.main.getWorldPoint(pointer.x, pointer.y)` to properly convert screen coordinates to world coordinates, accounting for both camera position AND scale transformations.

## Detailed Findings

### 1. Current Implementation (Broken)

**File**: `stick-rumble-client/src/game/input/InputManager.ts:96-116`

```typescript
private updateAimAngle(): void {
  if (!this.scene.input || !this.scene.input.activePointer) {
    return;
  }

  const pointer = this.scene.input.activePointer;
  const mouseX = pointer.worldX;  // ❌ PROBLEM: Doesn't account for scale mode
  const mouseY = pointer.worldY;  // ❌ PROBLEM: Doesn't account for scale mode

  // Calculate delta from player position
  const dx = mouseX - this.playerX;
  const dy = mouseY - this.playerY;

  // Calculate angle using atan2
  this.aimAngle = Math.atan2(dy, dx);
}
```

**Why it fails**:
- `pointer.worldX/worldY` only adjusts for camera scroll, not scale transformations
- The game uses `Phaser.Scale.FIT` mode (1280x720 canvas fitting into browser window)
- Arena size is 1920x1080, creating additional coordinate space complexity
- Camera is bounded to arena dimensions (`GameScene.ts:22`)

### 2. Game Configuration

**File**: `stick-rumble-client/src/game/config/GameConfig.ts:4-22`

```typescript
export const GameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1280,        // Canvas size (not arena size)
  height: 720,
  scale: {
    mode: Phaser.Scale.FIT,           // ⚠️ Scales canvas to fit window
    autoCenter: Phaser.Scale.CENTER_BOTH,  // ⚠️ Centers scaled canvas
  },
};
```

**File**: `stick-rumble-client/src/shared/constants.ts:23-29`

```typescript
export const ARENA = {
  WIDTH: 1920,   // Arena is LARGER than canvas
  HEIGHT: 1080,
} as const;
```

**Coordinate spaces involved**:
1. **Screen space**: Browser pixel coordinates (varies with window size)
2. **Canvas space**: Scaled/centered canvas (1280x720 base size)
3. **World space**: Game arena coordinates (1920x1080)
4. **Camera space**: Visible portion of world (camera can scroll)

### 3. Previous Working Implementation

**File**: `docs/archive/20251125-055521-pre-bmm/game/scenes/MainScene.ts:458-465`

The archived code shows the correct approach was previously used:

```typescript
// CRITICAL FIX: Use mousePointer specifically for desktop to avoid ambiguity
// pointer.x/y returns SCREEN coordinates (e.g. 0-windowWidth).
// Since the camera moves, we must convert this to World coordinates to aim correctly.
const pointer = this.input.mousePointer;
const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);  // ✅ CORRECT

aimAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
```

**Key insight**: The comment explicitly warns about the need to convert screen coordinates to world coordinates when the camera moves.

### 4. Phaser API Documentation

According to Phaser 3 documentation and known issues:
- `pointer.x, pointer.y` - Raw screen coordinates relative to canvas top-left
- `pointer.worldX, pointer.worldY` - Screen coordinates offset by camera scroll **only**
- `camera.getWorldPoint(x, y)` - Properly transforms through camera matrix (scroll + zoom + rotation + **scale**)

**Known Issues** (from web research):
- "Pointerdown event returns weird pointer coordinates when on Phaser.Scale.FIT scale mode" ([Phaser Forums](https://phaser.discourse.group/t/pointerdown-event-returns-weird-pointer-coordinates-when-on-phaser-scale-fit-scale-mode/1953))
- "this.input.activePointer.worldY or X doesn't get updated when camera is moving" ([GitHub Issue #4216](https://github.com/photonstorm/phaser/issues/4216))
- "Pointer worldX, worldY not updating correctly" ([GitHub Issue #4658](https://github.com/phaserjs/phaser/issues/4658))

## Code References

**Current Implementation**:
- `stick-rumble-client/src/game/input/InputManager.ts:102-103` - Uses `pointer.worldX/worldY` (broken)
- `stick-rumble-client/src/game/config/GameConfig.ts:18-21` - Defines `Phaser.Scale.FIT` mode
- `stick-rumble-client/src/game/scenes/GameScene.ts:22` - Sets camera bounds to arena size

**Working Reference**:
- `docs/archive/20251125-055521-pre-bmm/game/scenes/MainScene.ts:462` - Uses `getWorldPoint()` correctly

**Related Components**:
- `stick-rumble-client/src/game/entities/PlayerManager.ts:140-150` - Renders aim indicator using aimAngle
- `stick-rumble-client/src/game/scenes/GameScene.ts:52-62` - Updates InputManager with player position

## Architecture Insights

### Coordinate Transformation Pipeline

```
Browser Mouse Position
    ↓
[Canvas Scale/Center Transform] ← Phaser.Scale.FIT
    ↓
Canvas Screen Coordinates (pointer.x, pointer.y)
    ↓
[Camera Transform] ← getWorldPoint() accounts for this
    ↓
World Coordinates (correct position in 1920x1080 arena)
```

**Current bug**: Code skips the camera transform step by using `worldX/worldY` which only accounts for camera scroll, not the scale mode transformation.

### Why worldX/worldY Fails

`pointer.worldX` is calculated as:
```
worldX = pointer.x + camera.scrollX
```

This ignores:
- Canvas scaling from FIT mode
- Canvas centering from autoCenter
- Camera zoom (if used)
- Camera rotation (if used)

`camera.getWorldPoint()` properly applies the full transformation matrix.

### Testing Evidence

The test file `InputManager.test.ts:33-34` mocks `worldX` and `worldY` directly, which means tests pass but don't catch this real-world issue. Tests should mock screen coordinates and verify the `getWorldPoint()` transformation.

## Recommended Fix

Replace `InputManager.ts:96-116` with:

```typescript
private updateAimAngle(): void {
  if (!this.scene.input || !this.scene.input.activePointer) {
    return;
  }

  const pointer = this.scene.input.activePointer;

  // Convert screen coordinates to world coordinates accounting for scale mode
  const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

  const dx = worldPoint.x - this.playerX;
  const dy = worldPoint.y - this.playerY;

  if (dx === 0 && dy === 0) {
    return;
  }

  this.aimAngle = Math.atan2(dy, dx);
}
```

**Benefits**:
1. Correctly handles `Phaser.Scale.FIT` mode transformations
2. Works with any camera zoom/rotation/scroll
3. Matches the proven pattern from archived code
4. Aligns with Phaser best practices

## Open Questions

1. **Should we use `mousePointer` instead of `activePointer`?**
   - The archived code uses `this.input.mousePointer` explicitly
   - Comment warns about "ambiguity with activePointer"
   - `activePointer` can switch between mouse and touch
   - For desktop-only mouse aim, `mousePointer` may be more reliable

2. **Do we need touch/mobile support for aiming?**
   - Current code uses `activePointer` which works for both
   - If mobile is planned, may need separate touch handling
   - Archived code had joystick-based aiming for mobile

3. **Should camera follow the player?**
   - Camera is bounded but not following player
   - Archived code had `this.cameras.main.startFollow(this.player)`
   - Current implementation may need camera follow for better gameplay

4. **Are the tests sufficient?**
   - Current tests mock `worldX/worldY` directly
   - Should test the actual coordinate transformation
   - Need integration test with real Phaser scene + scale mode

## Sources

- [Phaser 3 API Documentation - worldX](https://newdocs.phaser.io/docs/3.60.0/focus/Phaser.Input.Pointer-worldX)
- [Pointerdown event returns weird pointer coordinates when on Phaser.Scale.FIT scale mode - Phaser Forums](https://phaser.discourse.group/t/pointerdown-event-returns-weird-pointer-coordinates-when-on-phaser-scale-fit-scale-mode/1953)
- [this.input.activePointer.worldY or X doesn't get updated when camera is moving - GitHub Issue #4216](https://github.com/photonstorm/phaser/issues/4216)
- [Pointer worldX, worldY not updating correctly - GitHub Issue #4658](https://github.com/phaserjs/phaser/issues/4658)
