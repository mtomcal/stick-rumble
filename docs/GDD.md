# Stick Rumble - Game Design Document

**Author:** BMad
**Game Type:** Multiplayer Arena Shooter
**Target Platform(s):** Web Browser (Desktop + Mobile)
**Date:** 2025-11-25
**Version:** 1.0

---

## Executive Summary

### Core Concept

**Stick Rumble** is a fast-paced multiplayer stick figure arena shooter that brings beloved Flash-era gameplay into the modern browser. Built for 2-8 player competitive matches lasting 3-7 minutes, it delivers instant-play accessibility with deep skill-based combat.

Players jump in from any device (desktop or mobile) with zero downloads, experiencing smooth 60 FPS action powered by cutting-edge web technology (Phaser 3 frontend, Golang backend). The game captures the pure joy of Flash classics like Stick Arena while delivering the competitive depth and polish expected from contemporary multiplayer titles.

**Core Promise:** Anyone can jump in and have fun within seconds, but mastery takes genuine skill. Simple aesthetics meet complex gameplay for pure, addictive competition.

### Target Audience

**Primary Audience:**
- **Age:** 16-35 years old
- **Platform:** Desktop and mobile web browser users
- **Gaming Experience:** Casual to mid-core gamers
- **Behavioral Profile:** Nostalgic for Flash-era gaming (Stick Arena, classic stick figure games), prefer quick 5-15 minute sessions, enjoy competitive multiplayer with low commitment, value instant browser accessibility

**Secondary Audiences:**
- **Streamers & Content Creators:** Looking for quick, entertaining content and skill showcases
- **Mobile Gamers:** Playing during commutes, want console-quality without app downloads
- **Esports Enthusiasts:** Interested in competitive ladders, skill-based ranking, fair anti-cheat gameplay

**Gaming Preferences:**
- Fast-paced action over slow tactical gameplay
- Skill-based competition with fair matchmaking
- Simple controls but high skill ceiling
- Cross-platform play (desktop ↔ mobile seamlessly)
- Social elements (friends, leaderboards, community)

### Unique Selling Points (USPs)

1. **Modern Tech, Nostalgic Feel** - Captures Flash-era stick figure combat nostalgia with 2025 web technology for smooth 60 FPS performance

2. **Fair, Server-Authoritative Gameplay** - No client-side cheating possible; server validates everything with client-side prediction masking latency

3. **Zero Friction Access** - No download, no install, URL → game in under 60 seconds; cross-platform with shared progression

4. **Polished Core Over Feature Bloat** - Every mechanic refined to feel perfect (tight controls, satisfying feedback); simple systems executed excellently

5. **Community-First Development** - Solo indie developer building in public, community feedback shapes priorities, fair monetization (cosmetics only)

---

## Goals and Context

### Project Goals

**MVP Goals (Emergency Sprint - Thursday Deadline):**
1. Prove core multiplayer loop works - functional 2-player combat with basic shooting mechanics
2. Validate technical architecture - Phaser + Golang stack performing as researched
3. Demonstrate gameplay feel translates to networked environment

**Full MVP Goals (Post-Thursday):**
1. Reach 1,000 players in month one
2. Sustain 50+ concurrent players for reliable matchmaking
3. Build engaged Discord community around the game
4. Achieve break-even on infrastructure costs

**Long-Term Vision:**
1. Reach 10,000+ active players
2. Establish thriving competitive scene with community tournaments
3. Prove browser games can have competitive depth and polish
4. Create sustainable multiplayer game with fair monetization

### Background and Rationale

**Why This Game, Why Now:**

Flash's death in 2020 left a void for stick figure combat games that had millions of players. Modern web technology (HTML5/WebGL, WebSocket) now enables browser games with quality matching native apps.

**Market Validation:**
- .io games proved massive demand for instant-play multiplayer (Agar.io: 100M+ players, Slither.io: huge success)
- Krunker.io demonstrates browser FPS games can have competitive depth
- Nostalgia for 2000s-2010s gaming aesthetics is strong
- Mobile gaming dominant but oversaturated with predatory monetization

**Technical Readiness:**
- Comprehensive technical research complete (Phaser + Golang architecture)
- Working single-player prototype validates core gameplay feel
- Solo developer has full-stack expertise to execute
- Modern game engines (Phaser 3) make browser game dev feasible

**Gap in Market:**
- No dominant stick figure shooter post-Flash (Stick Arena had millions, no true successor)
- Quality browser shooters rare (most .io games feel disposable)
- Mobile players want fair competition (not pay-to-win, not ad-spam)

**Project Philosophy:**
- Hobby project driven by passion over profit
- Build in public with transparent development
- Quality where it matters - polish core gameplay, pragmatic on features
- Sustainable pace to avoid burnout

---

## Core Gameplay

### Game Pillars

**1. Instant Mastery, Lifetime Skill Growth**
- Controls learnable in 30 seconds (WASD + mouse aim + click to shoot)
- Deep skill expression through movement, aim, positioning, weapon switching
- High skill ceiling rewards dedication without gating basic enjoyment

**2. Responsive, Fair Combat**
- 60 FPS client performance, <100ms network latency target
- Server-authoritative hit detection (no client-side cheating)
- Client-side prediction makes actions feel instant despite network
- Every death feels fair - you know exactly why you lost

**3. Quick Session, High Replayability**
- Matches last 3-7 minutes (perfect for quick play)
- Fast matchmaking (<30 seconds to get in game)
- Addictive "one more match" loop through varied modes and progression
- Minimal friction - from main menu to combat in under 60 seconds

**4. Accessible Anywhere**
- Zero download required - instant play in browser
- Seamless cross-platform (desktop keyboard/mouse, mobile touch)
- Performance optimized for mid-range devices
- Consistent experience across platforms (mobile isn't handicapped)

### Core Gameplay Loop

**Match Flow (3-7 minutes):**
1. **Queue** → Matchmaking finds 2-8 players with similar skill (< 30 seconds)
2. **Lobby** → Players ready up, 30-second preparation phase
3. **Spawn** → Players enter arena at balanced spawn points
4. **Combat** → Fight for kills using movement, aim, weapon control, positioning
5. **Weapon Control** → Strategic weapon pickups spawn on map (control = advantage)
6. **Tactical Play** → Health regen after delay encourages disengagement/re-engagement
7. **Score/Win** → First to kill target or highest score when time expires
8. **Results** → XP earned, progression tracked, "Play Again" for instant re-queue

**Moment-to-Moment Loop:**
- Move → Spot enemy → Aim → Shoot → Hit feedback → Kill or retreat
- Take damage → Find cover → Health regenerates → Re-engage
- Weapon empty → Reload (tactical timing) → Switch weapons or find pickup
- Control weapon spawns → Gain advantage → Dominate positioning

**Emotional Arc:**
- Empowerment ("I feel like a badass" - smooth controls, satisfying kills)
- Flow state (total engagement, time flies by)
- Competitive drive ("I can win if I play better" - fair matches motivate improvement)
- Social connection (playing with friends, sharing highlights)
- Progression satisfaction (unlocking cosmetics, climbing ranks, mastering weapons)

### Win/Loss Conditions

**Free-For-All Deathmatch:**
- **Win:** First player to reach kill target (e.g., 20 kills) OR highest kills when time expires
- **Loss:** Eliminated most often or lowest score at time limit

**Team Deathmatch:**
- **Win:** Team reaches kill target first OR highest team score at time expiry
- **Loss:** Team score below opponents at match end

**Future Modes (Post-MVP):**
- **Capture the Flag:** Capture enemy flag and return to base (first to 3 captures)
- **King of the Hill:** Control zone longest (most time = win)
- **Last Stand:** Battle royale style - last player/team alive wins

**Match Duration:** 3-7 minutes typical, adjustable per mode

---

## Game Mechanics

### Primary Mechanics

**Movement System:**
- **Top-down WASD/joystick movement** - Omnidirectional with smooth acceleration
- **Sprint mechanic** (Shift/button) - Faster movement but increased visibility/noise
- **Roll/dodge** - Cooldown-based defensive maneuver with invincibility frames (i-frames)
- **Movement momentum** - Not instant start/stop; requires skill for precise positioning
- **No jumping** - Pure 2D top-down plane

**Combat System:**
- **Mouse/touch aim** - 360-degree aiming freedom
- **Click/tap to fire** - Weapon-specific fire rates, damage, range
- **Hit feedback** - Damage numbers, screen shake, sound effects, bullet tracers
- **Health regeneration** - After delay (encourages tactical disengagement)
- **Reload mechanic** - Manual reload (R key) with tactical timing importance

**Weapon System:**
- **Weapon pickups** - Spawn at fixed map locations, controlling spawns is strategic
- **Limited ammo** - Manual reload required, ammo management tactical
- **Weapon diversity** - Melee (Bat, Katana) and Ranged (Uzi, AK47, Shotgun)
- **Weapon switching** - Instant switch to picked-up weapon, no inventory scrolling

**HUD & Feedback:**
- **Health bar** - Top or corner display
- **Ammo counter** - With reload indicator
- **Minimap** - Shows player/enemy positions (fog of war TBD)
- **Kill feed** - Recent kills displayed
- **Score display** - Current match standings
- **Damage direction indicators** - Visual cues for incoming damage direction

### Controls and Input

**Desktop (Keyboard + Mouse):**
- **WASD** - Movement (omnidirectional)
- **Mouse** - Aim (360-degree)
- **Left Click** - Fire weapon
- **R** - Reload
- **Shift** - Sprint
- **Space** - Roll/dodge
- **Tab** - Scoreboard
- **Enter** - Chat

**Mobile (Touch):**
- **Left virtual joystick** - Movement
- **Right virtual joystick** - Aim direction
- **Auto-fire** - Shoots when aiming at enemies (or tap to fire button)
- **Reload button** - Manual reload
- **Sprint toggle** - Persistent sprint mode
- **Dodge button** - Roll/dodge

**Controller Support (Future):**
- **Left stick** - Movement
- **Right stick** - Aim
- **Right trigger** - Fire
- **Face buttons** - Reload, dodge, interact
- **Bumpers** - Weapon switch (if multi-weapon inventory added)

**Input Responsiveness:**
- **Target:** <50ms from input to visual feedback (client-side prediction)
- **Network:** <100ms round-trip to server (masked by prediction)
- **Mobile aim assist:** Subtle assistance to balance mobile vs desktop (tuned in testing)

---

## Shooter Specific Elements

### Weapon Systems

**Melee Weapons:**

| Weapon | Damage | Attack Speed | Range | Special |
|--------|---------|--------------|-------|---------|
| **Bat** | 25 | Fast (0.5s) | Short | High DPS close range |
| **Katana** | 45 | Slow (0.8s) | Medium | Higher damage, longer reach |

**Ranged Weapons:**

| Weapon | Damage/Shot | Fire Rate | Range | Ammo | Reload Time | Special |
|--------|-------------|-----------|-------|------|-------------|---------|
| **Uzi** | 8 | Very High (10/s) | Medium | 30 | 1.5s | Spray and pray, high DPS |
| **AK47** | 20 | Medium (6/s) | Long | 30 | 2.0s | Balanced all-rounder |
| **Shotgun** | 60 (total) | Slow (1/s) | Short | 6 | 2.5s | Burst damage, close range devastating |

**Future Weapons (Post-MVP):**
- **Sniper Rifle** - High damage, slow fire rate, long range, scope zoom
- **Grenade Launcher** - Area damage, arc trajectory, limited ammo
- **Rocket Launcher** - Explosive damage, splash radius, very limited ammo

**Weapon Pickup System:**

**Acquisition Model: Fixed Weapon Crates (Arena Shooter Style)**

The weapon acquisition system follows classic arena shooter design (Quake, Halo, Stick Arena) with fixed weapon spawn locations that become strategic control objectives.

**Core Mechanics:**
- **Fixed spawn locations** - 3-5 predetermined positions per map, each spawns a specific weapon type
- **Auto-pickup on contact** - Players automatically pick up weapons when within 32px radius
- **Instant weapon switch** - Picked-up weapon immediately replaces current weapon
- **30-second respawn timer** - After pickup, weapon crate becomes inactive and respawns 30 seconds later
- **Default spawn weapon** - All players spawn with Pistol (balanced starter weapon)
- **No weapon drops** - Current weapon is destroyed on pickup (Pistol always destroyed, other weapons destroyed for MVP simplicity)
- **No inventory system** - Players carry one weapon at a time, no weapon scrolling

**Default Arena Spawn Configuration (1920x1080 map):**

| Spawn ID | Position (x, y) | Weapon Type | Strategic Location |
|----------|-----------------|-------------|-------------------|
| crate_1  | (960, 200)      | Uzi         | Top center (high-traffic area) |
| crate_2  | (400, 540)      | AK47        | Left middle (power position) |
| crate_3  | (1520, 540)     | Shotgun     | Right middle (close-quarters zone) |
| crate_4  | (960, 880)      | Katana      | Bottom center (melee control point) |
| crate_5  | (200, 200)      | Bat         | Top-left corner (flanking route) |

**Strategic Design:**
- **Map control** - Controlling weapon spawn points provides tactical advantage
- **Predictable locations** - Players learn spawn positions, creating skill-based gameplay (no RNG frustration)
- **Weapon diversity** - Spawn positions aligned with weapon playstyle (Shotgun near tight corridors, AK47 in open areas)
- **Fight for control** - Best weapons in contested areas, creating engagement hotspots
- **No loadout selection** - Prevents AK47 dominance (everyone would pick best weapon)
- **No random spawns** - Avoids battle royale RNG frustration from bad weapon spawns
- **No kill rewards** - Prevents snowball effect (rich get richer)

**Visual Feedback:**
- **Available crate** - Weapon sprite with pulsing glow effect (color-coded by weapon type)
- **Respawning crate** - Empty crate platform with countdown timer indicator
- **Minimap indicators** - Show weapon spawn locations and availability status

**Server-Authoritative Implementation:**
- Server owns all weapon crate state (available/unavailable, respawn timers)
- Server validates pickup attempts (distance check, availability check)
- Server broadcasts pickup events to all players for UI updates
- Client renders visual representation based on server state

**Balance Philosophy:**
- All weapons viable in situational contexts (no strict "best weapon")
- Risk/reward: Shotgun devastating but requires close approach
- Skill expression: Uzi high DPS but requires tracking aim, Katana requires positioning
- Map design supports different weapon playstyles (open areas favor ranged, tight corridors favor melee)

### Aiming and Combat Mechanics

**Aiming System:**
- **Top-down twin-stick style** - Separate movement and aim directions
- **360-degree free aim** - No aim snap or lock-on (pure skill-based)
- **Mouse:** Direct cursor aim (most precise)
- **Touch:** Virtual joystick direction (with optional aim assist)

**Hit Detection:**
- **Projectile-based** - Bullets travel across map (not instant hitscan)
- **Server-authoritative** - Server validates all hits (prevents cheating)
- **Client-side prediction** - Client shows hits immediately, server confirms/corrects
- **Bullet speed** - Fast but visible (allows dodging at range)

**Accuracy Mechanics:**
- **Movement penalty** - Sprinting reduces accuracy (spread increases)
- **Recoil patterns** - Each weapon has unique recoil (Uzi climbs, AK47 kicks)
- **No spread while stationary** - Rewards good positioning
- **Critical hits:** None (pure damage model keeps it simple)

**Combat Feedback:**
- **Hit markers** - Visual + audio confirmation on landing shots
- **Damage numbers** - Floating text shows damage dealt
- **Kill confirmation** - Distinct sound + visual effect
- **Screen shake** - On taking damage
- **Bullet tracers** - Visible projectile paths
- **Impact effects** - Sparks, blood splatter at hit location

### Enemy Design and AI

**PvE Modes (Future Consideration):**

While Stick Rumble is primarily PvP multiplayer, AI bots can serve multiple purposes:

**Bot Uses:**
- **Training mode** - Practice against AI before facing real players
- **Empty lobbies** - Fill matches when player count low
- **Spectator fill** - Keep match active if player disconnects

**AI Difficulty Tiers:**

| Tier | Behavior | Use Case |
|------|----------|----------|
| **Easy** | Predictable movement, poor aim, slow reaction | Tutorial/warm-up |
| **Medium** | Basic tactics, decent aim, human-like mistakes | Fill empty matches |
| **Hard** | Advanced positioning, good aim, uses cover | Practice for skilled players |

**AI Behavior Patterns:**
- **Aggressive:** Pushes forward, seeks combat actively
- **Defensive:** Holds positions, uses cover
- **Flanking:** Attempts to circle around player
- **Weapon preference:** Chooses weapons matching playstyle

**AI Telegraphing:**
- Distinct visual indicator (different color or tag) to show it's a bot
- Never deceptive - players always know when fighting AI vs human

**Priority:** Low for MVP - focus on PvP multiplayer first, add AI later if needed for matchmaking fill.

### Arena and Level Design

**Map Philosophy:**
- **Competitive fairness** - Symmetrical or balanced spawns
- **Strategic depth** - Multiple paths, weapon control objectives
- **Engagement variety** - Mix of close-quarters and open sightlines
- **Readable layouts** - Clear visual language, no confusing geometry

**Arena Flow:**
- **Spawn points** - Multiple balanced locations, spawn invincibility (2 seconds)
- **Choke points** - Narrow passages force encounters
- **Open spaces** - Favor ranged weapons, allow flanking
- **Verticality** - Platforms/ramps add movement depth
- **Cover elements** - Static cover doesn't obstruct excessively
- **Weapon spawns** - 3-5 per map, strategic control objectives

**Map Size:**
- **2-4 players:** Small arena (~30 seconds to traverse)
- **5-8 players:** Medium arena (~45 seconds to traverse)
- **Scale for player count** - Density of encounters balanced per map

**Environment Themes (MVP: 2-3 maps):**

1. **Industrial Arena** - Shipping containers, metal platforms, stark lighting
   - Tight corridors + open center area
   - Vertical platforms for height advantage

2. **Urban Rooftops** - City buildings, alleyways, neon signs
   - Multi-level design with drop-downs
   - Mid-range engagements favored

3. **Digital Grid** (Future) - Tron-like aesthetic, abstract geometry
   - Minimalist, pure competitive focus
   - Symmetric layout

**Map Design Checklist:**
- Balanced spawn points (no spawn camping)
- Multiple weapon pickup locations
- Cover that enables tactical play without camping
- Clear sightlines for ranged combat
- Tight spaces for melee viability
- No dead-end trap zones
- Readable from minimap view

### Multiplayer Considerations

**Game Modes (MVP):**

**Free-For-All Deathmatch:**
- 2-8 players, everyone vs everyone
- First to 20 kills OR highest score at 7 minutes
- Respawn after 3 seconds
- Full XP/progression earned

**Team Deathmatch:**
- 2v2, 3v3, or 4v4
- First team to 30 kills OR highest team score at 7 minutes
- Respawn after 3 seconds
- Team colors (red vs blue stick figures)

**Game Modes (Post-MVP):**
- **Capture the Flag** - Classic objective mode
- **King of the Hill** - Control zone for points
- **Last Stand** - Battle royale style, one life
- **Gun Game** - Progress through all weapons
- **Custom Modes** - Community-created rules

**Loadout System:**
- **MVP:** No loadout - everyone spawns with default weapon
- **Post-MVP:** Choose starting weapon (unlocked through progression)
- **No pay-to-win** - All weapons balanced, no stat advantages for paying players

**Matchmaking & Ranking:**
- **Skill-based matchmaking** - Hidden MMR (Elo-style)
- **Quick play** - Instant casual matches
- **Ranked mode** (Post-MVP) - Visible rank tiers (Bronze → Diamond)
- **Region-based** - Prioritize low latency (NA, EU, Asia)
- **Party system** (Future) - Queue with friends

**Balance Considerations:**
- **Skill ceiling** - No artificial limits, high mastery potential
- **Counter-play** - Every strategy has counter (shotgun → maintain distance, etc.)
- **Weapon variety** - All weapons viable in different situations
- **Map balance** - No dominant positions (spawns rotate)
- **Input parity** - Mobile touch competitive with desktop mouse (aim assist tuning)

**Anti-Cheat:**
- Server-authoritative validation (all actions verified)
- Input sanity checks (impossible speed/aim flagged)
- Rate limiting on actions (prevent macro exploits)
- Player reporting system (manual review for blatant cases)

---

## Progression and Balance

### Player Progression

**XP & Leveling System:**
- **XP Sources:**
  - Per kill: 100 XP
  - Match completion: 50 XP
  - Win bonus: +100 XP
  - Performance bonus: +50 XP for top 3

- **Level Progression:**
  - Levels 1-15: MVP progression
  - XP required scales per level (100, 200, 300, etc.)
  - Level cap: 50 (post-MVP), expandable with content updates

**Unlockables (Cosmetic Only):**
- **Character Customization:**
  - Stick figure colors
  - Accessories (hats, glasses, capes)
  - Emotes (victory poses, taunts)

- **Weapon Skins:**
  - Visual variants (no stat changes)
  - Unlock through leveling or achievements

- **Kill Effects:**
  - Custom death animations
  - Particle effects on elimination

**Ranked Progression (Post-MVP):**
- **Rank Tiers:** Bronze → Silver → Gold → Platinum → Diamond → Master
- **Promotion:** Win matches to rank up
- **Demotion:** Lose matches to rank down
- **Seasonal Resets:** Every 3 months with rewards

**Skill-Based Progression:**
- **True progression** = player skill improvement
- **Weapon mastery** - Learn recoil patterns, optimal ranges
- **Map knowledge** - Spawn timings, best positions
- **Movement tech** - Advanced dodge cancels, strafe patterns

### Difficulty Curve

**New Player Experience:**
- **Tutorial (Optional):** 2-minute interactive guide
  - Movement basics
  - Shooting and reloading
  - Weapon pickups
  - Win conditions

- **First Matches:** Matched against other new players (MMR-based)
- **Onboarding:** Tooltips for first 3 matches
- **Bot practice:** Available for risk-free learning

**Skill Progression Path:**

| Phase | Player Capability | Time Investment |
|-------|------------------|----------------|
| **Beginner** | Understand controls, hit some shots | First hour |
| **Novice** | Consistent aiming, basic positioning | 5-10 hours |
| **Intermediate** | Weapon switching, map knowledge | 20-40 hours |
| **Advanced** | Movement mastery, prediction | 50-100 hours |
| **Expert** | Perfect mechanics, meta understanding | 100+ hours |

**Difficulty Scaling:**
- **Matchmaking:** Hidden MMR ensures fair matches (±100 MMR range)
- **No artificial difficulty** - Challenge comes from opponent skill
- **Ranked tiers** - Visual representation of skill bracket
- **Spectator learning** - Watch better players after elimination

**Accessibility Options (Future):**
- **Colorblind modes** - Team color adjustments
- **UI scaling** - Larger HUD elements
- **Audio cues** - Enhanced sound for hit feedback
- **Aim assist strength** - Adjustable for mobile (default balanced)

### Economy and Resources

**In-Match Economy:** None (MVP)
- All weapons available via map pickups
- No currency or purchasing during matches
- Pure skill-based gameplay

**Post-Match Rewards:**
- XP for progression
- (Future) Currency for cosmetic shop purchases

**Monetization (Post-MVP):**
- **Cosmetic Microtransactions:**
  - Character skins: $1-5
  - Weapon skins: $1-3
  - Emotes: $0.50-2
  - Kill effects: $1-3

- **Battle Pass (Seasonal):**
  - Free tier: Basic rewards
  - Premium tier ($10/season): Exclusive cosmetics
  - 50 levels of progression over 3 months

- **No Pay-to-Win:**
  - Zero gameplay advantages for paying players
  - All weapons equally accessible
  - Cosmetics only model

**Resource Management:**
- **Ammo:** Limited per weapon, requires reload
- **Health:** Regenerates after damage delay (5 seconds)
- **No consumables** - No health packs, armor, etc. (keeps it simple)

---

## Level Design Framework

### Level Types

**Arena Maps (Core Type):**
- **Competitive multiplayer arenas** - Closed maps optimized for 2-8 player combat
- **Size variation:** Small (2-4 players), Medium (5-8 players)
- **Theme variation:** Industrial, Urban, Digital, Wasteland

**Map Categories by Engagement Style:**

1. **Close-Quarters Combat**
   - Tight corridors, short sightlines
   - Favors melee and shotguns
   - High encounter frequency
   - Example: Industrial warehouse interior

2. **Mid-Range Balanced**
   - Mix of open and confined spaces
   - Balanced weapon viability
   - Strategic positioning matters
   - Example: Urban rooftops with alleys

3. **Long-Range Open**
   - Wide sightlines, minimal cover
   - Favors rifles and precision
   - Positional/rotation focused
   - Example: Digital grid arena (future)

**Special Map Features:**
- **Moving platforms** (Future) - Dynamic geometry
- **Environmental hazards** (Future) - Damage zones, traps
- **Destructible cover** (Future) - Temporary cover that breaks

**MVP Map Selection (2-3 Maps):**
1. Industrial Arena (mid-range balanced)
2. Urban Rooftops (close-quarters focus)
3. (Optional) Digital Grid (long-range open)

### Level Progression

**Unlocking Maps:**
- **All maps available from start** (no gating for fairness)
- **Map rotation:** Random selection or voting system
- **New maps added:** Post-MVP content updates (every 2-3 months)

**Map Complexity Progression:**
- **Simple layouts first:** Easy to learn, hard to master
- **Complex maps later:** Multi-level, advanced routing
- **Community feedback driven:** Most popular maps get expansions/variants

**No Campaign/Story Mode:**
- Pure multiplayer focus (no single-player level progression)
- Progression is skill-based and cosmetic unlocks
- Replayability through competitive matches, not level unlocks

---

## Art and Audio Direction

### Art Style

**Core Aesthetic:** Modern stick figure combat with juicy visual effects

**Character Design:**
- **Clean black stick figures** - Iconic, instantly recognizable
- **Smooth 60 FPS animations** - Running, shooting, dodging, death
- **Team color indicators** - Red vs Blue outlines for team modes
- **Cosmetic customization:** Colors, accessories (hats, capes), emotes

**Visual Polish Elements:**
- **Particle effects:** Muzzle flashes, bullet tracers, impact sparks, blood splatter
- **Screen effects:** Camera shake on damage, hit flash, death slow-motion
- **Dynamic lighting:** Weapon glow effects, environmental lighting
- **Minimal HUD:** Clean design that doesn't clutter screen

**Art Style References:**
- Stick War series (clean animation, good stick figure quality)
- Hotline Miami (high-contrast, intense action feel)
- Super Meat Boy (smooth animation, clear silhouettes)

**Color Palette:**
- **Environments:** Bold, high-contrast colors for clarity
- **Characters:** Black stick figures with team/cosmetic colors
- **Effects:** Bright, punchy colors that read clearly at 60 FPS
- **UI:** Minimalist, high-contrast for readability

**2D Pure Sprite-Based:**
- No 3D models - pure 2D Phaser 3 sprites
- Simpler for solo dev, better mobile performance
- Clearer visual language for competitive play
- Nostalgic Flash-era feel

### Audio and Music

**Music Genre & Mood:**
- **High-energy electronic/synthwave** - Menu and intense combat moments
- **Dynamic music:** Responds to match flow (calm lobby → intense combat)
- **Volume balance:** Never overpowers gameplay sounds (mutable for competitive)

**Sound Effects Philosophy:**
- **Punchy, satisfying feedback** - Every action sounds impactful
- **Weapon distinctiveness** - Each weapon has unique audio signature
- **Spatial audio** - Positional audio for enemy gunfire (competitive advantage)
- **Hit confirmation** - Distinct sound when landing hits (critical feedback)

**Key Sound Categories:**

| Category | Examples | Priority |
|----------|----------|----------|
| **Weapons** | Fire, reload, empty click, pickup | Critical |
| **Character** | Footsteps, damage grunt, death, respawn | High |
| **UI** | Menu clicks, notifications, match start/end | Medium |
| **Ambient** | Environmental sounds per map theme | Low |

**Audio References:**
- Hotline Miami (punchy, satisfying combat)
- Counter-Strike (clear weapon audio, spatial positioning)
- Enter the Gungeon (diverse weapon sound design)

**Voice Acting:** None planned
- Text-based taunts/emotes instead
- Keeps development scope manageable
- Community-driven voice line suggestions (post-MVP)

**Production Approach:**
- **Asset Packs (MVP):** Royalty-free SFX libraries (GameAudioGDC, Kenney)
- **Music:** License synthwave tracks or royalty-free initially
- **Custom Audio (Post-Launch):** Commission unique tracks once revenue validates

---

## Technical Specifications

### Performance Requirements

**Client-Side Targets:**

| Platform | FPS Target | Resolution | Load Time |
|----------|-----------|------------|-----------|
| **Desktop** | 60 FPS | 1920x1080 | < 10 seconds |
| **Mobile (High-end)** | 60 FPS | Device native | < 15 seconds |
| **Mobile (Mid-range)** | 30-60 FPS | Device native | < 20 seconds |

**Server-Side Targets:**
- **Tick Rate:** 60 updates/second for authoritative game loop
- **Update Frequency to Clients:** 20-30 Hz (with client-side interpolation)
- **Latency:** <100ms target, playable up to 150ms
- **Concurrent Players per Instance:** 100+ (10-12 simultaneous matches)

**Network Requirements:**
- **Bandwidth:** 2-5 KB/s per player (with delta compression)
- **Packet Loss Tolerance:** Up to 5% packet loss handled gracefully
- **Jitter Handling:** Client-side buffering smooths variable latency

**Battery Considerations (Mobile):**
- **Target:** 2+ hours of gameplay per full charge
- **Optimization:** Reduce particle effects on mobile, lower update rates

### Platform-Specific Details

**Web Browser (Primary Platform):**
- **Desktop Support:** Chrome, Firefox, Safari, Edge (latest 2 versions)
- **Mobile Support:** iOS Safari, Chrome Mobile, Samsung Internet
- **WebGL Required:** Hardware acceleration for smooth rendering
- **WebSocket Required:** Real-time bidirectional communication

**Desktop-Specific:**
- **Input:** Keyboard + Mouse (primary), Controller (future)
- **Settings:** Graphics quality options (low/medium/high/ultra)
- **Fullscreen Support:** F11 or in-game toggle
- **Alt-Tab Handling:** Pause/disconnect after 30 seconds inactive

**Mobile-Specific:**
- **Input:** Touch (dual virtual joysticks)
- **Auto-detect Device:** Adjust graphics quality based on device capability
- **Portrait Mode:** Not supported (landscape only for optimal experience)
- **iOS Safari Quirks:** Audio autoplay workarounds, memory management
- **Aim Assist:** Subtle assistance to balance mobile vs desktop (tunable)

**Browser Limitations to Handle:**
- **No Native UDP:** WebSocket (TCP) instead of WebRTC for simplicity
- **Memory Constraints:** Mobile browsers have strict limits (optimize assets)
- **Audio Autoplay Policies:** User interaction required before playing sound
- **File Size:** Larger games = longer load times (optimize asset bundles)

**Future Platform Considerations:**
- **Native Desktop App:** Electron wrapper for Steam/Epic release
- **Native Mobile Apps:** Capacitor wrapper for App Store/Play Store

### Asset Requirements

**Art Assets (MVP):**

| Asset Type | Quantity | Size/Complexity | Source |
|------------|----------|----------------|--------|
| **Character Sprites** | 50-100 frames | 64x64px | Solo dev + asset packs |
| **Weapon Sprites** | 30-50 per weapon | 32x32px | Solo dev |
| **Map Tiles/Objects** | 200-300 reusable | 32x32px tiles | Asset packs |
| **Particle Effects** | 20-30 effects | Various | Phaser effects + packs |
| **UI Elements** | 100-150 components | Various | Solo dev |

**Audio Assets (MVP):**

| Asset Type | Quantity | Duration/Type | Source |
|------------|----------|---------------|--------|
| **Weapon SFX** | 30-40 sounds | 0.1-0.5s each | Royalty-free packs |
| **Character SFX** | 15-20 sounds | 0.1-0.3s each | Royalty-free packs |
| **UI SFX** | 10-15 sounds | 0.05-0.2s each | Royalty-free packs |
| **Music Tracks** | 3-5 tracks | 2-3 min loops | Licensed synthwave |

**Technical Asset Specs:**
- **Sprite Format:** PNG with transparency
- **Audio Format:** MP3 or OGG (browser-compatible)
- **Compression:** Optimize for web delivery (minimize file sizes)
- **Sprite Sheets:** Atlas packing for efficient loading
- **Asset Bundle:** Target <20MB total for fast initial load

**Asset Pipeline:**
1. Rough prototype with placeholder art (test gameplay feel)
2. Production art once mechanics locked
3. Continuous polish based on player feedback
4. Outsource cosmetics post-MVP (freelancers)

---

## Development Epics

### Epic Structure

**Epic 1: Core Multiplayer Foundation** (Critical Path - MVP)
- Server-authoritative game loop (60 tick/sec)
- WebSocket connection handling (Golang + gorilla/websocket)
- Room creation and management
- 2-8 player synchronization
- Basic input handling (movement, shooting)
- Deploy to cloud VPS for testing

**Epic 2: Client-Side Game Integration** (Critical Path - MVP)
- Phaser 3 client setup with React UI layer
- WebSocket client connection
- Server state rendering
- Local input handling
- HUD implementation (health, ammo, minimap)

**Epic 3: Combat Mechanics** (Critical Path - MVP)
- Weapon system implementation (5-6 weapons from prototype)
- Hit detection (server-authoritative)
- Damage calculation and health system
- Weapon pickup spawning
- Reload mechanic
- Kill/death tracking

**Epic 4: Netcode Polish** (Critical Path - Post-Thursday)
- Client-side prediction
- Server reconciliation
- Delta compression
- Interpolation for other players
- Lag compensation
- Artificial latency testing tools

**Epic 5: Matchmaking & Lobbies** (High Priority)
- Redis-based matchmaking queues
- Skill-based matchmaking (hidden MMR)
- Lobby system with ready-up
- Game mode selection
- Region selection

**Epic 6: Authentication & Accounts** (High Priority)
- OAuth integration (go-pkgz/auth)
- Google/Discord login
- PostgreSQL player database
- Session management (Redis)
- Guest play support

**Epic 7: Maps & Environments** (Content)
- Industrial Arena map (balanced mid-range)
- Urban Rooftops map (close-quarters)
- Map asset creation
- Weapon spawn placement per map
- Minimap generation

**Epic 8: Progression System** (Engagement)
- XP calculation and leveling
- Persistent stats (kills, deaths, wins)
- Leaderboards (Redis + PostgreSQL)
- Cosmetic unlocks (basic)
- Profile pages

**Epic 9: Mobile Optimization** (Platform Parity)
- Touch controls (dual joysticks)
- Touch UI layout
- Auto-detect device quality settings
- Aim assist tuning
- Battery optimization

**Epic 10: Polish & Launch Prep** (Quality)
- Visual effects and particles
- Audio integration
- Performance profiling and optimization
- Bug fixing
- Monitoring and metrics (Prometheus + Grafana)
- Deployment automation (CI/CD)

**Epic 11: Post-MVP Content** (Future)
- Additional maps (3-5 more)
- New weapons (Sniper, Grenade Launcher)
- Ranked competitive mode
- Clan/party system
- Spectator mode
- Replay system

---

## Success Metrics

### Technical Metrics

**Performance KPIs:**
- **Client FPS:** 60 FPS on 90% of desktop clients, 30+ FPS on 70% mobile
- **Average Latency:** <100ms for 80% of players
- **Server Uptime:** 99%+ availability
- **Crash Rate:** <1% of sessions
- **Load Time:** <15 seconds average (first load)

**Infrastructure Metrics:**
- **Concurrent Players Capacity:** 100+ per server instance
- **Server Response Time:** <2ms internal processing
- **Database Query Time:** <50ms for player data, <1ms Redis
- **Bandwidth Usage:** 2-5 KB/s per player average

**Monitoring Alerts:**
- Server CPU >80% for 5 minutes
- Latency >150ms for 20% of players
- Crash rate >2% in last hour
- Database connection errors

### Gameplay Metrics

**Player Acquisition:**
- **Month 1:** 1,000 unique players
- **Month 3:** 10,000 unique players
- **Month 6:** 50,000+ unique players

**Engagement & Retention:**
- **Session Length:** Average 15-20 minutes (3-5 matches)
- **Day 1 Retention:** 40%+ return next day
- **Day 7 Retention:** 20%+ return after week
- **Day 30 Retention:** 10%+ core community
- **Matches per Player:** 5+ average

**Match Quality:**
- **Matchmaking Time:** <30 seconds average
- **Balanced Matches:** 45-55% win rate distribution per player
- **Match Completion Rate:** >85% (low abandon rate)
- **Report Rate:** <2% of matches flagged

**Community Health:**
- **Discord Members:** 500+ within 3 months
- **Concurrent Players (Peak):** 50+ for reliable matchmaking
- **User Satisfaction:** 4+ star average feedback
- **Content Created:** 10+ YouTube videos, community highlights

**Business Metrics (Post-Monetization):**
- **Infrastructure Cost Coverage:** Break even
- **Conversion Rate:** 2-5% purchase cosmetics
- **ARPPU:** $5-10 average revenue per paying user

---

## Out of Scope

**Features Explicitly NOT in MVP:**
- ❌ Multiple game modes beyond Deathmatch (add post-launch)
- ❌ Extensive cosmetics catalog (basic only for MVP)
- ❌ Ranked competitive mode with visible ranks
- ❌ Clan/guild/party systems
- ❌ Spectator mode
- ❌ Replay/demo recording system
- ❌ Tournaments or esports infrastructure
- ❌ In-game voice chat
- ❌ Text chat moderation system (manual review initially)
- ❌ Mobile native apps (web-only MVP)
- ❌ Controller support (keyboard/mouse + touch only)
- ❌ Map editor or user-generated content
- ❌ Single-player campaign or story mode
- ❌ PvE modes (co-op vs AI)
- ❌ Destructible environments
- ❌ Vehicle gameplay
- ❌ Class-based gameplay (everyone equal)

**Future Consideration (Not MVP):**
- Additional game modes (Capture the Flag, King of the Hill)
- Seasonal content and battle passes
- Advanced stat tracking and analytics dashboards
- Social features (friend lists, private matches)
- Modding support and custom servers
- Native app wrappers (Electron for desktop, Capacitor for mobile stores)

**Technology NOT Used:**
- WebRTC (WebSocket sufficient for latency requirements)
- Nakama or other game server frameworks (custom Go server)
- Complex physics engines (simple AABB collision)
- 3D graphics (pure 2D for performance and simplicity)

---

## Assumptions and Dependencies

**Technical Assumptions:**
- WebSocket latency <100ms achievable with client-side prediction for arena shooter feel
- Single Golang server instance can handle 100+ concurrent players reliably
- Phaser 3 can maintain 60 FPS on mid-range mobile devices
- gorilla/websocket library stable and performant at scale
- Browser WebGL support universal enough (>95% of target audience)
- Delta compression reduces bandwidth sufficiently for mobile data usage

**Resource Assumptions:**
- Solo expert developer sufficient for MVP (no team required initially)
- Part-time development sustainable pace (avoid burnout)
- Infrastructure costs stay under $50/month for MVP scale
- Free/cheap asset packs provide sufficient quality for MVP art
- Royalty-free audio libraries adequate for MVP sound design

**Market Assumptions:**
- Flash-era nostalgia exists in 16-35 age demographic
- Browser gaming viable in 2025 (no download friction is advantage)
- .io game market not oversaturated for quality entrants
- Skill-based stick figure shooter has demand (Stick Arena had millions)
- Fair monetization (cosmetics only) sustainable business model

**Player Assumptions:**
- Target audience has stable internet (>1 Mbps, <150ms latency)
- Players willing to play against mobile + desktop mixed input
- Competitive players value fairness over ultra-low latency (<50ms)
- Community will self-organize (tournaments, clans) if given tools

**Dependencies:**
- **Technology Stack:** Phaser 3, Golang, PostgreSQL, Redis all stable and maintained
- **Cloud Infrastructure:** VPS providers (DigitalOcean, Hetzner, Fly.io) affordable and reliable
- **OAuth Providers:** Google, Discord continue offering free OAuth tiers
- **Asset Sources:** Royalty-free asset libraries remain accessible
- **Community Platforms:** Discord, Reddit remain primary gathering places for gamers

**Risks Mitigated by Assumptions:**
- Technical research complete (architecture validated before build)
- Working prototype proves gameplay feel translates to implementation
- Solo dev has full-stack expertise (no skill gaps blocking progress)
- Modest MVP scope (emergency sprint achievable by Thursday deadline)

**External Dependencies:**
- No dependencies on external APIs beyond OAuth (self-contained game)
- No reliance on third-party game services (Nakama, PlayFab, etc.)
- No app store approval processes (browser-based avoids gatekeeping)

**Critical Path Blockers (If Assumptions Wrong):**
- If WebSocket latency feels bad → Add WebRTC (complex but possible)
- If single server can't scale → Horizontal scaling pre-researched
- If solo dev burns out → Scope cut to core loop only
- If Thursday deadline impossible → Extend to full MVP timeline (post-Thursday plan)

---

**Document Status:** Complete - Ready for Architecture Phase

**Next Recommended Actions:**
1. Run `/bmad:bmgd:workflows:game-architecture` to define technical implementation
2. Begin emergency MVP sprint (Thursday deadline focus)
3. Set up development environment (Phaser + Golang projects)
4. Implement core multiplayer proof-of-concept (2-player sync)
