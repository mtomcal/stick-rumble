# Game Brief: Stick Rumble

**Date:** 2025-11-25
**Author:** BMad
**Status:** Draft for GDD Development

---

## Executive Summary

**Stick Rumble** is a fast-paced multiplayer stick figure arena shooter that brings beloved Flash-era gameplay into the modern browser. Built for 2-8 player competitive matches lasting 3-7 minutes, it delivers instant-play accessibility with deep skill-based combat. Players can jump in from any device (desktop or mobile) with zero downloads, experiencing smooth 60 FPS action powered by cutting-edge web technology (Phaser 3 frontend, Golang backend).

**Target Audience:** The game targets nostalgic gamers (16-35 years old) who remember Flash classics like Stick Arena, alongside casual competitive players seeking quick, fair multiplayer without the commitment of battle royales or the predatory monetization of mobile games. With cross-platform play and touch-optimized controls, Stick Rumble serves both desktop keyboard/mouse players and mobile gamers equally.

**Core Differentiators:** Fair server-authoritative gameplay (no cheating), responsive netcode with client-side prediction, zero-friction browser access, and polished core mechanics over feature bloat. Unlike competitors in the crowded .io space, Stick Rumble prioritizes gameplay feel and competitive integrity, building a sustainable game rather than a viral disposable experience.

**MVP & Success Vision:** The Minimum Viable Product has a critical Thursday deadline (part-time development), requiring extreme scope discipline. Emergency sprint focuses on functional 2-player multiplayer with basic shooting mechanics - proving the core loop works. Full MVP (post-Thursday) will expand to 2-8 player matches with both FFA and Team Deathmatch modes, 2-3 maps, 5-6 weapons, matchmaking, and progression. Success means reaching 1,000 players in month one, sustaining 50+ concurrent players for matchmaking, and building an engaged Discord community. This is a hobby project driven by passion over profit, with long-term vision including 10,000+ active players and a thriving competitive scene.

**Why Now:** Flash's death in 2020 left a void for stick figure combat games. Modern web technology (HTML5/WebGL, WebSocket) now enables browser games with quality matching native apps. The market has proven demand (Krunker.io, .io games' massive success), and nostalgia for 2000s-2010s gaming aesthetics is strong. Technical research is complete, prototype validates core feel, and the solo developer has the full-stack expertise to execute.

---

## Game Vision

### Core Concept

A fast-paced multiplayer stick figure arena shooter that brings the beloved Flash-era gameplay into the modern web, featuring smooth combat mechanics, multiple game modes, and real-time competitive matches for 2-8 players.

### Elevator Pitch

Remember those addictive stick figure Flash games? Stick Rumble revives that lightning-fast combat with modern multiplayer technology - jump in for quick 5-minute matches, customize your loadout, and dominate the leaderboards in browser-based arena warfare that works seamlessly on desktop and mobile.

### Vision Statement

Stick Rumble aims to become the definitive modern stick figure shooter, capturing the pure joy and accessibility of Flash-era games while delivering the competitive depth and polish expected from contemporary multiplayer titles. We're building a game where anyone can jump in and have fun within seconds, but mastery takes genuine skill. Through responsive controls, fair netcode, and a thriving competitive scene, Stick Rumble will prove that simple aesthetics and complex gameplay aren't mutually exclusive - they're the perfect combination for pure, addictive fun.

---

## Target Market

### Primary Audience

**Core Demographics:**
- Age: 16-35 years old
- Platform: Desktop and mobile web browser users
- Gaming Experience: Casual to mid-core gamers

**Behavioral Profile:**
- Nostalgic for Flash-era gaming (Stick Arena, Stick RPG, Stickman games)
- Prefer quick, session-based gameplay (5-15 minute matches)
- Enjoy competitive multiplayer but want low commitment
- Value accessibility - no downloads, play instantly in browser
- Active on gaming communities (Reddit, Discord, Twitch)
- Willing to engage with progression systems and cosmetic unlocks

**Gaming Preferences:**
- Fast-paced action over slow tactical gameplay
- Skill-based competition with fair matchmaking
- Simple controls but high skill ceiling
- Cross-platform play (switch between desktop at home, mobile on commute)
- Social elements (playing with friends, seeing leaderboards)

### Secondary Audience

**Streamers & Content Creators:**
- Looking for quick, entertaining content for short-form videos
- Value spectator-friendly gameplay and funny moments
- Interested in skill showcases and competitive highlights

**Mobile Gamers:**
- Playing during commutes or breaks
- Prefer touch-optimized controls
- Want console-quality action on mobile without app downloads

**Esports Enthusiasts:**
- Interested in competitive ladders and tournaments
- Seek skill-based ranking systems
- Value fair, server-authoritative gameplay (anti-cheat)

### Market Context

**Market Opportunity:**
- Browser-based gaming experiencing renaissance post-Flash (HTML5/WebGL maturity)
- .io games proved demand for instant-play multiplayer (Agar.io: 100M+ players, Slither.io: massive success)
- Mobile gaming dominant but oversaturated with predatory monetization
- Gap in market: quality browser games with fair competitive gameplay

**Competitive Landscape:**
- **Direct Competitors:** Krunker.io (3D FPS), Warbot.io (arena shooter), various .io games
- **Indirect Competitors:** Mobile shooters (PUBG Mobile, Free Fire), party games (Among Us, Fall Guys)
- **Legacy Inspiration:** Classic Flash games (Stick Arena had millions of players, now offline)

**Market Trends Supporting Success:**
- HTML5/WebGL tech now supports console-quality graphics in browser
- Cross-platform play increasingly expected (desktop/mobile seamless)
- Bite-sized competitive gaming growing (League of Legends ARAM, Apex Legends arenas)
- Nostalgia for 2000s-2010s gaming aesthetics (see: indie game success with retro styles)

**Why Now:**
- Flash officially dead (2020), leaving void for stick figure combat games
- WebSocket/WebRTC tech mature enough for smooth multiplayer
- Modern game engines (Phaser 3) make browser game dev feasible for solo developers
- Distribution easier than ever (no app store gatekeeping, instant play via link)

---

## Game Fundamentals

### Core Gameplay Pillars

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

### Primary Mechanics

**Movement System:**
- Top-down WASD/joystick movement (omnidirectional)
- Sprint mechanic (shift/button) - faster but more noise/visibility
- Roll/dodge with i-frames (cooldown-based defensive option)
- Movement momentum and acceleration (not instant start/stop for skill expression)

**Combat System:**
- Mouse/touch aim with 360-degree freedom
- Click/tap to fire weapon
- Weapon-specific fire rates, damage, range, and reload times
- Hit feedback: damage numbers, screen shake, sound effects
- Health regeneration after delay (encourages disengagement/positioning)

**Weapon Diversity (from prototype):**
- **Melee:** Bat (fast swing, high DPS close range), Katana (slower, longer reach, higher damage)
- **Ranged:** Uzi (high fire rate, low damage), AK47 (balanced), Shotgun (burst damage, close range)
- Weapon pickups spawn on map - controlling spawns is strategic advantage
- Limited ammo with manual reload (R key) - tactical ammo management

**HUD & Feedback:**
- Health bar (top or corner)
- Ammo counter with reload indicator
- Minimap showing player/enemy positions (fog of war or full vision TBD)
- Kill feed, score display
- Visual bullet tracers and impact effects
- Damage direction indicators

### Player Experience Goals

**Emotional Journey:**
- **Empowerment:** "I feel like a badass" - smooth controls, satisfying kills, skill expression
- **Flow State:** Total engagement during matches, time flies by
- **Competitive Drive:** "I can win if I play better" - fair matches motivate improvement
- **Social Connection:** Playing with friends, sharing highlights, friendly trash talk
- **Progression Satisfaction:** Unlocking cosmetics, climbing ranks, mastering weapons

**Moment-to-Moment Feel:**
- Responsive, "tight" controls that do exactly what you intend
- Satisfying audio/visual feedback on every action (shots, hits, kills)
- Tension and relief cycle: combat intensity → health regen → re-engage
- Strategic thinking: when to push, when to retreat, which weapon to grab
- Outplay moments that feel earned (dodging, perfect aim, smart positioning)

**Long-Term Engagement:**
- Mastery curve: always something new to learn (weapon combos, map knowledge, movement tech)
- Variety through game modes (Deathmatch, Team modes, objective-based)
- Social metagame: climbing leaderboards, earning cosmetics, reputation in community
- Content creator potential: highlight-worthy plays, funny moments, skill showcases

---

## Scope and Constraints

### Target Platforms

**Primary Platform:** Web Browser (HTML5/WebGL)
- Desktop: Chrome, Firefox, Safari, Edge (latest 2 versions)
- Mobile: iOS Safari, Chrome Mobile, Samsung Internet
- Target: 60 FPS on desktop, 30-60 FPS on mobile (device-dependent)

**Platform Priorities:**
1. **Desktop Web** (MVP focus) - Keyboard/mouse optimal experience
2. **Mobile Web** (Launch target) - Touch controls already prototyped
3. **Native Apps** (Post-launch consideration) - Electron wrapper for desktop, Capacitor for mobile stores

**Cross-Platform Requirements:**
- Shared account/progression across devices
- Seamless switching (play on desktop, continue on phone)
- Input-agnostic matchmaking (mobile vs desktop is fair)

### Development Timeline

**Development Approach:** Iterative with early public testing

⚠️ **CRITICAL CONSTRAINT:** MVP must be completed by Thursday (part-time development). This requires absolute minimum viable scope - focus exclusively on core multiplayer mechanics working, defer all polish and secondary features.

**Phase 1: Core Multiplayer MVP (DEADLINE: Thursday)**
- Functional 2-8 player matches with basic netcode
- Two game modes (FFA Deathmatch AND Team Deathmatch)
- 2-3 maps with weapon spawns
- Basic matchmaking (queue → join match)
- Social auth (Google/Discord login)
- **Status:** Technical architecture researched, single-player prototype exists
- **Note:** Given the Thursday deadline, this is an extremely aggressive timeline - may need to cut scope further (e.g., 1 game mode, 1 map) to meet deadline

**Phase 2: Netcode Polish**
- Client-side prediction + server reconciliation
- Delta compression for bandwidth optimization
- Smooth interpolation for other players
- **Critical for:** Fair, responsive gameplay feel

**Phase 3: Content & Progression**
- Multiple game modes (Team DM, Capture the Flag)
- 5-8 total maps
- Player progression (XP, levels, unlocks)
- Leaderboards and stats tracking
- Spectator mode

**Phase 4: Polish & Launch**
- Balance tuning based on playtesting
- Performance optimization
- Anti-cheat refinement
- Marketing materials and community building
- Soft launch → Full launch

**Milestone Strategy:** Release MVP publicly early for feedback, iterate based on player data

### Budget Considerations

**Infrastructure Costs (Monthly):**
- Game server hosting: $5-20 (VPS for 100+ concurrent players)
- PostgreSQL database: $0-7 (free tier or managed)
- Redis: $0-5 (free tier or managed)
- Domain + CDN: $10-20
- **Total MVP:** $15-50/month

**Development Costs:**
- Solo developer (no salary costs for MVP)
- Tools: Free/existing (VS Code, Git, Phaser 3, Go standard library)
- Art: Stick figures (minimal art budget, can expand post-launch)
- Sound effects: Free assets or low-cost packs ($50-200)

**Monetization Strategy (Post-MVP):**
- Cosmetic microtransactions (skins, emotes, effects) - no pay-to-win
- Optional battle pass system
- Potential ad revenue (non-intrusive)
- Potential Patreon/supporter tier
- **Goal:** Cover infrastructure costs first, profitability secondary to player experience

**Scaling Costs:**
- Infrastructure scales horizontally (add $20/mo per server instance)
- Target: Break even at 500-1000 daily active users
- Monetization activates after MVP validation

### Team Resources

**Core Team:** Solo expert developer

**Skills Available:**
- Full-stack development (TypeScript/JavaScript, Golang)
- Game development (Phaser 3 experience, working prototype exists)
- Backend/infrastructure (server architecture, databases, networking)
- System design and architecture

**Skills Gaps/Outsourcing Needs:**
- **Art:** Stick figures minimize this need; consider commissioning polished sprites/effects post-MVP
- **Sound Design:** Use asset packs initially, consider custom audio post-launch
- **Marketing:** Community building, social media presence (learn or outsource)
- **Playtesting:** Recruit volunteer community testers for MVP

**Time Availability:**
- Part-time development schedule
- **Critical Deadline:** MVP completion by Thursday (extremely aggressive timeline)
- Prioritize core multiplayer functionality over content volume initially
- Scope must be ruthlessly minimal to meet deadline

**Development Velocity:**
- MVP achievable as solo developer with modern tools (Phaser 3, Go, managed services)
- Technical research already complete (architecture decided)
- Existing prototype provides foundation (movement, combat feel established)

### Technical Constraints

**Technology Stack (Fixed):**
- **Frontend:** Phaser 3 (TypeScript/JavaScript), React for UI
- **Backend:** Golang server with gorilla/websocket
- **Protocol:** WebSocket (not WebRTC - simpler, sufficient for <100ms latency)
- **Databases:** PostgreSQL (persistence) + Redis (sessions/queues)
- **Auth:** OAuth via go-pkgz/auth (Google, Discord, etc.)

**Performance Targets:**
- **Client FPS:** 60 FPS on desktop, 30-60 FPS on mobile
- **Server Tick Rate:** 60 updates/second for authoritative game loop
- **Network Latency:** <100ms target, playable up to 150ms
- **Game State Updates:** 20-30 Hz to clients (with client-side interpolation)

**Browser Limitations:**
- No native UDP (WebRTC adds complexity, not using for MVP)
- Mobile browser performance varies widely (test on mid-range devices)
- iOS Safari quirks (audio autoplay, memory limits)
- File size considerations (larger games = longer initial load)

**Scalability Constraints:**
- Single server instance: 100+ concurrent players (10-12 active matches)
- Horizontal scaling required for larger player counts (add servers per region)
- WebSocket maintains persistent connections (can't scale infinitely without load balancing)

**Development Constraints:**
- Solo developer limits parallel workstreams
- No QA team - rely on automated testing + community feedback
- Limited art/audio production resources

---

## Reference Framework

### Inspiration Games

| Game | What We're Taking | What We're NOT Taking |
|------|-------------------|----------------------|
| **Stick Arena (Flash)** | Core stick figure aesthetic, fast-paced arena combat, weapon variety, simple controls | Dated graphics, Flash limitations, lack of progression systems |
| **Krunker.io** | Browser-based FPS success model, quick matchmaking, smooth netcode feel | 3D graphics (we're 2D), complex weapon customization |
| **Brawlhalla** | Stick figure style at scale, competitive scene viability, smooth online play | Platform fighter mechanics, free-to-play aggressive monetization |
| **Enter the Gungeon** | Top-down bullet combat feel, weapon variety, visual polish | Roguelike elements, single-player focus, complex meta-progression |
| **Super Smash Bros** | Easy to learn/hard to master philosophy, party game accessibility with competitive depth | Platform fighter mechanics, complex movesets |

**Key Inspiration Takeaways:**
- Stick figures don't mean low-quality - polish and responsiveness matter more than visual complexity
- Browser games can have competitive depth (Krunker proved this)
- Quick sessions + progression systems = strong retention
- Fair netcode is non-negotiable for competitive multiplayer

### Competitive Analysis

**Direct Competitors (Browser Arena Shooters):**

**Krunker.io**
- **Strengths:** Massive player base, smooth 3D FPS feel, active competitive scene, regular updates
- **Weaknesses:** Can feel generic (Counter-Strike clone), pay-to-win concerns with weapon skins, toxic community issues
- **Our Advantage:** 2D top-down offers different skill expression, cleaner aesthetic, focus on fair play

**Warbot.io**
- **Strengths:** Top-down robot shooter (similar perspective), decent netcode
- **Weaknesses:** Low player count, clunky controls, dated visuals, lack of polish
- **Our Advantage:** Better controls (prototype proves this), stick figure nostalgia, smoother gameplay

**Indirect Competitors (Mobile Shooters):**

**PUBG Mobile / Free Fire**
- **Strengths:** Huge player bases, polished gameplay, strong social features
- **Weaknesses:** Requires app download, predatory monetization, 30+ minute matches
- **Our Advantage:** Instant play in browser, fair monetization, quick 5-minute matches

**Market Gaps We're Filling:**
1. **No dominant stick figure shooter post-Flash** - Stick Arena had millions of players, no true successor
2. **Quality browser shooters are rare** - Most .io games feel disposable, we're aiming for polish
3. **Mobile players want fair competition** - Not pay-to-win, not ad-spam
4. **Nostalgia market untapped** - Millennials/Gen Z remember Flash games fondly

### Key Differentiators

**1. Modern Tech, Nostalgic Feel**
- Captures Flash-era stick figure combat nostalgia
- Built with 2025 web technology (Phaser 3, WebGL, modern browsers)
- Smooth 60 FPS performance on devices that struggled with Flash

**2. Fair, Server-Authoritative Gameplay**
- No client-side cheating possible (server validates everything)
- Client-side prediction masks latency without sacrificing fairness
- Transparent matchmaking based on skill, not exploits

**3. Zero Friction Access**
- No download, no install, no account required to try
- Instant play: URL → game in under 60 seconds
- Cross-platform with shared progression (desktop ↔ mobile)

**4. Polished Core Over Feature Bloat**
- Every mechanic refined to feel perfect (tight controls, satisfying feedback)
- Simple systems executed excellently > complex systems done poorly
- Prototype already demonstrates superior feel vs competitors

**5. Community-First Development**
- Solo indie developer building in public
- Community feedback shapes development priorities
- Fair monetization (cosmetics only, no pay-to-win ever)
- Transparent development roadmap

**Why Players Choose Stick Rumble:**
- "It feels better" - Responsive controls, satisfying combat
- "It's fair" - No cheaters, no pay-to-win, skill-based
- "I can play anywhere" - Browser-based, cross-platform
- "It respects my time" - Quick matches, meaningful progression

---

## Content Framework

### World and Setting

**Setting:** Abstract arena combat environments

**World Philosophy:**
- Minimalist, functional arenas that serve gameplay first
- No narrative justification needed - pure competitive combat focus
- Visual variety through environment themes, not story

**Environment Themes (MVP + Future):**
1. **Industrial** - Shipping containers, metal platforms, stark lighting
2. **Urban** - Rooftops, alleyways, neon signs
3. **Laboratory** - Clean white rooms, sci-fi elements, energy barriers
4. **Wasteland** - Post-apocalyptic ruins, debris, atmospheric dust
5. **Digital** - Tron-like grid aesthetic, abstract geometry

**Map Design Principles:**
- Symmetrical or balanced spawns (fairness over realism)
- Multiple weapon spawn points create strategic control objectives
- Cover elements that don't obstruct sightlines excessively
- Verticality through platforms/ramps (adds movement depth)
- Size: 2-8 players, roughly 30-60 seconds to traverse

**Tone:** Serious competition in a lighthearted package - no grimdark lore, no forced humor

### Narrative Approach

**Narrative Scope:** Minimal to none (intentional)

**Why No Story:**
- Competitive multiplayer doesn't need narrative justification
- Focus resources on gameplay feel, not cutscenes/dialogue
- Players create their own narratives through rivalries and memorable matches
- Stick figures are abstract enough to project onto

**Environmental Storytelling (Light Touch):**
- Map aesthetics imply context (industrial, urban, lab) without exposition
- Weapon designs hint at world tone (near-future, generic action movie)
- UI flavor text can add personality without mandatory lore

**Player-Generated Narrative:**
- Memorable matches become stories ("remember that comeback?")
- Rivalries form through leaderboards and repeated matchups
- Community memes and inside jokes
- Highlight reels and montages tell their own stories

**Future Consideration:**
- Optional lore for cosmetics (weapon skins with backstories)
- Seasonal events with loose thematic justification
- No mandatory story mode planned

### Content Volume

**MVP Launch Content:**
- **Maps:** 2-3 arenas (sufficient for early matchmaking variety)
- **Weapons:** 5-6 types (Bat, Katana, Uzi, AK47, Shotgun + 1-2 more)
- **Game Modes:** 1-2 (Deathmatch, possibly Team Deathmatch)
- **Playthrough Length:** Endless replayability (competitive multiplayer)
- **Average Match:** 3-7 minutes
- **Progression Content:** 10-15 levels, basic cosmetic unlocks

**Post-MVP Content Roadmap:**
- **Maps:** Add 1-2 new maps every 2-3 months (target 8-10 total)
- **Weapons:** New weapon every major update (balanced carefully)
- **Game Modes:** Capture the Flag, King of the Hill, custom modes
- **Cosmetics:** Character skins, weapon skins, emotes, kill effects
- **Seasonal Content:** Battle passes, limited-time modes

**Content Production Strategy:**
- Quality over quantity - each map must play well competitively
- Community feedback drives priorities (what do players want most?)
- Procedural generation NOT used - hand-crafted maps for balance
- Modding support consideration for long-term content generation

**Asset Volume Estimate (MVP):**
- Character sprites/animations: ~50-100 frames
- Weapon sprites/effects: ~30-50 assets per weapon
- Map tiles/objects: ~200-300 reusable pieces
- UI elements: ~100-150 components
- Sound effects: ~50-80 samples
- **Manageable for solo dev with asset packs and focused scope**

---

## Art and Audio Direction

### Visual Style

**Core Aesthetic:** Modern stick figure combat with juicy visual effects

**Character Design:**
- Clean black stick figures (iconic, instantly recognizable)
- Smooth animations (60 FPS capable)
- Color team indicators (red vs blue for team modes)
- Cosmetic customization: colors, accessories, emotes (post-MVP)

**Visual Polish Elements:**
- **Particle Effects:** Muzzle flashes, bullet tracers, impact sparks, blood splatter
- **Screen Effects:** Camera shake on damage, hit flash, death slowmo
- **Lighting:** Dynamic shadows, weapon glow effects, environmental lighting
- **UI:** Clean, minimalist HUD that doesn't clutter the screen
- **Feedback:** Damage numbers, kill confirmations, visual hit indicators

**Art Style References:**
- Stick War series (clean stick figures, good animation)
- Hotline Miami (high-contrast, intense action feel)
- Super Meat Boy (smooth animation, clear silhouettes)

**Color Palette:**
- Environments: Bold, high-contrast colors for clarity
- Characters: Black with team colors and cosmetic options
- Effects: Bright, punchy colors that read clearly at 60 FPS

**2D vs 3D:** Pure 2D (Phaser 3 sprites, no 3D models)
- Simpler for solo dev
- Better performance on mobile
- Clearer visual language for competitive play
- Nostalgic Flash-era feel

### Audio Style

**Music Genre & Mood:**
- High-energy electronic/synthwave for menu and intense moments
- Optional dynamic music that responds to match flow (calm lobby → intense combat)
- Music volume never overpowers gameplay sound (can be muted for competitive play)

**Sound Effects Philosophy:**
- **Punchy, Satisfying Feedback:** Every action must sound impactful
- **Weapon Distinctiveness:** Each weapon has unique sound signature (Uzi rapid-fire, Shotgun boom, Katana swoosh)
- **Spatial Audio:** Positional audio for enemy gunfire (gives competitive advantage to attentive players)
- **Hit Confirmation:** Distinct "thunk" when you land a hit (critical feedback)

**Key Sound Categories:**
- **Weapons:** Fire, reload, empty click, pickup
- **Character:** Footsteps, damage grunt, death sound, respawn
- **UI:** Menu clicks, notifications, match start/end fanfare
- **Ambient:** Environmental sounds per map theme (minimal, not distracting)

**Audio References:**
- Hotline Miami (punchy, satisfying combat sounds)
- Counter-Strike (clear weapon audio, good spatial positioning)
- Enter the Gungeon (diverse weapon sound design)

**Voice Acting:** None planned (keeps development scope manageable)
- Optional text-based taunts/emotes
- Community-driven voice line suggestions (post-MVP)

### Production Approach

**Art Production:**
- **In-House (MVP):** Solo dev creates basic stick figure sprites and animations using pixel art tools (Aseprite, Photoshop)
- **Asset Stores:** Use quality asset packs for effects, UI elements, environmental tiles (saves time, professional polish)
- **Outsourcing (Post-MVP):** Commission polished animations, custom effects, cosmetic items from freelancers
- **AI Tools:** Potentially use for texture generation, color palettes, concept art (human refinement required)

**Audio Production:**
- **Asset Packs (MVP):** Royalty-free SFX libraries (GameAudioGDC, Sonniss, Kenney)
- **Music:** License synthwave/electronic tracks or use royalty-free music initially
- **Custom Audio (Post-Launch):** Commission unique tracks and SFX once revenue validates investment
- **Tools:** Audacity for editing, SFXR/Chiptone for retro game sounds

**Style Consistency:**
- Document sprite sizes, color palettes, animation frame counts early
- Create style guide to maintain consistency across outsourced assets
- Establish clear pipeline: concept → implementation → integration testing

**Capability vs Vision:**
- Stick figure aesthetic perfectly matches solo dev capability (simple shapes, expressive animation)
- Focus on animation quality over visual complexity (smooth 60 FPS feel > detailed sprites)
- Community feedback guides cosmetic art direction (poll players on skin ideas)

**Asset Pipeline:**
1. Rough prototype in code (test gameplay feel)
2. Placeholder art (boxes, circles) to validate mechanics
3. Production art (polished sprites, effects) once mechanics locked
4. Continuous polish based on player feedback

---

## Risk Assessment

### Key Risks

**1. Player Acquisition Challenge**
- **Risk:** Browser games live/die by discoverability; hard to reach target audience
- **Impact:** High - No players = dead game regardless of quality
- **Likelihood:** Medium-High - Competitive market, limited marketing budget

**2. Netcode Complexity**
- **Risk:** Client-side prediction + server reconciliation is technically challenging; poor implementation = unplayable
- **Impact:** Critical - Bad netcode kills competitive shooters
- **Likelihood:** Medium - Technical research done, but execution still complex

**3. Solo Developer Bottleneck**
- **Risk:** Single point of failure; burnout, life circumstances, or technical blockers can stall project
- **Impact:** High - No team to pick up slack
- **Likelihood:** Medium - Long development cycles increase risk

**4. Critical Mass Requirement**
- **Risk:** Multiplayer games need active player base; "dead game" perception becomes self-fulfilling
- **Impact:** Critical - Matchmaking fails below threshold player count
- **Likelihood:** High - Most multiplayer games fail to reach critical mass

**5. Mobile Performance**
- **Risk:** Browser games on mobile face memory limits, battery drain, inconsistent performance
- **Impact:** Medium - Cuts off large potential audience segment
- **Likelihood:** Medium - Phaser 3 generally performs well, but edge cases exist

### Technical Challenges

**1. Network Latency & Prediction**
- Implementing client-side prediction correctly (replay inputs on misprediction)
- Handling edge cases (packet loss, high jitter, variable latency)
- Balancing responsiveness vs fairness

**2. Server Authority & Anti-Cheat**
- Validating all client inputs server-side without introducing lag
- Detecting subtle exploits (speedhacks, aimbots, wallhacks)
- Preventing client tampering with browser dev tools

**3. Horizontal Scaling**
- Distributing game rooms across multiple server instances
- Handling player migration between servers (region changes)
- Matchmaking coordination across distributed servers

**4. Cross-Platform Input Balance**
- Ensuring mobile touch controls competitive with keyboard/mouse
- Aim assist tuning (enough to help mobile, not enough to feel unfair)
- Touch UI not obstructing gameplay view

**5. Browser Compatibility**
- Safari quirks (audio, WebGL issues)
- iOS memory limitations
- Consistent performance across Chrome/Firefox/Edge/Safari

**6. State Synchronization**
- Delta compression implementation
- Handling out-of-order packets
- Maintaining determinism in physics simulation

### Market Risks

**1. Market Saturation**
- **.io game space is crowded** - Hundreds of browser shooters competing for attention
- **Player attention fragmented** - Fortnite, Apex, PUBG dominate shooter mindshare
- **Standing out is hard** - Quality alone doesn't guarantee visibility

**2. Discoverability Challenges**
- **No app store featuring** - Browser games lack discovery mechanisms of Steam/mobile stores
- **SEO takes time** - Organic search traffic builds slowly
- **Reliant on community** - Need influencers/streamers to amplify reach

**3. Monetization Uncertainty**
- **Browser game players expect free** - Less willingness to pay than mobile/PC gamers
- **Cosmetic-only limits revenue** - Can't monetize as aggressively as competitors
- **Ad blockers common** - Desktop users block ads at high rates

**4. Platform Competition**
- **Native apps feel more "real"** - Perception that browser games are inferior
- **Mobile stores have traffic** - Millions browsing app stores daily vs seeking browser games
- **Console/PC storefronts** - Steam, Epic have massive built-in audiences

**5. Trend Dependency**
- **Nostalgia window limited** - Flash-era nostalgia won't last forever
- **Stick figure aesthetic could be seen as "cheap"** - Must prove polish overcomes this
- **Genre could cool off** - Battle royale hype faded, arena shooters could too

### Mitigation Strategies

**For Player Acquisition Risk:**
- **Build in public:** Share dev progress on Twitter, Reddit (r/gamedev, r/WebGames), TikTok
- **Launch early:** Get MVP in players' hands fast, iterate based on feedback
- **Community first:** Foster Discord community pre-launch, involve players in development decisions
- **Content creator outreach:** Send demo to YouTubers/streamers who cover .io games or indie games
- **Reddit launch strategy:** Strategic posts on r/gaming, r/WebGames when ready (authentic, not spammy)

**For Netcode Complexity Risk:**
- **Follow proven patterns:** Implement Gabriel Gambetta's guide step-by-step
- **Prototype early:** Test netcode with 2-player matches before building full game
- **Artificial latency testing:** Add network delay simulation to local testing
- **Community beta testing:** Recruit players across different regions to test real-world conditions
- **Plan for iteration:** Budget extra time for netcode polish after initial implementation

**For Solo Developer Bottleneck:**
- **Scope discipline:** Ruthlessly cut features that don't serve core loop
- **Asset packs:** Use quality third-party assets to avoid art bottleneck
- **Modular architecture:** Code in a way that allows community contributions later
- **Document everything:** Make knowledge transfer easy if need to onboard help
- **Sustainable pace:** Avoid burnout with realistic milestones and breaks

**For Critical Mass Risk:**
- **Bots for empty matches:** Placeholder AI opponents until player count grows
- **Cross-region matchmaking:** Start with global pool, regionalize only when viable
- **Async content:** Add single-player challenges/practice mode for off-peak times
- **"Game is in beta" messaging:** Set expectations that player base is growing
- **Referral incentives:** Reward players for inviting friends (cosmetics, not pay-to-win)

**For Mobile Performance Risk:**
- **Test on real devices:** Borrow/buy mid-range phones for testing (iPhone 12, Pixel 5)
- **Performance budget:** Set target frame time, profile regularly
- **Scalable quality settings:** Auto-detect device capability, adjust effects
- **Progressive enhancement:** Core gameplay works on potato devices, fancy effects for high-end

---

## Success Criteria

### MVP Definition

**Minimum Playable Version (Public Beta):**

**Core Features Required:**
- ✅ **Multiplayer matches:** 2-8 players in real-time combat
- ✅ **Two game modes:** FFA Deathmatch AND Team Deathmatch
- ✅ **2-3 maps:** Balanced arenas with weapon spawns
- ✅ **5-6 weapons:** Melee + ranged variety (from prototype)
- ✅ **Basic matchmaking:** Queue system connects players to matches
- ✅ **Social auth:** Google/Discord login for accounts
- ✅ **Persistent stats:** Kills, deaths, win rate tracked per account
- ✅ **60 FPS desktop, 30+ mobile:** Smooth performance targets met
- ✅ **<100ms latency feel:** Client-side prediction working properly
- ✅ **Basic progression:** Player levels, simple unlocks

**What MVP Does NOT Include:**
- ❌ Multiple game modes (add post-launch)
- ❌ Extensive cosmetics (basic only)
- ❌ Ranked competitive mode
- ❌ Clan/party systems
- ❌ Spectator mode
- ❌ Replay system
- ❌ Tournaments

**MVP Success Criteria:**
- Game is fun in first 30 seconds (new player experience)
- No major bugs that break matches
- Matchmaking populates within 60 seconds (given enough players)
- Players complete 3+ matches in first session (retention signal)
- Positive feedback from beta testers

### Success Metrics

**Player Acquisition:**
- **Month 1:** 1,000 unique players (beta launch validation)
- **Month 3:** 10,000 unique players (word-of-mouth spreading)
- **Month 6:** 50,000+ unique players (sustainable growth)

**Engagement & Retention:**
- **Session Length:** Average 15-20 minutes (3-5 matches per session)
- **Day 1 Retention:** 40%+ (players return next day)
- **Day 7 Retention:** 20%+ (hooked players)
- **Day 30 Retention:** 10%+ (core community forming)
- **Matches per Player:** 5+ average (re-engagement working)

**Technical Performance:**
- **Average Latency:** <100ms for 80% of players
- **Frame Rate:** 60 FPS on 90% of desktop clients
- **Mobile Frame Rate:** 30+ FPS on 70% of mobile devices
- **Server Uptime:** 99%+ availability
- **Crash Rate:** <1% of sessions

**Community Health:**
- **Discord Members:** 500+ within 3 months
- **Reddit Subscribers:** 1,000+ on r/StickRumble (if created)
- **Concurrent Players:** 50+ during peak hours (enough for matchmaking)
- **User Reviews:** 4+ star average on feedback platforms
- **Content Created:** 10+ YouTube videos, community highlights

**Business Metrics (Post-Monetization):**
- **Cost Coverage:** Revenue covers infrastructure costs (break even)
- **ARPPU (Average Revenue Per Paying User):** $5-10
- **Conversion Rate:** 2-5% of players purchase cosmetics
- **Infrastructure Costs:** Under $100/month for first 1,000 concurrent players

### Launch Goals

**Pre-Launch (MVP Development):**
- ✅ Technical architecture validated (DONE - research complete)
- ✅ Single-player prototype demonstrates feel (DONE)
- 🎯 Multiplayer MVP functional (core development phase)
- 🎯 Beta community of 50-100 testers recruited
- 🎯 Discord server active with engaged members
- 🎯 Dev blog documenting progress (build-in-public strategy)

**Soft Launch (Closed Beta):**
- 🎯 100-500 players invited for testing
- 🎯 Critical bugs identified and fixed
- 🎯 Netcode validated across different network conditions
- 🎯 Balance tuning based on real matches
- 🎯 Matchmaking works reliably at low player counts
- 🎯 Key performance indicators tracked (retention, session length)

**Public Launch (Open Beta):**
- 🎯 1,000+ players in first week
- 🎯 Positive reception on Reddit/Twitter
- 🎯 At least 2-3 YouTubers/streamers cover the game
- 🎯 Concurrent player count sustains matchmaking (50+ peak hours)
- 🎯 Infrastructure stable under load
- 🎯 Community feedback mostly positive

**Post-Launch (First 3 Months):**
- 🎯 Regular content updates (new map/weapon every 4-6 weeks)
- 🎯 Player count growing or stable (not declining)
- 🎯 Community self-organizing (tournaments, clans, content)
- 🎯 Break even on infrastructure costs
- 🎯 Clear roadmap for next 6 months based on player feedback

**Long-Term Vision (6-12 Months):**
- 🎯 10,000+ active players
- 🎯 Ranked competitive mode live
- 🎯 Esports scene emerging (community tournaments)
- 🎯 Mobile app wrappers (App Store/Play Store) if validated
- 🎯 Sustainable revenue supporting continued development

---

## Next Steps

### Immediate Actions

⚠️ **REALITY CHECK:** Thursday deadline for MVP with part-time availability is approximately 3-5 days of work. Below is both the ideal roadmap AND the emergency sprint plan.

**🚨 EMERGENCY MVP SPRINT (Target: Thursday)**

**Absolute Minimum to Demo:**
1. **Day 1-2:** Set up basic Go WebSocket server + Phaser client connection
2. **Day 3:** Get 2 players syncing position in same room (simple state broadcasting)
3. **Day 4:** Add shooting mechanics, basic hit detection (server validates)
4. **Day 5 (Thursday):** Deploy to VPS, test with 2+ real clients, demo functional

**What Gets CUT for Thursday:**
- ❌ Matchmaking (players manually join room IDs)
- ❌ Auth system (guest players with random IDs)
- ❌ Multiple maps (one test arena)
- ❌ Multiple game modes (just FFA)
- ❌ Client prediction (will feel laggy but functional)
- ❌ Persistent stats (in-match only)
- ❌ Polish, effects, audio (core mechanics only)

**Post-Thursday Roadmap (Original Plan):**

**Week 1-2: Project Setup & Foundation**
1. Set up new Git repository (fresh greenfield start)
2. Initialize Golang server project structure
3. Set up Phaser 3 client project (TypeScript)
4. Configure development environment (Docker, local databases)
5. Implement basic WebSocket connection (client ↔ server handshake)

**Week 3-4: Core Multiplayer Proof of Concept**
6. Server-authoritative game loop (60 tick/sec)
7. Sync 2 players in same room (position updates)
8. Basic input handling (movement, shooting)
9. Deploy to cloud VPS for testing (latency validation)
10. Verify <100ms latency on real network

**Week 5-8: Netcode Implementation**
11. Client-side prediction (immediate local response)
12. Server reconciliation (correct mispredictions)
13. Delta compression (bandwidth optimization)
14. Test with artificial latency (100ms, 150ms, packet loss)
15. Refine until gameplay feels responsive

**Week 9-12: Game Features**
16. Port weapons from prototype to multiplayer
17. Implement 2-3 balanced maps
18. Basic matchmaking queue (Redis-based)
19. OAuth integration (Google/Discord login)
20. Persistent player stats (PostgreSQL)

**Week 13-16: Polish & Beta Prep**
21. Visual effects and audio integration
22. Mobile touch controls optimization
23. Performance profiling and optimization
24. Bug fixing and stability improvements
25. Beta tester recruitment (Discord, Reddit)

**Week 17+: Soft Launch**
26. Closed beta with 50-100 players
27. Iterate based on feedback
28. Prepare for public launch

### Research Needs

**✅ COMPLETED:**
- Multiplayer architecture research (Phaser + Golang)
- Networking protocol evaluation (WebSocket vs WebRTC)
- Netcode patterns (client-side prediction, server reconciliation)
- Database architecture (PostgreSQL + Redis hybrid)
- Authentication options (go-pkgz/auth selected)
- Game server frameworks (custom Go server recommended)

**🔍 REMAINING RESEARCH:**

**Player Validation Studies:**
- Survey potential players on Flash game nostalgia (do they care?)
- Test prototype with target audience (is it fun?)
- Validate monetization willingness (will they pay for cosmetics?)

**Technical Deep Dives:**
- gorilla/websocket best practices and optimization patterns
- Phaser 3 networking examples (study existing implementations)
- Browser performance profiling tools (Chrome DevTools, Lighthouse)
- Mobile browser optimization techniques (iOS Safari quirks)

**Market Intelligence:**
- Krunker.io player demographics and retention (learn from leader)
- Successful .io game launch strategies (how did they get initial players?)
- Browser game discovery channels (where do players find games?)
- Content creator preferences (what makes games streamable?)

**Competitive Analysis:**
- Deep play sessions of Krunker.io, Warbot.io (understand the bar)
- Community feedback on competitors (what do players complain about?)
- Monetization models that work (case studies of successful indie multiplayer)

✅ **Research priorities confirmed:** Technical research complete and sufficient for MVP development. Player validation and market intelligence will happen through early beta testing.

### Open Questions

**Game Design Decisions:**
1. ✅ **Deathmatch modes:** Both FFA (Free-for-All) and Team Deathmatch for MVP
2. **[NEEDS DECISION]** Respawn mechanic: Instant, wave-based, or delayed?
3. **[NEEDS DECISION]** Map size optimization: How many players per map feels best?
4. **[NEEDS DECISION]** Weapon balance: Should all weapons be viable, or intentional tier list?
5. **[NEEDS DECISION]** Progression pace: How fast should players level up?

**Technical Uncertainties:**
1. **[NEEDS TESTING]** Can single Go server handle 100+ concurrent players reliably?
2. **[NEEDS TESTING]** Is WebSocket latency acceptable for competitive play, or need WebRTC fallback?
3. **[NEEDS TESTING]** How much delta compression is needed for mobile data usage?
4. **[NEEDS DECISION]** Regional servers from day 1, or global pool initially?
5. **[NEEDS TESTING]** Mobile aim assist: How much is "fair"?

**Business & Scope:**
1. ✅ **Development time:** Part-time with MVP deadline Thursday
2. **[NEEDS DECISION]** Monetization timing: Launch with cosmetics, or add post-validation?
3. **[NEEDS DECISION]** Community platform: Discord-first, or Reddit, or both?
4. **[NEEDS DECISION]** Marketing budget: Any paid advertising, or pure organic?
5. ✅ **Long-term commitment:** Hobby project (passion over profit, sustainable pace)

**Content Strategy:**
1. **[NEEDS DECISION]** Map themes priority: Which 2-3 environments to build first?
2. **[NEEDS DECISION]** New weapons post-launch: How often to add content?
3. **[NEEDS DECISION]** Seasonal events: Worth the development complexity?
4. **[NEEDS CONFIRMATION]** Modding/custom modes: Support from launch or later?

**Player Experience:**
1. **[NEEDS TESTING]** Tutorial: Mandatory or skippable? How long?
2. **[NEEDS TESTING]** Bot matches: Good training or frustrating?
3. **[NEEDS TESTING]** Match length: Is 3-7 minutes optimal, or adjust?
4. **[NEEDS FEEDBACK]** Stick figure aesthetic: Does it attract or repel target audience?

---

## Appendices

### A. Research Summary

**Technical Research Completed (2025-11-25):**

Comprehensive technical architecture research was conducted covering multiplayer game server architecture, real-time networking protocols, and state synchronization patterns. Key findings:

**Recommended Technology Stack:**
- **Backend:** Custom Golang server with gorilla/websocket (proven at scale, cost-effective)
- **Frontend:** Phaser 3 (TypeScript) with React UI layer (existing prototype validates viability)
- **Networking:** WebSocket protocol with client-side prediction + server reconciliation
- **Databases:** PostgreSQL (persistence) + Redis (sessions/matchmaking queues)
- **Authentication:** go-pkgz/auth for multi-provider OAuth (Google, Discord, etc.)

**Key Architecture Decisions:**
1. **Custom server over frameworks** (Nakama considered but overkill for scope)
2. **WebSocket over WebRTC** (simpler, sufficient latency for arena shooter)
3. **Server-authoritative gameplay** (anti-cheat, fairness over ultra-low latency)
4. **Horizontal scaling pattern** (add server instances as player count grows)

**Performance Targets Validated:**
- Single server instance: 100+ concurrent players (10-12 simultaneous matches)
- Network latency: <100ms target achievable with WebSocket
- Client-side prediction masks latency for responsive feel
- Infrastructure costs: $15-50/month for MVP scale

**See:** Full technical research document at `/docs/research-technical-2025-11-25.md`

### B. Stakeholder Input

**Primary Stakeholder:** Solo developer/creator

**Project Vision:**
- Recreate beloved Flash-era stick figure shooter experience with modern technology
- Build sustainable multiplayer game with fair monetization
- Demonstrate that browser games can have competitive depth and polish

**Success Definition:**
- Game is fun to play (personal enjoyment validates design)
- Achieves critical mass for matchmaking (50+ concurrent players)
- Covers infrastructure costs (break even minimum)
- Community forms around the game (players care about it)

**Development Philosophy:**
- Hobby project - passion-driven, sustainable pace to avoid burnout
- Build in public - transparent development, community involvement
- Quality where it matters - polish core gameplay, pragmatic on features
- Learn and improve - technical skills, game design, community management
- **Deadline-driven MVP:** Aggressive Thursday deadline requires extreme scope discipline

**[NEEDS CONFIRMATION]** Additional stakeholder input to document:
- Target audience feedback (once prototype shared)
- Beta tester preferences and pain points
- Community suggestions from Discord/Reddit
- Potential partners or collaborators

### C. References

**Inspiration Games:**
- **Stick Arena** (XGen Studios) - Original Flash stick figure shooter, millions of players
- **Krunker.io** - Modern browser FPS, proves browser games can have competitive depth
- **Brawlhalla** - Demonstrates stick figures viable for competitive esports
- **Enter the Gungeon** - Top-down combat feel reference
- **Hotline Miami** - Fast-paced action, satisfying feedback

**Technical Resources:**
- Gabriel Gambetta: "Client-Side Prediction and Server Reconciliation" (authoritative netcode guide)
- Gaffer on Games: State synchronization and snapshot compression patterns
- Phaser 3 Documentation: https://phaser.io/docs
- gorilla/websocket GitHub: https://github.com/gorilla/websocket
- go-pkgz/auth: https://github.com/go-pkgz/auth

**Market Research:**
- Technical Research Document: `/docs/research-technical-2025-11-25.md`
- WebRTC vs WebSocket for multiplayer games (Rune.ai blog, 2025)
- Matchmaking at scale (AccelByte blog)
- .io game success stories (Agar.io, Slither.io case studies)

**Community Resources:**
- r/WebGames - Browser game discovery community
- r/gamedev - Indie game development community
- Phaser Discord - Technical support for Phaser 3
- Go community forums - Golang multiplayer patterns

**Asset Resources (Planned):**
- GameAudioGDC, Sonniss - Free SFX libraries
- Kenney.nl - Game assets and sound effects
- Aseprite - Pixel art creation tool
- SFXR/Chiptone - Retro game sound generation

---

_This Game Brief serves as the foundational input for Game Design Document (GDD) creation._

_Next Steps: Use the `workflow gdd` command to create detailed game design documentation._
