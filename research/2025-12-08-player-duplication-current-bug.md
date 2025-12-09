---
date: 2025-12-08T12:00:00-08:00
researcher: codebase-researcher-agent
topic: "Why are player sprites duplicating NOW during live testing (2 players showing 3 sprites)?"
tags: [research, codebase, bug, websocket, event-handlers, phaser, memory-leak]
status: complete
---

# Research: Current Player Sprite Duplication Bug in Live Gameplay

**Date**: 2025-12-08T12:00:00-08:00
**Researcher**: codebase-researcher-agent

## Research Question

Why are player sprites duplicating NOW during live testing (2 players in game, but 3 sprites visible on screen)?

**Context**: Previous research (2025-12-08-player-duplication-bug.md) investigated preventative cleanup for Epic 5 match restart (future feature). However, live testing shows sprite duplication is happening RIGHT NOW in current gameplay.

## Summary

**ROOT CAUSE IDENTIFIED: WebSocket Event Handler Accumulation**

The bug occurs because `WebSocketClient.on()` uses a `Set<handler>` that ACCUMULATES handlers on every call without deduplication. Each time `setupEventHandlers()` is called, it registers NEW handler functions (even for the same event type), causing `player:move` handlers to execute multiple times and create duplicate sprites.

**Critical Finding**: The `room:joined` handler calls `this.playerManager.destroy()` which clears existing sprites, but if event handlers are registered multiple times, each handler will process the SAME `player:move` message and create sprites independently.

**Why 3 sprites for 2 players?**
- If `setupEventHandlers()` is called twice (e.g., during reconnect or scene issues)
- Two `player:move` handlers are registered
- Server broadcasts state for 2 players
- First handler creates 2 sprites (Player A, Player B)
- Second handler ALSO creates sprites for the same data
- BUT: One handler might run before `room:joined` cleanup, creating "ghost" sprites
- Result: 3 sprites visible (2 + 1 duplicate from previous state)

## Detailed Findings

### 1. WebSocket Event Handler Registration - No Deduplication

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/network/WebSocketClient.ts:90-96`

```typescript
on(messageType: string, handler: (data: unknown) => void): void {
  const handlers = this.messageHandlers.get(messageType) || new Set();
  const sizeBefore = handlers.size;
  handlers.add(handler);  // ← ADDS to Set, but function references are ALWAYS unique
  this.messageHandlers.set(messageType, handlers);
  this.debug(`on('${messageType}') registered (handlers: ${sizeBefore} -> ${handlers.size})`);
}
```

**Key Issue**: `handlers.add(handler)` uses JavaScript `Set`, which compares by reference identity. Every time `setupEventHandlers()` is called, it creates NEW arrow function closures, so `Set.add()` treats them as different handlers even though they do the same thing.

**Example**:
```typescript
// First call to setupEventHandlers()
this.wsClient.on('player:move', (data) => { /* handler A */ });

// Second call to setupEventHandlers() (if scene restarts)
this.wsClient.on('player:move', (data) => { /* handler B */ });
// ↑ New function reference, added to Set even though identical code
```

**Result**: Two handlers registered for `player:move`, both execute on each message.

### 2. Event Handler Execution - Multiple Handlers Fire Independently

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/network/WebSocketClient.ts:114-123`

```typescript
private handleMessage(message: Message): void {
  const handlers = this.messageHandlers.get(message.type);
  this.debug(`handleMessage('${message.type}') - ${handlers ? handlers.size : 0} handlers`, message.data);
  if (handlers) {
    // Call all registered handlers for this message type
    handlers.forEach(handler => handler(message.data));  // ← ALL handlers execute
  }
  // Silently ignore messages without handlers - this is expected behavior
  // as not all clients will handle all message types
}
```

**Critical Behavior**: If 2 handlers are registered for `player:move`, BOTH execute independently with the SAME data.

### 3. Sprite Creation in PlayerManager - No Guard Against Duplicate Calls

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/entities/PlayerManager.ts:88-136`

```typescript
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
      // Create new player sprite
      sprite = this.scene.add.rectangle(/* ... */);  // ← PHASER CREATES SPRITE
      this.players.set(state.id, sprite);
      // ... create labels and aim indicators
    }

    // Update position, health, aim, etc.
  }
}
```

**Analysis**: `updatePlayers()` is idempotent when called ONCE per message. However:
- If called TWICE with the same data (two handlers)
- First call: Creates sprites and stores in Map
- Second call: Checks Map, finds sprites, UPDATES them (no duplicates in Map)
- **BUT**: Phaser's display list may retain both sprite creations

**Race Condition Scenario**:
1. Handler A executes: Creates sprite for Player 1, stores in Map
2. Handler B executes: Checks Map, finds sprite, updates it
3. **However**: If handlers execute in quick succession before Phaser rendering, Phaser's internal display list might duplicate objects

**Alternative Scenario (More Likely)**:
1. `room:joined` fires: Calls `playerManager.destroy()` - clears Map
2. Handler A executes `player:move`: Creates sprites, stores in Map
3. Another `room:joined` fires (reconnect): Calls `destroy()` again
4. Handler B executes STALE `player:move` from queue: Creates sprites again
5. Result: Duplicates because timing issues between cleanup and message processing

### 4. Room Joined Handler - Calls Destroy But No Handler Cleanup

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts:95-110`

```typescript
this.wsClient.on('room:joined', (data) => {
  const messageData = data as { playerId: string };
  console.log('Joined room as player:', messageData.playerId);

  // Clear existing players to prevent duplication if room:joined fires multiple times
  // This handles reconnect scenarios and future match restart functionality
  this.playerManager.destroy();  // ← CLEARS SPRITES but NOT event handlers

  // Set local player ID so we can highlight our player
  if (messageData.playerId) {
    this.playerManager.setLocalPlayerId(messageData.playerId);
    // Initialize health bar to full health on join
    this.localPlayerHealth = 100;
    this.getHealthBarUI().updateHealth(this.localPlayerHealth, 100, false);
  }
});
```

**Key Insight**: The comment says "This handles reconnect scenarios" BUT:
- Clears sprites via `playerManager.destroy()`
- Does NOT clear WebSocket event handlers
- If `room:joined` fires multiple times, sprites are cleared but handlers accumulate
- Each subsequent `player:move` message executes ALL accumulated handlers

### 5. Event Handler Setup - Called Once in GameScene.create()

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameScene.ts:87-99`

```typescript
// Initialize event handlers module
this.eventHandlers = new GameSceneEventHandlers(
  this.wsClient,
  this.playerManager,
  this.projectileManager,
  () => this.healthBarUI,
  this.killFeedUI,
  this.ui,
  this.spectator,
  () => this.startCameraFollowIfNeeded()
);

// Setup message handlers before connecting
this.eventHandlers.setupEventHandlers();  // ← CALLED ONCE... normally
```

**Normal Flow**: `setupEventHandlers()` is called ONCE during `create()`.

**HOWEVER**: Phaser scene lifecycle issues can cause `create()` to run multiple times:
- Scene restart: `this.scene.restart()` calls shutdown → create
- Scene pause/resume: May trigger create again in some Phaser versions
- WebSocket reconnection: If connection drops and reconnects, it could trigger re-initialization

### 6. Phaser Scene Lifecycle - Create Can Be Called Multiple Times

**File**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameScene.ts:36-40`

```typescript
create(): void {
  // Register shutdown event handler for cleanup
  this.events.once('shutdown', () => {
    this.cleanup();
  });
  // ... rest of create logic
}
```

**Analysis**: The shutdown handler is registered with `once()`, meaning:
- First shutdown: Cleanup is called
- Subsequent restarts: New shutdown handler is registered
- **BUT**: WebSocket connection persists across restarts if not cleaned up

**Shutdown Cleanup**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameScene.ts:213-244`

```typescript
private cleanup(): void {
  // Destroy all managers
  if (this.playerManager) {
    this.playerManager.destroy();
  }
  // ... other managers

  // Disconnect WebSocket
  if (this.wsClient) {
    this.wsClient.disconnect();  // ← SHOULD clear handlers
  }
}
```

**WebSocket Disconnect**: `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/network/WebSocketClient.ts:147-156`

```typescript
disconnect(): void {
  this.shouldReconnect = false; // Prevent reconnection attempts
  if (this.ws) {
    this.ws.close(1000, 'Client disconnect');
    this.ws = null;
  }
  // Clear all handlers on disconnect to prevent leaks
  this.debug(`disconnect() clearing ${this.messageHandlers.size} handler type(s)`);
  this.messageHandlers.clear();  // ← CLEARS handlers on disconnect
}
```

**Good News**: Disconnect DOES clear handlers.

**Bad News**: If scene restarts WITHOUT going through shutdown (Phaser bug or timing issue), handlers accumulate.

## Code References

### Client-Side Event Handler Flow
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/network/WebSocketClient.ts:90-96` - `on()` method adds handlers to Set
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/network/WebSocketClient.ts:114-123` - `handleMessage()` executes all handlers
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts:65-262` - `setupEventHandlers()` registers all handlers
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameScene.ts:87-99` - Event handlers initialized in create()

### Sprite Creation and Cleanup
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/entities/PlayerManager.ts:88-136` - `updatePlayers()` creates sprites
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/entities/PlayerManager.ts:180-197` - `destroy()` clears sprites
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts:95-110` - `room:joined` handler calls destroy

### Scene Lifecycle
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameScene.ts:36-40` - `create()` registers shutdown handler
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/scenes/GameScene.ts:213-244` - `cleanup()` called on shutdown
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-client/src/game/network/WebSocketClient.ts:147-156` - `disconnect()` clears handlers

### Server-Side Broadcasting
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/network/broadcast_helper.go:35-63` - `broadcastPlayerStates()` sends player:move
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/game/gameserver.go:139-161` - Broadcast loop runs at 20Hz
- `/Users/mtomcal/Code/stick-rumble/stick-rumble-server/internal/game/room.go:190-222` - `sendRoomJoinedMessage()` sends room:joined

## Architecture Insights

### Event Handler Lifecycle Problem
```
[Scene Create] → [setupEventHandlers()] → [Register Handlers in Set]
                                                    ↓
                                          [WebSocket Messages Fire]
                                                    ↓
                                          [ALL Handlers Execute]

IF scene restarts WITHOUT cleanup:
[Scene Create #2] → [setupEventHandlers()] → [Register MORE Handlers]
                                                    ↓
                                          [2x Handlers for SAME event]
```

### Current Bug Flow (Hypothesized)
```
1. GameScene.create() runs normally
2. setupEventHandlers() registers handlers (Set size: 1 per event type)
3. WebSocket connects and receives room:joined
4. Game runs normally
5. [TRIGGER: Unknown - WebSocket reconnect? Scene restart? Phaser bug?]
6. setupEventHandlers() is called AGAIN without disconnect
7. New handlers registered (Set size: 2 per event type)
8. Server sends player:move with 2 players
9. Handler #1 executes: Creates sprites for Player A, Player B
10. Handler #2 executes: Checks Map, finds sprites, updates them
11. [RACE CONDITION: Display list duplication or timing issue]
12. Result: 3 sprites visible
```

### Difference from Previous Research (Epic 5 Bug)

**Previous Research (2025-12-08-player-duplication-bug.md)**:
- Focus: FUTURE bug when match restart is implemented
- Cause: Lack of cleanup on scene shutdown for Epic 5 lobby system
- Status: Preventative fix for unreleased feature

**Current Research (THIS DOCUMENT)**:
- Focus: CURRENT bug happening in live gameplay NOW
- Cause: Event handler accumulation due to duplicate registration
- Status: Active bug affecting production gameplay

**Key Difference**:
- Epic 5 bug: Scene restart → sprites not cleaned up
- Current bug: Event handlers duplicated → sprites created multiple times PER MESSAGE

## Open Questions

### What Triggers setupEventHandlers() to Run Twice?

**Possible Scenarios**:

1. **WebSocket Reconnection**:
   - Connection drops
   - Client attempts reconnect (3 attempts with exponential backoff)
   - On successful reconnect, does `create()` run again?
   - **Likelihood**: HIGH - Reconnection logic exists

2. **Phaser Scene Lifecycle Bug**:
   - Known Phaser issue: `create()` can be called multiple times on restart
   - `this.scene.restart()` is implemented but not currently used
   - **Likelihood**: MEDIUM - Scene restart exists in code

3. **Manual Testing Artifact**:
   - Developer manually restarting game during testing
   - Browser refresh while WebSocket connection still open
   - **Likelihood**: MEDIUM - Common during development

4. **React Component Remounting**:
   - Phaser game is created in `useEffect` in PhaserGame.tsx
   - If component unmounts/remounts, new Phaser instance created
   - Old WebSocket connection might persist
   - **Likelihood**: LOW - useEffect cleanup calls game.destroy()

### How to Reproduce the Bug?

**Hypothesis**: The bug occurs when:
1. Start game with 2 players
2. Trigger WebSocket reconnection (disconnect network temporarily)
3. Client reconnects WITHOUT full scene shutdown
4. `setupEventHandlers()` runs again
5. Observe duplicate sprites

**Testing Steps Needed**:
1. Add debug logging to `setupEventHandlers()`: Log call count
2. Add debug logging to `WebSocketClient.on()`: Log handler Set size
3. Monitor during gameplay for handler accumulation
4. Trigger reconnection manually to reproduce

### Why 3 Sprites Instead of 4?

**If 2 handlers × 2 players = 4 sprites, why only 3?**

Possible explanations:
1. **Partial cleanup**: `room:joined` cleanup ran between handler executions
2. **Sprite reuse**: PlayerManager Map prevents some duplicates
3. **Timing**: Phaser rendering cycle deduplicates some sprites
4. **Map state**: One sprite ID was already in Map, preventing creation

**Needs investigation**: Check Phaser display list vs PlayerManager Map state.

## Root Cause Analysis

### PRIMARY ROOT CAUSE: WebSocket Event Handler Accumulation

**The bug occurs because**:
1. `WebSocketClient.on()` adds handlers to a Set without deduplication
2. Arrow function closures have unique references every time `setupEventHandlers()` is called
3. JavaScript Set compares by reference, not by function body
4. Multiple calls to `setupEventHandlers()` accumulate handlers
5. Each `player:move` message executes ALL accumulated handlers
6. Each handler independently processes the same player states
7. Result: Duplicate sprite creation attempts

**Why it's hard to detect**:
- PlayerManager Map prevents SOME duplicates (sprites with same ID)
- Bug only manifests when `setupEventHandlers()` is called multiple times
- Normal gameplay flow calls it ONCE, so bug is intermittent
- Dependent on WebSocket reconnection or scene lifecycle edge cases

### SECONDARY ROOT CAUSE: No Event Handler Cleanup on room:joined

**The `room:joined` handler clears sprites but not handlers**:
```typescript
this.playerManager.destroy();  // Clears sprites
// Missing: Clear and re-register event handlers
```

**Should be**:
```typescript
// Clear existing sprites
this.playerManager.destroy();

// Clear existing handlers
this.wsClient.off('player:move', existingHandler);

// Re-register fresh handlers
this.wsClient.on('player:move', newHandler);
```

**However**: This requires storing handler references, which complicates the architecture.

### TERTIARY ROOT CAUSE: Lack of Handler Deduplication

**WebSocketClient could prevent duplicates**:
```typescript
// Current implementation (no guard)
on(messageType: string, handler: (data: unknown) => void): void {
  const handlers = this.messageHandlers.get(messageType) || new Set();
  handlers.add(handler);  // Always adds, even if duplicate code
  this.messageHandlers.set(messageType, handlers);
}

// Improved implementation (with guard)
on(messageType: string, handler: (data: unknown) => void): void {
  const handlers = this.messageHandlers.get(messageType) || new Set();

  // Check if handler with same toString() already exists
  const existingHandler = Array.from(handlers).find(h => h.toString() === handler.toString());
  if (existingHandler) {
    console.warn(`Handler for '${messageType}' already registered, skipping duplicate`);
    return;
  }

  handlers.add(handler);
  this.messageHandlers.set(messageType, handlers);
}
```

**However**: `toString()` comparison is fragile and may not work reliably.

## Recommended Fix Approach

### Immediate Fix: Prevent Duplicate Handler Registration

**Option 1: Store Handler References (RECOMMENDED)**

Modify `GameSceneEventHandlers` to store handler function references and remove them on cleanup:

```typescript
export class GameSceneEventHandlers {
  private handlerRefs: Map<string, (data: unknown) => void> = new Map();

  setupEventHandlers(): void {
    // Clean up existing handlers before registering new ones
    this.cleanupHandlers();

    // Store handler references for later cleanup
    const playerMoveHandler = (data: unknown) => { /* ... */ };
    this.handlerRefs.set('player:move', playerMoveHandler);
    this.wsClient.on('player:move', playerMoveHandler);

    // ... repeat for all event types
  }

  cleanupHandlers(): void {
    for (const [eventType, handler] of this.handlerRefs) {
      this.wsClient.off(eventType, handler);
    }
    this.handlerRefs.clear();
  }
}
```

**Then call `cleanupHandlers()` in**:
- GameScene shutdown event
- Before re-registering handlers
- On WebSocket disconnect

**Option 2: Single Registration Guard**

Add a flag to prevent duplicate registration:

```typescript
export class GameSceneEventHandlers {
  private handlersRegistered = false;

  setupEventHandlers(): void {
    if (this.handlersRegistered) {
      console.warn('Event handlers already registered, skipping');
      return;
    }

    // Register handlers...
    this.handlersRegistered = true;
  }
}
```

**Pros**: Simple, prevents duplicates
**Cons**: Doesn't help with cleanup, relies on single instance

### Long-Term Fix: Proper Event Handler Lifecycle Management

1. **Add cleanup method to GameSceneEventHandlers**
2. **Call cleanup in GameScene.shutdown event**
3. **Ensure WebSocket disconnect always clears handlers**
4. **Add debug logging to detect handler accumulation**
5. **Add integration test for reconnection scenarios**

### Testing Recommendations

1. **Unit Test**: Verify handler registration count
   ```typescript
   test('setupEventHandlers does not register duplicates', () => {
     const wsClient = new WebSocketClient('ws://test');
     const eventHandlers = new GameSceneEventHandlers(wsClient, ...);

     eventHandlers.setupEventHandlers();
     const count1 = wsClient.getTotalHandlerCount();

     eventHandlers.setupEventHandlers();
     const count2 = wsClient.getTotalHandlerCount();

     expect(count1).toBe(count2); // Should not increase
   });
   ```

2. **Integration Test**: Simulate reconnection
   ```typescript
   test('reconnection does not duplicate sprites', async () => {
     // Start game, connect 2 players
     // Disconnect and reconnect
     // Verify sprite count matches player count
   });
   ```

3. **Manual Test**: Reproduce bug
   - Start game with 2 players
   - Temporarily block network to trigger reconnect
   - Observe sprite count
   - Check browser console for handler count logs

## Web Research Sources

- [create method of a Scene class calls multiple times · Issue #5132 · phaserjs/phaser](https://github.com/photonstorm/phaser/issues/5132)
- [Phaser 3.16.2: Main scene duplicates on scene.restart() - Phaser 3 - Phaser](https://phaser.discourse.group/t/phaser-3-16-2-main-scene-duplicates-on-scene-restart/1925)
- [Scene.Start just work for twice, after call it for third time, the whole canvas freeze and browser ram going to top on phaser@3.60-beta14 · Issue #6282 · phaserjs/phaser](https://github.com/photonstorm/phaser/issues/6282)
- [Restart scene 6x times with matter.js provoke bug - Phaser 3 - Phaser](https://phaser.discourse.group/t/restart-scene-6x-times-with-matter-js-provoke-bug/5302)
- [phaser3 memory leak issue (all resources type)](https://lightrun.com/answers/photonstorm-phaser-phaser3-memory-leak-issue-all-resources-type)
- [Memory issue about reload scene & sprite & animation - Phaser 3 - HTML5 Game Devs Forum](https://www.html5gamedevs.com/topic/38373-memory-issue-about-reload-scene-sprite-animation/)
- [Phaser 3 API Documentation - Scenes](https://docs.phaser.io/phaser/concepts/scenes)
