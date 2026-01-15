# Research: Match Restart Flow Fix (stick-rumble-ela)

**Date**: 2026-01-15
**Issue**: Player characters duplicate and errors flood console when match restarts

## Executive Summary

The bug is **NOT a cleanup code problem** - all cleanup code exists and works correctly. The bug occurs because:

1. **"Play Again" button is a placeholder** - just shows `alert('Lobby system coming in Epic 5')`
2. **Countdown timer reaches 0 but does NOTHING** - no callback triggers
3. **Page refresh mid-game** causes reconnection to old room with duplicated sprites

The fix requires:
1. Implementing actual match restart via countdown completion
2. Ensuring cleanup is triggered on reconnection scenarios
3. Adding server-side match reset capability

## Current State Analysis

### Client-Side Cleanup (ALREADY EXISTS - Works Correctly)

**GameScene.ts:46-51** - Shutdown handler registered:
```typescript
this.events.once('shutdown', () => {
  this.cleanup();
});
```

**GameScene.ts:328-373** - cleanup() method destroys all managers:
- eventHandlers.destroy()
- playerManager.destroy()
- projectileManager.destroy()
- wsClient.disconnect()
- etc.

**GameSceneEventHandlers.ts:120-127** - cleanupHandlers() properly removes handlers:
```typescript
private cleanupHandlers(): void {
  for (const [eventType, handler] of this.handlerRefs) {
    this.wsClient.off(eventType, handler);
  }
  this.handlerRefs.clear();
}
```

**GameSceneEventHandlers.ts:180-196** - room:joined handler DOES clear existing players:
```typescript
// Clear existing players to prevent duplication if room:joined fires multiple times
this.playerManager.destroy();
```

### Missing Pieces

1. **MatchEndScreen.tsx:62-64** - Play Again is placeholder:
```typescript
const handlePlayAgain = () => {
  alert('Lobby system coming in Epic 5');
};
```

2. **MatchEndScreen.tsx:46-54** - Countdown does nothing when reaching 0:
```typescript
useEffect(() => {
  if (countdown <= 0) return; // Just stops, no callback!
  const timer = setInterval(() => {
    setCountdown(prev => Math.max(0, prev - 1));
  }, 1000);
  return () => clearInterval(timer);
}, [countdown]);
```

3. **No server-side match restart** - Match.EndMatch() is final:
```go
// match.go:133-145
func (m *Match) EndMatch(reason string) {
  if m.State == MatchStateEnded {
    return; // Can only end once
  }
  m.State = MatchStateEnded;
  // NO RESET METHOD EXISTS
}
```

### Duplication Scenario (Verified)

When page is refreshed mid-game:
1. Old WebSocket connection closes
2. New page loads, new GameScene created
3. New WebSocket connects, gets NEW player ID
4. Room still has old player in state
5. Server sends player:move with OLD player data
6. Client creates sprites for OLD player + NEW player
7. Result: Duplicated sprites

## Recommended Fix Approach

### Phase 1: Wire Up Match Restart (Client-Only Quick Fix)

1. **Add onPlayAgain callback** to MatchEndScreen:
   - Pass from App.tsx through PhaserGame
   - Expose as window.onPlayAgain (like onMatchEnd)
   - Call scene.restart() from Phaser game

2. **Trigger restart when countdown reaches 0**:
   - Add onCountdownComplete callback
   - Or auto-call onPlayAgain when countdown === 0

3. **App.tsx handles restart**:
   - Clear matchEndData
   - Signal PhaserGame to restart scene

### Phase 2: Server-Side Reset (Required for Clean State)

1. **Add Room.ResetMatch()** method:
   - Create new Match instance
   - Keep same players
   - Broadcast match:start to clients

2. **Add match:start handler on client**:
   - Triggers scene.restart()
   - Fresh start with same room

### Phase 3: Handle Reconnection Edge Cases

1. **Server detects reconnect** (same IP/token):
   - Clean up old player state
   - Assign to existing room or new one

2. **Client handles room:joined properly** (ALREADY WORKS):
   - playerManager.destroy() already called
   - Just need server to send clean state

## Files Requiring Changes

### Client-Side
1. `stick-rumble-client/src/ui/match/MatchEndScreen.tsx` - Add onPlayAgain callback, trigger on countdown=0
2. `stick-rumble-client/src/App.tsx` - Handle restart callback
3. `stick-rumble-client/src/ui/common/PhaserGame.tsx` - Expose restart capability
4. `stick-rumble-client/src/shared/types.ts` - Add callback type to window

### Server-Side (Optional Phase 2)
5. `stick-rumble-server/internal/game/match.go` - Add Reset() method
6. `stick-rumble-server/internal/game/room.go` - Add ResetMatch() method

## Testing Plan

1. **Unit Tests**: MatchEndScreen countdown triggers restart
2. **Integration Test**: Full match cycle (start → play → end → restart → play)
3. **Manual Test**: Page refresh mid-game (verify no duplicates)
4. **Manual Test**: Multiple match cycles without page refresh

## Conclusion

The cleanup code is correct - the issue is that restart is never triggered. The fix is straightforward:
1. Wire countdown completion to trigger scene.restart()
2. Ensure React state is cleared on restart
3. The existing cleanup code will handle the rest
