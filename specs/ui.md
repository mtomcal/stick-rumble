# UI System

> **Spec Version**: 1.4.0
> **Last Updated**: 2026-02-17
> **Depends On**: [constants.md](constants.md), [player.md](player.md), [weapons.md](weapons.md), [match.md](match.md), [client-architecture.md](client-architecture.md), [graphics.md](graphics.md)
> **Depended By**: [test-index.md](test-index.md)

---

## Overview

The UI system provides all heads-up display (HUD) elements, feedback indicators, and overlays that communicate game state to the player. The system is divided between Phaser-rendered in-game UI (health bars, ammo, timers) and React-rendered modal overlays (match end screen).

**Why this architecture?** Phaser handles real-time, frame-synced UI that must update at 60 FPS (crosshair, cooldowns). React handles static modals where responsiveness matters less but accessibility and standard UI patterns matter more (forms, buttons, text input).

All in-game UI elements are screen-fixed (scroll factor 0) and render at depth 1000+ to always appear above game entities.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| Phaser | 3.90.0 | In-game HUD rendering |
| React | 19.2.0 | Modal overlays (match end) |
| TypeScript | 5.9.3 | Type-safe UI components |

### Spec Dependencies

- [constants.md](constants.md) - Arena dimensions, health values
- [player.md](player.md) - Health, kills, deaths, XP tracking
- [weapons.md](weapons.md) - Weapon names, ammo counts, spread values
- [match.md](match.md) - Timer, win conditions, final scores
- [client-architecture.md](client-architecture.md) - Manager pattern, event handlers
- [graphics.md](graphics.md) - Color conventions, depth layering

---

## Constants

All UI constants are defined here and referenced in [constants.md](constants.md#ui-constants).

| Constant | Value | Unit | Description |
|----------|-------|------|-------------|
| UI_DEPTH_BASE | 1000 | - | Base depth for UI elements (above all game entities) |
| KILL_FEED_MAX_ENTRIES | 5 | count | Maximum visible kills in feed |
| KILL_FEED_FADE_DELAY | 5000 | ms | Time before kill entry fades |
| KILL_FEED_FADE_DURATION | 1000 | ms | Duration of fade animation |
| KILL_FEED_SPACING | 25 | px | Vertical spacing between entries |
| HUD_HEALTH_BAR_WIDTH | 200 | px | HUD health bar width (distinct from PLAYER_HEALTH_BAR_WIDTH=32 in constants.md for world-space bar) |
| HUD_HEALTH_BAR_HEIGHT | 30 | px | HUD health bar height |
| DODGE_ROLL_UI_RADIUS | 20 | px | Cooldown indicator radius |
| CAMERA_FLASH_DURATION | 100 | ms | Camera flash on damage received |
| CAMERA_FLASH_COLOR | RGB(128,0,0) | color | Dark red camera flash |
| HIT_FEEDBACK_SHAKE_DURATION | 50 | ms | Camera shake on server-confirmed hit |
| HIT_FEEDBACK_SHAKE_INTENSITY | 0.001 | ratio | Hit feedback shake magnitude |
| RECOIL_SHAKE_DURATION | 100 | ms | Camera shake on firing (client-side) |
| RECOIL_SHAKE_UZI | 0.005 | ratio | Uzi recoil shake intensity |
| RECOIL_SHAKE_AK47 | 0.007 | ratio | AK47 recoil shake intensity |
| RECOIL_SHAKE_SHOTGUN | 0.012 | ratio | Shotgun recoil shake intensity |
| MELEE_HIT_SHAKE_DURATION | 150 | ms | Bat melee hit shake duration |
| MELEE_HIT_SHAKE_INTENSITY | 0.008 | ratio | Bat melee hit shake magnitude |
| HIT_MARKER_TEXTURE_SIZE | 20 | px | Hit marker X texture dimensions |
| HIT_MARKER_NORMAL_SCALE | 1.2 | ratio | Normal hit marker scale |
| HIT_MARKER_KILL_SCALE | 2.0 | ratio | Kill hit marker scale (red) |
| HIT_MARKER_FADE | 150 | ms | Hit marker fade duration |
| DAMAGE_NUMBER_FLOAT_DISTANCE | 50 | px | Float-up distance |
| DAMAGE_NUMBER_DURATION | 800 | ms | Animation duration |
| MATCH_END_COUNTDOWN | 10 | s | Auto-restart countdown |

---

## Data Structures

### MatchEndData

Sent by server on `match:ended`, consumed by React modal.

**TypeScript:**
```typescript
interface PlayerScore {
  playerId: string;
  kills: number;
  deaths: number;
  xp: number;
}

interface MatchEndData {
  winners: string[];      // Array of winner player IDs (can be multiple on tie)
  finalScores: PlayerScore[];
  reason: 'kill_target' | 'time_limit';
}
```

**Why this structure?** `winners` is an array to handle ties. `finalScores` includes all players (even 0-kill) for complete leaderboard.

### UIElementPosition

Standard positioning for fixed UI elements.

```typescript
interface UIElementPosition {
  x: number;
  y: number;
  origin?: { x: number; y: number };
  scrollFactor?: { x: number; y: number };
  depth: number;
}
```

---

## HUD Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Minimap]  [EKG] [====Health Bar====] 100%      [000000]    │
│ FPS: N     [Ammo Icon] 20/20                     KILLS: 0   │
│ Update: Nms                                                  │
│ AI: Nms                            [Timer]      [Kill Feed]  │
│ E: N | B: N                        MM:SS           Entry 1   │
│                                                    Entry 2   │
│                                                    Entry 3   │
│                      [Crosshair]                   Entry 4   │
│                         + bloom                    Entry 5   │
│                      [Reload Circle]                         │
│                      [RELOAD! text]                          │
│                                                              │
│                  [Pickup Prompt]              [Dodge Roll]   │
│              Press E to pick up {WEAPON}          ○          │
│                                                              │
│ [Chat Log Panel (bottom-left)]                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Behavior

### Health Bar UI (Top Left)

**Position**: (10, 70)

**Why this location?** Top-left follows FPS conventions where primary player stats live. Below title/status text.

**Visual Specification:**
- Dimensions: 200×30 px
- Icon: Heartbeat/EKG icon to the left of the bar (COLORS.HEALTH_FULL)
- Background (depleted portion): Dark gray (#333333 / COLORS.HEALTH_DEPLETED_BG), 0.7 alpha
- Foreground: Dynamic color based on health percentage
- Text: "N%" format to the right of the bar, white (#ffffff), 18px bold (e.g., "100%", "76%")
- Depth: 1000

**Color Thresholds (2-tier):**
| Health % | Color | Hex | Why |
|----------|-------|-----|-----|
| >= 20% | Green | #00CC00 (COLORS.HEALTH_FULL) | Safe / normal |
| < 20% | Red | #FF0000 (COLORS.HEALTH_CRITICAL) | Critical, immediate danger |

**Regeneration Indicator:**
When `isRegenerating` is true:
- Pulsing animation: alpha oscillates 0.6 → 1.0 → 0.6
- Duration: 500ms per cycle
- Loops infinitely until regeneration stops

**Pseudocode:**
```
function updateHealth(current, max, isRegenerating):
    ratio = current / max
    width = ratio * 200px

    if ratio >= 0.2:
        color = COLORS.HEALTH_FULL    // Green
    else:
        color = COLORS.HEALTH_CRITICAL // Red

    drawDepletedBackground(COLORS.HEALTH_DEPLETED_BG)
    drawBar(width, color)
    drawEKGIcon(left of bar)
    setText("{round(ratio * 100)}%")   // e.g., "76%"

    if isRegenerating AND NOT pulsingActive:
        startPulseAnimation()
    else if NOT isRegenerating AND pulsingActive:
        stopPulseAnimation()
```

**TypeScript:**
```typescript
export class HealthBarUI {
  private bar: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private ekgIcon: Phaser.GameObjects.Graphics;
  private pulseTween?: Phaser.Tweens.Tween;

  updateHealth(current: number, max: number, isRegenerating: boolean): void {
    const ratio = current / max;
    const color = ratio >= 0.2 ? 0x00CC00 : 0xFF0000; // COLORS.HEALTH_FULL / COLORS.HEALTH_CRITICAL

    this.bar.clear();
    // Depleted background
    this.bar.fillStyle(0x333333, 0.7); // COLORS.HEALTH_DEPLETED_BG
    this.bar.fillRect(0, 0, 200, 30);
    // Filled portion
    this.bar.fillStyle(color);
    this.bar.fillRect(2, 2, (ratio * 196), 26);

    this.text.setText(`${Math.round(ratio * 100)}%`);

    if (isRegenerating && !this.pulseTween) {
      this.pulseTween = this.scene.tweens.add({
        targets: this.bar,
        alpha: { from: 0.6, to: 1.0 },
        duration: 500,
        yoyo: true,
        repeat: -1
      });
    } else if (!isRegenerating && this.pulseTween) {
      this.pulseTween.destroy();
      this.pulseTween = undefined;
      this.bar.setAlpha(1);
    }
  }
}
```

---

### Kill Feed (Top Right)

**Position**: (ARENA.WIDTH - 10, 100), right-aligned

**Why this location?** Top-right keeps action updates visible without obstructing gameplay center. Right-align prevents text overlap with left HUD.

**Visual Specification:**
- Max entries: 5
- Entry spacing: 25px vertical
- Font: 16px bold, white (#ffffff)
- Stroke: Black (#000000), 2px
- Background: Black semi-transparent padding (8px horizontal, 4px vertical)
- Text format: "{killerName} killed {victimName}"
- Text origin: (1, 0) - right-aligned
- Depth: 1000

**Behavior:**
1. New kill → add entry at top
2. If > 5 entries → remove oldest (FIFO)
3. After 5 seconds → fade out over 1 second
4. On fade complete → remove and reposition remaining entries

**Pseudocode:**
```
function addKill(killerName, victimName):
    // Remove oldest (front of array) if at max capacity
    if kills.length >= 5:
        oldest = kills.shift()
        oldest.destroy()

    entry = createText("{killerName} killed {victimName}")
    kills.push(entry)  // Add to end of array

    scheduleRemoval(entry, 5000ms)

function fadeOutKill(entry):
    tween(entry.alpha, 0, 1000ms)
    onComplete: removeEntry(entry)
```

**TypeScript:**
```typescript
export class KillFeedUI {
  private kills: KillEntry[] = [];  // Oldest at index 0, newest at end
  private readonly MAX_KILLS = 5;
  private readonly FADE_DELAY = 5000;
  private readonly KILL_SPACING = 25;

  addKill(killerName: string, victimName: string): void {
    // Remove oldest kill if at max capacity
    if (this.kills.length >= this.MAX_KILLS) {
      const oldestKill = this.kills.shift();  // Remove from front
      if (oldestKill) {
        this.container.remove(oldestKill.text);
        oldestKill.text.destroy();
      }
    }

    const yPosition = this.kills.length * this.KILL_SPACING;
    const killText = this.scene.add.text(
      0, yPosition,
      `${killerName} killed ${victimName}`,
      { fontSize: '16px', fontStyle: 'bold', color: '#ffffff',
        stroke: '#000000', strokeThickness: 2,
        backgroundColor: '#000000', padding: { x: 8, y: 4 } }
    );
    killText.setOrigin(1, 0);
    this.container.add(killText);

    this.kills.push({ text: killText, timestamp: Date.now() });  // Add to end

    this.scene.time.delayedCall(this.FADE_DELAY, () => this.fadeOutKill(killEntry));
  }
}
```

---

### Score Display (Top Right)

**Position**: Top-right corner, right-aligned

**Why this location?** Score is a persistent stat visible at a glance. Top-right groups it with the kill counter below.

**Visual Specification:**
- Format: 6-digit zero-padded (e.g., `String(score).padStart(6, '0')` → "000000", "001250")
- Font: Monospaced, ~28px, white (#FFFFFF / COLORS.SCORE)
- Position: Top-right corner, right-aligned
- Updated by: `player:kill_credit` event (when local player is killer). Score = killerXP from the event data
- Depth: 1000

**TypeScript:**
```typescript
export class ScoreDisplayUI {
  private scoreText: Phaser.GameObjects.Text;
  private score = 0;

  updateScore(killerXP: number): void {
    this.score = killerXP;
    this.scoreText.setText(String(this.score).padStart(6, '0'));
  }
}
```

---

### Kill Counter (Top Right, Below Score)

**Position**: Below score display, top-right, right-aligned

**Why this location?** Groups with score for quick combat stats at a glance.

**Visual Specification:**
- Format: "KILLS: N" (e.g., "KILLS: 0", "KILLS: 5")
- Color: #FF6666 (COLORS.KILL_COUNTER)
- Font: ~16px, right-aligned
- Position: Below score display, top-right
- Incremented on `player:kill_credit` for local player
- Depth: 1000

**TypeScript:**
```typescript
export class KillCounterUI {
  private killText: Phaser.GameObjects.Text;
  private kills = 0;

  incrementKills(): void {
    this.kills++;
    this.killText.setText(`KILLS: ${this.kills}`);
  }
}
```

---

### Ammo Display (Top Left)

**Position**: (10, 50)

**Why this location?** Below title, above health bar. Groups weapon info together.

**Visual Specification:**
- Icon (left of text): Yellow/orange target/crosshair icon (#E0A030 / COLORS.AMMO_READY) when ready; red rotating spinner icon when reloading
- Text format: "{current}/{max}" (e.g., "15/15")
- Text color: Yellow/orange (#E0A030 / COLORS.AMMO_READY) when ready
- Font: 16px
- Reloading state: "RELOADING..." text in red/coral (#CC5555 / COLORS.AMMO_RELOADING) appears to the right of the counter
- Fist/infinite-ammo weapons: Display "INF" instead of ammo count (no max shown)
- Visibility: Hidden for melee weapons (Bat, Katana)
- Depth: 1000

**Why hide for melee?** Melee weapons have unlimited attacks (magazineSize = 0). Showing "0/0" is confusing.

**TypeScript:**
```typescript
updateAmmoDisplay(shootingManager: ShootingManager): void {
  if (this.ammoText && shootingManager) {
    const isMelee = shootingManager.isMeleeWeapon();
    const isReloading = shootingManager.isReloading();

    if (isMelee) {
      this.ammoText.setVisible(false);
      this.ammoIcon.setVisible(false);
      this.reloadingText.setVisible(false);
    } else {
      this.ammoText.setVisible(true);
      this.ammoIcon.setVisible(true);
      const [current, max] = shootingManager.getAmmoInfo();

      if (max === Infinity || max === 0) {
        this.ammoText.setText('INF');
      } else {
        this.ammoText.setText(`${current}/${max}`);
      }
      this.ammoText.setColor('#E0A030'); // COLORS.AMMO_READY

      // Icon state: ready vs reloading
      if (isReloading) {
        this.ammoIcon.setTint(0xFF0000); // Red spinner when reloading
        this.reloadingText.setVisible(true);
        this.reloadingText.setText('RELOADING...');
        this.reloadingText.setColor('#CC5555'); // COLORS.AMMO_RELOADING
      } else {
        this.ammoIcon.setTint(0xE0A030); // COLORS.AMMO_READY
        this.reloadingText.setVisible(false);
      }
    }
  }
}
```

---

### Reload Indicators

Three complementary indicators for reload state:

#### Reload Progress Bar (World-Space, Above Player)

**Position**: World-space above the player character, same pattern as health bars rendered above entities (not screen-fixed)

**Visual Specification:**
- Dimensions: ~60×6 px
- Background: Dark gray (#333333), 0.8 alpha
- Progress fill: White (#FFFFFF)
- Visibility: Only during reload, hidden for melee
- Depth: World-space (rendered with player entities)

**Why world-space?** Keeps reload feedback attached to the player character, consistent with world-space health bars. Easier to track during movement.

#### Reload Circle (Screen Center)

**Position**: Camera center (width/2, height/2)

**Visual Specification:**
- Radius: 20px
- Line style: 3px, green (#00ff00), 1.0 alpha (fully opaque)
- Arc: Starts at 270° (top), sweeps clockwise
- Depth: 1002

**Why centered?** Player focuses on crosshair during combat. Circle around crosshair is immediately visible.

#### "RELOAD!" Flashing Text

**Position**: (camera.width/2, camera.height/2 + 60)

**Visual Specification:**
- Text: "RELOAD!"
- Font: 32px bold, red (#ff0000)
- Stroke: Black (#000000), 4px
- Animation: Alpha pulsing 1.0 → 0.3, 500ms, infinite
- Visibility: Only when magazine is empty AND not currently reloading
- Depth: 1003 (highest priority)

**Why flashing?** Empty magazine is critical—player is defenseless. Flashing demands immediate attention.

**Pseudocode:**
```
function updateReloadUI(isReloading, isEmpty, reloadProgress, isMelee):
    if isMelee:
        hideAll()
        return

    if isReloading:
        showProgressBar(reloadProgress)
        showCircle(reloadProgress)
        hideReloadText()
    else if isEmpty:
        hideProgressBar()
        hideCircle()
        showFlashingReloadText()
    else:
        hideAll()
```

---

### Match Timer (Top Center)

**Position**: (camera.width/2, 10), centered horizontally

**Why this location?** Top-center is standard for match timers (sports, esports). Visible without obstructing action.

**Visual Specification:**
- Format: "M:SS" or "MM:SS" (e.g., "7:00", "0:30")
- Font: 24px bold
- Text origin: (0.5, 0) - centered
- Depth: 1000

**Color Coding:**
| Remaining Time | Color | Why |
|----------------|-------|-----|
| > 120 seconds | White (#ffffff) | Normal, plenty of time |
| 60-120 seconds | Yellow (#ffff00) | Match winding down |
| < 60 seconds | Red (#ff0000) | Final minute urgency |

**Pseudocode:**
```
function updateMatchTimer(remainingSeconds):
    minutes = floor(remainingSeconds / 60)
    seconds = remainingSeconds % 60
    text = "{minutes}:{seconds.toString().padStart(2, '0')}"

    if remainingSeconds < 60:
        color = RED
    else if remainingSeconds < 120:
        color = YELLOW
    else:
        color = WHITE

    timerText.setText(text)
    timerText.setColor(color)
```

**TypeScript:**
```typescript
updateMatchTimer(remainingSeconds: number): void {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  this.matchTimerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

  if (remainingSeconds < 60) {
    this.matchTimerText.setColor('#ff0000');    // Red
  } else if (remainingSeconds < 120) {
    this.matchTimerText.setColor('#ffff00');    // Yellow
  } else {
    this.matchTimerText.setColor('#ffffff');    // White
  }
}
```

---

### Dodge Roll Cooldown (Bottom Right)

**Position**: (camera.width - 50, camera.height - 50)

**Why this location?** Bottom-right is underutilized. Cooldown is secondary info—player doesn't stare at it.

**Visual Specification:**
- Radius: 20px
- Background: Gray (#666666), 0.5 alpha
- Progress: Green (#00ff00), 0.6 alpha
- Ready state: Solid green (#00ff00), 0.8 alpha
- Arc: Starts at -90° (top), sweeps clockwise
- Depth: 1000

**Behavior:**
- Progress 0.0-0.99: Gray background + green arc showing % complete
- Progress 1.0: Solid green circle (ready to roll)

**Pseudocode:**
```
function updateProgress(progress):  // 0.0 to 1.0
    clear()

    if progress >= 1.0:
        // Ready - solid green
        fillCircle(GREEN, 0.8)
    else:
        // Cooling down - gray background + partial green arc
        fillCircle(GRAY, 0.5)
        angle = progress * 360
        drawArc(-90, -90 + angle, GREEN, 0.6)
```

**TypeScript:**
```typescript
export class DodgeRollCooldownUI {
  private graphics: Phaser.GameObjects.Graphics;

  updateProgress(progress: number): void {
    this.graphics.clear();

    if (progress >= 1.0) {
      this.graphics.fillStyle(0x00ff00, 0.8);
      this.graphics.fillCircle(0, 0, 20);
    } else {
      // Background
      this.graphics.fillStyle(0x666666, 0.5);
      this.graphics.fillCircle(0, 0, 20);

      // Progress arc
      this.graphics.lineStyle(4, 0x00ff00, 0.6);
      const startAngle = Phaser.Math.DegToRad(-90);
      const endAngle = startAngle + (progress * Math.PI * 2);
      this.graphics.beginPath();
      this.graphics.arc(0, 0, 18, startAngle, endAngle);
      this.graphics.strokePath();
    }
  }
}
```

---

### Weapon Pickup Prompt (Bottom Center)

**Position**: (camera.width/2, camera.height - 100)

**Why this location?** Bottom-center is visible without blocking combat. Near where player looks when approaching crates.

**Visual Specification:**
- Text: "Press E to pick up {WEAPON_NAME}"
- Font: 20px, yellow (#ffff00)
- Background: Semi-transparent black (#000000aa)
- Padding: 10px horizontal, 5px vertical
- Text origin: (0.5, 0.5) - centered
- Visibility: Only when near available weapon crate
- Depth: 1000

**Proximity Check:**
- Distance threshold: 32px (matches PICKUP_RADIUS)
- Must be available (not recently picked up)

**Pseudocode:**
```
function checkProximity(localPlayerPosition, crates):
    for crate in crates:
        if crate.available:
            distance = |crate.position - localPlayerPosition|
            if distance <= 32:
                return crate.weaponType

    return null

function update():
    nearbyWeapon = checkProximity(...)
    if nearbyWeapon:
        show("Press E to pick up " + nearbyWeapon.toUpperCase())
    else:
        hide()
```

---

### Weapon Pickup Notification (Center Screen)

**Trigger**: `weapon:pickup_confirmed` event

**Why this location?** Center screen ensures the player sees the confirmation. Distinct from the proximity-based [Weapon Pickup Prompt](#weapon-pickup-prompt-bottom-center) which asks the player to press E.

**Visual Specification:**
- Text: "Picked up {WEAPON_NAME}" (e.g., "Picked up AK47")
- Color: Gray (#AAAAAA)
- Font: 18px, centered
- Position: Center screen
- Animation: Fade out after ~2 seconds (alpha 1.0 → 0.0 over 500ms starting at 1500ms)
- Depth: 1000

**TypeScript:**
```typescript
export class PickupNotificationUI {
  show(weaponName: string): void {
    this.text.setText(`Picked up ${weaponName}`);
    this.text.setAlpha(1).setVisible(true);
    this.scene.time.delayedCall(1500, () => {
      this.scene.tweens.add({
        targets: this.text,
        alpha: 0,
        duration: 500,
        onComplete: () => this.text.setVisible(false),
      });
    });
  }
}
```

---

### Crosshair (Mouse Cursor)

**Position**: Follows mouse pointer

**Visual Specification:**
- Crosshair shape: White "+" (cross) inside an outer circle outline. All elements white (#FFFFFF)
- Outer circle: Base diameter ~40px. Expands to ~60-80px during firing (recoil bloom). Snap to expanded on shot, ease back over 200-300ms. Also expands during movement proportional to aim sway
- Visibility: Hidden for melee weapons, hidden when spectating
- Depth: 1000

> **Note:** The previous red spread circle (#ff0000) has been removed. The outer circle bloom replaces it as the dynamic accuracy indicator.

**Spread Values by Weapon:**
| Weapon | Base Spread (degrees) |
|--------|----------------------|
| Pistol | 2.0 |
| Uzi | 5.0 |
| AK47 | 3.0 |
| Shotgun | 15.0 |
| Bat | 0 (hidden) |
| Katana | 0 (hidden) |

**Behavior:**
- Spread circle only visible when player is moving
- Smooth lerp transition (0.2 speed) between spread states
- Sprint multiplies spread by 1.5x

**Why lerp?** Instant spread changes are jarring. Smooth transition feels responsive but controlled.

**TypeScript:**
```typescript
export class Crosshair {
  private currentRadius = 20; // Base radius ~20px (40px diameter)
  private readonly BASE_RADIUS = 20;
  private readonly EXPANDED_RADIUS = 35; // ~60-70px diameter
  private readonly LERP_SPEED = 0.2;

  update(isMoving: boolean, spreadDegrees: number, weaponType: string, isFiring: boolean): void {
    // Bloom: expand on firing, also expand during movement
    const targetRadius = isFiring
      ? this.EXPANDED_RADIUS
      : isMoving
        ? this.BASE_RADIUS + spreadDegrees
        : this.BASE_RADIUS;
    this.currentRadius = Phaser.Math.Linear(this.currentRadius, targetRadius, this.LERP_SPEED);

    this.graphics.clear();
    const pointer = this.scene.input.activePointer;
    const x = pointer.x;
    const y = pointer.y;

    // White "+" cross
    this.graphics.lineStyle(2, 0xffffff);
    this.graphics.lineBetween(x - 8, y, x + 8, y);
    this.graphics.lineBetween(x, y - 8, x, y + 8);

    // Outer circle outline (bloom expands during firing)
    this.graphics.lineStyle(2, 0xffffff, 0.8);
    this.graphics.strokeCircle(x, y, this.currentRadius);
  }
}
```

---

### Damage Flash

When the local player takes damage (`player:damaged` where `victimId === localPlayerId`), a persistent red overlay tints the screen.

**Implementation**: A full-viewport red overlay rectangle (not `cameras.main.flash()`, which produces a bright-to-transparent flash). The prototype shows a persistent red tint, not a bright flash.

```typescript
// Overlay rectangle, created once, hidden by default
this.damageOverlay = this.add.rectangle(
  camera.width / 2, camera.height / 2,
  camera.width, camera.height,
  0xFF0000 // COLORS.DAMAGE_FLASH
).setAlpha(0).setScrollFactor(0).setDepth(999);

// On damage:
this.damageOverlay.setAlpha(0.35); // 0.3-0.4 alpha
this.tweens.add({
  targets: this.damageOverlay,
  alpha: 0,
  duration: 300,
  ease: 'Power2'
});
```

| Property | Value | Source |
|----------|-------|--------|
| Color | #FF0000 (COLORS.DAMAGE_FLASH) | Full red |
| Alpha | 0.3-0.4 | Persistent tint, not blinding |
| Fade duration | ~300ms | Fade out to 0 |
| Depth | 999 | Below fixed HUD (1000+), above game entities |

**Constants**: See [constants.md § Camera Effects Constants](constants.md#camera-effects-constants).

---

### Hit Marker

Hit markers appear at the reticle position when the player deals damage. They use a **pre-generated 20×20 X texture** with a kill variant.

**Texture Generation**:
```typescript
const hitGfx = scene.make.graphics({ x: 0, y: 0 }, false);
hitGfx.lineStyle(3, 0xffffff, 1);
hitGfx.beginPath();
hitGfx.moveTo(2, 2); hitGfx.lineTo(18, 18);
hitGfx.moveTo(18, 2); hitGfx.lineTo(2, 18);
hitGfx.strokePath();
hitGfx.generateTexture('hitmarker', 20, 20);
```

**Display**:
```typescript
const marker = this.add.sprite(reticle.x, reticle.y, 'hitmarker').setDepth(1000);
if (kill) {
    marker.setTint(0xff0000).setScale(2.0);   // Kill: red, 2× size
} else {
    marker.setTint(0xffffff).setScale(1.2);   // Normal: white, 1.2× size
}
this.tweens.add({
    targets: marker, alpha: 0, scale: marker.scale * 0.5, duration: 150,
    onComplete: () => marker.destroy()
});
```

| Variant | Scale | Color | Duration |
|---------|-------|-------|----------|
| Normal Hit | 1.2× | White (0xFFFFFF) | 150ms fade |
| Kill | 2.0× | Red (0xFF0000) | 150ms fade |

**Constants**: See [constants.md § Hit Marker Constants](constants.md#hit-marker-constants).

---

### Damage Numbers

Floating damage numbers appear above hit targets. Three variants exist based on context.

**Implementation**:
```typescript
const text = this.add.text(x, y - 30, amount.toString(), {
    fontSize: isCrit ? '24px' : '16px',
    color: isCrit ? '#ff0000' : '#ffffff',
    stroke: '#000000', strokeThickness: 2, fontFamily: 'Arial'
}).setOrigin(0.5).setDepth(1000);

this.tweens.add({
    targets: text, y: y - 80, alpha: 0, duration: 800,
    onComplete: () => text.destroy()
});
```

| Variant | Font Size | Color | Scale | Alpha | Use Case |
|---------|-----------|-------|-------|-------|----------|
| Normal | 16px | White (#FFFFFF) | 1.0 | 1.0 | Standard damage |
| Kill | 24px | Red (#FF0000) | 1.0 | 1.0 | Killing blow |
| Remote | 16px | White (#FFFFFF) | 0.7 | 0.8 | Non-local-player damage |

| Property | Value | Source |
|----------|-------|--------|
| Duration | 800ms | `constants.md § Damage Number Constants` |
| Float Distance | 50px upward | — |
| Stroke | 2px black outline | — |
| Depth | 1000 | — |

**Constants**: See [constants.md § Damage Number Constants](constants.md#damage-number-constants).

---

### Camera Shake

Three distinct camera shake triggers exist, each serving a different feedback purpose. They differ in trigger source, timing, and intensity.

#### Hit Feedback Shake (Server-Confirmed)

Triggered by the `hit:confirmed` event from the server. Confirms the local player's shot or melee strike dealt damage. This is server-authoritative — the shake only fires after the server validates the hit.

**Implementation** (in `GameSceneUI.ts`):
```typescript
this.cameras.main.shake(50, 0.001);
```

| Property | Value | Source |
|----------|-------|--------|
| Duration | 50ms | `constants.md § Hit Feedback Shake` |
| Intensity | 0.001 | Subtle, felt but not disorienting |

#### Per-Weapon Recoil Shake (Client-Side, Immediate)

Triggered by the `projectile:spawn` event. Fires immediately on the client when the local player shoots, providing instant tactile feedback without waiting for server confirmation. Intensity varies per weapon to match the weapon's perceived weight.

Only applies to Uzi, AK47, and Shotgun. Pistol has no recoil shake (too light). Melee weapons (Bat, Katana) do not fire projectiles and are not affected.

**Implementation** (in `ScreenShake.ts`):
```typescript
// Intensity varies by weapon type
const recoilIntensity = {
  uzi: 0.005,
  ak47: 0.007,
  shotgun: 0.012,
};
this.cameras.main.shake(100, recoilIntensity[weaponType]);
```

| Property | Value | Source |
|----------|-------|--------|
| Duration | 100ms (all weapons) | `constants.md § Per-Weapon Recoil Shake` |
| Intensity (Uzi) | 0.005 | Light spray weapon |
| Intensity (AK47) | 0.007 | Medium assault rifle |
| Intensity (Shotgun) | 0.012 | Heavy single shot, strongest recoil |

**Why separate from hit feedback?** Recoil shake is immediate client-side feedback tied to firing. Hit feedback shake is delayed until the server confirms the hit landed. They can overlap — firing and hitting in the same frame produces both shakes.

#### Bat Melee Hit Shake

Triggered on a successful melee hit with the Bat weapon. Heavier and longer than the standard hit feedback shake to sell the physicality of a blunt melee weapon connecting. This is distinct from the generic `hit:confirmed` shake and replaces it for Bat hits.

**Implementation** (in `ScreenShake.ts`):
```typescript
this.cameras.main.shake(150, 0.008);
```

| Property | Value | Source |
|----------|-------|--------|
| Duration | 150ms | `constants.md § Bat Melee Hit Shake` |
| Intensity | 0.008 | 8x stronger than hit feedback shake |

**Constants**: See [constants.md § Camera Effects Constants](constants.md#camera-effects-constants).

---

### Minimap

A minimap in the top-left corner shows the arena layout, player position, and nearby enemies within radar range.

**Architecture**: Two graphics layers, both with `setScrollFactor(0)` (screen-fixed). Circular shape with teal/green outline border:
1. **Static layer** (depth 1999): Circular background, teal border, walls — drawn once
2. **Dynamic layer** (depth 2000): Player dot, enemy dots, radar ring — updated every frame

**Static Layer** (drawn once in `setupMinimap()`):
```typescript
const scale = 0.106;  // MINIMAP_SCALE = 170 / 1600
const mapX = 20, mapY = 20;
const mapSize = 170;  // MINIMAP_SIZE

// Background
minimapStaticGraphics.fillStyle(0x3A3A3A, 0.5); // Dark gray at 50% alpha
minimapStaticGraphics.fillCircle(mapX + mapSize / 2, mapY + mapSize / 2, mapSize / 2);

// Circular/radar ring border — teal/green outline
minimapStaticGraphics.lineStyle(2, 0x00CCCC, 0.8);
minimapStaticGraphics.strokeCircle(mapX + mapSize / 2, mapY + mapSize / 2, mapSize / 2);

// Walls
minimapStaticGraphics.fillStyle(0x555555, 1);
walls.forEach(wall => {
    minimapStaticGraphics.fillRect(
        mapX + wall.x * scale - (wall.width * scale) / 2,
        mapY + wall.y * scale - (wall.height * scale) / 2,
        wall.width * scale, wall.height * scale
    );
});
```

**Dynamic Layer** (updated every frame in `updateMinimap()`):
```typescript
// Enemy dots (within radar range only)
enemies.forEach(enemy => {
    const dist = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
    if (dist <= 600) {  // MINIMAP_RADAR_RANGE
        minimapGraphics.fillStyle(0xff0000, 1);
        minimapGraphics.fillCircle(mapX + enemy.x * scale, mapY + enemy.y * scale, 3);
    }
});

// Player dot
minimapGraphics.fillStyle(0x00ff00, 1);
minimapGraphics.fillCircle(mapX + player.x * scale, mapY + player.y * scale, 4);

// Radar range ring
minimapGraphics.lineStyle(1, 0x00ff00, 0.15);
minimapGraphics.strokeCircle(mapX + player.x * scale, mapY + player.y * scale, 600 * scale);

// Aim direction line
minimapGraphics.lineStyle(1, 0x00ff00, 0.8);
minimapGraphics.beginPath();
minimapGraphics.moveTo(mapX + player.x * scale, mapY + player.y * scale);
minimapGraphics.lineTo(
    mapX + player.x * scale + Math.cos(player.rotation) * 10,
    mapY + player.y * scale + Math.sin(player.rotation) * 10
);
minimapGraphics.strokePath();
```

| Property | Value | Source |
|----------|-------|--------|
| Position | (20, 20) top-left | `constants.md § Minimap Constants` |
| Scale | 0.106 (MINIMAP_SCALE) | 1600px → 170px |
| Size | 170 × 170 px (MINIMAP_SIZE) | `constants.md § Minimap Constants` |
| Shape | Circular with teal/green outline border | — |
| Radar Range | 600px | Enemies beyond this hidden |
| Player Dot | 4px radius, green | — |
| Enemy Dot | 3px radius, red | — |
| Background | #3A3A3A, alpha 0.5 | — |
| Static Depth | 1999 | — |
| Dynamic Depth | 2000 | — |

**Constants**: See [constants.md § Minimap Constants](constants.md#minimap-constants).

---

### Match End Screen (React Modal)

**Trigger**: `match:ended` event

> **Note:** This is distinct from the [Death Screen Overlay](#death-screen-overlay-per-death), which is a Phaser-rendered overlay shown on each individual death during the match. The Match End Screen is a React modal that appears once when the entire match concludes.

**Why React?** Complex layout (tables, buttons, forms) is easier in React. Accessibility features (keyboard nav, screen readers) come free.

**Visual Specification:**

#### Backdrop
- Fixed fullscreen
- Background: rgba(0, 0, 0, 0.8)
- z-index: 1000
- Click outside modal → close

#### Modal Container
- Max width: 600px
- Max height: 80vh
- Centered vertically and horizontally
- Border: 2px solid white
- Border radius: 8px
- Background: #1a1a1a
- Padding: 20px
- Overflow-y: auto

#### Winner Section
- Single winner: "Winner: {PlayerName}"
- Multiple winners: "Winners: {Name1}, {Name2}"
- No winner: "No Winner"
- Winner name color: Gold (#ffd700)
- No separate "MATCH ENDED" title — the winner text IS the title (`<h2 class="match-end-title">`)

#### Scoreboard Table

| Column | Width | Align |
|--------|-------|-------|
| Rank | 50px | Center |
| Player | Flex | Left |
| Kills | 60px | Center |
| Deaths | 60px | Center |

- Header background: #2a2a2a
- Row hover: #252525
- Local player row: #2a3a4a (blue tint), bold
- Sorted: Kills descending, then deaths ascending

#### XP Breakdown

| Row | Description |
|-----|-------------|
| Base XP | 50 XP participation |
| Kill XP | kills × 100 XP |
| Win Bonus | 200 XP (if winner) |
| Top 3 Bonus | 50-150 XP (3rd-1st) |
| **Total** | Sum of above |

- XP row background: #2a2a2a
- Total row: #3a4a3a (green tint), bold, 18px

#### Countdown Timer
- Text: "Returning to lobby in {n}s"
- Color: #aaaaaa
- Auto-triggers restart at 0

#### Controls
- Close button (×): Top-right corner, red on hover
- "Play Again" button: Full-width, green (#4a7a4a), 18px bold
- ESC key: Closes modal

**TypeScript (React):**
```tsx
export function MatchEndScreen({ matchData, localPlayerId, onClose, onPlayAgain }: MatchEndScreenProps) {
  const [countdown, setCountdown] = useState(10);
  const hasCalledPlayAgainRef = useRef(false);

  // Countdown timer (separate effect from trigger)
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // Trigger onPlayAgain when countdown reaches 0 (ref prevents double-call)
  useEffect(() => {
    if (countdown === 0 && !hasCalledPlayAgainRef.current) {
      hasCalledPlayAgainRef.current = true;
      onPlayAgain();
    }
  }, [countdown, onPlayAgain]);

  const rankedPlayers = [...matchData.finalScores].sort((a, b) =>
    b.kills !== a.kills ? b.kills - a.kills : a.deaths - b.deaths
  );

  const renderWinners = () => {
    if (matchData.winners.length === 0)
      return <h2 className="match-end-title">No Winner</h2>;
    if (matchData.winners.length === 1)
      return <h2 className="match-end-title">Winner: <span className="winner-name">{matchData.winners[0]}</span></h2>;
    return <h2 className="match-end-title">Winners: <span className="winner-name">{matchData.winners.join(', ')}</span></h2>;
  };

  return (
    <div className="match-end-backdrop" onClick={handleBackdropClick}>
      <div className="match-end-modal" role="dialog" onClick={e => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>
        {renderWinners()}
        {/* Rankings table, XP breakdown, countdown, play again button */}
      </div>
    </div>
  );
}
```

> **Note:** No "MATCH ENDED" heading — the winner text IS the title. Countdown uses a `useRef` guard to prevent calling `onPlayAgain` multiple times on re-render.

---

### Connection Status (Top Left)

**Position**: (10, 30), below title

**Visual Specification:**
- Font size: 14px
- Connected: "Connected! WASD=move, Click=shoot, R=reload, E=pickup, SPACE=dodge"
  - Color: Green (#00ff00)
- Failed: "Failed to connect to server"
  - Color: Red (#ff0000)
- Reconnecting: **Console only** — `console.log("Reconnecting in ${delay}ms... (attempt ${n})")`
  - No visible on-screen UI for reconnecting state

**Why detailed connected message?** First-time players need control hints. Experienced players ignore it.

---

### Chat Log (Bottom Left)

**Position**: Bottom-left of viewport, screen-fixed (scroll factor 0)

**Why this location?** Bottom-left is underutilized and doesn't conflict with combat HUD elements. Chat is secondary info players glance at between fights.

**Visual Specification:**
- Dimensions: ~300x120px
- Background: #808080 at 70% opacity
- System messages: Yellow (#BBA840 / COLORS.CHAT_SYSTEM), prefixed `[SYSTEM]` (e.g., "Welcome to Stick Rumble. Survive.")
- Player messages: Name in red/orange, message text in white (e.g., "Reaper: Bruh")
- Font: Sans-serif, 14px
- Max visible lines: ~6 (overflow scrolls oldest off top)
- Scroll behavior: Auto-scrolls to newest message; manual scroll pauses auto-scroll
- Depth: 1000

**TypeScript:**
```typescript
export class ChatLogUI {
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private messages: Phaser.GameObjects.Text[] = [];
  private readonly MAX_VISIBLE = 6;

  addSystemMessage(text: string): void {
    this.addMessage(`[SYSTEM] ${text}`, '#BBA840'); // COLORS.CHAT_SYSTEM
  }

  addPlayerMessage(playerName: string, text: string): void {
    const nameColor = '#E07040'; // Red/orange for player name
    // Render: "{playerName}: {text}" with name colored, message white
    this.addMessage(`${playerName}: ${text}`, '#FFFFFF');
  }
}
```

---

### Death Screen Overlay (Per-Death)

**Trigger**: `player:death` event for local player

> **Note:** This is distinct from the [Match End Screen](#match-end-screen-react-modal), which is a React modal triggered by `match:ended`. The Death Screen Overlay is a Phaser-rendered overlay shown on each individual death during the match.

**Why separate from Match End?** Players die multiple times per match. Each death needs immediate feedback without blocking the game permanently. The match end screen only appears once when the entire match concludes.

**Visual Specification:**
- Dark overlay: Full viewport, 70% opacity black (#000000)
- "YOU DIED" text: ~72px bold, white (#FFFFFF), centered horizontally and vertically
- Stats row (below "YOU DIED"):
  - Trophy icon (yellow/gold) + score value (red)
  - Skull icon (red) + kill count (white)
- "TRY AGAIN" button: Rectangular, thin white border, white text, centered below stats. On click: sends `player:respawn_request` to server (server auto-respawns the player via `player:respawn`)
- Depth: Above game world (depth ~990), below React modals (z-index 1000)

**Respawn Flow:**
1. `player:death` received for local player → show Death Screen Overlay
2. Player clicks "TRY AGAIN" → client sends `player:respawn_request`
3. Server processes respawn → sends `player:respawn` → client hides overlay

**TypeScript:**
```typescript
export class DeathScreenOverlay {
  private overlay: Phaser.GameObjects.Rectangle;
  private diedText: Phaser.GameObjects.Text;
  private tryAgainButton: Phaser.GameObjects.Container;

  show(score: number, kills: number): void {
    this.overlay.setAlpha(0.7).setVisible(true);
    this.diedText.setVisible(true);
    this.scoreText.setText(String(score).padStart(6, '0'));
    this.killsText.setText(String(kills));
    this.tryAgainButton.setVisible(true);
  }

  hide(): void {
    this.overlay.setVisible(false);
    this.diedText.setVisible(false);
    this.tryAgainButton.setVisible(false);
  }
}
```

---

### Debug Overlay (Top Left, Below Minimap)

**Position**: Below minimap, left side, screen-fixed

**Why this location?** Groups diagnostic info near the minimap without overlapping combat HUD. Only visible during development.

**Visual Specification:**
- Color: Bright green (#00FF00 / COLORS.DEBUG_OVERLAY)
- Font: Monospaced, ~12px
- Lines:
  - `FPS: N`
  - `Update: Nms`
  - `AI: Nms`
  - `E: N | B: N` (entity count | bullet count)
- Controlled by a debug flag (not shown in production)
- Depth: 1000

> **Note:** This is distinct from the [Debug Network Panel](#debug-network-panel-epic-4), which is a React component for simulating network conditions. The Debug Overlay is a Phaser-rendered performance readout.

**TypeScript:**
```typescript
export class DebugOverlayUI {
  private lines: Phaser.GameObjects.Text[];
  private enabled = false;

  update(fps: number, updateMs: number, aiMs: number, entities: number, bullets: number): void {
    if (!this.enabled) return;
    this.lines[0].setText(`FPS: ${fps}`);
    this.lines[1].setText(`Update: ${updateMs}ms`);
    this.lines[2].setText(`AI: ${aiMs}ms`);
    this.lines[3].setText(`E: ${entities} | B: ${bullets}`);
  }
}
```

---

### Debug Network Panel (Epic 4)

**File:** `src/ui/debug/DebugNetworkPanel.tsx`

**Purpose:** React panel for controlling the client-side NetworkSimulator during development. Allows testing prediction, reconciliation, and interpolation under degraded network conditions.

**Props:**
```typescript
interface DebugNetworkPanelProps {
  isVisible: boolean;
  onClose: () => void;
  stats: NetworkSimulatorStats;
  onLatencyChange: (latency: number) => void;
  onPacketLossChange: (packetLoss: number) => void;
  onEnabledChange: (enabled: boolean) => void;
}
```

**Controls:**
- **Enable/Disable**: Toggle network simulation on/off
- **Latency slider**: 0–300ms base latency
- **Packet Loss slider**: 0–20% random drop rate

**Why a debug panel?** Testing netcode requires simulating poor network conditions. Without this, developers must use external tools (e.g., `tc`, Clumsy) to degrade the network. The panel provides in-game controls with instant feedback.

See [networking.md](networking.md#network-simulator) for the underlying NetworkSimulator implementation.

---

## Error Handling

### Missing Player for Damage Numbers

**Trigger**: `player:damaged` with victimId not found in PlayerManager
**Response**: Skip damage number rendering (silently fail)
**Why**: Race condition possible if player left between damage and render

### Invalid Weapon Type for Crosshair

**Trigger**: Unknown weapon type passed to crosshair update
**Response**: Default to 0 spread (show static crosshair only)
**Recovery**: N/A - self-healing

### Kill Feed Overflow

**Trigger**: More than 5 kills in rapid succession
**Response**: FIFO removal of oldest entries
**Why**: Prevents memory growth, maintains readability

---

## Implementation Notes

### TypeScript (Client)

**File Organization:**
```
src/game/ui/
├── HealthBarUI.ts          # HUD health bar with regen pulse
├── KillFeedUI.ts           # Kill notification feed
├── DodgeRollCooldownUI.ts  # Circular cooldown indicator
├── PickupPromptUI.ts       # Weapon pickup prompt

src/game/entities/
├── Crosshair.ts            # Mouse-following crosshair

src/game/scenes/
├── GameSceneUI.ts          # Aggregates UI creation/updates

src/ui/match/
├── MatchEndScreen.tsx      # React match end modal
├── MatchEndScreen.css      # Modal styles
```

**Manager Pattern:**
All UI is created and updated through `GameSceneUI` in `GameScene.create()` and `GameScene.update()`.

**Depth Layering:**
| Depth | Element |
|-------|---------|
| 999 | Damage flash overlay |
| 1000 | Base UI (health, timer, kill feed) |
| 1001 | Hit marker, reload progress |
| 1002 | Reload circle |
| 1003 | RELOAD! flashing text |

**Screen-Fixed Elements:**
All HUD elements use `setScrollFactor(0)` to prevent movement with camera.

### Event Handler Integration

```typescript
// In GameSceneEventHandlers.setupEventHandlers()

this.wsClient.on('player:move', (data) => {
  if (data.playerId === this.localPlayerId) {
    this.healthBarUI.updateHealth(data.health, 100, data.isRegenerating);
  }
});

this.wsClient.on('player:kill_credit', (data) => {
  const killerName = data.killerId.substring(0, 8);
  const victimName = data.victimId.substring(0, 8);
  this.killFeedUI.addKill(killerName, victimName);
});

this.wsClient.on('match:timer', (data) => {
  this.ui.updateMatchTimer(data.remainingSeconds);
});

this.wsClient.on('player:damaged', (data) => {
  if (data.victimId === this.localPlayerId) {
    // Health bar updated from BOTH player:move AND player:damaged
    this.localPlayerHealth = data.newHealth;
    this.healthBarUI.updateHealth(this.localPlayerHealth, 100, false);
    this.ui.showDamageFlash();
  }
  this.ui.showDamageNumber(this.playerManager, data.victimId, data.damage);
});

this.wsClient.on('hit:confirmed', () => {
  this.ui.showHitMarker();
});

this.wsClient.on('match:ended', (data) => {
  window.onMatchEnd?.(data, this.localPlayerId);
});
```

---

## Test Scenarios

### TS-UI-001: Health Bar Reflects Current Health

**Category**: Unit
**Priority**: Critical

**Preconditions:**
- GameScene active with HealthBarUI created

**Input:**
- updateHealth(75, 100, false)

**Expected Output:**
- Bar width = 75% of 200px = 150px
- Bar color = Green (#00CC00 / COLORS.HEALTH_FULL) — 75% is >= 20% threshold
- Text = "75%"

**TypeScript (Vitest):**
```typescript
it('should display correct health bar width and color', () => {
  healthBarUI.updateHealth(75, 100, false);

  expect(healthBarUI.getBarWidth()).toBe(150);
  expect(healthBarUI.getBarColor()).toBe(0x00CC00); // COLORS.HEALTH_FULL
  expect(healthBarUI.getText()).toBe('75%');
});
```

---

### TS-UI-002: Kill Feed Shows Recent Kills

**Category**: Unit
**Priority**: High

**Preconditions:**
- KillFeedUI created

**Input:**
- addKill("Player1", "Player2")
- addKill("Player3", "Player4")

**Expected Output:**
- 2 entries visible
- First entry (top): "Player3 killed Player4"
- Second entry: "Player1 killed Player2"

**TypeScript (Vitest):**
```typescript
it('should show kills in reverse chronological order', () => {
  killFeedUI.addKill('Player1', 'Player2');
  killFeedUI.addKill('Player3', 'Player4');

  const entries = killFeedUI.getEntries();
  expect(entries).toHaveLength(2);
  expect(entries[0].text).toBe('Player3 killed Player4');
  expect(entries[1].text).toBe('Player1 killed Player2');
});
```

---

### TS-UI-003: Kill Feed Fades After 5 Seconds

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- KillFeedUI with one entry

**Input:**
- Wait 5000ms

**Expected Output:**
- Entry begins fade animation
- Entry removed after additional 1000ms

---

### TS-UI-004: Ammo Counter Updates on Shoot

**Category**: Integration
**Priority**: High

**Preconditions:**
- Player with Pistol (15/15 ammo)

**Input:**
- `weapon:state` event with currentAmmo=14, maxAmmo=15

**Expected Output:**
- Ammo text shows "14/15"

---

### TS-UI-005: Reload Indicator Shows During Reload

**Category**: Integration
**Priority**: High

**Preconditions:**
- Player reloading

**Input:**
- ShootingManager.isReloading() = true
- ShootingManager.getReloadProgress() = 0.5

**Expected Output:**
- Progress bar at 50%
- Reload circle at 180°
- RELOAD! text hidden

---

### TS-UI-006: Timer Counts Down Correctly

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Match active

**Input:**
- `match:timer` event with remainingSeconds=120

**Expected Output:**
- Timer shows "2:00"
- Color = Yellow (#ffff00)

---

### TS-UI-007: Timer Turns Red Under 60 Seconds

**Category**: Unit
**Priority**: Medium

**Input:**
- updateMatchTimer(45)

**Expected Output:**
- Timer shows "0:45"
- Color = Red (#ff0000)

---

### TS-UI-008: Score Updates on Kill

**Category**: Integration
**Priority**: High

**Preconditions:**
- Match active

**Input:**
- `player:kill_credit` event

**Expected Output:**
- Kill feed entry added
- (Stats tracked in player state, visible in match end)

---

### TS-UI-009: Pickup Prompt Appears Near Crates

**Category**: Integration
**Priority**: High

**Preconditions:**
- Player near available weapon crate

**Input:**
- Player moves within 32px of crate

**Expected Output:**
- Prompt shows "Press E to pick up {WEAPON_NAME}"
- Prompt visible = true

---

### TS-UI-010: Dodge Cooldown Shows Progress

**Category**: Unit
**Priority**: Medium

**Input:**
- updateProgress(0.5)

**Expected Output:**
- Gray background circle
- Green arc at 180° (half circle)

---

### TS-UI-011: Match End Screen Shows Winner

**Category**: Integration
**Priority**: Critical

**Preconditions:**
- Match ended

**Input:**
- `match:ended` event with winners=["Player1"]

**Expected Output:**
- Modal visible
- Winner text = "Winner: Player1"

---

### TS-UI-012: Scoreboard Sorted Correctly

**Category**: Unit
**Priority**: High

**Input:**
- finalScores with kills: [3, 5, 2, 5]

**Expected Output:**
- Sorted order by kills descending: [5, 5, 3, 2]
- Ties broken by deaths ascending

**TypeScript (Vitest):**
```typescript
it('should sort scoreboard by kills descending, deaths ascending', () => {
  const scores = [
    { playerId: 'a', kills: 3, deaths: 2, xp: 300 },
    { playerId: 'b', kills: 5, deaths: 3, xp: 500 },
    { playerId: 'c', kills: 2, deaths: 1, xp: 200 },
    { playerId: 'd', kills: 5, deaths: 1, xp: 500 },
  ];

  const sorted = sortScores(scores);
  expect(sorted.map(s => s.playerId)).toEqual(['d', 'b', 'a', 'c']);
});
```

---

### TS-UI-013: Damage flash overlay on damage received

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player takes damage

**Expected Output:**
- Full-viewport red overlay rectangle (#FF0000 / COLORS.DAMAGE_FLASH) at 0.3-0.4 alpha
- Fades out over ~300ms
- Depth 999 (below fixed HUD)
- Does NOT use cameras.main.flash (uses persistent overlay rectangle)

### TS-UI-014: Hit marker normal variant

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player deals non-lethal damage

**Expected Output:**
- White X texture at reticle position, scale 1.2×
- Fades and shrinks over 150ms

### TS-UI-015: Hit marker kill variant

**Category**: Visual
**Priority**: High

**Preconditions:**
- Player deals killing blow

**Expected Output:**
- Red X texture at reticle position, scale 2.0×
- Fades and shrinks over 150ms

### TS-UI-016: Damage number variants

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Damage dealt in various contexts

**Expected Output:**
- Normal: white 16px, full opacity
- Kill: red 24px, full opacity
- Remote: white 16px, 0.7× scale, 0.8 alpha
- All float up 50px and fade over 800ms

### TS-UI-017: Camera shake — hit feedback

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Player hits an enemy, `hit:confirmed` received from server

**Expected Output:**
- Camera shakes for 50ms at 0.001 intensity

### TS-UI-020: Camera shake — per-weapon recoil

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Player fires a ranged weapon (Uzi, AK47, or Shotgun)

**Expected Output:**
- Camera shakes for 100ms at weapon-specific intensity (Uzi=0.005, AK47=0.007, Shotgun=0.012)
- Pistol firing does NOT trigger recoil shake

### TS-UI-021: Camera shake — bat melee hit

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Player hits an enemy with the Bat weapon

**Expected Output:**
- Camera shakes for 150ms at 0.008 intensity

### TS-UI-018: Minimap renders static layer

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Game scene loaded

**Expected Output:**
- Minimap at (20, 20), 170×170px (MINIMAP_SIZE=170)
- Dark gray (#3A3A3A) background at 50% alpha with teal/green circular border
- Wall positions rendered at 0.106 scale (MINIMAP_SCALE)
- Static layer at depth 1999

### TS-UI-019: Minimap radar range filters enemies

**Category**: Visual
**Priority**: Medium

**Preconditions:**
- Enemies at various distances from player

**Expected Output:**
- Enemies within 600px shown as red dots (radius 3)
- Enemies beyond 600px NOT shown
- Player shown as green dot (radius 4)
- Radar range ring visible at 0.15 alpha (scaled at MINIMAP_SCALE=0.106)

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.1.0 | 2026-02-15 | Added Debug Network Panel section (DebugNetworkPanel.tsx for testing netcode under degraded conditions). |
| 1.1.1 | 2026-02-16 | Fixed kill feed ordering — actual uses `push` (add to end) + `shift` (remove oldest from front), not `unshift` + `pop`. Uses KillEntry objects with container, not raw text with setScrollFactor. |
| 1.1.8 | 2026-02-16 | Added dual-source health bar update — `player:damaged` handler also calls `updateHealth()` (not just `player:move`) |
| 1.1.7 | 2026-02-16 | Fixed hit marker — uses world coordinates (no `setScrollFactor(0)`) per actual `GameSceneUI.ts:305-361` |
| 1.1.6 | 2026-02-16 | Clarified reload circle alpha — explicitly 1.0 (fully opaque) per `GameSceneUI.ts:168` |
| 1.1.5 | 2026-02-16 | Fixed match timer boundary conditions — uses `< 60` and `< 120` (not `> 120` and `> 60`), checks red first |
| 1.1.4 | 2026-02-16 | Added font size (14px) to connection status specification |
| 1.1.3 | 2026-02-16 | Fixed kill feed player ID method — `slice(0, 8)` → `substring(0, 8)` to match source |
| 1.1.2 | 2026-02-16 | Fixed match end screen test expected output — winner text is "Winner: Player1", not "Player1 WINS!" |
| 1.2.0 | 2026-02-16 | Replaced damage flash overlay with camera flash. Replaced procedural hit marker with texture-based 20×20 X. Updated damage numbers with kill/remote variants. Added camera shake, minimap sections. Added tests TS-UI-013 through TS-UI-019. Ported from pre-BMM prototype. |
| 1.3.0 | 2026-02-17 | Expanded camera shake section to document all three shake systems: hit feedback shake (server-confirmed, 50ms/0.001), per-weapon recoil shake (client-side, 100ms, Uzi=0.005/AK47=0.007/Shotgun=0.012), and bat melee hit shake (150ms/0.008). Renamed constants from generic CAMERA_SHAKE to specific HIT_FEEDBACK_SHAKE. Added tests TS-UI-020 and TS-UI-021. |
| 1.4.0 | 2026-02-18 | Art style alignment: Rewrote HUD layout diagram. Health bar updated to 2-tier (green/red at 20%), EKG icon, "N%" format, #333333 depleted bg. Ammo counter updated with icon, #E0A030 color, RELOADING text, INF state. Added Score Display (6-digit zero-padded), Kill Counter (KILLS: N), Chat Log, Death Screen Overlay, Debug Overlay, Weapon Pickup Notification sections. Minimap updated to 170x170px circular with teal border. Reload progress bar moved to world-space 60px white. Crosshair changed to white "+" in circle with bloom. Damage flash changed from camera flash to persistent red overlay at depth 999. Renamed HEALTH_BAR_WIDTH to HUD_HEALTH_BAR_WIDTH. Updated tests TS-UI-001, TS-UI-013, TS-UI-018. |
