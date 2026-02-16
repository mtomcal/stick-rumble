# Input System

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-16
> **Depends On**: [types-and-events.md](types-and-events.md), [overview.md](overview.md), [player.md](player.md)
> **Depended By**: [main-scene.md](main-scene.md), [combat.md](combat.md), [ui.md](ui.md)

---

## Overview

The input system supports two parallel control schemes: keyboard + mouse (desktop) and dual virtual joysticks (mobile/touch). Both feed into the same game loop via the EventBus or direct Phaser input polling. Desktop input is polled every frame inside `MainScene.update()`; mobile joystick events are forwarded through the React → Phaser EventBus bridge.

There is no input abstraction layer — desktop and mobile paths are checked sequentially, with mobile joystick data overriding keyboard movement when active, and joystick aiming taking priority over mouse aiming.

**Key design decisions:**
- Movement and aiming are intentionally decoupled (twin-stick style on mobile)
- The cursor is set to `crosshair` for desktop aiming visibility
- Right-click context menu is disabled to prevent interference
- An aim sway mechanic adds procedural inaccuracy that varies with movement speed
- Mobile joysticks are hidden on `md:` breakpoint and above via Tailwind CSS

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser 3 | 3.x (CDN) | Keyboard polling, mouse pointer, physics velocity |
| React | 19.x (CDN) | Joystick component rendering, touch event handling |
| Tailwind CSS | CDN | Responsive visibility (`md:hidden`) for joysticks |

### Spec Dependencies

- [types-and-events.md](types-and-events.md) — `EVENTS.INPUT_MOVE`, `EVENTS.INPUT_AIM`, `VirtualJoystickData`
- [overview.md](overview.md) — EventBus bridge architecture
- [player.md](player.md) — `StickFigure.aimSway`, `StickFigure.rotation`
- [main-scene.md](main-scene.md) — `handleMovement()`, `handleAiming()`, `handleAttacks()`

---

## Constants

| Constant | Value | Unit | Description | Source |
|----------|-------|------|-------------|--------|
| PLAYER_SPEED | 350 | px/s | Movement speed for all directions | `MainScene.handleMovement()` ~line 415 |
| JOYSTICK_MAX_RADIUS | 40 | px | Maximum drag distance for virtual joystick thumb | `Joystick.tsx` line 18 |
| JOYSTICK_FIRE_THRESHOLD | 0.3 | normalized | Aim stick deflection required to auto-fire | `MainScene.handleAttacks()` ~line 476 |
| RETICLE_JOYSTICK_DISTANCE | 250 | px | Distance from player to place reticle when using joystick aim | `MainScene.handleAiming()` ~line 449 |
| AIM_SWAY_SPEED_MOVING | 0.008 | 1/ms | Sine wave frequency multiplier while moving | `StickFigure.preUpdate()` ~line 268 |
| AIM_SWAY_SPEED_IDLE | 0.002 | 1/ms | Sine wave frequency multiplier while idle | `StickFigure.preUpdate()` ~line 268 |
| AIM_SWAY_MAGNITUDE_MOVING | 0.15 | rad (~8.6 deg) | Max sway offset while moving | `StickFigure.preUpdate()` ~line 269 |
| AIM_SWAY_MAGNITUDE_IDLE | 0.03 | rad (~1.7 deg) | Max sway offset while idle | `StickFigure.preUpdate()` ~line 269 |

---

## Data Structures

### VirtualJoystickData

Defined in `types.ts` but never imported by name — consumers use inline structural types.

```typescript
export interface VirtualJoystickData {
  x: number;   // -1 to 1 (normalized horizontal deflection)
  y: number;   // -1 to 1 (normalized vertical deflection)
  active: boolean; // true while finger/mouse is held down
}
```

### JoystickProps

Props for the React `Joystick` component (`components/Joystick.tsx` line 3):

```typescript
interface JoystickProps {
  onMove: (data: { x: number; y: number; active: boolean }) => void;
  color?: string;    // Tailwind color class (default: 'white')
  label?: string;    // Text label above the joystick
  side: 'left' | 'right';  // Positioning
  resetKey?: number; // Increment to force reset
}
```

### Internal Scene State

Stored on `MainScene` instance (`MainScene.ts` lines 61-62):

```typescript
private moveStick = { x: 0, y: 0 };
private aimStick = { x: 0, y: 0, active: false };
```

---

## Behavior

### Desktop: Keyboard Movement

**Source**: `MainScene.handleMovement()` (~line 414)

Movement uses WASD keys and arrow keys simultaneously. Both key sets are polled each frame. The resulting direction vector is normalized and scaled by the constant speed of 350 px/s. There is no acceleration or deceleration — velocity is set directly.

```
function handleMovement():
    velocityX = 0
    velocityY = 0

    // Keyboard polling (WASD + Arrow keys)
    if left.isDown:  velocityX = -1
    if right.isDown: velocityX = 1
    if up.isDown:    velocityY = -1
    if down.isDown:  velocityY = 1

    // Mobile joystick override (if stick is deflected)
    if moveStick.x != 0 or moveStick.y != 0:
        velocityX = moveStick.x  // Already normalized -1..1
        velocityY = moveStick.y

    vec = Vector2(velocityX, velocityY)
    if vec.length > 0:
        vec.normalize().scale(350)
        player.setVelocity(vec.x, vec.y)
    else:
        player.setVelocity(0, 0)
```

**Key details:**
- WASD and arrow keys produce integer -1/0/1 components
- Mobile joystick values are continuous floats in [-1, 1]
- Diagonal movement is normalized (no faster diagonal speed)
- Velocity is set directly — no acceleration/deceleration model
- The mobile joystick values **override** keyboard input when non-zero (not additive)

**Key bindings** (`MainScene.create()` ~line 115):

| Key | Action |
|-----|--------|
| W / Up Arrow | Move up (negative Y) |
| S / Down Arrow | Move down (positive Y) |
| A / Left Arrow | Move left (negative X) |
| D / Right Arrow | Move right (positive X) |
| R | Reload weapon |

### Desktop: Mouse Aiming

**Source**: `MainScene.handleAiming()` (~line 439)

Mouse aiming uses the `mousePointer` property specifically (not `activePointer`) to avoid conflicts with touch input. The screen-space pointer coordinates are converted to world coordinates via `camera.getWorldPoint()` because the camera follows the player.

```
function handleAiming():
    if aimStick.active and (aimStick.x != 0 or aimStick.y != 0):
        // Joystick aim takes priority (see below)
        ...
    else:
        // Desktop mouse aim
        pointer = input.mousePointer
        worldPoint = camera.getWorldPoint(pointer.x, pointer.y)
        aimAngle = atan2(worldPoint.y - player.y, worldPoint.x - player.x)
        player.setRotation(aimAngle)
        reticle.setPosition(worldPoint.x, worldPoint.y)
        reticle.setVisible(true)
```

**Key details:**
- Uses `this.input.mousePointer` (not `this.input.activePointer`) to avoid touch/mouse ambiguity
- Screen-to-world coordinate conversion is essential because the camera follows the player
- The reticle sprite tracks the world-space mouse position
- Cursor is set to `crosshair` via `this.input.setDefaultCursor('crosshair')` in `create()`
- Right-click context menu is disabled via `this.input.mouse.disableContextMenu()`

### Desktop: Mouse Firing

**Source**: `MainScene.handleAttacks()` (~line 474)

Mouse firing is triggered by left-click (held or pressed). Firing is suppressed while the aim joystick is active to prevent desktop mouse events from interfering with touch controls.

```
function handleAttacks(time):
    isMobileFiring = aimStick.active and (|aimStick.x| > 0.3 or |aimStick.y| > 0.3)
    isMouseFiring = not aimStick.active and (mousePointer.primaryDown or mousePointer.isDown)

    if isMobileFiring or isMouseFiring:
        executeAttack(player, bullets, isPlayer=true)
```

**Key details:**
- `primaryDown` and `isDown` are both checked for robust left-click detection
- Mouse firing is gated on `!aimStick.active` to prevent dual input conflicts
- Firing is continuous while held — fire rate is enforced by cooldown in `executeAttack()`

### Desktop: Reload Key

**Source**: `MainScene.handleReloadInput()` (~line 342)

The R key triggers a reload for ranged weapons only. It checks that the player is not already reloading and has less than full ammo.

```
function handleReloadInput():
    if reloadKey.isDown and not player.isReloading and player.currentAmmo < player.maxAmmo:
        stats = WEAPON_STATS[player.weaponType]
        if not stats.isMelee:
            reloadWeapon(player)
```

### Mobile: Virtual Joystick Component

**Source**: `components/Joystick.tsx`

The `Joystick` is a React component that handles both touch and mouse input. Two instances are rendered: left (movement) and right (aim/fire).

#### Touch Tracking

Each joystick tracks a specific `touchIdentifier` to handle multi-touch correctly. The origin is set at the point where the finger first touches down.

```
on touchStart:
    origin = (clientX, clientY)
    touchId = touch.identifier
    active = true
    emit { x: 0, y: 0, active: true }

on touchMove:
    // Failsafe: verify tracked touch still exists in e.touches
    if touchId not in e.touches:
        force handleEnd()  // Fix for "sticky" joystick bug
        return

    for changedTouch matching touchId:
        dx = clientX - origin.x
        dy = clientY - origin.y
        distance = sqrt(dx*dx + dy*dy)
        clampedDist = min(distance, maxRadius=40)
        angle = atan2(dy, dx)
        clampedX = cos(angle) * clampedDist
        clampedY = sin(angle) * clampedDist
        emit { x: clampedX/40, y: clampedY/40, active: true }

on touchEnd:
    if e.touches.length == 0:
        handleEnd()  // All fingers lifted — kill all inputs
    else:
        if released touch matches touchId:
            handleEnd()

handleEnd():
    active = false
    touchId = null
    emit { x: 0, y: 0, active: false }
```

#### Mouse Fallback

When a joystick interaction is started with a mouse click (not touch), `touchIdRef` is set to `null`. Mouse events are only processed when `touchIdRef === null`, preventing mouse events from interfering with active touch interactions.

#### Safety Mechanisms

| Mechanism | Purpose | Source |
|-----------|---------|--------|
| Touch ID tracking | Distinguish multiple fingers | `touchIdRef` |
| Global `touchmove` listener | Track finger movement outside joystick element | `window.addEventListener` |
| Sticky touch failsafe | Force-end if tracked touch disappears from `e.touches` | `onTouchMove` lines 86-100 |
| All-fingers-lifted check | End if `e.touches.length === 0` | `onTouchEnd` line 114 |
| Window blur handler | Reset joystick on alt-tab/focus loss | `onBlur` line 142 |
| `resetKey` prop | Parent can force-reset by incrementing counter | `useEffect` on `resetKey` |
| `touchcancel` listener | Handle browser touch interruptions | Line 148 |

#### Joystick Output Normalization

The raw pixel displacement is clamped to `maxRadius` (40px) and then normalized to [-1, 1]:

```
normalizedX = clampedX / maxRadius  // -1.0 to 1.0
normalizedY = clampedY / maxRadius  // -1.0 to 1.0
```

#### Visual Rendering

The joystick consists of two nested divs:
- **Base**: 96x96px (`w-24 h-24`) circle with semi-transparent black background and colored border
- **Thumb**: 40x40px (`w-10 h-10`) colored circle that translates with the drag position
- **Container**: 128x128px (`w-32 h-32`) absolute-positioned area at bottom-left or bottom-right

The thumb returns to center with a 100ms ease-out transition on release. During active drag, the transition is disabled for instant response.

### Mobile: Joystick Aim and Auto-Fire

**Source**: `MainScene.handleAiming()` (~line 443) and `MainScene.handleAttacks()` (~line 476)

When the aim joystick is active, it overrides mouse aiming. The joystick angle is used directly. A deflection threshold of 0.3 (30%) on either axis triggers continuous auto-fire.

```
function handleAiming():
    if aimStick.active and (aimStick.x != 0 or aimStick.y != 0):
        aimAngle = atan2(aimStick.y, aimStick.x)
        player.setRotation(aimAngle)
        reticle.setPosition(
            player.x + cos(aimAngle) * 250,
            player.y + sin(aimAngle) * 250
        )
        reticle.setVisible(true)
    else:
        // Mouse aim (see above)
```

The reticle is placed at a fixed 250px distance from the player when using joystick aim, rather than at the actual pointer position.

### EventBus Input Bridge

**Source**: `App.tsx` lines 93-99, `MainScene.setupEvents()` ~line 166

The React layer emits joystick data through the EventBus; the Phaser scene listens:

```
React (App.tsx):
    Joystick(left)  → onMove → EventBus.emit('input-move', {x, y, active})
    Joystick(right) → onAim  → EventBus.emit('input-aim',  {x, y, active})

Phaser (MainScene.ts):
    EventBus.on('input-move') → this.moveStick = data
    EventBus.on('input-aim')  → this.aimStick = data
```

Event listeners are cleaned up on scene `shutdown` event to prevent stale references.

### Aim Sway

**Source**: `StickFigure.preUpdate()` (~line 264)

A procedural aim sway is applied to all entities (player and AI bots). It uses composite sine waves for less predictable motion. The sway magnitude increases 5x when the entity is moving.

```
function preUpdate(time, delta):
    swayTime += delta
    isMoving = body.speed > 10

    swaySpeed = isMoving ? 0.008 : 0.002
    swayMagnitude = isMoving ? 0.15 : 0.03

    // Composite sine wave
    aimSway = (sin(swayTime * swaySpeed) + sin(swayTime * swaySpeed * 0.7)) * swayMagnitude
```

The `aimSway` value (in radians) affects:
1. **Barrel position**: Added to rotation in `getBarrelPosition()` — bullets spawn from the visually-swayed barrel tip
2. **Weapon visual**: The weapon container rotates by `rotation + aimSway` (line 289)
3. **Bullet direction**: Final angle = `rotation + aimSway + spread` (line 604 of MainScene)

**Note**: Aim sway applies equally to the player and AI bots. It is a visual and mechanical effect, not just cosmetic. Standing still reduces sway from ~8.6 degrees to ~1.7 degrees.

### Input Priority

When both desktop and mobile inputs are present simultaneously:

| Input Type | Priority | Notes |
|------------|----------|-------|
| Aim joystick (active) | Highest | Overrides mouse aim, enables auto-fire |
| Mouse aim | Fallback | Used when aim joystick inactive |
| Move joystick (non-zero) | Overrides keyboard | Replaces WASD direction entirely |
| WASD / Arrow keys | Lowest movement | Used when move joystick is at origin |

### Joystick Visibility

The joystick container has the CSS class `md:hidden block`, meaning:
- **Visible** on screens below Tailwind's `md` breakpoint (768px)
- **Hidden** on screens 768px and wider

However, the EventBus listeners are always registered, so if a desktop user resizes the window below 768px, joysticks become functional.

---

## Error Handling

### Touch Disappearance ("Sticky Joystick")

**Trigger**: Browser misses a `touchend` event (common on mobile)
**Detection**: On `touchmove`, check if tracked `touchId` exists in `e.touches`
**Response**: Force `handleEnd()` to reset joystick state
**Source**: `Joystick.tsx` lines 86-100

### Window Blur

**Trigger**: User alt-tabs, switches apps, or browser loses focus
**Detection**: `window.blur` event listener
**Response**: Force `handleEnd()` to reset joystick
**Source**: `Joystick.tsx` line 142

### Keyboard Unavailable

**Trigger**: `this.input.keyboard` is null (possible in some browser contexts)
**Detection**: Null check before key binding setup
**Response**: Keyboard bindings silently skipped; joysticks still work
**Source**: `MainScene.create()` line 115

### Game Over / Death

**Trigger**: Player dies
**Detection**: `!this.player || this.player.isDead` check at start of `update()`
**Response**: All input handling is skipped; movement stops
**Source**: `MainScene.update()` line 186

---

## Implementation Notes

### Client-Only Architecture

This is a single-player prototype — all input is processed locally with no server. There is no input rate limiting, no server-side validation, and no network input state messages. The full input → movement → attack pipeline runs every frame.

### No Input Buffering

Keyboard state is polled every frame. There is no input queue or buffer. If a key press is shorter than one frame (~16.7ms at 60fps), it may be missed. This is standard Phaser behavior.

### Cursor Style

The cursor is set to `crosshair` in `create()` and restored to `default` on scene `shutdown`. This provides visual feedback that the mouse controls aiming.

### Touch Event Configuration

- Global `touchmove` uses `{ passive: false }` to allow `preventDefault()` if needed
- `touchcancel` is handled identically to `touchend`
- The joystick container has `touch-none` and `select-none` CSS classes to prevent browser default touch behaviors

### Joystick Reset on Game State Change

When the game starts or restarts, `App.tsx` increments `resetJoysticks` state, which propagates as `resetKey` to both joystick components. This triggers `handleEnd()` to clear any stuck joystick state.

---

## Test Scenarios

### TS-INPUT-001: WASD Movement

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- Game is running, player is alive

**Input:**
- Press W key

**Expected Output:**
- Player velocity set to (0, -350)

### TS-INPUT-002: Diagonal Normalization

**Category**: Unit
**Priority**: High

**Preconditions:**
- Game is running

**Input:**
- Press W + D simultaneously

**Expected Output:**
- Velocity vector has magnitude 350, direction is normalized (not 350*sqrt(2))

### TS-INPUT-003: Arrow Key Equivalence

**Category**: Unit
**Priority**: Medium

**Input:**
- Press Left Arrow

**Expected Output:**
- Same movement as pressing A key

### TS-INPUT-004: Mobile Joystick Movement Override

**Category**: Integration
**Priority**: High

**Input:**
- WASD key held + joystick deflected to (0.5, -0.5)

**Expected Output:**
- Movement direction follows joystick (0.5, -0.5), not keyboard

### TS-INPUT-005: Mouse Aim World Coordinate Conversion

**Category**: Unit
**Priority**: Critical

**Input:**
- Mouse at screen position (400, 300), camera scrolled to follow player at world (1000, 1000)

**Expected Output:**
- Aim angle calculated from player position to world-space mouse position, not screen-space

### TS-INPUT-006: Joystick Aim Priority Over Mouse

**Category**: Integration
**Priority**: High

**Input:**
- Aim joystick deflected to (1, 0), mouse positioned above player

**Expected Output:**
- Player aims right (angle 0), following joystick, not mouse

### TS-INPUT-007: Joystick Auto-Fire Threshold

**Category**: Unit
**Priority**: High

**Input:**
- Aim joystick deflected to (0.2, 0.1)

**Expected Output:**
- Player does NOT fire (below 0.3 threshold on both axes)

### TS-INPUT-008: Joystick Auto-Fire Active

**Category**: Unit
**Priority**: High

**Input:**
- Aim joystick deflected to (0.5, 0.0)

**Expected Output:**
- Player fires continuously (x > 0.3 threshold)

### TS-INPUT-009: Mouse Fire Blocked During Joystick Aim

**Category**: Integration
**Priority**: Medium

**Input:**
- Aim joystick active (even at 0,0), mouse left button held

**Expected Output:**
- Player does NOT fire via mouse (aimStick.active is true)

### TS-INPUT-010: Aim Sway While Moving

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Player moving at speed > 10

**Expected Output:**
- `aimSway` oscillates with magnitude up to ~0.15 rad (~8.6 degrees)

### TS-INPUT-011: Aim Sway While Idle

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- Player stationary (speed < 10)

**Expected Output:**
- `aimSway` oscillates with magnitude up to ~0.03 rad (~1.7 degrees)

### TS-INPUT-012: Joystick Normalization

**Category**: Unit
**Priority**: High

**Input:**
- Drag joystick 100px from origin (beyond maxRadius of 40)

**Expected Output:**
- Output clamped to magnitude 1.0 (values in [-1, 1])

### TS-INPUT-013: Sticky Touch Recovery

**Category**: Integration
**Priority**: Medium

**Input:**
- Touch starts on joystick, browser loses the touchend event

**Expected Output:**
- On next touchmove, joystick detects missing touch and resets to inactive

### TS-INPUT-014: Window Blur Reset

**Category**: Integration
**Priority**: Low

**Input:**
- Joystick is active, user alt-tabs

**Expected Output:**
- Joystick resets to (0, 0, active=false)

### TS-INPUT-015: Reload Key

**Category**: Unit
**Priority**: High

**Input:**
- Press R key with ranged weapon equipped and ammo < maxAmmo

**Expected Output:**
- Reload process starts (`isReloading = true`)

### TS-INPUT-016: Reload Key Ignored for Melee

**Category**: Unit
**Priority**: Medium

**Input:**
- Press R key with BAT equipped

**Expected Output:**
- No reload action

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-16 | Initial specification |
