# Epic 7: Arena Environments

**Goal:** Players experience varied tactical combat across different map designs

**Value Delivered:** 2-3 polished maps with distinct playstyles and strategic depth

**FRs Covered:** FR15 (2-3 maps)

**Status:** Not Started (0/5 stories)

---

## Stories

### Story 7.1: Design and Implement Industrial Arena Map

As a player,
I want to play on a balanced industrial-themed map,
So that I can experience competitive mid-range combat.

**Acceptance Criteria:**

**Given** I join a match on Industrial Arena
**When** the map loads
**Then** I see an industrial warehouse environment with shipping containers and metal platforms

**And** map size: 1920 x 1080 pixels (fits one screen at standard zoom)
**And** 4 balanced spawn points (corners of map)
**And** 5 weapon pickup locations (1 center, 4 around perimeter)
**And** mix of open center area and tight corridors around edges

**And** map features:
- Shipping containers as cover (block bullets, players can hide behind)
- Metal platforms with ramps (verticality, height advantage)
- Open center area (favors ranged weapons)
- Tight corridors near edges (favors close-range weapons)

**And** visual style: industrial gray/brown color palette, high contrast
**And** minimap generated from map layout (top-right corner UI)

**Prerequisites:** Story 6.6

**Technical Notes:**
- Map data: JSON file `maps/industrial_arena.json` with {tilesmap, spawnPoints, weaponSpawns, obstacles}
- Tileset: 32x32 pixel tiles (floor, wall, platform sprites)
- Collision layer: binary grid for obstacles (1 = solid, 0 = passable)
- Phaser tilemap: `this.make.tilemap({data: mapData, tileWidth: 32, tileHeight: 32})`
- Spawn points: `[{x: 100, y: 100}, {x: 1820, y: 100}, {x: 100, y: 980}, {x: 1820, y: 980}]`
- Weapon spawns: `[{x: 960, y: 540, type: 'ak47'}, ...]`
- Minimap: render map at 10% scale in top-right corner

---

### Story 7.2: Design and Implement Urban Rooftops Map

As a player,
I want to play on a close-quarters urban map,
So that I can experience intense CQC combat.

**Acceptance Criteria:**

**Given** I join a match on Urban Rooftops
**When** the map loads
**Then** I see a rooftop environment with buildings, alleyways, and neon signs

**And** map size: 1920 x 1080 pixels
**And** 4 balanced spawn points
**And** 5 weapon pickup locations
**And** emphasis on tight spaces and close-quarters engagements

**And** map features:
- Multi-level rooftops connected by stairs/ladders
- Narrow alleyways between buildings (chokepoints)
- Drop-down areas (one-way vertical movement)
- Fewer open sightlines (favors shotgun/melee)

**And** visual style: urban nighttime, neon signs, dark blue/purple palette
**And** distinct from Industrial Arena (players can easily identify which map they're on)

**Prerequisites:** Story 7.1

**Technical Notes:**
- Map data: `maps/urban_rooftops.json`
- Multi-level: use layered tilemaps (ground level + rooftop level)
- Ladders: special tiles trigger vertical movement (climb animation)
- Drop-downs: one-way collision (can jump down but not up)
- Lighting: darker overall, neon signs glow (emissive sprites)
- Balance: more corners and cover (slower gameplay, tactical)

---

### Story 7.3: Implement Map Selection and Rotation

As a player,
I want to play on different maps,
So that gameplay stays fresh and varied.

**Acceptance Criteria:**

**Given** a match is created in matchmaking
**When** the match starts
**Then** a map is selected (Industrial Arena or Urban Rooftops)

**And** map selection is random or based on player votes (if lobby voting enabled)
**And** consecutive matches avoid repeating same map (rotation prevents staleness)
**And** all players receive `match:start` message with `{mapName: 'industrial_arena'}`

**And** map loads on all clients simultaneously
**And** if map fails to load: fallback to default map (Industrial Arena)

**Prerequisites:** Story 7.2

**Technical Notes:**
- Server map pool: `['industrial_arena', 'urban_rooftops']` (expandable array)
- Random selection: `maps[Math.floor(Math.random() * maps.length)]`
- Rotation tracking: store `lastMapPlayed` in room state, exclude from next selection
- Client map loading: `this.scene.start('GameScene', {mapName: 'industrial_arena'})`
- Map registry: `{industrial_arena: require('./maps/industrial_arena.json'), ...}`
- Error handling: if map JSON missing, use fallback default map

---

### Story 7.4: Optimize Map Assets and Loading Times

As a developer,
I want map loading to be fast,
So that matches start quickly (<15 seconds).

**Acceptance Criteria:**

**Given** a match starts
**When** the map loads
**Then** all assets (tiles, sprites, collision data) load in <10 seconds on desktop

**And** mobile devices load in <15 seconds
**And** loading screen displays progress bar (0-100%)
**And** loading screen shows map preview image (gives players context)

**And** assets are optimized:
- Tileset sprites: PNG with compression, max 512x512 spritesheet
- Map JSON: minified, <100 KB
- Preloading: critical assets loaded during lobby countdown

**Prerequisites:** Story 7.3

**Technical Notes:**
- Phaser preload: `this.load.image('tileset', 'assets/maps/tileset.png')`
- Progress bar: `this.load.on('progress', (value) => { progressBar.fillRect(0, 0, 800 * value, 50) })`
- Asset optimization: use TexturePacker for sprite atlases
- Compression: optimize PNGs with TinyPNG or similar
- Lazy loading: load only selected map assets (not all maps at once)
- Cache: assets cached in browser after first load (faster subsequent loads)

---

### Story 7.5: Implement Minimap with Player Positions

As a player,
I want a minimap showing player locations,
So that I can maintain tactical awareness.

**Acceptance Criteria:**

**Given** I am in a match
**When** I look at the minimap (top-right corner)
**Then** I see a small overview of the entire map

**And** my position: green dot or icon
**And** teammates (in TDM): blue dots
**And** enemies: red dots (visible if within 400px or recently fired weapon)
**And** weapon spawn locations: gray icons

**And** minimap updates in real-time (every 50ms)
**And** minimap is semi-transparent (doesn't obstruct gameplay)
**And** can toggle minimap visibility with M key

**Prerequisites:** Story 7.4

**Technical Notes:**
- Minimap: Phaser Graphics object rendering map at 1:10 scale
- Size: 200x120 pixels (fits in top-right corner)
- Player dots: 4px circles at scaled positions
- Fog of war: only show enemies if `distance < 400px || recentlyFired`
- Update frequency: every 50ms (20 Hz)
- Toggle: `this.minimap.setVisible(!this.minimap.visible)`
- Background: map silhouette with collision walls shown
