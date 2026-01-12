# Epic 3: Weapon Systems & Game Feel

**Goal:** Players experience diverse, satisfying combat with multiple weapon types

**Value Delivered:** 5 distinct weapons (Bat, Katana, Uzi, AK47, Shotgun) with unique feel + basic visual polish

**FRs Covered:** FR4 (weapon pickups), FR5 (reload/switch), FR6 (sprint/dodge)

**Epic Status:** In Progress (2/14 stories complete, 14% done)

**Epic Ready:** December 9, 2025 (Epic 2 complete)
**Epic Started:** December 10, 2025 (Story 3.1 PR #3 merged)

---

## Epic Progress

- Story 3.0: Weapon Balance Research & Validation (DONE - Dec 9)
- Story 3.1: Weapon Pickup System (DONE - Dec 10, PR #3 merged)
- Story 3.2: Melee Weapons (NEXT - ready to start)
- Stories 3.3-3.7B: Blocked by sequential dependencies

**Key Additions:**
- Story 3.0 added for weapon balance research before implementation (prevents mid-epic rebalancing)
- Story 3.7 split into 3.7A (sprites) and 3.7B (UI effects) for improved agent success rate (smaller stories = 1-day tasks)
- Story 3.8 added for shared configuration system (from PR #3 feedback, blocked until 3.2-3.4 complete)

---

## Epic 3 Balance Warnings (from weapon-balance-analysis.md)

**CRITICAL FINDINGS** (Story 3.0 research):
1. Melee underpowered: Bat (50 DPS) and Katana (56.25 DPS) have LOWEST DPS, not highest as designed
2. AK47 overpowered: 120 DPS + 800px range + no weaknesses = dominates all scenarios
3. Pistol damage mismatch: Client shows 15 dmg, server uses 25 dmg (FIXED in Story 3.0B)
4. Risk/reward inverted: High-risk melee gives low reward, low-risk ranged gives high reward

**RECOMMENDED SOLUTIONS**:
- Story 3.2: Consider buffing melee (Bat 25->30, Katana 45->50) for 60+ DPS
- Story 3.3: Implement damage falloff system (PRIMARY AK47 balance mechanism)
- Story 3.3: Monitor AK47 playtesting, ready to nerf fire rate 6/s->5/s if needed

See docs/weapon-balance-analysis.md for full analysis with DPS calculations, TTK tables, and design recommendations.

---

## Epic 3 Completion Checklist

**Feature Stories (9 core):**
- [x] 3.0: Weapon Balance Research & Validation
- [x] 3.1: Weapon Pickup System
- [ ] 3.2: Melee Weapons (Bat and Katana)
- [ ] 3.3: Ranged Weapons (Uzi, AK47, Shotgun)
- [ ] 3.4: Manual Reload Mechanic
- [ ] 3.5: Sprint Mechanic
- [ ] 3.6: Dodge Roll with Invincibility Frames
- [ ] 3.7A: Character & Weapon Sprites
- [ ] 3.7B: Health Bars & Hit Effects

**Supporting Work:**
- [x] 3.0B: Pistol damage mismatch fix (client 15->25)
- [x] 3.3A: Weapon acquisition system design
- [x] 3.4A: Ammo economy & magazine balance design
- [ ] 3.8: Shared configuration system (blocked until 3.2-3.4 complete)

**Epic Complete When:**
- All 14 stories done (9 feature + 4 supporting + 1 tech debt)
- All weapon mechanics playtested and balanced
- Balance validated against weapon-balance-analysis.md findings
- Game is "shareable" quality (sprites, effects, clear UI)
- Zero TypeScript errors, zero ESLint warnings, zero Go vet issues
- >90% test coverage maintained across all new code

---

## Stories

### Story 3.1: Implement Weapon Pickup System

As a player,
I want to pick up weapons from map spawns,
So that I can gain tactical advantage.

**Acceptance Criteria:**

**Given** a weapon (Uzi) spawned at position {x: 500, y: 600}
**When** I move within 32 pixels of the weapon crate
**Then** weapon pickup automatically triggers (no key press required)

**And** client sends `weapon:pickup_attempt` message to server with crate ID
**And** server validates I'm in range and weapon crate is available
**And** server switches my weapon to Uzi (destroying current weapon)
**And** server marks weapon crate as unavailable and starts 30-second respawn timer
**And** server broadcasts `weapon:pickup_confirmed` to all players with pickup details
**And** weapon crate visual changes to "unavailable" state for all players
**And** my current weapon is destroyed (Pistol always destroyed, other weapons destroyed for MVP)

**And** weapon crate respawns at the same location after 30 seconds
**And** server broadcasts `weapon:respawned` to all players
**And** weapon crate visual changes back to "available" state with glow effect
**And** minimap shows weapon spawn locations and availability status

**Prerequisites:** Story 2.6, Story 3.0 (Weapon Balance Research), Story 3.3A (Weapon Acquisition System)

**Technical Notes:**
- Weapon crate data structure: `{id, type, position, isAvailable, respawnTime}`
- Server tracks weapon crate state: `{available: true/false, nextRespawn: timestamp}`
- Pickup detection: Auto-trigger when player within 32px radius (circular collision check)
- Weapon switch: Instant replacement (no animation delay for MVP)
- No weapon drops: Current weapon destroyed on pickup (no floor loot clutter)
- Fixed spawn points: 5 locations defined in GDD Section "Weapon Pickup System"
  - crate_1: (960, 200) - Uzi
  - crate_2: (400, 540) - AK47
  - crate_3: (1520, 540) - Shotgun
  - crate_4: (960, 880) - Katana
  - crate_5: (200, 200) - Bat
- Network messages:
  - `weapon:pickup_attempt` (Client -> Server): {crateId}
  - `weapon:pickup_confirmed` (Server -> All): {playerId, crateId, weaponType, nextRespawn}
  - `weapon:respawned` (Server -> All): {crateId, weaponType, position}
  - `weapon:spawned` (Server -> Client on join): Initial crate state sync
- Collision pattern: Reuse AABB system from projectile collision
- Visual states: Available (glowing), Unavailable (empty platform), Respawning (countdown timer)

---

### Story 3.2: Implement Melee Weapons (Bat and Katana)

As a player,
I want to use melee weapons for high-risk, high-reward close combat,
So that I can dominate at short range.

**Acceptance Criteria:**

**Given** I have a Bat equipped
**When** I click to attack
**Then** my stick figure swings the bat in a 90-degree arc in the aim direction

**And** any enemy within melee range (64 pixels) and within the swing arc takes 25 damage
**And** bat attacks at 0.5 second intervals (fast)
**And** hit enemies are knocked back slightly (40 pixels in hit direction)
**And** melee hit plays satisfying "thwack" sound with screen shake

**And** given I have a Katana equipped
**When** I click to attack
**Then** the katana slashes with 45 damage, 0.8 second cooldown, 80 pixel range

**And** katana has longer reach than bat but slower attack speed
**And** both weapons have no ammo (infinite uses)
**And** melee attacks require precise timing and positioning

**And** melee balance approach selected from options:
  - Option A: Implement as-is (Bat 25 dmg, Katana 45 dmg) and evaluate in playtesting
  - Option B: Apply recommended buffs (Bat 30 dmg = 60 DPS, Katana 50 dmg = 62.5 DPS)
  - Option C: Implement as-is but add TODO for post-Epic 3 balance pass

**And** decision rationale documented in session logs (why chosen, what trade-offs)

**Prerequisites:** Story 3.1

**Technical Notes:**
- Bat stats: {damage: 25, cooldown: 0.5s, range: 64px, arc: 90 deg, DPS: 50}
- Katana stats: {damage: 45, cooldown: 0.8s, range: 80px, arc: 90 deg, DPS: 56.25}
- Server hit detection: check enemies in cone-shaped area from player
- Knockback velocity: 200 px/s for 0.2 seconds
- Animation: 4-frame swing (0.2s duration)
- Melee priority: if multiple enemies in range, hit all (AoE)

**Balance Note:** Weapon balance research (docs/weapon-balance-analysis.md) shows melee weapons have the LOWEST DPS among all weapons (Bat: 50 DPS, Katana: 56.25 DPS vs AK47: 120 DPS). This contradicts the original "high-risk, high-reward" design philosophy. Consider implementing recommended stat buffs (Bat 25->30 damage = 60 DPS, Katana 45->50 damage = 62.5 DPS) or evaluate during playtesting. See weapon-balance-analysis.md Section 7 for detailed analysis.

---

### Story 3.3: Implement Ranged Weapons (Uzi, AK47, Shotgun)

As a player,
I want to use ranged weapons with distinct characteristics,
So that I can choose weapons matching my playstyle.

**Acceptance Criteria:**

**Given** I have an Uzi equipped
**When** I hold down mouse button
**Then** the Uzi fires in full-auto at 10 rounds/second

**And** each bullet does 8 damage with medium range (600px max)
**And** Uzi has 30-round magazine, 1.5 second reload
**And** recoil climbs upward (aim angle increases by 2 deg per shot, recovers over 0.5s)
**And** bullet spread increases while moving (+/-5 deg spread)

**And** given I have an AK47 equipped
**When** I click to fire
**Then** the AK47 fires semi-auto at 6 rounds/second (hold for continuous fire)

**And** each bullet does 20 damage with long range (800px max)
**And** AK47 has 30-round magazine, 2.0 second reload
**And** balanced recoil (horizontal + vertical, +/-3 deg pattern)
**And** accurate while stationary, spread while moving

**And** given I have a Shotgun equipped
**When** I click to fire
**Then** the shotgun fires 8 pellets in spread pattern

**And** each pellet does 7.5 damage (60 total if all hit) with short range (300px max)
**And** pellet spread: 15 deg cone from aim angle
**And** devastating at close range (all pellets hit), weak at distance (spread too wide)
**And** slow fire rate: 1 shot per second, 6-round magazine, 2.5 second reload

**Prerequisites:** Story 3.1

**Technical Notes:**
- Uzi: {damage: 8, fireRate: 10/s, mag: 30, reload: 1.5s, range: 600px, DPS: 80}
- AK47: {damage: 20, fireRate: 6/s, mag: 30, reload: 2.0s, range: 800px, DPS: 120}
- Shotgun: {damage: 60 total (8 pellets x 7.5), fireRate: 1/s, mag: 6, reload: 2.5s, range: 300px, DPS: 60}
- Shotgun pellet spread: each pellet angle offset by random +/-7.5 deg from aim
- Recoil patterns stored as `{x, y}` offset arrays per weapon
- Bullet drop-off: damage decreases linearly after 50% of max range
- Server validates fire rate (prevent macros/exploits)

**CRITICAL - Damage Falloff Formula** (applies to all ranged weapons):
```javascript
if (distance > maxRange * 0.5) {
  damageFalloff = 1.0 - ((distance - maxRange * 0.5) / (maxRange * 0.5))
  actualDamage = baseDamage * damageFalloff
} else {
  actualDamage = baseDamage
}
```
Damage decreases linearly after 50% of max range. At max range (100%), damage = 0. Example: AK47 at 400px = 20 dmg, 600px = 10 dmg, 800px = 0 dmg.

**Balance Warning:** Weapon balance research (docs/weapon-balance-analysis.md) shows AK47 is overpowered with highest DPS (120), longest range (800px), and largest magazine (30 rounds) with no clear weakness. The damage falloff system is the PRIMARY balance mechanism to prevent AK47 dominance. Monitor playtesting closely. If AK47 still dominates after falloff implementation, consider reducing fire rate from 6/s to 5/s (reduces DPS to 100). See weapon-balance-analysis.md Sections 6-7 for detailed analysis.

---

### Story 3.4: Implement Manual Reload Mechanic

As a player,
I want to manually reload my weapon,
So that I can choose optimal timing for vulnerability.

**Acceptance Criteria:**

**Given** my AK47 has 5 rounds remaining
**When** I press R key
**Then** reload animation starts (2.0 seconds for AK47)

**And** during reload, I cannot shoot (clicking does nothing)
**And** reload progress bar appears on HUD (fills over 2 seconds)
**And** reload can be canceled by switching weapons (lose progress)
**And** after reload completes, magazine refills to 30 rounds

**And** if I attempt to shoot with empty magazine, auto-reload starts
**And** empty magazine indicator: "RELOAD!" flashes on screen in red
**And** reload sound effect plays (unique per weapon)

**And** I can move, sprint, and dodge while reloading (not stunned)

**Prerequisites:** Story 3.3

**Technical Notes:**
- Reload time per weapon: Uzi (1.5s), AK47 (2.0s), Shotgun (2.5s)
- Server tracks reload state: `{isReloading: bool, reloadStartTime: timestamp}`
- Reload progress: `(now - reloadStartTime) / reloadDuration`
- Cancel reload: switch weapon or pickup new weapon
- Auto-reload trigger: attempt to shoot with `ammo === 0`
- Animation: character lowers weapon, reload gesture, raises weapon
- UI: circular reload indicator around crosshair

---

### Story 3.5: Implement Sprint Mechanic

As a player,
I want to sprint for faster movement,
So that I can reposition quickly or retreat from danger.

**Acceptance Criteria:**

**Given** I am moving with WASD keys
**When** I hold Shift key
**Then** my movement speed increases from 200 px/s to 300 px/s (1.5x multiplier)

**And** sprint has no stamina limit (can sprint indefinitely)
**And** sprinting applies accuracy penalty (bullet spread increases by 50%)
**And** sprinting makes louder footstep sounds (audio cue for enemies)
**And** visual indicator: subtle motion blur or speed lines

**And** sprinting does not prevent shooting, reloading, or aiming
**And** releasing Shift returns to normal movement speed instantly

**Prerequisites:** Story 3.4

**Technical Notes:**
- Sprint speed: 300 px/s (vs normal 200 px/s)
- Accuracy penalty: multiply bullet spread by 1.5 when `isSprinting === true`
- Server validates sprint input (cannot sprint + move slower, prevents speed hacks)
- Footstep volume: +30% louder while sprinting
- Visual effect: camera FOV increases slightly (zoom out effect)
- No stamina system for MVP (infinite sprint, simple mechanic)

---

### Story 3.6: Implement Dodge Roll with Invincibility Frames

As a player,
I want to dodge roll to evade attacks,
So that I can outplay opponents with skillful timing.

**Acceptance Criteria:**

**Given** I am in combat
**When** I press Space bar
**Then** my stick figure performs a roll in the current movement direction (or forward if stationary)

**And** roll duration: 0.4 seconds, covers 100 pixels
**And** during first 0.2 seconds: invincibility frames (cannot take damage)
**And** during last 0.2 seconds: vulnerable to damage
**And** dodge cooldown: 3 seconds (cannot roll again for 3s)

**And** visual indicator: character sprite rolls with transparency effect during i-frames
**And** cooldown UI: circular timer shows when dodge is available again
**And** dodge sound effect: quick "whoosh"

**And** cannot shoot, reload, or switch weapons during roll
**And** roll direction: based on WASD keys pressed (or aim direction if no keys pressed)

**Prerequisites:** Story 3.5

**Technical Notes:**
- Roll stats: {duration: 0.4s, distance: 100px, iframes: 0.2s, cooldown: 3s}
- Server tracks roll state: `{isRolling: bool, rollStartTime, lastRollTime}`
- Invincibility check: `if (isRolling && now - rollStartTime < 200) { return; }`
- Roll velocity: 250 px/s for 0.4 seconds
- Animation: 6-frame roll animation, sprite rotates 360 deg
- Cooldown enforcement: client shows UI, server validates (prevent spam)
- Roll cancels: stopped if hitting wall/obstacle

---

### Story 3.7A: Character & Weapon Sprites

As a player,
I want visually distinct characters and weapons,
So that the game looks presentable and weapons are easily identifiable.

**Acceptance Criteria:**

**Given** I am playing the game after completing weapon mechanics
**When** I look at my character and weapons
**Then** I see proper stick figure sprites (not primitive shapes)

**And** stick figure character has:
- Simple but clean 16x32 pixel sprite (head, body, limbs clearly visible)
- 4-frame walk animation (8-12 FPS, cycles smoothly)
- Distinct idle pose vs moving pose
- Color customization working (black default, other colors unlocked)

**And** all 5 weapons have unique sprites:
- Pistol: small handgun shape, 8x8 pixels, silver/gray
- Bat: wooden bat, 16x4 pixels, brown
- Katana: sleek blade, 20x4 pixels, silver with black handle
- Uzi: compact SMG shape, 12x8 pixels, black/gray
- AK47: rifle shape, 20x8 pixels, wood/metal colors
- Shotgun: pump-action shape, 18x8 pixels, dark gray/brown

**And** weapons rotate correctly with aim angle (anchor point at handle)
**And** weapons visible when held by other players (rendered at player position + aim angle)

**Prerequisites:** Story 3.6

**Technical Notes:**
- **Art Sourcing:** Use free assets from Kenney.nl (Micro Roguelike, Top-Down Shooter packs) or create simple pixel art (16x16 or smaller)
- **Client assets:** `public/assets/sprites/character.png`, `weapons/*.png`
- **Phaser sprite loading:** `this.load.spritesheet('player', 'assets/sprites/character.png', {frameWidth: 16, frameHeight: 32})`
- **Animation config:** `this.anims.create({key: 'walk', frames: this.anims.generateFrameNumbers('player', {start: 0, end: 3}), frameRate: 10, repeat: -1})`
- **Weapon rendering:** `this.add.sprite(x, y, 'weapon_pistol').setRotation(aimAngle)`
- **Quality:** Sprites readable at 1920x1080, weapons visually distinct, <500KB total
- **Tests:** Mock sprite paths, verify rendering methods called, >90% coverage
- **Estimated Effort:** 1 day (asset sourcing + integration + testing)

---

### Story 3.7B: Health Bars & Hit Effects

As a player,
I want clear visual feedback during combat,
So that I can track health and understand hit registration.

**Acceptance Criteria:**

**Given** I am in combat with other players
**When** damage is dealt or health changes
**Then** I see clear visual feedback

**And** health bar UI visible above each player:
- Green bar (health), gray background, 32x4 pixels
- Updates in real-time as health changes
- Positioned 8 pixels above player head
- Scales proportionally from 0-100 HP

**And** basic hit effects (minimal, not full particle systems):
- Bullet impact: small yellow flash sprite (4x4 pixels, fades in 0.1s)
- Melee hit: white impact lines (simple graphic, not particles)
- Muzzle flash: small orange/yellow flash at gun barrel (fades in 0.1s)

**And** all effects are performant (60 FPS maintained with 8 players fighting)

**Prerequisites:** Story 3.7A

**Technical Notes:**
- **Health bar:** Phaser Graphics object, rectangle drawn above player each frame
- **Hit effects:** Simple sprites with tween alpha fade
- **Implementation:** `this.add.sprite(x, y, 'impact_flash').setAlpha(1).tween({alpha: 0, duration: 100, onComplete: destroy})`
- **Performance:** Effects pooled/reused (not created/destroyed per hit)
- **Quality:** 60 FPS maintained with 8 players fighting, health bars clearly visible
- **Tests:** Browser acceptance tests for visibility and performance, >90% coverage
- **Estimated Effort:** 1 day (UI polish + feedback systems + testing)

**Scope Boundaries (Both Stories):**
- NO particle systems (deferred to Story 9.1)
- NO advanced animations (idle breathing, run cycles, death animations, ragdolls - deferred to Story 9.1)
- NO screen shake or camera effects (deferred to Story 9.1)
- YES basic sprites that make the game shareable and clear
- YES health bars and minimal hit feedback

**Why Split Into 3.7A and 3.7B:**
- Smaller stories improve agent success rate (learned from Epic 2.6/2.7 splits)
- Story 3.7A focuses on asset integration (1 day)
- Story 3.7B focuses on UI systems (1 day)
- Combined: 2 days total, more manageable than single 2-day story

**Why After Epic 3 Weapon Mechanics:**
- All 5 weapons implemented (can do all weapon art at once)
- Combat mechanics proven (won't waste art on cut features)
- Makes game shareable for early playtesting feedback
- Motivational boost before tackling Epic 4's technical netcode work
