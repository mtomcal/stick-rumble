# Spec Update Implementation Plan

> Reference file for the worker loop. Read this at the START of each iteration to know what to do.

## What Changed Since Specs Were Written (2026-02-02)

| # | Feature | Key Files | Affected Specs |
|---|---------|-----------|----------------|
| 1 | Client-Side Prediction (Epic 4.1) | `PredictionEngine.ts`, `GameSimulation.ts`, `types.ts` | movement, client-architecture, overview |
| 2 | Server Reconciliation (Epic 4.2) | `GameSceneEventHandlers.ts` (reconciliation logic) | movement, client-architecture, networking |
| 3 | Smooth Interpolation (Epic 4.3) | `InterpolationEngine.ts` | client-architecture, networking, overview |
| 4 | Delta Compression (Epic 4.4) | `delta_tracker.go`, `state-delta`/`state-snapshot` messages | networking, messages, server-architecture |
| 5 | Lag Compensation (Epic 4.5) | `position_history.go`, `gameserver.go` (lag comp) | hit-detection, server-architecture, shooting |
| 6 | Network Simulator (Epic 4.6) | `NetworkSimulator.ts`, `network_simulator.go`, `DebugNetworkPanel.tsx` | client-architecture, server-architecture, ui |
| 7 | Ping Tracking | `ping_tracker.go`, `room.go` (ping integration) | rooms, server-architecture, networking |
| 8 | Deceleration Change | `constants.go`, `constants.ts`: DECELERATION 50→1500 px/s² | constants, movement |
| 9 | Death/Respawn Visual Fix | `PlayerManager.ts`, `GameSceneEventHandlers.ts` | player, graphics |
| 10 | New Client Dirs | `src/game/physics/`, `src/game/simulation/`, `src/ui/debug/` | client-architecture |
| 11 | New Message Types | `state:delta`, `state:snapshot`, `clientTimestamp` on input:state/player:shoot | messages, networking |
| 12 | Weapon Rotation Fix | `ProceduralWeaponGraphics.ts` | graphics |

## Spec Update Order

Ordered by drift risk — do highest risk first, batch low-risk/no-change specs together.

### High Drift (read source carefully, expect significant edits)

| # | Spec | What to Check |
|---|------|---------------|
| 1 | constants.md | DECELERATION 50→1500. Diff `constants.go` and `constants.ts` against spec. |
| 2 | movement.md | Deceleration change. Client-side prediction section needed. Server reconciliation. |
| 3 | networking.md | Delta compression protocol. Ping tracking. New message flow. Lag comp wire protocol. |
| 4 | messages.md | Add `state:delta`, `state:snapshot`. `clientTimestamp` field on `input:state` and `player:shoot`. |
| 5 | client-architecture.md | New dirs: `physics/`, `simulation/`, `ui/debug/`. New classes: PredictionEngine, InterpolationEngine, GameSimulation, NetworkSimulator. |
| 6 | server-architecture.md | Lag comp pipeline. Delta tracker. Position history buffer. Ping tracker. Network simulator. |
| 7 | hit-detection.md | Lag compensation rewinding. Position history integration. `clientTimestamp` on hit checks. |

### Medium Drift (likely some edits)

| # | Spec | What to Check |
|---|------|---------------|
| 8 | player.md | Death hide/teleport-respawn visual changes. Position history on PlayerState. |
| 9 | graphics.md | Death: player hidden (not just grayed). Respawn: teleport. Weapon rotation fix. |
| 10 | shooting.md | `clientTimestamp` on shoot requests for lag comp. |
| 11 | weapons.md | Verify `weapon-configs.json` still matches spec tables. |
| 12 | overview.md | Architecture section needs prediction/reconciliation/interpolation/delta compression. |
| 13 | README.md | Update line counts if specs grew. Any new tech dependencies. |
| 14 | rooms.md | Ping tracker integration in room lifecycle. |
| 15 | ui.md | DebugNetworkPanel. Any HUD changes. |

### Low Drift (likely no changes — batch 2-3 per iteration)

| # | Spec | What to Check |
|---|------|---------------|
| 16 | match.md | Verify no changes to match state machine. |
| 17 | dodge-roll.md | Verify no changes to roll mechanics. |
| 18 | melee.md | Verify no changes to melee system. |
| 19 | arena.md | Verify no changes to arena boundaries. |
| 20 | audio.md | Verify no changes to audio system. |

### Final (do last)

| # | Spec | What to Check |
|---|------|---------------|
| 21 | test-index.md | Add test scenario entries for all new Epic 4 features. |
| 22 | spec-of-specs-plan.md | Add audit log entry dated today. |

## Progress

- [x] 1. constants.md
- [x] 2. movement.md
- [x] 3. networking.md
- [x] 4. messages.md
- [x] 5. client-architecture.md
- [x] 6. server-architecture.md
- [x] 7. hit-detection.md
- [x] 8. player.md
- [x] 9. graphics.md
- [x] 10. shooting.md
- [x] 11. weapons.md
- [x] 12. overview.md
- [x] 13. README.md
- [x] 14. rooms.md
- [x] 15. match.md
- [x] 16. dodge-roll.md
- [x] 17. melee.md
- [x] 18. arena.md
- [x] 19. ui.md
- [x] 20. audio.md
- [ ] 21. test-index.md
- [ ] 22. spec-of-specs-plan.md

## Discoveries

Add rows to the "What Changed" table above when you find drift the plan missed.

## Per-Spec Process

```
1. Read the spec file in specs/
2. Read the relevant source files (see "Key Files" column above)
3. Diff spec vs code — note discrepancies
4. Edit spec: targeted updates only (no rewrites)
5. Add changelog entry, bump version (1.0.0 → 1.1.0 for features, 1.0.1 for fixes)
6. Commit: `docs: Update {spec-name} to match current codebase`
7. Check off progress above
```

## Rules

1. **Read before editing** — Always read both the spec AND the source code before making changes
2. **Preserve structure** — Keep existing section structure (Overview, Dependencies, Data Structures, Behavior, etc.)
3. **Update, don't rewrite** — Only change sections that are actually wrong or missing. Don't rephrase working content.
4. **Add, don't remove** — If old behavior is still present, keep it. Only remove docs for deleted behavior.
5. **Changelog + version bump** — Every modified spec gets a changelog entry (today's date) and version bump
6. **Code is truth** — If spec says X but code does Y, update the spec to say Y.
7. **WHY matters** — New content must include rationale, not just description.
8. **Cross-references** — When a change affects multiple specs, note it but only edit the current spec. Other specs get fixed when their turn comes.
9. **spec-of-specs-plan.md last** — Update the plan file only after all other specs are done.
10. **Only edit specs/** — Do NOT modify any source code.
11. **No new spec files** — Unless a completely new system was added that doesn't fit any existing spec.
12. **Batch low-drift specs** — If a spec needs no changes, mark it done and move to the next in the same iteration.
