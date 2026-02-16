# Orchestrator: Spec Drift Fix Monitor

You are monitoring a `loop.sh` worker that is fixing spec drift in `specs/`. The worker edits specs to match source code based on 104 findings from a prior validation pass. Your job is to auto-check every 5 minutes and course-correct when needed by editing PROMPT.md.

## How to Run

```bash
# Launch the worker loop in the background (sandbox mode)
cd ../stick-rumble-worktrees/spec-fixes
SANDBOX=1 JOB_NAME=spec-fixes ./loop.sh 110 PROMPT.md &

# Or bare mode:
cd ../stick-rumble-worktrees/spec-fixes
JOB_NAME=spec-fixes ./loop.sh 110 PROMPT.md &
```

### Auto-Checking

After launching the loop in the background, enter a blocking check cycle: `sleep 300`, run the full checklist below, then `sleep 300` again. Repeat until the job completes. No background timers — just sleep, wake, check, sleep.

## What to Check

### 1. Progress

Read IMPLEMENTATION_PLAN.md "Fix Checklist". Count `[x]` vs `[ ]`.

### 2. Git History

Run: `git log --oneline -10`

Red flags:
- Commits touching source code (this job only edits specs)
- No plan updates in 2+ iterations (stuck)
- Commits with wrong message format (should be "docs: Fix {spec} — ...")
- Thrashing (same spec edited multiple times)

### 3. Latest Log

Run: `ls -t .loop-logs/iteration-*.log | head -1` then read it.

Look for: which finding is being fixed, errors, whether worker is reading source code before editing spec.

### 4. Diff Size

Run: `git diff --stat HEAD~1`

Red flag: 200+ lines in one file = rewrite instead of targeted fix.

### 5. Discoveries

Check if worker added new rows to IMPLEMENTATION_PLAN.md Discoveries section. If a discovery affects completed items, write a correction.

### 6. Container Resources

Run: `docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.PIDs}}" | grep ralph-spec-fixes-*`

Red flags:
- Memory above 80% of limit (approaching OOM kill)
- PIDs near the limit (default 512)
- CPU pegged at 100%

### 7. Spot Check

Read one recently-committed spec file. Verify the fix matches the finding description and is accurate against source code.

## Course Corrections

Append `CORRECTION: {what's wrong and what to do}` to PROMPT.md's IMPORTANT section. Worker picks it up next iteration.

## Status Report

After each check, tell the user:

```
## Check #{N} — {time}

**Progress:** {X}/104 findings fixed ({Y} since last check)
**Current finding:** #{id} — {spec-name}
**Health:** {OK | WARNING | PROBLEM}
**Container:** {MEM usage/limit, CPU%, PIDs} or "bare mode"
**Recent commits:** {list}
```

## Post-Job Completion (worktree mode)

After the worker outputs `/done`:
1. Verify the branch was pushed to the remote (`git log --oneline origin/ralph/spec-fixes -1`)
2. If not pushed, push it: `git push -u origin ralph/spec-fixes`
3. The worktree, branch, and job files (PROMPT.md, IMPLEMENTATION_PLAN.md, ORCHESTRATOR.md) are left intact for manual review
4. The user will merge and clean up the worktree manually

## When to Intervene vs Let It Run

**Let it run:** steady progress (1 finding per iteration), only spec files edited, reasonable diff sizes, correct commit format.

**Write a correction:** source code edited, rewrites instead of targeted fixes, stuck 2+ iterations, skipping items, not committing, not reading source before editing.

**Alert the user:** error loop, worker modifying source code, garbled output, faking progress, fundamental misunderstanding of a finding.
