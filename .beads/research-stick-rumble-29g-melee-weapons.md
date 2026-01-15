# Comprehensive Research: Melee Weapon Implementation in Stick Rumble

Based on my thorough analysis of the codebase, here's a detailed report on how melee weapons are implemented and where the UI bug manifests:

---

## 1. WEAPON TYPE SYSTEM & DISTINCTION

### Server-Side (Go)
The server uses a **magazine-based system** to distinguish weapon types:

**Location:** `/home/mtomcal/code/stick-rumble-worktrees/stick-rumble-29g/stick-rumble-server/internal/game/weapon.go`

```go
// IsMelee returns true if this is a melee weapon
func (w *Weapon) IsMelee() bool {
    return w.MagazineSize == 0 && w.ProjectileSpeed == 0
}
```

**Weapon Classifications:**
- **Melee Weapons** (Bat, Katana): `MagazineSize = 0`, `ProjectileSpeed = 0`
- **Ranged Weapons** (Pistol, Uzi, AK47, Shotgun): `MagazineSize > 0`, `ProjectileSpeed > 0`

**Weapon Configuration (lines 45-47):**
```go
type Weapon struct {
    MagazineSize      int            // Rounds per magazine (0 for melee)
    ReloadTime        time.Duration  // Time to reload (0 for melee)
    ProjectileSpeed   float64        // Projectile speed in px/s (0 for melee)
    // ...
}
```

**Melee Weapon Examples from weaponConfig.ts:**
```typescript
Bat: {
    name: 'Bat',
    damage: 25,
    fireRate: 2.0,
    magazineSize: 0,          // ZERO - indicates melee
    reloadTimeMs: 0,          // ZERO - no reload
    projectileSpeed: 0,       // ZERO - no projectile
    range: 64.0,
    arcDegrees: 90,
    knockbackDistance: 40,
},
Katana: {
    name: 'Katana',
    damage: 45,
    fireRate: 1.25,
    magazineSize: 0,          // ZERO - indicates melee
    reloadTimeMs: 0,          // ZERO - no reload
    projectileSpeed: 0,       // ZERO - no projectile
    range: 80.0,
    arcDegrees: 90,
    knockbackDistance: 0,
}
```

### Client-Side (TypeScript)
The client-side also uses magazine size to detect melee:

**Location:** `/home/mtomcal/code/stick-rumble-worktrees/stick-rumble-29g/stick-rumble-client/src/shared/weaponConfig.ts` (lines 118-153)

Same pattern: melee weapons have `magazineSize: 0` and `reloadTimeMs: 0`.

---

## 2. WEAPON STATE DATA FLOW

### Server → Client Communication

**Message Type:** `weapon:state`

**Location (Server):** `/home/mtomcal/code/stick-rumble-worktrees/stick-rumble-29g/stick-rumble-server/internal/network/broadcast_helper.go` (lines 154-202)

```go
func (h *WebSocketHandler) sendWeaponState(playerID string) {
    ws := h.gameServer.GetWeaponState(playerID)
    if ws == nil {
        return
    }

    current, max := ws.GetAmmoInfo()

    // Create weapon:state message data
    data := map[string]interface{}{
        "currentAmmo": current,
        "maxAmmo":     max,
        "isReloading": ws.IsReloading,
        "canShoot":    ws.CanShoot(),
    }
    // ...sends to client
}
```

**The GetAmmoInfo() Method:** (weapon.go, lines 185-188)

```go
func (ws *WeaponState) GetAmmoInfo() (current, max int) {
    return ws.CurrentAmmo, ws.Weapon.MagazineSize
}
```

**CRITICAL ISSUE:** For melee weapons, `ws.Weapon.MagazineSize == 0`, so the server sends:
- `currentAmmo: 0`
- `maxAmmo: 0`

### Schema Definition

**Location:** `/home/mtomcal/code/stick-rumble-worktrees/stick-rumble-29g/events-schema/src/schemas/server-to-client.ts` (lines 129-152)

```typescript
export const WeaponStateDataSchema = Type.Object({
    currentAmmo: Type.Integer({ description: 'Current ammunition count', minimum: 0 }),
    maxAmmo: Type.Integer({ description: 'Maximum ammunition capacity', minimum: 0 }),
    isReloading: Type.Boolean({ description: 'Whether the weapon is currently reloading' }),
    canShoot: Type.Boolean({ description: 'Whether the weapon can currently shoot' }),
});
```

---

## 3. CLIENT-SIDE UI IMPLEMENTATION

### Ammo Display

**Location:** `/home/mtomcal/code/stick-rumble-worktrees/stick-rumble-29g/stick-rumble-client/src/game/scenes/GameSceneUI.ts`

**createAmmoDisplay() (lines 57-63):**
```typescript
createAmmoDisplay(x: number, y: number): void {
    this.ammoText = this.scene.add.text(x, y, '15/15', {
        fontSize: '16px',
        color: '#ffffff'
    });
    this.ammoText.setScrollFactor(0);
}
```

**updateAmmoDisplay() (lines 68-95):**
```typescript
updateAmmoDisplay(shootingManager: ShootingManager): void {
    if (this.ammoText && shootingManager) {
        const [current, max] = shootingManager.getAmmoInfo();
        this.ammoText.setText(`${current}/${max}`);  // BUG: Shows 0/0 for melee

        const isReloading = shootingManager.isReloading();
        const isEmpty = shootingManager.isEmpty();

        // Update reload progress bar visibility
        if (this.reloadProgressBar && this.reloadProgressBarBg) {
            this.reloadProgressBar.setVisible(isReloading);
            this.reloadProgressBarBg.setVisible(isReloading);
        }

        // Show flashing "RELOAD!" indicator when empty
        if (isEmpty && !isReloading) {
            this.showEmptyMagazineIndicator();  // BUG: Shows for melee with 0 ammo
        } else {
            this.hideEmptyMagazineIndicator();
        }
    }
}
```

**Reload Progress Indicators (lines 100-162):**
- **Progress Bar**: Visible when `isReloading` is true
- **Reload Circle**: Circular progress indicator around crosshair
- **Empty Magazine Indicator**: "RELOAD!" text that flashes

All these elements activate when `isEmpty()` returns true, which happens when `currentAmmo <= 0`.

### ShootingManager

**Location:** `/home/mtomcal/code/stick-rumble-worktrees/stick-rumble-29g/stick-rumble-client/src/game/input/ShootingManager.ts`

**getAmmoInfo() (lines 183-185):**
```typescript
getAmmoInfo(): [number, number] {
    return [this.weaponState.currentAmmo, this.weaponState.maxAmmo];
}
```

**isEmpty() (lines 190-192):**
```typescript
isEmpty(): boolean {
    return this.weaponState.currentAmmo <= 0;
}
```

**isReloading() (lines 197-199):**
```typescript
isReloading(): boolean {
    return this.weaponState.isReloading;
}
```

---

## 4. MELEE ATTACK FLOW

### Input Handling

**Location:** `/home/mtomcal/code/stick-rumble-worktrees/stick-rumble-29g/stick-rumble-client/src/game/scenes/GameScene.ts` (lines 149-155)

Currently, **only shooting is mapped to mouse click**:
```typescript
this.input.on('pointerdown', () => {
    if (this.shootingManager && this.inputManager) {
        this.shootingManager.setAimAngle(this.inputManager.getAimAngle());
        this.shootingManager.shoot();  // Only shoots, no melee check
    }
});
```

There is **NO logic to switch between `shoot()` and `meleeAttack()`** based on current weapon type.

### Melee Attack Method

**Location:** ShootingManager.ts (lines 212-230)

```typescript
meleeAttack(): boolean {
    if (!this.isEnabled || !this.canMeleeAttack()) {
        return false;
    }

    // Record attack time for cooldown
    this.lastMeleeTime = this.clock.now();

    // Send melee attack message to server
    this.wsClient.send({
        type: 'player:melee_attack',
        timestamp: this.clock.now(),
        data: {
            aimAngle: this.aimAngle,
        },
    });

    return true;
}
```

### Weapon Type Tracking

**Location:** GameSceneEventHandlers.ts (lines 55, 399-401)

```typescript
private currentWeaponType: string = 'pistol'; // Default weapon

// Updated when weapon is picked up
if (messageData.playerId === this.playerManager.getLocalPlayerId()) {
    this.currentWeaponType = messageData.weaponType;
}
```

This `currentWeaponType` is available but **not used to control shoot vs melee routing**.

### Weapon Type Detection in ShootingManager

**Location:** ShootingManager.ts (lines 20, 204-206)

```typescript
type WeaponType = 'Pistol' | 'Bat' | 'Katana';

setWeaponType(weaponType: WeaponType): void {
    this.weaponType = weaponType;
}
```

The method exists but **is never called from GameSceneEventHandlers**.

### Weapon Cooldowns

**Location:** ShootingManager.ts (lines 25-29)

```typescript
const WEAPON_COOLDOWNS: Record<WeaponType, number> = {
    Pistol: 1000 / WEAPON.PISTOL_FIRE_RATE, // 333ms
    Bat: 500,    // 0.5s cooldown (2.0/s fire rate)
    Katana: 800, // 0.8s cooldown (1.25/s fire rate)
};
```

Cooldowns are defined but only used in `canMeleeAttack()` (lines 235-244).

---

## 5. WHERE THE BUG MANIFESTS

**UI Display Issues for Melee Weapons:**

1. **Ammo Counter Shows 0/0**
   - File: GameSceneUI.ts, line 71
   - When a player equips Bat or Katana, ammo displays as "0/0" instead of hidden or "∞"
   - This is technically correct data (server sends 0/0 for melee) but confusing to players

2. **Empty Magazine Indicator Flashes**
   - File: GameSceneUI.ts, lines 89-93, 202-231
   - "RELOAD!" text flashes when player has melee weapon
   - Because `isEmpty()` returns true (0 ammo) even for infinite melee weapons
   - Reload UI elements also show when they shouldn't

3. **Reload Progress Bar Shows**
   - File: GameSceneUI.ts, lines 78-81
   - Since melee weapons set `isReloading` to false, this shouldn't show
   - However, visual inconsistency exists

**Attack Triggering Issue:**

4. **No Melee Attack Triggering**
   - File: GameScene.ts, line 153
   - Mouse click always calls `shoot()`, never `meleeAttack()`
   - Even with Bat/Katana equipped, ranged attack handler is used
   - No server-side validation currently prevents this from being handled as a shoot

---

## 6. CURRENT ARCHITECTURE SUMMARY

```
Server-Side Flow (Melee):
┌─────────────────┐
│ Player Equips   │
│ Bat/Katana      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│ SetWeaponState(playerID, meleeWeapon)   │
│ MagazineSize = 0                        │
│ ProjectileSpeed = 0                     │
└────────┬────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────┐
│ sendWeaponState()                        │
│ GetAmmoInfo() returns (0, 0)             │
│ Sends: {currentAmmo: 0, maxAmmo: 0}      │
└────────┬───────────────────────────────────┘
         │
         ▼
     Client UI ─ Shows 0/0 ammo
                 ├─ Shows "RELOAD!" indicator
                 └─ Shows reload progress UI

Client-Side Issue:
┌──────────────────────────────┐
│ Mouse Click Event            │
└────────┬─────────────────────┘
         │
         ▼
    shootingManager.shoot()  ◄─── No weapon type check
         │
         ▼
    Sends 'player:shoot' to server (wrong message type)
```

---

## 7. IMPLEMENTATION APPROACH TO FIX ISSUES

### A. Server-Side Fix (weapon:state message)

The server needs to send **weapon type information** so the client can make intelligent decisions. Add to the schema:

```typescript
// In events-schema/src/schemas/server-to-client.ts
export const WeaponStateDataSchema = Type.Object({
    currentAmmo: Type.Integer({ description: 'Current ammunition count', minimum: 0 }),
    maxAmmo: Type.Integer({ description: 'Maximum ammunition capacity', minimum: 0 }),
    isReloading: Type.Boolean({ description: 'Whether the weapon is currently reloading' }),
    canShoot: Type.Boolean({ description: 'Whether the weapon can currently shoot' }),
    weaponType: Type.String({ description: 'Name of the current weapon (e.g., "Pistol", "Bat")', minLength: 1 }),  // NEW
    isMelee: Type.Boolean({ description: 'Whether the current weapon is melee', optional: true }),  // NEW (optional for compatibility)
});
```

Then update broadcast_helper.go to include weaponType:

```go
current, max := ws.GetAmmoInfo()
data := map[string]interface{}{
    "currentAmmo": current,
    "maxAmmo":     max,
    "isReloading": ws.IsReloading,
    "canShoot":    ws.CanShoot(),
    "weaponType":  ws.Weapon.Name,  // NEW
}
```

### B. Client-Side UI Fix

**Update GameSceneUI.updateAmmoDisplay():**

```typescript
updateAmmoDisplay(shootingManager: ShootingManager, isMelee?: boolean): void {
    if (this.ammoText && shootingManager) {
        const [current, max] = shootingManager.getAmmoInfo();

        // Show "∞" for melee weapons, numerical ammo for ranged
        if (isMelee) {
            this.ammoText.setText('∞');  // Or "MELEE"
        } else {
            this.ammoText.setText(`${current}/${max}`);
        }

        const isReloading = shootingManager.isReloading();
        const isEmpty = shootingManager.isEmpty();

        // Hide reload UI for melee weapons entirely
        if (this.reloadProgressBar && this.reloadProgressBarBg) {
            this.reloadProgressBar.setVisible(!isMelee && isReloading);
            this.reloadProgressBarBg.setVisible(!isMelee && isReloading);
        }

        if (this.reloadCircle) {
            this.reloadCircle.setVisible(!isMelee && isReloading);
        }

        // Only show empty magazine for ranged weapons
        if (!isMelee && isEmpty && !isReloading) {
            this.showEmptyMagazineIndicator();
        } else {
            this.hideEmptyMagazineIndicator();
        }
    }
}
```

**Update GameSceneEventHandlers.ts weapon:state handler:**

```typescript
const weaponStateHandler = (data: unknown) => {
    const messageData = data as WeaponStateData;
    if (this.shootingManager) {
        this.shootingManager.updateWeaponState(messageData);
        const isMelee = messageData.isMelee ??
                       (messageData.maxAmmo === 0 && this.shootingManager.getWeaponState().maxAmmo === 0);
        this.ui.updateAmmoDisplay(this.shootingManager, isMelee);
    }
};
```

### C. Client-Side Attack Routing Fix

**Update GameScene.ts to route attacks correctly:**

```typescript
// Setup mouse click for shooting/melee
this.input.on('pointerdown', () => {
    if (this.shootingManager && this.inputManager && this.eventHandlers) {
        this.shootingManager.setAimAngle(this.inputManager.getAimAngle());

        // Route to correct attack type based on current weapon
        const weaponType = this.eventHandlers.getCurrentWeaponType().toLowerCase();
        const isMelee = weaponType === 'bat' || weaponType === 'katana';

        if (isMelee) {
            this.shootingManager.meleeAttack();
        } else {
            this.shootingManager.shoot();
        }
    }
});
```

### D. Update Crosshair Display

**In GameScene.update() (around line 255):**

Already has weapon spread mapping, just verify melee weapons show 0 spread:

```typescript
const WEAPON_SPREAD: Record<string, number> = {
    'uzi': 5.0,
    'ak47': 3.0,
    'shotgun': 15.0,
    'pistol': 2.0,
    'bat': 0,        // No spread for melee
    'katana': 0,     // No spread for melee
};
```

This is already correct.

---

## 8. KEY FILES TO MODIFY

**Server-Side:**
1. `/home/mtomcal/code/stick-rumble-worktrees/stick-rumble-29g/stick-rumble-server/internal/network/broadcast_helper.go` - Add weaponType to message
2. Server schema validation (if needed to regenerate from TypeScript schemas)

**Client-Side:**
1. `/home/mtomcal/code/stick-rumble-worktrees/stick-rumble-29g/events-schema/src/schemas/server-to-client.ts` - Add weaponType field
2. `/home/mtomcal/code/stick-rumble-worktrees/stick-rumble-29g/stick-rumble-client/src/game/scenes/GameSceneUI.ts` - Update updateAmmoDisplay()
3. `/home/mtomcal/code/stick-rumble-worktrees/stick-rumble-29g/stick-rumble-client/src/game/scenes/GameScene.ts` - Route mouse click to meleeAttack() for melee weapons
4. `/home/mtomcal/code/stick-rumble-worktrees/stick-rumble-29g/stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts` - Pass isMelee to UI updates

---

## SUMMARY

The melee weapon implementation is architecturally sound but has a **data flow gap**: the server doesn't communicate weapon type information to the client's UI layer. The UI layer treats all weapons the same way using ammo count as the source of truth. For melee weapons with 0 ammo, this creates confusing displays showing "0/0" and "RELOAD!" indicators.

Additionally, **attack routing is hardcoded to `shoot()` without checking weapon type**, so melee attacks cannot be triggered even though the `meleeAttack()` method exists and works correctly.

Both issues are straightforward to fix by:
1. Adding weapon type to the schema
2. Making UI conditional on weapon type
3. Routing attack input based on weapon type
