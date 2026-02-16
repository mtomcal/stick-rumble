# Spec Verification Plan — Pre-BMM Archive

## Context Table

| # | Spec File | Source Files | Notes |
|---|-----------|-------------|-------|
| 1 | `README.md` | all source files | Index file — references `stick-figure.md` but actual file is `player.md` |
| 2 | `overview.md` | `App.tsx`, `game/EventBus.ts`, `game/phaserGame.ts` | Architecture overview |
| 3 | `types-and-events.md` | `types.ts` | Shared types and event constants |
| 4 | `config.md` | `vite.config.ts`, `index.tsx` | Build tooling and CDN setup |
| 5 | `player.md` | `game/objects/StickFigure.ts` | StickFigure class spec (README calls it stick-figure.md) |
| 6 | `main-scene.md` | `game/scenes/MainScene.ts` | Central game loop |
| 7 | `combat.md` | `game/scenes/MainScene.ts`, `game/objects/StickFigure.ts` | Weapon stats, damage, melee/ranged |
| 8 | `ai.md` | `game/scenes/MainScene.ts` | Bot spawning, targeting, movement |
| 9 | `pathfinder.md` | `game/systems/Pathfinder.ts` | A* algorithm |
| 10 | `level-generator.md` | `game/world/LevelGenerator.ts` | Arena layout |
| 11 | `texture-generator.md` | `game/utils/TextureGenerator.ts` | Procedural textures |
| 12 | `graphics.md` | `game/objects/StickFigure.ts`, `game/scenes/MainScene.ts` | Procedural rendering, draw methods |
| 13 | `rendering.md` | `game/scenes/MainScene.ts` | Minimap, tracers, particles, damage numbers |
| 14 | `input.md` | `game/scenes/MainScene.ts`, `components/Joystick.tsx` | Keyboard, mouse, virtual joysticks |
| 15 | `ui.md` | `App.tsx`, `components/ChatBox.tsx`, `components/Joystick.tsx` | React HUD, overlays |
| 16 | `gemini-service.md` | `services/geminiService.ts` | Gemini API integration |
| 17 | `SPEC-OF-SPECS.md` | n/a | Blueprint doc — verify internal consistency only |

All source files are rooted at `docs/archive/20251125-055521-pre-bmm/`.
All spec files are at `docs/archive/20251125-055521-pre-bmm/specs/`.

---

## Task Order

### High Priority (structural / cross-cutting)
| # | Task | What to Check |
|---|------|---------------|
| 1 | README.md | Fix stick-figure.md → player.md link, verify source file inventory (line counts, file list), reading order accuracy |
| 2 | overview.md | Architecture description matches actual data flow, file roles are accurate |
| 3 | types-and-events.md | Every type, enum, and constant in `types.ts` is documented correctly |
| 4 | config.md | Vite config, CDN imports, tsconfig values match source |

### Medium Priority (core gameplay specs)
| # | Task | What to Check |
|---|------|---------------|
| 5 | player.md | StickFigure constructor, properties, methods, draw logic match source |
| 6 | main-scene.md | create() and update() flow, physics groups, collision setup match source |
| 7 | combat.md | Weapon stats table, damage values, cooldowns, reload timings match source |
| 8 | ai.md | Bot spawn logic, wave system, targeting, movement strategies match source |
| 9 | graphics.md | Draw methods, colors, line widths, animation frames match source |

### Lower Priority (subsystems)
| # | Task | What to Check |
|---|------|---------------|
| 10 | pathfinder.md | Grid size, A* implementation details, step limits match source |
| 11 | level-generator.md | Wall positions, desk layout, dimensions match source |
| 12 | texture-generator.md | Texture keys, draw calls, sizes match source |
| 13 | rendering.md | Minimap size, tracer logic, particle configs match source |
| 14 | input.md | Key bindings, mouse handling, joystick config match source |
| 15 | ui.md | React component props, EventBus events, HUD layout match source |
| 16 | gemini-service.md | API calls, prompt text, error handling match source |
| 17 | SPEC-OF-SPECS.md | Internal consistency check (references, structure) |

---

## Progress Checklist

- [x] 1. README.md
- [x] 2. overview.md
- [x] 3. types-and-events.md
- [x] 4. config.md
- [x] 5. player.md
- [x] 6. main-scene.md
- [x] 7. combat.md
- [x] 8. ai.md
- [x] 9. graphics.md
- [x] 10. pathfinder.md
- [x] 11. level-generator.md
- [x] 12. texture-generator.md
- [x] 13. rendering.md
- [x] 14. input.md
- [x] 15. ui.md
- [ ] 16. gemini-service.md
- [ ] 17. SPEC-OF-SPECS.md

---

## Discoveries

Add rows here when you find something the plan missed.

| # | Discovery | Affected Items | Action Taken |
|---|-----------|---------------|--------------|
| 1 | `graphics.md` missing from README reading order, quick reference table, and dependency graph | README.md | Added graphics.md to all three sections in README.md |
| 2 | Several source file line counts in README were wrong (Joystick.tsx: ~100→~193, MainScene.ts: ~890→~989, vite.config.ts: ~15→~23, tsconfig.json: ~20→~28) | README.md | Corrected all line counts |
| 3 | Weapon stats are wrong across multiple specs — BAT dmg 30→60, KATANA dmg 45→100, cooldowns and ranges differ | overview.md, combat.md, player.md | Fixed in overview.md; combat.md pending |
| 4 | Player speed is 350 px/s, not 250 px/s | overview.md, main-scene.md, player.md | Fixed in overview.md; others pending |
| 5 | All event names were wrong (game-stats→player-update, enemy-killed→bot-killed, joystick-*→input-*) | overview.md, types-and-events.md, ui.md, input.md | Fixed in overview.md; others pending |

---

## Per-Item Process

For each checklist item:

1. **Read the spec** — read the full spec file
2. **Read the source** — read every source file listed in the Context Table for that spec
3. **Diff mentally** — identify mismatches: wrong values, missing methods, incorrect descriptions, wrong line numbers, broken cross-references
4. **Fix the spec** — edit the spec to match what the code actually does. Preserve the spec's structure and style. Do targeted edits, not rewrites.
5. **Update README.md if needed** — if you renamed/restructured anything, update the index
6. **Commit** — `docs: verify {spec-name} against archived source`
7. **Check off** — mark the item `[x]` in this file

---

## Rules

1. **Read before editing** — always read both the spec and its source file(s) before making changes.
2. **Code is truth** — the spec must match the code, not the other way around. Never edit source files.
3. **Preserve structure** — fix content inside the existing spec structure. Don't reorganize or reformat unless something is genuinely wrong.
4. **Targeted edits** — change the specific wrong values/descriptions. Don't rewrite entire sections when a few lines need fixing.
5. **Update don't rewrite** — if a spec is 95% correct, fix the 5%. Don't regenerate from scratch.
6. **One item per iteration** — do one checklist item, commit, then stop. The loop restarts fresh for the next one.
7. **Cross-references** — if fixing one spec reveals a problem in another, note it in Discoveries but don't fix it now.
8. **Line numbers are approximate** — source line numbers in specs are rough guides from the snapshot. Update obviously wrong ones but don't obsess over ±5 lines.

---

## Course Corrections

(The orchestrator appends corrections here. Check this section at the start of every iteration.)

