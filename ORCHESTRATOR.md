# Orchestrator Playbook — Pre-BMM Spec Verification

> **Mode: SANDBOX ONLY** — This job runs exclusively in Docker. Never run bare metal.

## How to Run

Launch the worker loop in sandbox mode from the project root:

```bash
SANDBOX=1 ./loop.sh 20 PROMPT.md
```

To monitor from a separate Claude session, launch the loop in the background and auto-check on a blocking 5-minute interval:

```bash
SANDBOX=1 ./loop.sh 20 PROMPT.md &
LOOP_PID=$!

while kill -0 $LOOP_PID 2>/dev/null; do
    sleep 300
    # Run your 7 checks here (see below)
done
```

**Do NOT run without `SANDBOX=1`.** If the loop is accidentally started bare, stop it and relaunch with the env var.

---

## What to Check (7-Point Checklist)

### 1. Progress
Read `IMPLEMENTATION_PLAN.md`, count `[x]` vs `[ ]` in the Progress Checklist section.

```bash
grep -c '\[x\]' IMPLEMENTATION_PLAN.md   # completed
grep -c '\[ \]' IMPLEMENTATION_PLAN.md   # remaining
```

### 2. Git History
```bash
git log --oneline -10
```
**Red flags:** commits touching files outside `docs/archive/`, thrashing (same spec fixed multiple times), stuck (no new commits since last check).

### 3. Latest Log
Read the most recent `.loop-logs/iteration-*.log`. Look for:
- Errors or exceptions
- Worker drifting to unrelated work
- Worker editing source code (should only edit specs)

```bash
ls -t .loop-logs/iteration-*.log | head -1
```

### 4. Diff Size
```bash
git diff --stat HEAD~1
```
**Red flag:** 200+ lines changed in a single spec = likely rewrote it instead of targeted edits. A spec fix should typically be 5-50 lines changed.

### 5. Discoveries
Check if the worker added rows to the Discoveries table in `IMPLEMENTATION_PLAN.md`. If a discovery affects already-completed items, write a course correction to revisit them.

### 6. Container Resources
```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.PIDs}}" | grep ralph
```
**Red flags:** Memory >6g of 8g limit (OOM risk), PIDs near 512 cap, CPU pegged at 400%.

### 7. Spot Check
Read one recently-committed spec file. Verify:
- Corrections are accurate (compare a claim against the actual source file)
- Spec structure is preserved
- No unnecessary rewrites or reformatting
- Cross-references still work

---

## Course Corrections

To correct the worker, append a line to the IMPORTANT section of `PROMPT.md`:

```
CORRECTION: {what's wrong and what to do instead}
```

The worker reads PROMPT.md fresh each iteration and checks for corrections first.

**Examples:**
```
CORRECTION: You rewrote rendering.md from scratch — revert and make targeted edits only.
CORRECTION: Skip SPEC-OF-SPECS.md — it's a template doc, not a code spec. Mark it done.
CORRECTION: You missed that player.md references stick-figure.md links — fix those cross-refs.
```

---

## Status Report Template

```
## Check #{N} — {time}

**Progress:** {X}/17 complete ({Y} since last check)
**Current item:** {spec name}
**Health:** {OK | WARNING | PROBLEM}
**Container:** {MEM usage/limit, CPU%, PIDs} (sandbox mode)
**Recent commits:**
- {hash} {message}
- {hash} {message}
**Notes:** {anything notable}
```

---

## When to Intervene vs Let It Run

### Let it run
- Steady progress (1 spec per iteration)
- Reasonable diff sizes (5-50 lines per spec)
- Correct commit pattern (`docs: verify {name} against archived source`)
- Worker checking off items in order

### Write a correction
- Wrong files edited (source code instead of specs, files outside archive)
- Rewrites instead of targeted edits (200+ line changes)
- Stuck 2+ iterations on same item
- Skipping items without marking them done
- Not committing at end of iteration
- Editing PROMPT.md or IMPLEMENTATION_PLAN.md structure (should only update checklist + discoveries)

### Alert the user
- Error loop (same error 3+ iterations)
- Worker fundamentally misunderstands the task (e.g., trying to make specs match current multiplayer code instead of archived pre-BMM code)
- Faking progress (checking items off without actually reading source)
- Container resource issues (repeated OOM kills)
