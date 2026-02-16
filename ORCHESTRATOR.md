# Orchestrator: Spec Validation Monitor

You are monitoring a `loop.sh` worker that is validating spec files in `specs/` against source code. The worker does NOT edit specs — it only reads and reports drift. Your job is to auto-check every 5 minutes and course-correct when needed by editing PROMPT.md.

## How to Run

```
# Launch the worker loop (sandbox mode)
SANDBOX=1 ./loop.sh 25 PROMPT.md

# Or bare mode (no Docker):
./loop.sh 25 PROMPT.md
```

### Auto-Checking

The orchestrator runs checks on a 5-minute interval using a blocking `sleep 300` between cycles. No background timers — it simply sleeps, wakes, runs the full checklist, then sleeps again.

## What to Check

### 1. Progress

Read IMPLEMENTATION_PLAN.md "Validation Checklist". Count `[x]` vs `[ ]`.

### 2. Git History

Run: `git log --oneline -10`

Red flags:
- Commits touching spec files (this is a READ-ONLY validation)
- Commits touching source code
- No plan updates in 2+ iterations (stuck)

### 3. Latest Log

Run: `ls -t .loop-logs/iteration-*.log | head -1` then read it.

Look for: what spec is being validated, errors, whether worker is actually reading source code.

### 4. Findings

Read IMPLEMENTATION_PLAN.md "Findings" table. Check for new rows. Verify findings are specific (cite spec section + source file).

### 5. Container Resources

Run: `docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}" | grep sandbox-loop`

Red flags:
- Memory above 80% of limit (approaching OOM kill)
- PIDs near the limit (default 512)

### 6. One-Per-Iteration Check

Verify the worker is doing exactly one spec per iteration (check iteration log count vs checklist progress).

## Course Corrections

Append `CORRECTION: {what's wrong and what to do}` to PROMPT.md's IMPORTANT section.

## Status Report

After each check, tell the user:

```
## Check #{N} — {time}

**Progress:** {X}/23 specs validated ({Y} since last check)
**Current spec:** {name}
**Health:** {OK | WARNING | PROBLEM}
**Container:** {MEM usage/limit, CPU%, PIDs} or "bare mode"
**Findings so far:** {count} ({HIGH}/{MEDIUM}/{LOW})
```

## When to Intervene vs Let It Run

**Let it run:** steady progress (1 spec per iteration), no spec edits, findings are specific.

**Write a correction:** worker editing specs, doing multiple specs per iteration, vague findings, not reading source code.

**Alert the user:** error loop, worker modifying code, faking validations.
