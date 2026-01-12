# Epic 8: Mobile Cross-Platform Play

**Goal:** Mobile players compete fairly against desktop players

**Value Delivered:** Touch controls with aim assist, cross-platform compatibility

**FRs Covered:** FR17 (cross-platform browser access)

**Status:** Not Started (0/5 stories)

---

## Stories

### Story 8.1: Implement Virtual Joystick Controls for Touch

As a mobile player,
I want intuitive touch controls,
So that I can play comfortably on my phone or tablet.

**Acceptance Criteria:**

**Given** I open the game on a mobile device
**When** the game detects touch input
**Then** two virtual joysticks appear: left (movement) and right (aim)

**And** left joystick: drag to move in any direction, distance from center = movement speed
**And** right joystick: drag to aim, auto-fires when aimed at enemies
**And** joysticks are semi-transparent, positioned in bottom corners

**And** alternative control scheme: tap to move to location (optional setting)
**And** buttons for reload, dodge, weapon switch (right side of screen)
**And** joysticks persist during match, hidden in menus

**Prerequisites:** Story 7.5

**Technical Notes:**
- Virtual joystick library: `nipplejs` or Phaser's built-in virtual joystick plugin
- Left joystick: position (100, 900), radius 80px
- Right joystick: position (1820, 900), radius 80px
- Movement input: `{x: joystick.force * cos(joystick.angle), y: joystick.force * sin(joystick.angle)}`
- Auto-fire: when aiming joystick active + enemy in crosshair, trigger shoot
- UI buttons: reload (right side, top), dodge (right side, middle), weapon switch (right side, bottom)

---

### Story 8.2: Implement Mobile Aim Assist

As a mobile player,
I want aim assistance,
So that I can compete fairly with desktop mouse users.

**Acceptance Criteria:**

**Given** I am aiming with touch controls
**When** my crosshair is near an enemy (within 50 pixels)
**Then** aim is subtly magnetized toward enemy center (slowdown + attraction)

**And** aim assist strength: low (doesn't feel like aimbot, enhances natural aim)
**And** aim slowdown: when aiming over enemy, sensitivity reduces by 30%
**And** aim attraction: crosshair pulled toward enemy at 20% of distance per frame

**And** aim assist only active for mobile touch input (not desktop)
**And** setting to adjust aim assist strength: Off / Low / Medium / High
**And** aim assist doesn't work through walls (only visible enemies)

**Prerequisites:** Story 8.1

**Technical Notes:**
- Detection: `if (platform === 'mobile' && aimAssistEnabled)`
- Slowdown: `sensitivity *= 0.7` when crosshair within 50px of enemy
- Attraction: `aimAngle += (angleToEnemy - aimAngle) * 0.2` (smooth lerp)
- Visibility check: raycast from player to enemy, if wall hit, disable assist
- Settings: `aimAssistStrength` multiplier (0 = off, 0.5 = low, 1.0 = medium, 1.5 = high)
- Balance: tune in playtesting, goal is parity not advantage

---

### Story 8.3: Optimize Mobile Performance and Battery Usage

As a mobile player,
I want smooth 60 FPS gameplay without draining my battery,
So that I can play for extended sessions.

**Acceptance Criteria:**

**Given** I play on a mid-range mobile device (e.g., iPhone 12, Samsung S21)
**When** the game runs
**Then** I achieve 60 FPS in matches with 8 players

**And** battery consumption: 2+ hours of gameplay per full charge
**And** game auto-detects device capability and adjusts graphics quality
**And** mobile optimizations:
- Reduced particle effects (fewer particles, shorter lifetime)
- Lower texture resolution (half-res sprites)
- Simplified lighting (no dynamic shadows)
- Reduced network update frequency (15 Hz instead of 20 Hz)

**And** manual quality settings: Low / Medium / High / Auto (in settings menu)

**Prerequisites:** Story 8.2

**Technical Notes:**
- Device detection: `navigator.userAgent`, screen size, WebGL capabilities
- Auto-quality: benchmark FPS for 10 seconds, adjust down if <50 FPS
- Particle reduction: max 20 particles instead of 100
- Texture resolution: load mobile-specific assets at 50% resolution
- Network: mobile clients receive 15 Hz updates (vs 20 Hz desktop)
- Battery: use `requestAnimationFrame` with adaptive frame skipping if battery low
- Settings: dropdown menu for quality preset

---

### Story 8.4: Implement Responsive UI for Mobile Screens

As a mobile player,
I want a UI that fits my screen,
So that all information is readable and accessible.

**Acceptance Criteria:**

**Given** I play on a mobile device with 414x896 resolution (iPhone)
**When** the UI renders
**Then** all elements scale appropriately (no tiny text or buttons)

**And** HUD elements repositioned:
- Health bar: larger, bottom-left corner
- Ammo counter: larger, bottom-right corner
- Minimap: smaller or hidden (toggle with button)
- Kill feed: shorter, shows only last 3 kills
- Scoreboard: fullscreen overlay (not inline)

**And** touch targets: minimum 44x44 pixels (iOS guideline)
**And** font sizes: minimum 14px (readable on small screens)
**And** portrait mode: disabled, landscape-only (show "Rotate device" message)

**Prerequisites:** Story 8.3

**Technical Notes:**
- Responsive design: use CSS media queries or Phaser responsive scaling
- Phaser scale config: `{mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH}`
- Touch target size: all buttons at least 44x44 px
- HUD scaling: multiply sizes by `isMobile ? 1.5 : 1.0`
- Portrait check: `if (window.innerHeight > window.innerWidth) { showRotateMessage() }`
- React components: use responsive breakpoints (styled-components or TailwindCSS)

---

### Story 8.5: Implement iOS Safari Specific Workarounds

As a mobile player on iOS,
I want the game to work reliably on Safari,
So that I can play without technical issues.

**Acceptance Criteria:**

**Given** I play on iOS Safari
**When** the game loads
**Then** audio autoplay policy is handled (requires user interaction)

**And** audio starts after first tap anywhere on screen
**And** fullscreen mode works (press fullscreen button, Safari enters fullscreen)
**And** WebSocket connection remains stable during tab switching
**And** memory management: no crashes after 30 minutes of play

**And** iOS quirks handled:
- Audio context must be resumed on user gesture
- Canvas doesn't overflow viewport (no scroll)
- Touch events don't trigger zoom or scroll
- Home indicator hidden in fullscreen

**Prerequisites:** Story 8.4

**Technical Notes:**
- Audio: create AudioContext after first touch event `document.addEventListener('touchstart', () => audioContext.resume(), {once: true})`
- Fullscreen: use `document.documentElement.requestFullscreen()` on button press
- Viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">`
- Touch events: `{passive: false, capture: true}` to prevent default scroll
- Memory: limit texture cache size, unload unused assets
- Home indicator: CSS `env(safe-area-inset-bottom)` for padding
