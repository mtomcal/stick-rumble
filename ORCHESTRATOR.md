# Orchestrator Playbook — Pre-BMM Visual Systems Implementation

You are the orchestrator for a loop.sh worker job implementing 7 visual systems across 5 phases. The worker reads PROMPT.md each iteration, implements one system section from IMPLEMENTATION_PLAN.md, commits, and loops.

---

## How to Run

Launch the orchestrator with restricted tools:

```
claude-director
```

If you don't have the alias, add it to your shell config:

```bash
alias claude-director='claude --allowedTools "Read" "Grep" "Glob" "Bash(git log *)" "Bash(git diff *)" "Bash(docker stats *)" "Bash(docker ps *)" "Bash(docker kill *)" "Bash(./loop.sh *)" "Bash(ps *)" "Bash(kill *)" "Bash(sleep *)" "Bash(cat .loop-logs/*)" "Bash(ls .loop-logs/*)" "Edit(PROMPT.md)"'
```

---

## Allowed Tools

You can ONLY use these tools. Do not attempt anything outside this list:

- `Read` — read any file
- `Grep` / `Glob` — search files
- `Bash(git log *)` / `Bash(git diff *)` — inspect git history and diffs
- `Bash(./loop.sh *)` — launch or restart the worker loop
- `Bash(ps *)` / `Bash(kill *)` — check if loop is running, kill if stuck
- `Bash(docker stats *)` / `Bash(docker ps *)` — check container resources and status
- `Bash(docker kill *)` — kill a stuck sandbox container
- `Bash(sleep *)` — wait between check cycles
- `Bash(cat .loop-logs/*)` / `Bash(ls .loop-logs/*)` — read iteration logs
- `Edit(PROMPT.md)` — write course corrections (the ONLY file you can edit)

---

## Monitoring Loop

Auto-check every 5 minutes using blocking sleep:

1. Run all 7 checks below
2. Write a status report
3. Take action if needed (correction, alert, or let it run)
4. `sleep 300`
5. Repeat

---

## What to Check

### 1. Progress

Read IMPLEMENTATION_PLAN.md and count `[x]` vs `[ ]` items (excluding HUMAN ONLY sections).

```
# Quick count
grep -c '\[x\]' IMPLEMENTATION_PLAN.md
grep -c '\[ \]' IMPLEMENTATION_PLAN.md
```

### 2. Git History

```
git log --oneline -10
```

Red flags:
- Wrong files touched (e.g., editing specs/ when it should only read them)
- Thrashing (same file changed back and forth)
- Stuck (no new commits since last check)

### 3. Latest Log

```
ls -t .loop-logs/iteration-*.log | head -1
```

Read the most recent log. Look for:
- Errors or test failures
- Rate limit messages ("hit your limit", "rate_limit_error")
- Worker confusion or drift from the plan

### 4. Diff Size

```
git diff --stat HEAD~1
```

Red flags:
- 200+ lines changed in a single file = likely rewrite (should be targeted edits)
- Files outside stick-rumble-client/ or stick-rumble-server/ being modified

### 5. Discoveries

Check if the worker added new entries to the Worker Discovery Log in IMPLEMENTATION_PLAN.md. If a discovery affects already-completed items, write a course correction.

### 6. Container Resources

```
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.PIDs}}" | grep ralph
```

Red flags:
- Memory >6.5g / 8g (OOM risk)
- PIDs near 512 cap
- CPU pegged at 400% continuously

### 7. Spot Check

Read one recently-committed source file. Verify:
- Code quality matches spec requirements
- Tests have meaningful assertions (not bare `toHaveBeenCalled()`)
- No debug statements or commented-out code left behind

---

## Course Corrections

When the worker drifts, append a correction to the **Course Corrections** section in IMPLEMENTATION_PLAN.md:

Format:
```
- **CORRECTION [check #N]:** {what's wrong and what to do instead}
```

The worker checks this section FIRST every iteration. Be specific and actionable.

Examples:
- `CORRECTION [check #3]: You're rewriting MeleeWeapon.ts from scratch. Make targeted edits only — change the color, remove fill, update stroke width. Don't delete and recreate the file.`
- `CORRECTION [check #5]: Discovery about RenderedPlayer fields affects System 3b (blood particles). When you get to System 3b, add lastDamageTime and lastDamageSourceAngle to the interface FIRST.`

---

## Status Report Template

```
## Check #N — HH:MM

**Progress:** X/Y complete (Z since last check)
**Current system:** {system name from plan}
**Health:** OK | WARNING | PROBLEM
**Container:** MEM X.Xg/8g, CPU X%, PIDs X/512
**Recent commits:**
- abc1234 commit message
- def5678 commit message
**Notes:** {anything notable}
```

---

## When to Intervene vs Let It Run

### Let it run
- Steady progress (1+ items checked off per iteration)
- Reasonable diff sizes (<200 lines per file)
- Correct commit pattern (one commit per iteration, descriptive messages)
- Tests passing

### Write a correction
- Wrong files being edited (especially specs/)
- Rewrites instead of targeted edits (200+ line diffs)
- Stuck on same item for 2+ iterations
- Skipping items or doing them out of order
- Not committing at end of iteration
- Weak test assertions (bare `toHaveBeenCalled()`, `toBeDefined()` on rendering)

### Alert the user
- Error loop (same error 3+ iterations)
- Rate limit hit (worker burns iterations doing nothing)
- Garbled output or fundamental misunderstanding of the task
- Container OOM-killed repeatedly
- Worker editing PROMPT.md or spec files
- Faking progress (checking items off without implementing them)

---

## Key Context

- **Total items:** ~170 checklist items (excluding HUMAN ONLY)
- **Worker does:** ~1 system section per iteration (all items in that section)
- **Expected iterations:** ~20-25 productive iterations for all systems
- **Spec files:** `specs/` directory — worker reads these for reference, NEVER edits
- **Source files:** `stick-rumble-client/` and `stick-rumble-server/` — worker edits these
- **Test commands:** `make test-server` (Go), `make test-client` (TypeScript)
- **Branch:** Worker commits to current branch
- **Git author:** `mtomcal <mtomcal@users.noreply.github.com>`
