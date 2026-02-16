#!/bin/bash
# Usage: ./loop.sh [max_iterations] [prompt_file]
# Examples:
#   ./loop.sh              # Unlimited iterations, PROMPT.md
#   ./loop.sh 20           # Max 20 iterations
#   ./loop.sh 20 TASK.md   # Custom prompt file
#
# Environment variables:
#   SANDBOX=1              # Run Claude inside a Docker container
#   MEMORY_LIMIT=8g        # Container memory cap (default: 8g)
#   CPU_LIMIT=4            # Container CPU cap (default: 4)
#   PIDS_LIMIT=512         # Container PID cap (default: 512)
#   SANDBOX_IMAGE=stick-rumble-sandbox  # Docker image name
#   SANDBOX_NETWORK=sandbox-net         # Docker network name

MAX_ITERATIONS=${1:-0}
PROMPT_FILE=${2:-PROMPT.md}
ITERATION=0
CURRENT_BRANCH=$(git branch --show-current)
LOG_DIR=".loop-logs"
DONE_PATTERN="/done"
SANDBOX=${SANDBOX:-0}

mkdir -p "$LOG_DIR"

# --- Sandbox auto-build ---
if [ "$SANDBOX" = "1" ]; then
    IMAGE="${SANDBOX_IMAGE:-stick-rumble-sandbox}"
    if ! docker image inspect "$IMAGE" &>/dev/null; then
        echo "Sandbox image '$IMAGE' not found — building..."
        docker build \
            --build-arg USER_ID="$(id -u)" \
            --build-arg GROUP_ID="$(id -g)" \
            -t "$IMAGE" \
            -f Dockerfile.sandbox .
        echo "Image '$IMAGE' built successfully"
    fi
fi

# --- Claude auth (sandbox mode) ---
# Priority: ANTHROPIC_API_KEY > CLAUDE_CODE_OAUTH_TOKEN > auto-extract
# OAuth tokens expire after ~8h but loop.sh re-extracts each iteration.
# For long sessions, ANTHROPIC_API_KEY is more reliable.
resolve_claude_auth() {
    if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
        return 0
    fi
    if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
        return 0
    fi
    # Auto-extract from credentials file (subscription users)
    local CREDS="$HOME/.claude/.credentials.json"
    if [ -f "$CREDS" ]; then
        CLAUDE_CODE_OAUTH_TOKEN=$(python3 -c "
import json, sys
try:
    d = json.load(open(sys.argv[1]))
    print(d.get('claudeAiOauth', {}).get('accessToken', ''))
except Exception:
    pass
" "$CREDS" 2>/dev/null || true)
        export CLAUDE_CODE_OAUTH_TOKEN
    fi
    if [ -z "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then
        echo "warning: no Claude auth found. Worker will show login prompt." >&2
        echo "  fix: export ANTHROPIC_API_KEY=sk-ant-... or run 'claude login' on host." >&2
    fi
}

# --- Git auth (sandbox mode) ---
resolve_git_auth() {
    GH_TOKEN="${GH_TOKEN:-}"
    if [ -z "$GH_TOKEN" ] && command -v gh &>/dev/null; then
        GH_TOKEN=$(gh auth token 2>/dev/null || true)
    fi
    if [ -z "$GH_TOKEN" ]; then
        echo "warning: no GH_TOKEN found. git push will fail inside the container." >&2
        echo "  fix: run 'gh auth login' or export GH_TOKEN=ghp_..." >&2
    fi
    export GH_TOKEN
}

# --- Claude execution functions ---

run_claude_bare() {
    local prompt_file="$1"
    local iter_log="$2"

    cat "$prompt_file" | claude -p \
        --dangerously-skip-permissions \
        --output-format=stream-json \
        --model opus \
        --verbose 2>&1 | tee "$iter_log.raw" | jq -jr '
  (.event.delta.text // empty),
  (select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text // empty)
' | tee "$iter_log"
}

run_claude_sandboxed() {
    local prompt_file="$1"
    local iter_log="$2"

    # Re-resolve auth each iteration (OAuth tokens may refresh)
    resolve_claude_auth
    resolve_git_auth

    # Resolve symlinked settings
    local CLAUDE_SETTINGS
    CLAUDE_SETTINGS=$(readlink -f "$HOME/.claude/settings.json" 2>/dev/null || echo "$HOME/.claude/settings.json")

    local TTY_FLAG=""
    [ -t 0 ] && TTY_FLAG="-it"

    docker run --rm $TTY_FLAG \
        --name "sandbox-loop-$$-$ITERATION" \
        --memory="${MEMORY_LIMIT:-8g}" \
        --memory-swap="${MEMORY_LIMIT:-8g}" \
        --cpus="${CPU_LIMIT:-4}" \
        --pids-limit="${PIDS_LIMIT:-512}" \
        --network="${SANDBOX_NETWORK:-sandbox-net}" \
        -v "$(pwd):/workspace" \
        -v "$CLAUDE_SETTINGS:/home/loopuser/.claude/settings.json:ro" \
        -v "$HOME/.claude/projects:/home/loopuser/.claude/projects" \
        -e ANTHROPIC_API_KEY \
        -e CLAUDE_CODE_OAUTH_TOKEN \
        -e DISABLE_AUTOUPDATER=1 \
        -e "GH_TOKEN=$GH_TOKEN" \
        -w /workspace \
        "${SANDBOX_IMAGE:-stick-rumble-sandbox}" \
        sh -c "claude -p \
            --dangerously-skip-permissions \
            --output-format=stream-json \
            --model opus \
            --verbose < /workspace/$prompt_file 2>&1" \
        | tee "$iter_log.raw" \
        | jq -jr '
            (.event.delta.text // empty),
            (select(.type == "assistant") | .message.content[]? | select(.type == "text") | .text // empty)
        ' | tee "$iter_log"
}

# --- Banner ---
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Prompt: $PROMPT_FILE"
echo "Branch: $CURRENT_BRANCH"
echo "Logs:   $LOG_DIR/"
[ "$MAX_ITERATIONS" -gt 0 ] && echo "Max:    $MAX_ITERATIONS iterations"
echo "Done:   when output contains '$DONE_PATTERN'"
if [ "$SANDBOX" = "1" ]; then
    echo "Mode:   SANDBOX (Docker)"
    echo "  Image:   ${SANDBOX_IMAGE:-stick-rumble-sandbox}"
    echo "  Network: ${SANDBOX_NETWORK:-sandbox-net}"
    echo "  Memory:  ${MEMORY_LIMIT:-8g}"
    echo "  CPUs:    ${CPU_LIMIT:-4}"
    echo "  PIDs:    ${PIDS_LIMIT:-512}"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verify prompt file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: $PROMPT_FILE not found"
    exit 1
fi

while true; do
    ITERATION=$((ITERATION + 1))

    if [ "$MAX_ITERATIONS" -gt 0 ] && [ "$ITERATION" -gt "$MAX_ITERATIONS" ]; then
        echo "Reached max iterations: $MAX_ITERATIONS"
        break
    fi

    echo -e "\n======================== ITERATION $ITERATION ========================"
    echo "Started: $(date '+%Y-%m-%d %H:%M:%S')"

    ITER_LOG="$LOG_DIR/iteration-$ITERATION.log"

    # Run claude (sandboxed or bare)
    if [ "$SANDBOX" = "1" ]; then
        run_claude_sandboxed "$PROMPT_FILE" "$ITER_LOG"
    else
        run_claude_bare "$PROMPT_FILE" "$ITER_LOG"
    fi
    EXIT_CODE=${PIPESTATUS[0]}

    echo ""
    echo "Finished: $(date '+%Y-%m-%d %H:%M:%S')"

    # Handle exit codes (sandbox mode)
    if [ "$SANDBOX" = "1" ] && [ "$EXIT_CODE" -ne 0 ]; then
        case $EXIT_CODE in
            137)
                echo "WARNING: Container OOM-killed (hit ${MEMORY_LIMIT:-8g} limit)"
                echo "  Iteration $ITERATION lost — restarting in 5s"
                sleep 5
                continue
                ;;
            124)
                echo "WARNING: Container timed out"
                sleep 5
                continue
                ;;
            *)
                echo "WARNING: Container exited with code $EXIT_CODE"
                sleep 5
                continue
                ;;
        esac
    fi

    # Check for done pattern
    if grep -q "$DONE_PATTERN" "$ITER_LOG"; then
        echo "Done pattern found in output - task completed"

        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Loop completed after $ITERATION iteration(s)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        break
    fi

    echo "Continuing to next iteration..."
    sleep 2
done
