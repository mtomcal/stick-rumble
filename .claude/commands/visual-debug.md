# Visual Debug Session

Launch an interactive visual debugging session for investigating rendering and gameplay bugs.

## Context
- Working on: [epic/feature area - to be filled in by user]
- Test harness: http://localhost:5173/
- Known bugs to investigate: [list from your notes]

## Session Rules

1. **Maintain a running log** in `/tmp/debug-session.md` with:
   - What we've tried
   - What we've observed
   - Current hypothesis
   - Next step

2. **Visual verification loop**: After each fix attempt, ask the user to verify visually before moving on

3. **Liberal debug logging**: Add `console.log` debug statements freely — user will report what they see

4. **Checkpoints**: If user says "checkpoint", dump current state to the session log

5. **Wrap up**: If user says "wrap up", summarize what's fixed, what's still broken

## Session Workflow

```
┌─────────────────────────────────────────────────────────────┐
│  USER                        │  CLAUDE                      │
├─────────────────────────────────────────────────────────────┤
│  Describes visual issue      │                              │
│                              │  Adds debug logs, asks user  │
│                              │  to reload and report        │
│  Reports console output and  │                              │
│  what they see               │                              │
│                              │  Forms hypothesis, tries fix │
│                              │  Updates session log         │
│  Confirms fix or reports     │                              │
│  new observation             │                              │
│                              │  Iterates on fix...          │
│  "checkpoint"                │                              │
│                              │  Writes current state to log │
│  "wrap up"                   │                              │
│                              │  Summarizes findings         │
└─────────────────────────────────────────────────────────────┘
```

## Starting the Session

When this skill is invoked:

1. **Initialize session log** at `/tmp/debug-session.md`:
   ```markdown
   # Debug Session - [timestamp]

   ## Context
   - Feature area: [from user or TBD]
   - Test URL: http://localhost:5173/

   ## Log

   ### [timestamp] - Session Start
   User observation: [to be filled]
   ```

2. **Ask the user**:
   - What feature area they're debugging (e.g., melee weapons, projectiles, player rendering)
   - What they currently see in the test harness
   - Any specific issues to reference

3. **Begin the debug loop** based on user observations

## Current State
[empty on first run, or paste from previous session log if resuming]

## Commands During Session

- **"checkpoint"** - Save current progress to session log
- **"wrap up"** - End session with summary
- **"hypothesis: [text]"** - Record a specific hypothesis
- **"try: [approach]"** - Request a specific debugging approach

## Useful Debug Patterns

### Console Logging for Phaser Entities
```typescript
console.log('[DEBUG] Entity state:', {
  position: { x: entity.x, y: entity.y },
  visible: entity.visible,
  alpha: entity.alpha,
  active: entity.active,
  scene: entity.scene?.scene?.key
});
```

### Event Tracing
```typescript
console.log('[DEBUG] Event fired:', eventName, data);
```

### Render Loop Inspection
```typescript
// In update():
if (this.debugFrame++ % 60 === 0) {
  console.log('[DEBUG] Frame state:', { /* ... */ });
}
```
