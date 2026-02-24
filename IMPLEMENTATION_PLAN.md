# Implementation Plan: Spec Corrections Build-Out

> **Created**: 2026-02-24
> **Status**: DRAFT — Awaiting approval
> **Scope**: 17 items (9 bug fixes + 8 feature changes) from spec corrections commit `06e471a`
> **Affected Code**: Client-side only (`stick-rumble-client/src/`)

---

## Table of Contents

1. [Change Inventory](#1-change-inventory)
2. [Agent Team Topology](#2-agent-team-topology)
3. [Test Quality Verifier Sub-Agent](#3-test-quality-verifier-sub-agent)
4. [Worktree Isolation Strategy](#4-worktree-isolation-strategy)
5. [Phase 0 — Constants Foundation](#5-phase-0--constants-foundation)
6. [Phase 1 — Parallel Agent Execution](#6-phase-1--parallel-agent-execution)
7. [Phase 2 — Merge & Verify](#7-phase-2--merge--verify)
8. [Detailed Acceptance Criteria by Agent](#8-detailed-acceptance-criteria-by-agent)
9. [Risk Mitigation](#9-risk-mitigation)

---

## 1. Change Inventory

### Bug Fixes (code doesn't match spec)

| ID | Bug | Spec | Severity | Agent |
|----|-----|------|----------|-------|
| BUG-1 | Floor grid not rendering — flat gray background, no grid lines visible | `arena.md` | Medium | B |
| BUG-2 | Enemy weapons nearly invisible (render as tiny nubs instead of full-sized) | `graphics.md` | High | A |
| BUG-3 | Score display shows 7 digits (should be 6-digit zero-padded) | `ui.md` | Low | B |
| BUG-4 | Minimap dots escape bounds (not clamped to minimap area) | `ui.md` | Medium | B |
| BUG-5 | Minimap overlaps HUD elements below it (health bar, ammo, debug text) | `ui.md` | Medium | B |
| BUG-6 | Minimap border gray instead of teal `0x00CCCC` | `ui.md` | Low | B |
| BUG-7 | Debug/ammo text overlaps minimap — should sit below it | `ui.md` | Low | B |
| BUG-8 | Chat log is opaque — should be semi-transparent (`#808080` at 70% opacity) | `ui.md` | Low | B |
| BUG-9 | Weapon crate pickup text lowercase (should be uppercase weapon name) | `weapons.md` | Low | A |

### Feature Changes (spec changed, code needs updating)

| ID | Change | From → To | Agent |
|----|--------|-----------|-------|
| FEAT-1 | Aim line → Hit confirmation trail | Continuous aim line from player to cursor → event-driven trail on `hit:confirmed`, barrel→target, 300ms linger + 200ms fade | A |
| FEAT-2 | Crosshair bloom removed | Dynamic 40→80px expansion on fire → fixed ~20px `⊕` reticle, no bloom, no spread vis | A |
| FEAT-3 | Minimap circular → square | `fillCircle`/`strokeCircle` → `fillRect`/`strokeRect`, teal border | B |
| FEAT-4 | Reload circle → player-centered arc | Screen-center circle at depth 1002 → world-space arc on player body, 25px radius, green, clockwise sweep | B |
| FEAT-5 | Weapon crate icon updated | Dark cross inside circle → yellow `⊕` symbol inside circle | A |
| FEAT-6 | Death corpse yellow outline | No outline → ~50px yellow circle stroke around corpse | A |
| FEAT-7 | Reticle constants simplified | Remove center dot color, dot radius, tick length constants | Phase 0 |
| FEAT-8 | New constants added | `HIT_TRAIL_*`, `RELOAD_ARC_*`, `MINIMAP_BORDER_*`, 3 new COLORS entries | Phase 0 |

---

## 2. Agent Team Topology

```
┌─────────────────────────────────────────────────────────┐
│                  MERGE SHEPHERD (Opus)                   │
│                                                         │
│  Responsibilities:                                      │
│  - Phase 0: Update constants.ts on main                 │
│  - Spawn Phase 0 verifier gate                          │
│  - Create worktrees + branches                          │
│  - Launch Worker agents into worktrees                  │
│  - Monitor progress via task list                       │
│  - Merge branches back to main                          │
│  - Run final verification (make test/lint/type)         │
│  - Spawn Phase 2 final verifier gate (Opus, 3 passes)  │
│  - Resolve any merge conflicts                          │
│  - Cleanup worktrees                                    │
└──────────┬──────────────────┬───────────────────────────┘
           │                  │
     ┌─────▼──────┐    ┌─────▼──────┐
     │ WORKER A   │    │ WORKER B   │
     │ (Sonnet)   │    │ (Sonnet)   │
     │            │    │            │
     │ Visual     │    │ UI Bugs    │
     │ Systems    │    │ & Layout   │
     │            │    │            │
     │ Worktree:  │    │ Worktree:  │
     │ wt-visual  │    │ wt-ui      │
     │            │    │            │
     │ Branch:    │    │ Branch:    │
     │ fix/visual │    │ fix/ui     │
     │            │    │            │
     │ ┌────────┐ │    │ ┌────────┐ │
     │ │VERIFIER│ │    │ │VERIFIER│ │
     │ │(Sonnet)│ │    │ │(Sonnet)│ │
     │ │3 passes│ │    │ │3 passes│ │
     │ └────────┘ │    │ └────────┘ │
     └────────────┘    └────────────┘

     Phase 0 Verifier    Phase 2 Final Verifier
     (Sonnet, 3 passes)  (Opus, 3 passes)
     ── spawned by Shepherd at each gate ──
```

### Model Assignment Rationale

| Role | Model | Why |
|------|-------|-----|
| Merge Shepherd | **Opus** | Orchestration, merge conflict resolution, judgment calls, final verification |
| Worker A (Visual Systems) | **Sonnet** | Mechanical code changes with clear specs — cost-effective for focused file edits |
| Worker B (UI Bugs & Layout) | **Sonnet** | Mechanical code changes with clear specs — cost-effective for focused file edits |
| Verifier (Phase 0, A, B) | **Sonnet** | Pattern-matching anti-pattern scans, scoped to branch diff — cost-effective |
| Verifier (Phase 2 Final) | **Opus** | Full merged codebase audit, needs judgment for cross-branch interaction quality |

### Cost Estimate

| Agent | Model | Est. Turns | Est. Cost |
|-------|-------|-----------|-----------|
| Merge Shepherd | Opus | ~15-20 | ~$3-5 |
| Worker A | Sonnet | ~30-40 | ~$1-2 |
| Worker B | Sonnet | ~30-40 | ~$1-2 |
| Verifiers (3× Sonnet) | Sonnet | ~10-15 each | ~$1-2 total |
| Final Verifier (1× Opus) | Opus | ~10-15 | ~$1-2 |
| **Total** | | | **~$7-13** |

---

## 3. Test Quality Verifier Sub-Agent

### Purpose

The **test-quality-verifier** is a sub-agent spawned by the Merge Shepherd (or by workers at phase boundaries) to audit test code quality. It runs **3 passes** at every phase checkpoint to catch regressions before they compound.

### What It Checks (Per Pass)

Each pass focuses on a different quality dimension:

#### Pass 1: Anti-Pattern Detection
Scan all modified/created test files for:
- [ ] **Vague assertions**: Standalone `toBeDefined()`, `toBeTruthy()`, `toBeFalsy()` not guarding a more specific assertion
- [ ] **Missing argument checks**: `toHaveBeenCalled()` without corresponding `toHaveBeenCalledWith()` in the same test or describe block
- [ ] **Empty test bodies**: `it('...', () => {})` with no assertions
- [ ] **TODO/FIXME/SKIP markers**: `it.skip(...)`, `xit(...)`, `// TODO` inside test files
- [ ] **Overly broad matchers**: `toMatchObject({})` with empty objects, `expect(result).toBe(true)` when testing non-booleans
- [ ] **Magic numbers in assertions**: Inline hex values or numeric literals that should reference constants

#### Pass 2: Coverage & Completeness
Verify that tests actually cover the changes:
- [ ] **Every modified source file** has corresponding test assertions that exercise the changed behavior
- [ ] **New code paths** (e.g., hit trail linger→fade, crosshair melee hide) have at least one test
- [ ] **Removed features** (e.g., bloom, aim line) have their old test assertions updated or removed — no stale tests passing vacuously
- [ ] **Edge cases from acceptance criteria** are tested (e.g., off-screen hit trail, melee crosshair hidden, dot clamping at minimap bounds)
- [ ] **Constants usage**: Tests reference imported constants, not hardcoded values

#### Pass 3: Structural Quality
Check test organization and maintainability:
- [ ] **Descriptive test names**: `it('should ...')` format, not `it('test 1')`
- [ ] **Proper setup/teardown**: `beforeEach`/`afterEach` used where fixtures repeat
- [ ] **No test interdependence**: Tests don't rely on execution order or shared mutable state
- [ ] **Assertion density**: Each `it()` block has at least 1 meaningful assertion
- [ ] **No console.log/debug output** left in test files

### Invocation

The verifier is spawned as a `general-purpose` sub-agent with this prompt template:

```
You are the test-quality-verifier. Audit ALL test files that were modified or
created in the current phase. Run three passes:

PASS 1 — Anti-Pattern Detection: Look for vague assertions, empty tests,
TODO/SKIP markers, magic numbers, overly broad matchers.

PASS 2 — Coverage & Completeness: Verify every source change has corresponding
test coverage. Check for stale tests from removed features. Verify edge cases
from acceptance criteria are tested.

PASS 3 — Structural Quality: Check test names, setup/teardown, independence,
assertion density, no debug output.

WORKING DIRECTORY: {worktree_path}
SCOPE: Only test files changed in the last N commits on this branch.

For each finding, report:
- File and line number
- Which pass caught it (1/2/3)
- Severity: ERROR (must fix) or WARNING (should fix)
- Suggested fix

If all three passes are clean, report: "VERIFIER PASS — 0 errors, 0 warnings"
```

### When It Runs (3× Per Phase Checkpoint)

| Checkpoint | Who Spawns It | Scope | Blocking? |
|------------|---------------|-------|-----------|
| **Phase 0 complete** | Merge Shepherd | `constants.ts` and any test files touching constants | Yes — must pass before creating worktrees |
| **Worker A complete** | Worker A (or Shepherd) | All test files in `wt-visual` branch diff | Yes — must pass before Worker A signals done |
| **Worker B complete** | Worker B (or Shepherd) | All test files in `wt-ui` branch diff | Yes — must pass before Worker B signals done |
| **Phase 2 post-merge** | Merge Shepherd | ALL test files changed across both branches on merged `main` | Yes — must pass before declaring job complete |

**Each checkpoint = 3 verifier passes.** If any pass returns ERRORs, the responsible agent fixes them and re-runs the verifier until clean.

### Verifier Model

| Verifier Instance | Model | Rationale |
|-------------------|-------|-----------|
| Phase 0 verifier | **Sonnet** | Small scope (constants only), mechanical checks |
| Worker A verifier | **Sonnet** | Scoped to worker's branch, pattern matching |
| Worker B verifier | **Sonnet** | Scoped to worker's branch, pattern matching |
| Phase 2 final verifier | **Opus** | Full merged codebase, needs judgment for cross-branch interactions |

---

## 4. Worktree Isolation Strategy

### Why Worktrees?

Git worktrees give each agent its own **physical directory** with its own **branch checkout**. Agents can edit files in parallel without:
- Overwriting each other's uncommitted changes
- Triggering branch checkout conflicts
- Accidentally committing to the wrong branch

### Setup (Merge Shepherd executes AFTER Phase 0)

```bash
# From project root /home/mtomcal/code/stick-rumble-specs/

# Phase 0: constants update committed to main first (see Section 4)

# Create isolated worktrees branching from updated main
git worktree add /home/mtomcal/code/wt-visual -b fix/visual-systems
git worktree add /home/mtomcal/code/wt-ui -b fix/ui-bugs
```

### File Ownership Rules (STRICT — NO OVERLAP)

**Worker A owns these files** (working in `/home/mtomcal/code/wt-visual/`):

| File | Path (relative to worktree root) | Changes |
|------|----------------------------------|---------|
| AimLine.ts | `stick-rumble-client/src/game/entities/AimLine.ts` | Rewrite as hit confirmation trail |
| Crosshair.ts | `stick-rumble-client/src/game/entities/Crosshair.ts` | Simplify, remove bloom |
| WeaponCrateManager.ts | `stick-rumble-client/src/game/entities/WeaponCrateManager.ts` | Update icon + uppercase text |
| PlayerManager.ts | `stick-rumble-client/src/game/entities/PlayerManager.ts` | Death corpse yellow outline |
| ProceduralWeaponGraphics.ts | `stick-rumble-client/src/game/entities/ProceduralWeaponGraphics.ts` | Fix enemy weapon scale |
| GameSceneEventHandlers.ts | `stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts` | Wire hit:confirmed → trail |
| GameScene.ts | `stick-rumble-client/src/game/scenes/GameScene.ts` | Update AimLine refs → HitTrail (**entity setup section ONLY**) |
| PickupNotificationUI.ts | `stick-rumble-client/src/game/ui/PickupNotificationUI.ts` | Uppercase weapon names |

**Worker B owns these files** (working in `/home/mtomcal/code/wt-ui/`):

| File | Path (relative to worktree root) | Changes |
|------|----------------------------------|---------|
| GameSceneUI.ts | `stick-rumble-client/src/game/scenes/GameSceneUI.ts` | Minimap (square, clamp, border), reload arc |
| GameScene.ts | `stick-rumble-client/src/game/scenes/GameScene.ts` | Fix floor grid rendering (**renderArena section ONLY**) |
| ScoreDisplayUI.ts | `stick-rumble-client/src/game/ui/ScoreDisplayUI.ts` | Fix 7→6 digit padding |
| DebugOverlayUI.ts | `stick-rumble-client/src/game/ui/DebugOverlayUI.ts` | Reposition below minimap |
| ChatLogUI.ts | `stick-rumble-client/src/game/ui/ChatLogUI.ts` | Semi-transparent background |

### Conflict Zone: `GameScene.ts`

Both agents touch `GameScene.ts` but in **different sections**:
- **Worker A**: Entity initialization section (AimLine → HitTrail references)
- **Worker B**: `renderArena()` / grid rendering method

**Mitigation**: Merge Shepherd reviews both diffs before merging. If edits are in the same hunk, Shepherd resolves manually.

### Merge Order (Merge Shepherd executes)

```bash
# From main branch in primary worktree
git merge fix/visual-systems --no-ff -m "feat: Visual systems corrections (hit trail, crosshair, crate icon, corpse, enemy weapons)"
git merge fix/ui-bugs --no-ff -m "fix: UI bugs (minimap, grid, score, reload arc, debug overlay, chat)"

# Cleanup
git worktree remove /home/mtomcal/code/wt-visual
git worktree remove /home/mtomcal/code/wt-ui
git branch -d fix/visual-systems fix/ui-bugs
```

---

## 5. Phase 0 — Constants Foundation

**Executor**: Merge Shepherd (Opus), directly on `main`
**Duration**: ~5 minutes
**MUST complete before creating worktrees** (so worktrees inherit the changes)

### Checklist

- [ ] **FEAT-7**: Remove these constants from `constants.ts`:
  - `RETICLE_CENTER_DOT_COLOR`
  - `RETICLE_CENTER_DOT_RADIUS`
  - `RETICLE_TICK_LENGTH`
- [ ] **FEAT-8**: Add to `COLORS` object:
  ```typescript
  HIT_TRAIL: 0xFFFFFF,
  MINIMAP_BORDER: 0x00CCCC,
  RELOAD_ARC: 0x00FF00,
  ```
- [ ] **FEAT-8**: Add Hit Confirmation Trail constants section:
  ```typescript
  export const HIT_TRAIL = {
    COLOR: 0xFFFFFF,
    STROKE: 1,
    ALPHA: 0.8,
    LINGER_DURATION: 300,   // ms
    FADE_DURATION: 200,     // ms
    DEPTH: 40,
  } as const;
  ```
- [ ] **FEAT-8**: Add Reload Arc constants section:
  ```typescript
  export const RELOAD_ARC = {
    RADIUS: 25,
    STROKE: 3,
    COLOR: 0x00FF00,
    START_ANGLE: 270,       // degrees (top of circle)
    DEPTH: 45,
  } as const;
  ```
- [ ] **FEAT-8**: Add Minimap Border constants (if not already present):
  ```typescript
  // Inside existing MINIMAP object or as additions:
  BORDER_COLOR: 0x00CCCC,
  BORDER_STROKE: 2,
  ```
- [ ] Commit: `"feat: Update constants for spec corrections (hit trail, reload arc, minimap border)"`
- [ ] Verify: `make typecheck` passes (no broken references to removed constants)

### Phase 0 Verification Gate

After committing, run the test-quality-verifier (3 passes) on any test files that reference constants:

- [ ] **Verifier Pass 1** (Anti-Pattern Detection): Scan constants test files for magic numbers, vague assertions
- [ ] **Verifier Pass 2** (Coverage & Completeness): Verify new constants (HIT_TRAIL, RELOAD_ARC, MINIMAP border) have test coverage; verify removed constants have no stale test assertions
- [ ] **Verifier Pass 3** (Structural Quality): Check test names, no debug output, proper assertions
- [ ] All 3 passes clean (0 errors) → proceed to create worktrees
- [ ] If errors found → fix and re-run until clean

### Handling Removed Constants

Before removing `RETICLE_CENTER_DOT_COLOR`, `RETICLE_CENTER_DOT_RADIUS`, `RETICLE_TICK_LENGTH`:
1. Grep for usages across codebase
2. If used in `Crosshair.ts`, that's fine — Worker A will remove those references
3. If used elsewhere, assess impact

**Decision**: If the removed constants are referenced in code, do NOT remove them in Phase 0. Instead, mark them as deprecated and let Worker A clean them up as part of FEAT-2.

---

## 6. Phase 1 — Parallel Agent Execution

### Worker A: Visual Systems (Sonnet)

**Worktree**: `/home/mtomcal/code/wt-visual/`
**Branch**: `fix/visual-systems`
**Commit strategy**: One commit per logical change group

| Task | Items | File(s) | Description | Commit Message |
|------|-------|---------|-------------|----------------|
| A1 | FEAT-1 | `AimLine.ts`, `GameScene.ts`, `GameSceneEventHandlers.ts` | Replace continuous aim line with event-driven hit confirmation trail triggered by `hit:confirmed`. Line from barrel→target, white 1px alpha 0.8, depth 40, linger 300ms + fade 200ms. | `feat: Replace aim line with hit confirmation trail` |
| A2 | FEAT-2 | `Crosshair.ts` | Remove bloom/expansion logic. Fixed ~20px `⊕` reticle. Remove `EXPANDED_RADIUS`, `LERP_SPEED`, firing/movement scaling. Keep white circle + cross. | `fix: Simplify crosshair to fixed-size reticle (no bloom)` |
| A3 | BUG-2 | `ProceduralWeaponGraphics.ts`, `PlayerManager.ts` | Fix enemy weapon visibility — ensure enemy weapon containers use same scale as local player. Debug why they render as tiny nubs. | `fix: Enemy weapons render at full scale` |
| A4 | FEAT-5, FEAT-6 | `WeaponCrateManager.ts`, `PlayerManager.ts` | Update weapon crate inner icon to yellow `⊕`. Add ~50px yellow circle stroke around death corpses. | `feat: Yellow crate icon and death corpse outline` |
| A5 | BUG-9 | `PickupNotificationUI.ts` | Uppercase weapon name in "Picked up [WEAPON]" text. | `fix: Uppercase weapon name in pickup notification` |
| A6 | — | — | Run `make test-client && make typecheck && make lint` in worktree. Fix any failures. | (no commit if clean) |

#### Worker A Verification Gate (BLOCKING — before signaling done)

Run the test-quality-verifier sub-agent (3 passes) on all test files changed in `fix/visual-systems` branch:

- [ ] **Verifier Pass 1** (Anti-Pattern Detection): Scan for vague assertions, empty tests, TODO/SKIP, magic numbers in all modified test files
- [ ] **Verifier Pass 2** (Coverage & Completeness): Verify hit trail has tests (linger, fade, off-screen), crosshair simplification has tests (fixed size, melee hide), enemy weapon scale has tests, corpse outline has tests, uppercase pickup has tests. Verify old aim line / bloom tests are updated or removed.
- [ ] **Verifier Pass 3** (Structural Quality): Test names descriptive, setup/teardown proper, no debug output, assertion density adequate
- [ ] All 3 passes clean (0 errors) → Worker A signals done
- [ ] If errors found → Worker A fixes and re-runs verifier until clean

### Worker B: UI Bugs & Layout (Sonnet)

**Worktree**: `/home/mtomcal/code/wt-ui/`
**Branch**: `fix/ui-bugs`
**Commit strategy**: One commit per logical change group

| Task | Items | File(s) | Description | Commit Message |
|------|-------|---------|-------------|----------------|
| B1 | BUG-1 | `GameScene.ts` | Fix floor grid rendering. Grid lines `0xD8DCD8` at alpha 0.5, 100px spacing, depth -1. Debug why grid code isn't producing visible output. | `fix: Floor grid lines now visible on arena` |
| B2 | FEAT-3, BUG-4, BUG-5, BUG-6 | `GameSceneUI.ts` | Minimap overhaul: circular→square (`fillRect`/`strokeRect`), teal border `0x00CCCC`, clamp all dots to bounds via `Math.min`/`Math.max`, reposition to avoid HUD overlap. | `fix: Minimap square shape, dot clamping, teal border, no HUD overlap` |
| B3 | BUG-7 | `DebugOverlayUI.ts` | Reposition debug text below the minimap. No overlap with minimap or HUD. | `fix: Debug overlay positioned below minimap` |
| B4 | BUG-3 | `ScoreDisplayUI.ts` | Fix zero-padding from 7→6 digits (`padStart(6, '0')` not 7). | `fix: Score display uses 6-digit zero-padding` |
| B5 | BUG-8 | `ChatLogUI.ts` | Change background from opaque to semi-transparent (`#808080` at alpha 0.7). | `fix: Chat log background semi-transparent` |
| B6 | FEAT-4 | `GameSceneUI.ts` | Replace screen-center reload circle with world-space arc centered on player body. 25px radius, green `0x00FF00`, 3px stroke, clockwise from top (270°). Follows player position. | `feat: Reload arc centered on player (world-space)` |
| B7 | — | — | Run `make test-client && make typecheck && make lint` in worktree. Fix any failures. | (no commit if clean) |

#### Worker B Verification Gate (BLOCKING — before signaling done)

Run the test-quality-verifier sub-agent (3 passes) on all test files changed in `fix/ui-bugs` branch:

- [ ] **Verifier Pass 1** (Anti-Pattern Detection): Scan for vague assertions, empty tests, TODO/SKIP, magic numbers in all modified test files
- [ ] **Verifier Pass 2** (Coverage & Completeness): Verify floor grid has tests (visibility, color, depth), minimap has tests (square shape, dot clamping, border color, HUD clearance), score padding has tests (6 digits), chat transparency has tests (alpha 0.7), reload arc has tests (world-space, follows player, clockwise sweep). Verify old circular minimap / screen-center reload tests are updated or removed.
- [ ] **Verifier Pass 3** (Structural Quality): Test names descriptive, setup/teardown proper, no debug output, assertion density adequate
- [ ] All 3 passes clean (0 errors) → Worker B signals done
- [ ] If errors found → Worker B fixes and re-runs verifier until clean

---

## 7. Phase 2 — Merge & Verify

**Executor**: Merge Shepherd (Opus)

### Checklist

- [ ] Confirm Worker A signals completion (all A1-A6 done)
- [ ] Confirm Worker B signals completion (all B1-B7 done)
- [ ] Review Worker A diff: `git diff main...fix/visual-systems --stat`
- [ ] Review Worker B diff: `git diff main...fix/ui-bugs --stat`
- [ ] Check `GameScene.ts` specifically for conflict potential
- [ ] Merge `fix/visual-systems` into `main` (`--no-ff`)
- [ ] Merge `fix/ui-bugs` into `main` (`--no-ff`)
- [ ] If merge conflict in `GameScene.ts`: resolve manually (Worker A's entity setup + Worker B's grid fix)
- [ ] Run full verification suite:
  - [ ] `make test` — all tests pass (client + server)
  - [ ] `make typecheck` — zero TypeScript errors
  - [ ] `make lint` — zero errors/warnings

### Phase 2 Final Verification Gate (Opus Verifier — 3 Passes on Merged Main)

Spawn the test-quality-verifier as an **Opus** sub-agent on the fully merged `main` branch. This is the most critical gate — it catches cross-branch interaction issues that per-worker verifiers can't see.

- [ ] **Verifier Pass 1** (Anti-Pattern Detection): Scan ALL test files modified across both branches for vague assertions, empty tests, TODO/SKIP, magic numbers, overly broad matchers
- [ ] **Verifier Pass 2** (Coverage & Completeness): Verify every item in the Change Inventory (Section 1) has corresponding test coverage on the merged branch. Check for:
  - Hit trail tests exercise linger + fade + off-screen behavior
  - Crosshair tests verify fixed size, no bloom, melee hidden
  - Enemy weapon scale tests verify full-size rendering
  - Minimap tests verify square shape, dot clamping, teal border, no HUD overlap
  - Floor grid tests verify visibility, color, depth
  - Reload arc tests verify world-space positioning, player-follow, sweep direction
  - Score tests verify 6-digit padding
  - Chat tests verify semi-transparency
  - Removed features (aim line, crosshair bloom, circular minimap, screen-center reload circle) have no stale tests passing vacuously
- [ ] **Verifier Pass 3** (Structural Quality): Test names, setup/teardown, independence, assertion density, no debug output across all changed test files
- [ ] All 3 passes clean (0 errors) → Job complete
- [ ] If errors found → Shepherd fixes on main and re-runs verifier until clean

### Post-Verification Cleanup

- [ ] Cleanup:
  - [ ] `git worktree remove /home/mtomcal/code/wt-visual`
  - [ ] `git worktree remove /home/mtomcal/code/wt-ui`
  - [ ] `git branch -d fix/visual-systems fix/ui-bugs`
- [ ] Final sanity: `git log --oneline -10`

---

## 8. Detailed Acceptance Criteria by Agent

### Worker A: Visual Systems

#### A1: Hit Confirmation Trail (FEAT-1) — replaces Aim Line
- [ ] `AimLine.ts` rewritten (or renamed) — no longer draws continuous per-frame line
- [ ] Trail triggered ONLY by `hit:confirmed` WebSocket event
- [ ] Line drawn from local player's gun barrel position to hit target position
- [ ] Color: white `0xFFFFFF` (use `HIT_TRAIL.COLOR` constant)
- [ ] Stroke: 1px (`HIT_TRAIL.STROKE`)
- [ ] Alpha: 0.8 (`HIT_TRAIL.ALPHA`)
- [ ] Depth: 40 (`HIT_TRAIL.DEPTH`)
- [ ] Lingers for 300ms after appearing (`HIT_TRAIL.LINGER_DURATION`)
- [ ] Fades to alpha 0 over 200ms (`HIT_TRAIL.FADE_DURATION`) via Phaser tween
- [ ] Trail game object destroyed after fade completes
- [ ] Works for on-screen AND off-screen targets (line extends beyond viewport)
- [ ] `GameSceneEventHandlers.ts`: `hit:confirmed` handler calls trail renderer with barrel + target positions
- [ ] `GameScene.ts`: no longer creates/updates AimLine per frame
- [ ] All old aim line code removed (no dead code remaining)

#### A2: Crosshair Simplification (FEAT-2)
- [ ] Fixed ~20-25px diameter (radius ~10px)
- [ ] Shape: white `⊕` — outer circle (stroke ~1.5px, alpha 0.8) + cross lines (±6px, stroke 2px)
- [ ] NO `EXPANDED_RADIUS`, `LERP_SPEED`, or bloom logic
- [ ] NO firing-based expansion
- [ ] NO movement-based scaling
- [ ] NO spread visualization or dynamic size changes
- [ ] Hidden for melee weapons (bat, katana)
- [ ] Positioned at exact mouse cursor position
- [ ] Depth: 100
- [ ] Removed reticle constants (`RETICLE_CENTER_DOT_COLOR`, `RETICLE_CENTER_DOT_RADIUS`, `RETICLE_TICK_LENGTH`) usage if present

#### A3: Enemy Weapon Visibility (BUG-2)
- [ ] Enemy weapons render at SAME scale as local player weapons
- [ ] All 6 weapon types (pistol, uzi, ak47, shotgun, bat, katana) visually identifiable on enemies
- [ ] Not tiny nubs/stubs — full-sized weapon graphics matching local player
- [ ] Root cause identified and documented in commit message

#### A4: Weapon Crate Icon + Death Corpse Outline (FEAT-5, FEAT-6)
- [ ] Weapon crate inner icon: yellow `⊕` crosshair/plus symbol (`0xCCCC00`)
- [ ] Dead enemies: ~50px diameter yellow circle outline around corpse
- [ ] Circle is stroke-only (no fill), color `COLORS.SPAWN_RING` / `0xFFFF00`
- [ ] Circle drawn at corpse body position

#### A5: Uppercase Weapon Pickup Text (BUG-9)
- [ ] `PickupNotificationUI.ts`: "Picked up [WEAPON]" uses `.toUpperCase()` on weapon name
- [ ] Example: "Picked up AK47" not "Picked up ak47"

---

### Worker B: UI Bugs & Layout

#### B1: Floor Grid (BUG-1)
- [ ] Grid lines visible on arena background
- [ ] Color: `0xD8DCD8` / `COLORS.GRID_LINE`
- [ ] Alpha: 0.5
- [ ] Spacing: 100px
- [ ] Depth: -1 (below all game objects)
- [ ] Light gray background `0xC8CCC8` visible between grid lines
- [ ] Root cause of invisibility identified (likely depth, alpha, or draw order issue)

#### B2: Minimap Overhaul (FEAT-3, BUG-4, BUG-5, BUG-6)
- [ ] Background shape: `fillRect` (not `fillCircle`)
- [ ] Border shape: `strokeRect` (not `strokeCircle`)
- [ ] Border color: teal `0x00CCCC` / `MINIMAP_BORDER_COLOR`, stroke 2px
- [ ] All dots (player + enemy) clamped to `[mapX, mapX+mapSize]` × `[mapY, mapY+mapSize]`
- [ ] Clamping uses `Math.min` / `Math.max` helper
- [ ] Minimap positioned with sufficient vertical clearance — does NOT overlap health bar, ammo, debug text below
- [ ] Radar range ring still renders as circle (geometric, not shape of minimap)
- [ ] Player dot: green, 4px radius
- [ ] Enemy dots: red, 3px radius
- [ ] Background: `#3A3A3A` at 50% alpha
- [ ] Static layer depth 1999, dynamic layer depth 2000

#### B3: Debug Overlay Position (BUG-7)
- [ ] Debug text renders BELOW the minimap
- [ ] No overlap with minimap
- [ ] No overlap with health bar or ammo display

#### B4: Score Display Padding (BUG-3)
- [ ] Exactly 6 digits zero-padded (e.g., `000100`)
- [ ] NOT 7 digits (e.g., `0000100`)
- [ ] Uses `padStart(6, '0')` or equivalent

#### B5: Chat Log Transparency (BUG-8)
- [ ] Background color: `#808080` (or equivalent hex)
- [ ] Background alpha: 0.7 (70% opacity)
- [ ] Game world partially visible through chat panel

#### B6: Reload Arc (FEAT-4)
- [ ] World-space arc centered on player body position (NOT screen center)
- [ ] Follows player as they move
- [ ] Radius: 25px (`RELOAD_ARC.RADIUS`)
- [ ] Stroke: 3px (`RELOAD_ARC.STROKE`), green `0x00FF00` (`RELOAD_ARC.COLOR`)
- [ ] Alpha: 1.0 (fully opaque)
- [ ] Arc starts at top (270° / -90°)
- [ ] Sweeps clockwise proportional to reload progress (0% = no arc, 100% = full circle)
- [ ] Old screen-center reload circle fully removed (no dead code)
- [ ] `GameSceneUI.ts` reload update logic uses new arc instead of old circle

---

## 9. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `GameScene.ts` merge conflict | Medium | Low | Both agents touch different sections (entity setup vs renderArena). Shepherd resolves manually if needed. |
| Floor grid bug is non-trivial | Medium | Medium | Worker B should add `console.log` to verify grid draw code executes. May be depth/ordering/clear issue. |
| Enemy weapon scale is complex | Medium | High | Worker A must read `ProceduralWeaponGraphics.ts` and `PlayerManager.ts` carefully. Bug may be in container scaling, not rendering. Escalate to Opus if Sonnet can't find root cause. |
| Tests break after changes | Low | High | Each worker runs `make test-client` before signaling done. Shepherd runs full `make test` after merge. |
| Constants not available in worktrees | Zero | High | Phase 0 commits to `main` BEFORE worktrees are created, so branches inherit constants automatically. |
| Removed reticle constants break code | Low | Medium | Grep for usages before removing. If used, leave as deprecated in Phase 0 and let Worker A clean up. |
| Rate limiting (API) | Medium | Medium | Only 2 Sonnet workers + 1 Opus. Light load. If hit, workers pause naturally. |

---

## Execution Timeline

```
T+0min   ┌─ Phase 0: Shepherd updates constants.ts on main
T+3min   ├─ Phase 0 Verifier (Sonnet): 3 passes on constants tests
T+8min   ├─ Shepherd creates worktrees (wt-visual, wt-ui)
T+10min  ├─ Shepherd launches Worker A + Worker B in parallel
         │
T+10min  │  ┌─ Worker A starts (wt-visual)     ┌─ Worker B starts (wt-ui)
         │  │  A1: Hit trail                    │  B1: Floor grid
         │  │  A2: Crosshair simplify           │  B2: Minimap overhaul
         │  │  A3: Enemy weapon scale            │  B3: Debug overlay position
         │  │  A4: Crate icon + corpse outline  │  B4: Score padding
         │  │  A5: Uppercase pickup text        │  B5: Chat transparency
         │  │  A6: Tests & lint                 │  B6: Reload arc
         │  │  ── Verifier gate (3 passes) ──   │  B7: Tests & lint
         │  │                                   │  ── Verifier gate (3 passes) ──
T+45min  │  └─ Worker A verified & done         └─ Worker B verified & done
         │
T+47min  ├─ Phase 2: Shepherd reviews diffs
T+50min  ├─ Shepherd merges fix/visual-systems
T+52min  ├─ Shepherd merges fix/ui-bugs (resolve conflicts if any)
T+55min  ├─ Shepherd runs make test && make typecheck && make lint
T+58min  ├─ Phase 2 Final Verifier (Opus): 3 passes on ALL changed tests
T+65min  ├─ Shepherd cleans up worktrees + branches
T+65min  └─ DONE
```

**Estimated total wall-clock time: ~65-80 minutes**

### Verification Summary

| Checkpoint | Verifier Model | Passes | Scope | Est. Duration |
|------------|---------------|--------|-------|---------------|
| Phase 0 complete | Sonnet | 3 | Constants test files | ~5 min |
| Worker A complete | Sonnet | 3 | All test files in `fix/visual-systems` diff | ~5 min |
| Worker B complete | Sonnet | 3 | All test files in `fix/ui-bugs` diff | ~5 min |
| Phase 2 post-merge | **Opus** | 3 | ALL test files changed on merged `main` | ~7 min |
| **Total verifier runs** | | **12 passes** | | **~22 min overhead** |

---

## Agent Prompt Templates

### Worker A Prompt (Visual Systems)

```
You are Worker A on the spec-corrections team. Your job is to fix visual systems
in the Stick Rumble client to match updated specs.

WORKING DIRECTORY: /home/mtomcal/code/wt-visual/
BRANCH: fix/visual-systems (already checked out)

You MUST:
- Only edit files in YOUR ownership list (see below)
- Run `make test-client && make typecheck && make lint` from the worktree root before finishing
- Commit after each logical change group with descriptive messages
- Set git identity: git config user.name "mtomcal" && git config user.email "mtomcal@users.noreply.github.com"
- Read each file BEFORE editing it
- AFTER completing all tasks and passing tests/lint, spawn a test-quality-verifier
  sub-agent (Sonnet, general-purpose) to run 3 passes on all test files you
  modified. See Section 3 for the verifier prompt template and Section 6 for
  the Worker A Verification Gate checklist. You MUST NOT signal done until the
  verifier reports 0 errors across all 3 passes. If errors are found, fix them
  and re-run the verifier.

YOUR FILES (do NOT touch any other files):
- stick-rumble-client/src/game/entities/AimLine.ts
- stick-rumble-client/src/game/entities/Crosshair.ts
- stick-rumble-client/src/game/entities/WeaponCrateManager.ts
- stick-rumble-client/src/game/entities/PlayerManager.ts
- stick-rumble-client/src/game/entities/ProceduralWeaponGraphics.ts
- stick-rumble-client/src/game/entities/HitEffectManager.ts
- stick-rumble-client/src/game/scenes/GameSceneEventHandlers.ts
- stick-rumble-client/src/game/scenes/GameScene.ts (entity setup section ONLY)
- stick-rumble-client/src/game/ui/PickupNotificationUI.ts

TASKS: [See Section 6, Worker A task table]
ACCEPTANCE CRITERIA: [See Section 8, Worker A acceptance criteria]
VERIFICATION GATE: [See Section 3 + Section 6 Worker A Verification Gate]
```

### Worker B Prompt (UI Bugs)

```
You are Worker B on the spec-corrections team. Your job is to fix UI bugs and
layout issues in the Stick Rumble client to match updated specs.

WORKING DIRECTORY: /home/mtomcal/code/wt-ui/
BRANCH: fix/ui-bugs (already checked out)

You MUST:
- Only edit files in YOUR ownership list (see below)
- Run `make test-client && make typecheck && make lint` from the worktree root before finishing
- Commit after each logical change group with descriptive messages
- Set git identity: git config user.name "mtomcal" && git config user.email "mtomcal@users.noreply.github.com"
- Read each file BEFORE editing it
- AFTER completing all tasks and passing tests/lint, spawn a test-quality-verifier
  sub-agent (Sonnet, general-purpose) to run 3 passes on all test files you
  modified. See Section 3 for the verifier prompt template and Section 6 for
  the Worker B Verification Gate checklist. You MUST NOT signal done until the
  verifier reports 0 errors across all 3 passes. If errors are found, fix them
  and re-run the verifier.

YOUR FILES (do NOT touch any other files):
- stick-rumble-client/src/game/scenes/GameSceneUI.ts
- stick-rumble-client/src/game/scenes/GameScene.ts (renderArena / grid section ONLY)
- stick-rumble-client/src/game/ui/ScoreDisplayUI.ts
- stick-rumble-client/src/game/ui/DebugOverlayUI.ts
- stick-rumble-client/src/game/ui/ChatLogUI.ts

TASKS: [See Section 6, Worker B task table]
ACCEPTANCE CRITERIA: [See Section 8, Worker B acceptance criteria]
VERIFICATION GATE: [See Section 3 + Section 6 Worker B Verification Gate]
```

---

## Rules for All Agents

1. **Read before editing** — always read the target file AND the relevant spec section before making changes
2. **One commit per task group** — follow the commit sizing in Section 5
3. **Run tests after each commit** — `make test-client` must pass
4. **Use constants** — import from `shared/constants.ts`, never use inline hex values for colors
5. **Spec is truth** — when this plan and the spec disagree, the spec wins
6. **Stay in your worktree** — never `cd` to another worktree or the main repo
7. **Git identity** — always `mtomcal` / `mtomcal@users.noreply.github.com`
8. **No dead code** — remove old code completely, don't comment it out
9. **Minimal changes** — only change what's needed for your assigned items. Don't refactor surrounding code.
