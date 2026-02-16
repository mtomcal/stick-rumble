# UI System

> **Spec Version**: 1.1.0
> **Last Updated**: 2026-02-15
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
| HEALTH_BAR_WIDTH | 200 | px | HUD health bar width |
| HEALTH_BAR_HEIGHT | 30 | px | HUD health bar height |
| DODGE_ROLL_UI_RADIUS | 20 | px | Cooldown indicator radius |
| DAMAGE_FLASH_ALPHA | 0.5 | ratio | Initial red flash opacity |
| DAMAGE_FLASH_DURATION | 200 | ms | Flash fade-out time |
| HIT_MARKER_SIZE | 15 | px | Hit confirmation line length |
| HIT_MARKER_GAP | 10 | px | Hit marker gap from center |
| DAMAGE_NUMBER_FLOAT_DISTANCE | 50 | px | Float-up distance |
| DAMAGE_NUMBER_DURATION | 1000 | ms | Animation duration |
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
│ [Title]                                                      │
│ [Status]                                       [Kill Feed]   │
│ [Ammo]                                            Entry 1    │
│ [Health Bar + Regen Pulse]                        Entry 2    │
│ [Reload Progress]                                 Entry 3    │
│                                                   Entry 4    │
│                          [Timer]                  Entry 5    │
│                         MM:SS                                │
│                                                              │
│                                                              │
│                      [Crosshair]                             │
│                         + spread                             │
│                      [Reload Circle]                         │
│                      [RELOAD! text]                          │
│                                                              │
│                  [Pickup Prompt]              [Dodge Roll]   │
│              Press E to pick up {WEAPON}          ○          │
└─────────────────────────────────────────────────────────────┘
```

---

## Behavior

### Health Bar UI (Top Left)

**Position**: (10, 70)

**Why this location?** Top-left follows FPS conventions where primary player stats live. Below title/status text.

**Visual Specification:**
- Dimensions: 200×30 px
- Background: Black (#000000), 0.7 alpha
- Foreground: Dynamic color based on health percentage
- Text: "HP: {current}/{max}" centered, white (#ffffff), 18px bold
- Depth: 1000

**Color Thresholds:**
| Health % | Color | Hex | Why |
|----------|-------|-----|-----|
| > 60% | Green | #00ff00 | Safe, no urgency |
| 30-60% | Yellow | #ffff00 | Caution, find cover |
| < 30% | Red | #ff0000 | Critical, immediate danger |

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

    if ratio > 0.6:
        color = GREEN
    else if ratio > 0.3:
        color = YELLOW
    else:
        color = RED

    drawBar(width, color)
    setText("HP: {current}/{max}")

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
  private pulseTween?: Phaser.Tweens.Tween;

  updateHealth(current: number, max: number, isRegenerating: boolean): void {
    const ratio = current / max;
    const color = ratio > 0.6 ? 0x00ff00 : ratio > 0.3 ? 0xffff00 : 0xff0000;

    this.bar.clear();
    this.bar.fillStyle(0x000000, 0.7);
    this.bar.fillRect(0, 0, 200, 30);
    this.bar.fillStyle(color);
    this.bar.fillRect(2, 2, (ratio * 196), 26);

    this.text.setText(`HP: ${current}/${max}`);

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

### Ammo Display (Top Left)

**Position**: (10, 50)

**Why this location?** Below title, above health bar. Groups weapon info together.

**Visual Specification:**
- Text format: "{current}/{max}" (e.g., "15/15")
- Font: 16px, white (#ffffff)
- Visibility: Hidden for melee weapons (Bat, Katana)
- Depth: 1000

**Why hide for melee?** Melee weapons have unlimited attacks (magazineSize = 0). Showing "0/0" is confusing.

> **Note:** There is no low-ammo color change logic. The ammo text stays white (#ffffff) regardless of ammo count.

**TypeScript:**
```typescript
updateAmmoDisplay(shootingManager: ShootingManager): void {
  if (this.ammoText && shootingManager) {
    const isMelee = shootingManager.isMeleeWeapon();

    if (isMelee) {
      this.ammoText.setVisible(false);
    } else {
      this.ammoText.setVisible(true);
      const [current, max] = shootingManager.getAmmoInfo();
      this.ammoText.setText(`${current}/${max}`);
    }
  }
}
```

---

### Reload Indicators

Three complementary indicators for reload state:

#### Reload Progress Bar (Top Left)

**Position**: (10, 70), overlays health bar area

**Visual Specification:**
- Dimensions: 200×10 px
- Background: Dark gray (#333333), 0.8 alpha
- Progress fill: Green (#00ff00)
- Visibility: Only during reload, hidden for melee
- Depth: 1001 (above health bar)

**Why overlay health bar?** Reload is temporary state; dedicated real estate wastes space.

#### Reload Circle (Screen Center)

**Position**: Camera center (width/2, height/2)

**Visual Specification:**
- Radius: 20px
- Line style: 3px, green (#00ff00)
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

    if remainingSeconds > 120:
        color = WHITE
    else if remainingSeconds > 60:
        color = YELLOW
    else:
        color = RED

    timerText.setText(text)
    timerText.setColor(color)
```

**TypeScript:**
```typescript
updateMatchTimer(remainingSeconds: number): void {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

  const color = remainingSeconds > 120 ? '#ffffff'
              : remainingSeconds > 60 ? '#ffff00'
              : '#ff0000';
  this.timerText.setColor(color);
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

### Crosshair (Mouse Cursor)

**Position**: Follows mouse pointer

**Visual Specification:**
- Static crosshair: 4 white lines (2px), 10px long, 5px gap from center
- Spread indicator: Red circle (#ff0000), 2px line, 0.6 alpha
- Spread radius: `spreadDegrees * 2` pixels
- Visibility: Hidden for melee weapons, hidden when spectating
- Depth: 1000

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
  private currentSpread = 0;
  private readonly LERP_SPEED = 0.2;

  update(isMoving: boolean, spreadDegrees: number, weaponType: string): void {
    const targetSpread = isMoving ? spreadDegrees * 2 : 0;
    this.currentSpread = Phaser.Math.Linear(this.currentSpread, targetSpread, this.LERP_SPEED);

    this.graphics.clear();
    const pointer = this.scene.input.activePointer;
    const x = pointer.x;
    const y = pointer.y;

    // Static crosshair lines
    this.graphics.lineStyle(2, 0xffffff);
    this.graphics.lineBetween(x - 15, y, x - 5, y);
    this.graphics.lineBetween(x + 5, y, x + 15, y);
    this.graphics.lineBetween(x, y - 15, x, y - 5);
    this.graphics.lineBetween(x, y + 5, x, y + 15);

    // Spread circle (only when moving)
    if (this.currentSpread > 0.1) {
      this.graphics.lineStyle(2, 0xff0000, 0.6);
      this.graphics.strokeCircle(x, y, this.currentSpread);
    }
  }
}
```

---

### Damage Flash Overlay

**Trigger**: `player:damaged` event for local player

**Visual Specification:**
- Full-screen rectangle
- Color: Red (#ff0000)
- Initial alpha: 0.5
- Animation: Fade to 0 over 200ms (Linear easing)
- Depth: 999 (below other UI, above game)

**Why full-screen?** Peripheral vision detects the flash even when focused on combat. More noticeable than small indicators.

**TypeScript:**
```typescript
showDamageFlash(): void {
  this.damageOverlay.setAlpha(0.5);
  this.scene.tweens.add({
    targets: this.damageOverlay,
    alpha: 0,
    duration: 200,
    ease: 'Linear'
  });
}
```

---

### Hit Marker (Confirmation)

**Trigger**: `hit:confirmed` event

**Position**: Screen center (around crosshair)

**Visual Specification:**
- 4 white lines forming + pattern (crosshair: top, bottom, left, right)
- Line length: 15px
- Gap from center: 10px
- Line width: 3px
- Animation: Fade out over 200ms (Cubic.easeOut)
- Depth: 1001

**Why + pattern?** Instantly recognizable hit confirmation from FPS conventions. Overlays the crosshair position without obstructing view.

**TypeScript:**
```typescript
showHitMarker(): void {
  const camera = this.scene.cameras.main;
  const centerX = camera.scrollX + camera.width / 2;
  const centerY = camera.scrollY + camera.height / 2;
  const lineLength = 15;
  const gap = 10;

  // 4 lines forming + pattern (top, bottom, left, right)
  const lines = [
    this.scene.add.line(0, 0, centerX, centerY - gap, centerX, centerY - gap - lineLength, 0xffffff),
    this.scene.add.line(0, 0, centerX, centerY + gap, centerX, centerY + gap + lineLength, 0xffffff),
    this.scene.add.line(0, 0, centerX - gap, centerY, centerX - gap - lineLength, centerY, 0xffffff),
    this.scene.add.line(0, 0, centerX + gap, centerY, centerX + gap + lineLength, centerY, 0xffffff),
  ];

  lines.forEach(line => {
    line.setLineWidth(3);
    line.setScrollFactor(0);
    line.setDepth(1001);
  });

  this.scene.tweens.add({
    targets: lines,
    alpha: 0,
    duration: 200,
    ease: 'Cubic.easeOut',
    onComplete: () => lines.forEach(l => l.destroy())
  });
}
```

---

### Damage Numbers (Floating Text)

**Trigger**: `player:damaged` event

**Position**: Above victim's head, floats upward

**Visual Specification:**
- Text format: "-{damage}" (e.g., "-25")
- Font: 24px bold, red (#ff0000)
- Stroke: Black (#000000), 3px
- Initial position: Victim Y - 30px
- Animation: Float up 50px + fade out, 1000ms, Cubic.easeOut
- Depth: Variable (in world space)

**Why floating numbers?** Immediate feedback on damage dealt. Helps players understand weapon effectiveness.

**TypeScript:**
```typescript
showDamageNumber(victimX: number, victimY: number, damage: number): void {
  const text = this.scene.add.text(victimX, victimY - 30, `-${damage}`, {
    fontSize: '24px',
    fontStyle: 'bold',
    color: '#ff0000',
    stroke: '#000000',
    strokeThickness: 3
  });
  text.setOrigin(0.5, 0.5);

  this.scene.tweens.add({
    targets: text,
    y: text.y - 50,
    alpha: 0,
    duration: 1000,
    ease: 'Cubic.easeOut',
    onComplete: () => text.destroy()
  });
}
```

---

### Match End Screen (React Modal)

**Trigger**: `match:ended` event

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
- Connected: "Connected! WASD=move, Click=shoot, R=reload, E=pickup, SPACE=dodge"
  - Color: Green (#00ff00)
- Failed: "Failed to connect to server"
  - Color: Red (#ff0000)
- Reconnecting: **Console only** — `console.log("Reconnecting in ${delay}ms... (attempt ${n})")`
  - No visible on-screen UI for reconnecting state

**Why detailed connected message?** First-time players need control hints. Experienced players ignore it.

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
  const killerName = data.killerId.slice(0, 8);
  const victimName = data.victimId.slice(0, 8);
  this.killFeedUI.addKill(killerName, victimName);
});

this.wsClient.on('match:timer', (data) => {
  this.ui.updateMatchTimer(data.remainingSeconds);
});

this.wsClient.on('player:damaged', (data) => {
  if (data.victimId === this.localPlayerId) {
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
- Bar color = Yellow (#ffff00)
- Text = "HP: 75/100"

**TypeScript (Vitest):**
```typescript
it('should display correct health bar width and color', () => {
  healthBarUI.updateHealth(75, 100, false);

  expect(healthBarUI.getBarWidth()).toBe(150);
  expect(healthBarUI.getBarColor()).toBe(0xffff00);
  expect(healthBarUI.getText()).toBe('HP: 75/100');
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

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial specification |
| 1.1.0 | 2026-02-15 | Added Debug Network Panel section (DebugNetworkPanel.tsx for testing netcode under degraded conditions). |
| 1.1.1 | 2026-02-16 | Fixed kill feed ordering — actual uses `push` (add to end) + `shift` (remove oldest from front), not `unshift` + `pop`. Uses KillEntry objects with container, not raw text with setScrollFactor. |
| 1.1.2 | 2026-02-16 | Fixed match end screen test expected output — winner text is "Winner: Player1", not "Player1 WINS!" |
