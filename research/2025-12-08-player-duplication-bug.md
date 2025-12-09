---
date: 2025-12-08T08:00:00-08:00
researcher: codebase-researcher-agent
topic: "Player character duplication bug when starting new match after first match ends"
tags: [research, codebase, game-scene, player-manager, match-lifecycle, cleanup]
status: complete
---

# Research: Player Character Duplication Bug When Starting New Match

**Date**: 2025-12-08T08:00:00-08:00
**Researcher**: codebase-researcher-agent

## Research Question

Investigate why player characters are duplicated on screen when a match ends and a new match starts. Understand:
1. GameScene cleanup and lifecycle
2. PlayerManager sprite management
3. Match transition flow (match:ended → new match)
4. Room state management and room:joined events
5. Sprite lifecycle and potential memory leaks

## Summary

**CRITICAL FINDING: There is NO mechanism to start a new match after the first match ends.**

The player duplication bug is a **symptom of a missing feature**, not a cleanup bug. The game currently:
1. Ends the match and displays match end screen
2. Allows players to close the modal (setting `matchEndData` to null in React)
3. **Does NOT** restart the match, create new rooms, or clean up sprites
4. Players remain connected to their original room with frozen game state
5. If a second `room:joined` event somehow fires, it would create duplicate sprites

The codebase has **no server-side or client-side logic for match restart/rematch**.

## Detailed Findings

### 1. GameScene Cleanup - NO Phaser Scene Lifecycle Methods

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameScene.ts`

**Key Finding**: GameScene has NO shutdown, destroy, or cleanup event handlers.

```typescript
// GameScene.ts - NO lifecycle methods
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Initialize managers, connect WebSocket
    // Lines 36-152
  }

  update(_time: number, delta: number): void {
    // Update loop - Lines 155-178
  }

  // NO shutdown() method
  // NO destroy() method
  // NO scene.events.on('shutdown', ...) handler
}
```

**Phaser Best Practice** (from web research):
- Use `this.events.once('shutdown', () => { sprites.length = 0; })` to clean up arrays
- Shutdown event fires AFTER children are wiped, so manual cleanup is needed
- Destroyed sprites can remain in arrays if not explicitly cleared

**Current State**: GameScene never calls `this.playerManager.destroy()` on shutdown.

### 2. PlayerManager Lifecycle - Cleanup Exists But Never Called

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/entities/PlayerManager.ts`

**Key Finding**: PlayerManager HAS a destroy() method but it's NEVER invoked.

```typescript
// PlayerManager.ts:179-197
/**
 * Cleanup all players
 */
destroy(): void {
  for (const sprite of this.players.values()) {
    sprite.destroy();
  }
  this.players.clear();

  for (const label of this.playerLabels.values()) {
    label.destroy();
  }
  this.playerLabels.clear();

  for (const aimIndicator of this.aimIndicators.values()) {
    aimIndicator.destroy();
  }
  this.aimIndicators.clear();

  this.playerStates.clear();
}
```

**Analysis**: The cleanup logic is implemented correctly BUT:
- GameScene never calls `this.playerManager.destroy()`
- No shutdown event handler triggers cleanup
- Sprites remain in memory indefinitely

**Player Tracking**:
```typescript
// PlayerManager.ts:31-35
private players: Map<string, Phaser.GameObjects.Rectangle> = new Map();
private playerLabels: Map<string, Phaser.GameObjects.Text> = new Map();
private aimIndicators: Map<string, Phaser.GameObjects.Line> = new Map();
private localPlayerId: string | null = null;
private playerStates: Map<string, PlayerState> = new Map();
```

All Maps persist across matches because they're never cleared.

### 3. Match Transition Flow - NO Match Restart Logic

#### Server Side - Match Ends But Never Restarts

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/game/match.go`

```go
// match.go:133-145
func (m *Match) EndMatch(reason string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Only end once
	if m.State == MatchStateEnded {
		return
	}

	m.State = MatchStateEnded
	m.EndReason = reason
}
```

**Server Behavior After Match End**:
1. Match state set to `MatchStateEnded`
2. `match:ended` broadcast sent to all players (broadcast_helper.go:202-225)
3. **NOTHING HAPPENS AFTER THIS**
4. Room remains active with ended match
5. Players remain connected to same room
6. No new match is created

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/game/room.go`

```go
// room.go:30-44
func NewRoom() *Room {
	match := NewMatch()

	// Enable test mode if TEST_MODE environment variable is set
	if os.Getenv("TEST_MODE") == "true" {
		match.SetTestMode()
		log.Println("Match created in TEST MODE (kill target: 2, time limit: 10s)")
	}

	return &Room{
		ID:         uuid.New().String(),
		Players:    make([]*Player, 0, 8),
		MaxPlayers: 8,
		Match:      match,
	}
}
```

**Room Creation**: Only happens when 2 waiting players connect (room.go:145-187).
- NO mechanism to create new match after first match ends
- NO room.Match reassignment or reset
- Existing room persists with ended match state

#### Client Side - Match End Just Hides Modal

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/App.tsx`

```typescript
// App.tsx:11-18
const handleMatchEnd = (data: MatchEndData, playerId: string) => {
  setMatchEndData(data)
  setLocalPlayerId(playerId)
}

const handleCloseMatchEnd = () => {
  setMatchEndData(null)  // <-- ONLY HIDES MODAL, NO CLEANUP
}
```

**Match End Flow**:
1. `match:ended` WebSocket message received
2. GameSceneEventHandlers.ts:253-254 triggers `window.onMatchEnd(matchEndData, localPlayerId)`
3. React displays `<MatchEndScreen>`
4. User clicks close button
5. `handleCloseMatchEnd()` sets `matchEndData = null`
6. Modal disappears
7. **GameScene remains unchanged** - frozen with input disabled

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`

```typescript
// GameSceneEventHandlers.ts:233-256
this.wsClient.on('match:ended', (data) => {
  const matchEndData = data as {
    winners: string[];
    finalScores: Array<{ playerId: string; kills: number; deaths: number; xp: number }>;
    reason: string;
  };
  console.log(`Match ended! Reason: ${matchEndData.reason}, Winners:`, matchEndData.winners);
  console.log('Final scores:', matchEndData.finalScores);

  // Freeze gameplay by disabling input handlers
  if (this.inputManager) {
    this.inputManager.disable();  // <-- INPUT FROZEN
  }
  if (this.shootingManager) {
    this.shootingManager.disable();  // <-- SHOOTING FROZEN
  }

  // Trigger match end UI via React callback
  const localPlayerId = this.playerManager.getLocalPlayerId();
  if (localPlayerId && window.onMatchEnd) {
    window.onMatchEnd(matchEndData, localPlayerId);
  }

  // NO CLEANUP, NO SCENE RESTART, NO MATCH RESET
});
```

### 4. Room State Management - No Rejoining or New Room Creation

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts`

```typescript
// GameSceneEventHandlers.ts:95-105
this.wsClient.on('room:joined', (data) => {
  const messageData = data as { playerId: string };
  console.log('Joined room as player:', messageData.playerId);

  // Set local player ID so we can highlight our player
  if (messageData.playerId) {
    this.playerManager.setLocalPlayerId(messageData.playerId);
    // Initialize health bar to full health on join
    this.localPlayerHealth = 100;
    this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100, false);
  }
});
```

**Analysis**:
- `room:joined` sets local player ID but does NOT clear existing sprites
- If this event fires twice (e.g., reconnect scenario), it would NOT remove old sprites
- PlayerManager.updatePlayers() in `player:move` handler WOULD create duplicate sprites

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/entities/PlayerManager.ts`

```typescript
// PlayerManager.ts:58-86
updatePlayers(playerStates: PlayerState[]): void {
  const currentPlayerIds = new Set(playerStates.map(p => p.id));

  // Remove players that no longer exist
  for (const [id, sprite] of this.players) {
    if (!currentPlayerIds.has(id)) {
      sprite.destroy();
      this.players.delete(id);
      // ... cleanup labels and aim indicators
    }
  }

  // Update or create players
  for (const state of playerStates) {
    let sprite = this.players.get(state.id);

    if (!sprite) {
      // Create new player sprite  <-- HAPPENS ON FIRST player:move AFTER room:joined
      sprite = this.scene.add.rectangle(/* ... */);
      this.players.set(state.id, sprite);
      // ... create labels and aim indicators
    }

    // Update position, health, aim, etc.
  }
}
```

**Duplication Scenario**:
1. Match 1: Players A and B join, sprites created
2. Match ends: Sprites frozen but NOT destroyed
3. IF `room:joined` fires again (reconnect/new room):
   - localPlayerId updated
   - Old sprites still exist in Map
4. `player:move` arrives with NEW player states:
   - `currentPlayerIds` contains new player A, B
   - Loop checks if sprites exist: `this.players.get(A)` → FINDS OLD SPRITE
   - NO new sprite created (old ones reused)

**HOWEVER**: The bug report says duplicates appear, which suggests:
- Either the Map is somehow cleared causing new sprites to be created
- OR player IDs change between matches, creating new entries
- OR the Phaser scene's display list retains destroyed objects

### 5. Sprite Lifecycle - Phaser Display List Persistence

**Key Insight from Web Research**:
> "In a scene's shutdown event, this.children are always empty. The reason is that before the shutdown event is called, all 'children' are wiped out."
>
> "When restarting a scene, destroyed sprites from the last cycle can still be in arrays. The solution is to clean up using the shutdown event: `this.events.once('shutdown', () => { sprites.length = 0; })`"

**Current Issue**:
- GameScene never registers shutdown event handler
- PlayerManager Maps are never cleared
- Even though Phaser may clear display list, the Map references prevent garbage collection
- If scene is somehow restarted (not currently implemented), old sprites could reappear

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/ui/common/PhaserGame.tsx`

```typescript
// PhaserGame.tsx:13-36
useEffect(() => {
  // Initialize Phaser game
  if (!gameRef.current) {
    gameRef.current = new Phaser.Game(GameConfig);

    // Expose onMatchEnd callback to Phaser game
    if (onMatchEnd) {
      window.onMatchEnd = onMatchEnd;
    }
  }

  // Cleanup on unmount
  return () => {
    if (gameRef.current) {
      gameRef.current.destroy(true);  // <-- ONLY ON COMPONENT UNMOUNT
      gameRef.current = null;
    }

    // Cleanup global callback
    if (onMatchEnd) {
      delete window.onMatchEnd;
    }
  };
}, [onMatchEnd]);
```

**Analysis**: Phaser game is only destroyed when React component unmounts (app closes).
- No scene restart mechanism
- No cleanup between matches

## Code References

### Client-Side Files
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameScene.ts:1-203` - No shutdown/cleanup handlers
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts:233-256` - match:ended handler (freezes input, no cleanup)
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/entities/PlayerManager.ts:179-197` - destroy() method (never called)
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/entities/PlayerManager.ts:58-175` - updatePlayers() (creates sprites)
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/ui/common/PhaserGame.tsx:13-36` - Phaser game lifecycle
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/App.tsx:11-18` - Match end modal (just hides UI)

### Server-Side Files
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/game/match.go:133-145` - EndMatch() (no restart)
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/game/room.go:30-44` - NewRoom() (only on initial connect)
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/game/room.go:145-187` - AddPlayer() (creates room when 2 players waiting)
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/network/broadcast_helper.go:202-225` - broadcastMatchEnded()

## Architecture Insights

### Current Match Lifecycle (Incomplete)
```
[Connection] → [Room Created] → [Match Started] → [Match Ended] → [FROZEN STATE]
                                                                          ↓
                                                                    (NO CLEANUP)
                                                                    (NO RESTART)
```

### Missing Flow for Match Restart
```
[Match Ended] → [Cleanup Phase] → [New Match Start]
                      ↓
              - PlayerManager.destroy()
              - Clear WebSocket handlers
              - Scene shutdown event
              - Server creates new match
              - room:joined re-sent
              - Fresh player sprites created
```

### Design Patterns Observed
1. **Server-Authoritative**: Room and match management on server
2. **Event-Driven**: WebSocket messages trigger client updates
3. **Singleton GameScene**: Single scene runs for entire app lifetime
4. **No Scene Transitions**: Unlike typical Phaser games with MenuScene → GameScene → EndScene

### Known Issues
1. **No match restart mechanism** - Server or client
2. **No scene cleanup handlers** - Phaser shutdown events not used
3. **Input permanently disabled** - After match:ended, game is frozen
4. **Persistent state** - Maps never cleared between matches
5. **Missing rematch/lobby flow** - Per MatchEndScreen.tsx:62-64, lobby system is "coming in Epic 5"

## Open Questions

### How Does Duplication Actually Occur?

The bug report states duplicates appear, but current code analysis suggests:
- **Hypothesis 1**: Players disconnect/reconnect causing new `room:joined` without sprite cleanup
- **Hypothesis 2**: Server sends duplicate player states in `player:move` messages
- **Hypothesis 3**: Player IDs change between matches, creating new Map entries alongside old ones
- **Hypothesis 4**: Phaser display list retains destroyed sprites (unlikely based on Phaser docs)

**Needs Manual Testing**:
1. Set breakpoint in PlayerManager.updatePlayers()
2. Check `this.players.size` after match:ended
3. Trigger whatever causes "new match" (unclear from code)
4. See if sprites are duplicated or reused

### Is There a Hidden Match Restart Path?

**Searched for**: `match:start`, `StartMatch`, `scene.restart`, `scene.start`
**Result**: Only found in documentation/comments, NOT in actual code.

**GDD Reference** (docs/epics.md:1429):
```
- Transition: `match:start` message with {roomId, players, mapName}
```

This suggests Epic 5 (Lobby System) will implement match restart, but it's NOT currently implemented.

### What Triggers "New Match Start" in Bug Report?

The bug report reproduction steps say:
```
1. Start a match with 2+ players
2. Play until match ends (kill target or time limit)
3. Start a new match  <-- HOW?
4. Observe: player characters appear duplicated
```

**Current code cannot start a new match**. Possible explanations:
- Bug reporter manually restarted server/client (causing reconnect)
- There's a hidden dev/test command not in the codebase
- Bug is anticipated future issue when Epic 5 lobby is implemented

## Root Cause Analysis

### PRIMARY ROOT CAUSE: Missing Feature
**The player duplication bug cannot occur with current code because there is no way to start a new match.**

The bug will DEFINITELY occur when match restart is implemented IF:
1. GameScene does not register shutdown event handlers
2. PlayerManager.destroy() is not called before room:joined
3. Player sprite Maps are not cleared before new match

### SECONDARY ROOT CAUSE: No Cleanup on Match End
Even though restart isn't implemented, cleanup should still happen:
- Input remains frozen permanently
- Memory leaks from unclosed resources
- WebSocket connection persists in frozen state

### Design Flaw
Using a single persistent GameScene without lifecycle management makes match restart complex. Typical Phaser patterns:
- **Multi-Scene**: MainMenu → GameScene → GameOver (scene transitions with automatic cleanup)
- **Scene Restart**: `this.scene.restart()` triggers shutdown → create cycle
- **Current Approach**: Single long-running scene (requires manual cleanup)

## Recommendations

### Immediate Fix (Before Epic 5 Implementation)
1. **Add shutdown event handler** to GameScene.create():
   ```typescript
   this.events.once('shutdown', () => {
     this.playerManager.destroy();
     this.projectileManager.destroy();
     this.wsClient.disconnect();
   });
   ```

2. **Add scene restart method** for future use:
   ```typescript
   restartMatch(): void {
     this.scene.restart();
   }
   ```

3. **Clear player state on room:joined**:
   ```typescript
   this.wsClient.on('room:joined', (data) => {
     // Clear existing players before setting new local player
     this.playerManager.destroy();
     this.playerManager.setLocalPlayerId(messageData.playerId);
   });
   ```

### Long-Term Fix (Epic 5: Lobby System)
1. **Server**: Implement match restart on existing room
   ```go
   func (r *Room) StartNewMatch() {
       r.Match = NewMatch()
       r.Match.Start()
       // Broadcast match:start to all players
   }
   ```

2. **Client**: Handle match:start event
   ```typescript
   this.wsClient.on('match:start', () => {
     this.scene.restart();  // Triggers shutdown → cleanup → create
   });
   ```

3. **Architecture Change**: Consider multi-scene approach
   - LobbyScene: Player waiting, ready up
   - GameScene: Active match
   - ResultsScene: Match end screen (instead of modal)
   - Automatic cleanup on scene transitions

### Testing Recommendations
1. **Integration test**: Simulate match end → match start flow
2. **Memory leak test**: Check sprite count after multiple match cycles
3. **Visual test**: Verify no duplicate sprites after restart
4. **Unit test**: Verify PlayerManager.destroy() clears all Maps

## Web Research Sources

- [Scene Lifecycle | phaserjs/phaser | DeepWiki](https://deepwiki.com/phaserjs/phaser/3.1-scene-lifecycle)
- [Scene/GameObject destruction and Scene Children properties are confusing · Issue #6143 · phaserjs/phaser](https://github.com/phaserjs/phaser/issues/6143)
- [Scenes.Events](https://docs.phaser.io/api-documentation/event/scenes-events)
- [Scenes](https://docs.phaser.io/phaser/concepts/scenes)
- [Scene manager - Notes of Phaser 3](https://rexrainbow.github.io/phaser3-rex-notes/docs/site/scenemanager/)
- [Deprecated: Phaser 3 API Documentation - Namespace: Events](https://photonstorm.github.io/phaser3-docs/Phaser.Scenes.Events.html)
- [Phaser.Scenes.Events.SHUTDOWN](https://newdocs.phaser.io/docs/3.60.0/Phaser.Scenes.Events.SHUTDOWN)
- [Destroy a scene and re-instantiate it - Phaser 3 - Phaser](https://phaser.discourse.group/t/destroy-a-scene-and-re-instantiate-it/12136)
- [Scene Lifecycle Management](https://groups.google.com/g/phaser3-dev/c/Mb_T3CPgLSk)
- [Phaser.Scenes.Events](https://docs.phaser.io/api-documentation/namespace/scenes-events)
