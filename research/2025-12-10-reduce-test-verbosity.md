---
date: 2025-12-10T00:00:00Z
researcher: codebase-researcher-agent
topic: "Reducing Test Output Verbosity to Prevent Overwhelming Agent Context Windows"
tags: [research, codebase, testing, verbosity, vitest, go-test]
status: complete
---

# Research: Reducing Test Output Verbosity to Prevent Overwhelming Agent Context Windows

**Date**: 2025-12-10
**Researcher**: codebase-researcher-agent

## Research Question
How are tests currently configured and run in both the Go server (stick-rumble-server) and TypeScript client (stick-rumble-client), and what configuration options exist to make them less verbose while preserving error details?

## Summary
The project currently generates excessive test output from:
1. **TypeScript/Vitest (Client)**: ~662 test occurrences across 30 test files using verbose default reporter
2. **Go tests (Server)**: ~271 test functions across 28 test files using `-v` flag in Makefile
3. **Integration test helpers**: Extensive console.log statements (10+ in WebSocketClient.integration.helpers.ts)
4. **Runtime logging**: WebSocket client has 8+ console statements, server has 50+ log.Print statements

**Key Finding**: Both test frameworks support native quiet/silent modes that dramatically reduce output while preserving error details. The fix is primarily **configuration changes** rather than code refactoring.

## Detailed Findings

### 1. Current Test Configuration

#### TypeScript Client Configuration
- **Test framework**: Vitest 4.0.13
- **Config file**: `/home/mtomcal/code/stick-rumble/stick-rumble-client/vitest.config.ts`
- **Current reporter**: Default (verbose) - shows all test output
- **Coverage reporter**: `['text', 'html', 'json-summary']` - text output is verbose
- **Test commands** (package.json:12-19):
  ```json
  "test": "vitest --run",
  "test:watch": "vitest",
  "test:unit": "vitest --run",
  "test:integration": "vitest --run --config vitest.integration.config.ts"
  ```
- **No silent/quiet configuration currently applied**

#### Go Server Configuration
- **Test framework**: Go 1.24.1 built-in testing
- **Makefile configuration** (lines 66, 78):
  ```makefile
  test:
      cd stick-rumble-server && go test ./...  # No -v flag (quiet)

  test-server:
      cd stick-rumble-server && go test ./... -v  # VERBOSE FLAG ENABLED
  ```
- **Coverage script**: `/home/mtomcal/code/stick-rumble/stick-rumble-server/scripts/check-coverage.sh:12`
  ```bash
  go test ./... -coverprofile="$COVERAGE_FILE" -covermode=atomic  # No -v (good)
  ```

**Issue**: Makefile `test-server` target uses `-v` flag, causing verbose output for every test function.

### 2. Verbosity Sources Identified

#### TypeScript/Client Sources (High Verbosity)

**A. Integration Test Helpers** (`src/game/network/WebSocketClient.integration.helpers.ts`):
- Line 156: `console.log('[connectClientsToRoom] Connecting ${clientsToConnect.length} client(s)...')`
- Line 160: `console.log('[connectClientsToRoom] Setting up room:joined handler for client ${index + 1}')`
- Line 165: `console.log('[connectClientsToRoom] Connecting all clients to WebSocket...')`
- Line 167: `console.log('[connectClientsToRoom] Connecting client ${index + 1}...')`
- Line 172: `console.log('[connectClientsToRoom] Waiting for all room:joined events...')`
- Line 175: `console.log('[connectClientsToRoom] All clients joined room successfully')`
- Line 235: `console.log('[waitForEvent] '${eventName}' received after ${duration}ms')`
- Line 246: `console.error('[waitForEvent] '${eventName}' TIMEOUT after ${timeout}ms')`
- Line 253: `console.log('[waitForEvent] Waiting for '${eventName}'...')`
- Line 338: `console.log('[aggressiveCleanup] Cleaning up ${clients.length} client(s)...')`
- Line 344: `console.warn('[aggressiveCleanup] Client ${i} has ${handlerCount} handlers before disconnect')`
- Line 355: `console.log('[aggressiveCleanup] Cleanup complete')`

**B. WebSocket Client Runtime** (`src/game/network/WebSocketClient.ts`):
- Line 43: `console.log('[${this.clientId}] ${message}', ...args)` (debug mode)
- Line 53: `console.log('WebSocket connected')`
- Line 63: `console.error('Failed to parse message:', err)`
- Line 68: `console.error('WebSocket error:', error)`
- Line 73: `console.log('WebSocket closed:', event.code, event.reason)`
- Line 86: `console.warn('WebSocket not connected, cannot send message')`
- Line 132: `console.error('Max reconnection attempts reached')`
- Line 138: `console.log('Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})')`
- Line 142: `console.error('Reconnection failed:', err)`

**C. Game Code Console Statements**:
- GameScene.ts: 2 console statements
- GameSceneEventHandlers.ts: 9 console statements
- PlayerManager.ts: 1 console statement
- InputManager.ts: console statements present

#### Go/Server Sources (Moderate Verbosity)

**A. Runtime Logging** (50+ log.Print statements, sampled):
- `internal/network/broadcast_helper.go`: 17+ log.Printf for errors/events
- `internal/network/websocket_handler.go`: 11+ log.Printf for connections/errors
- `internal/game/room.go`: 15+ log.Printf for room lifecycle
- `internal/game/physics.go`: 3 log.Printf for invalid values
- `internal/game/gameserver.go`: 2 log.Println for lifecycle events

**B. Test Logging**:
- **Zero t.Log() calls found** in test files (good - Go tests don't log during passing tests)
- Test output verbosity comes entirely from `-v` flag showing all test names

### 3. Framework-Native Solutions

#### Vitest Reporter Options (2025)

**Recommended: DOT Reporter**
- **Configuration**: Add to `vitest.config.ts` and `vitest.integration.config.ts`
  ```typescript
  test: {
    reporters: ['dot'],  // Minimal: single dot per test
    // ... other config
  }
  ```
- **Output**: Single dot (`.`) per passing test, detailed output for failures only
- **Token savings**: ~90% reduction vs default reporter
- **Source**: [Vitest Reporters Guide](https://vitest.dev/guide/reporters)

**Alternative: Silent Mode with Passed-Only (July 2025 Feature)**
- **Configuration**:
  ```typescript
  test: {
    silent: 'passed-only',  // Hide console.log from passing tests
    reporters: ['dot'],     // Combine with dot reporter
  }
  ```
- **CLI Usage**: `vitest --silent=passed-only --reporter=dot`
- **Benefit**: Suppresses console.log/warn/error from passing tests while showing failures
- **Source**: [Vitest Silent Config](https://vitest.dev/config/silent), [GitHub Discussion #6002](https://github.com/vitest-dev/vitest/discussions/6002)

**Coverage Reporter Optimization**:
- Change from `['text', 'html', 'json-summary']` to `['json-summary', 'html']`
- Removes verbose text table output, keeps machine-readable JSON + browsable HTML
- File: `/home/mtomcal/code/stick-rumble/stick-rumble-client/vitest.config.ts:23`

#### Go Test Output Control (2025)

**Recommended: Remove -v Flag**
- **Current**: Makefile:78 uses `go test ./... -v` (verbose)
- **Fix**: Remove `-v` flag for normal test runs
  ```makefile
  test-server:
      @echo "Running server tests..."
      cd stick-rumble-server && go test ./...  # Remove -v
  ```
- **Behavior**: Only shows package pass/fail, detailed output on failures
- **Token savings**: ~85% reduction
- **Source**: [Go Issue #21461](https://github.com/golang/go/issues/21461), [Dave Cheney on go test -v](https://dave.cheney.net/2020/03/10/go-test-v-streaming-output)

**Alternative: JSON Output for Machine Parsing (Go 1.24+)**
- **Usage**: `go test -json ./...`
- **Output**: Newline-delimited JSON events (TestEvent objects)
- **Benefit**: Structured, parseable, less verbose than `-v` for passing tests
- **Use case**: If agents need structured test results
- **Source**: [Go 1.24 JSON Output](https://www.bytesizego.com/blog/go-124-json-output), [test2json package](https://pkg.go.dev/cmd/test2json)

**Coverage Script** (already optimal):
- Line 12: `go test ./... -coverprofile="$COVERAGE_FILE"` (no `-v`, good)
- No changes needed

### 4. Code-Level Optimizations

#### Integration Test Helper Logging

**Problem**: 12+ console statements in `/home/mtomcal/code/stick-rumble/stick-rumble-client/src/game/network/WebSocketClient.integration.helpers.ts`

**Solution**: Add environment variable or config flag for verbose integration logging
```typescript
// At top of file
const VERBOSE_INTEGRATION_LOGS = process.env.VITEST_VERBOSE_INTEGRATION === 'true';

function log(message: string, ...args: unknown[]) {
  if (VERBOSE_INTEGRATION_LOGS) {
    console.log(message, ...args);
  }
}

// Replace all console.log/warn/error calls
log('[connectClientsToRoom] Connecting ${clientsToConnect.length} client(s)...');
```

**Alternative**: Use Vitest's `silent: 'passed-only'` to suppress these automatically

#### WebSocket Client Debug Mode

**Current**: Line 41-45 has debug mode, but other console.log calls are unconditional

**Recommendation**: Keep production logging (connection/error states) but gate verbose debug logs
- Keep: Line 53 (connection), 68 (error), 73 (close) - useful for debugging
- Consider gating: Line 138 (reconnection delay) - verbose during tests

### 5. Best Practices Found in Codebase

**Positive Patterns**:
1. **Go tests**: Zero `t.Log()` usage - rely on `-v` flag for verbosity control (good)
2. **Coverage script**: Runs without `-v` flag (optimal)
3. **WebSocket debug mode**: Conditional logging pattern exists (line 41-45)

**Anti-Patterns**:
1. **Integration helpers**: Unconditional verbose logging in test utilities
2. **Makefile inconsistency**: `test` target quiet, `test-server` verbose
3. **No silent mode**: Vitest configured with default reporter (verbose)

## Code References

### Configuration Files
- `/home/mtomcal/code/stick-rumble/Makefile:66,78` - Test commands
- `/home/mtomcal/code/stick-rumble/stick-rumble-client/vitest.config.ts:1-46` - Vitest config
- `/home/mtomcal/code/stick-rumble/stick-rumble-client/vitest.integration.config.ts:1-22` - Integration config
- `/home/mtomcal/code/stick-rumble/stick-rumble-client/package.json:6-20` - Test scripts
- `/home/mtomcal/code/stick-rumble/stick-rumble-server/scripts/check-coverage.sh:12` - Coverage command

### High-Verbosity Source Files
- `/home/mtomcal/code/stick-rumble/stick-rumble-client/src/game/network/WebSocketClient.integration.helpers.ts:156-355` - 12 console statements
- `/home/mtomcal/code/stick-rumble/stick-rumble-client/src/game/network/WebSocketClient.ts:43-142` - 8 console statements
- `/home/mtomcal/code/stick-rumble/stick-rumble-server/internal/network/broadcast_helper.go:23-316` - 17 log.Printf
- `/home/mtomcal/code/stick-rumble/stick-rumble-server/internal/network/websocket_handler.go:77-177` - 11 log.Printf
- `/home/mtomcal/code/stick-rumble/stick-rumble-server/internal/game/room.go:36-411` - 15 log.Printf

## Architecture Insights

### Test Output Patterns
1. **Go philosophy**: Tests silent by default (without `-v`), verbose on demand
2. **Vitest default**: Verbose reporter shows all test output
3. **Integration tests**: Most verbose due to helper logging + real server interaction
4. **Coverage reporting**: Text format very verbose, JSON format compact

### Token Usage Estimation

**Current State** (approximate per full test run):
- **Client tests** (30 files, 662 tests): ~50-80K tokens (default reporter + console.log)
- **Server tests** (28 files, 271 tests): ~30-50K tokens (with `-v` flag)
- **Integration tests**: ~20-30K tokens (helper logs + test output)
- **Total**: ~100-160K tokens per complete test run

**With Recommended Changes**:
- **Client tests** (dot reporter + silent mode): ~5-10K tokens
- **Server tests** (no `-v` flag): ~3-5K tokens
- **Integration tests** (helper logging gated): ~5-8K tokens
- **Total**: ~13-23K tokens per complete test run

**Estimated Savings**: ~85-88% reduction in test output tokens

## Recommendations

### Phase 1: Configuration-Only Changes (Immediate, Zero Code Changes)

1. **Vitest Configuration** - Update both config files:
   ```typescript
   // vitest.config.ts and vitest.integration.config.ts
   test: {
     reporters: ['dot'],
     silent: 'passed-only',  // Available in Vitest 2025
     coverage: {
       reporter: ['json-summary', 'html'],  // Remove 'text'
       // ... existing config
     }
   }
   ```

2. **Makefile Go Tests** - Remove `-v` flag:
   ```makefile
   test-server:
       @echo "Running server tests..."
       cd stick-rumble-server && go test ./...
   ```

3. **Package.json scripts** - Add reporter flags:
   ```json
   "test": "vitest --run --reporter=dot --silent=passed-only",
   "test:integration": "vitest --run --reporter=dot --silent=passed-only --config vitest.integration.config.ts"
   ```

**Estimated impact**: 80-85% reduction in test output verbosity

### Phase 2: Code-Level Optimizations (Optional, for Fine-Tuning)

1. **Integration Helper Logging** - Add environment-based gating:
   - File: `WebSocketClient.integration.helpers.ts`
   - Replace console.log with conditional logging function
   - Enable via `VITEST_VERBOSE_INTEGRATION=true` when debugging

2. **WebSocket Client** - Consider gating reconnection logs:
   - File: `WebSocketClient.ts:138`
   - Only log reconnection attempts in debug mode
   - Keep error/connection logs (useful for production debugging)

**Estimated additional impact**: 2-5% further reduction

### Phase 3: Advanced Options (Future Consideration)

1. **Go JSON output** - For structured test results:
   ```makefile
   test-server-json:
       cd stick-rumble-server && go test -json ./... | jq -r 'select(.Action=="fail" or .Action=="pass")'
   ```

2. **Custom Vitest reporter** - If dot reporter too minimal:
   - Create reporter that shows test file names but not individual tests
   - Show timing/coverage summary only

## Open Questions

1. **Do agents need test names during passing runs?**
   - If yes, consider custom reporter between dot and default
   - If no, dot reporter is optimal

2. **Should integration helper logs be removed entirely?**
   - Current recommendation: Gate behind env var for debugging
   - Alternative: Remove completely, rely on test assertions

3. **Is JSON output preferred for Go tests?**
   - Structured format may be easier for agents to parse
   - But adds parsing complexity vs simple text output

## Sources

**Vitest Documentation & Community:**
- [Vitest Reporters Guide](https://vitest.dev/guide/reporters)
- [Vitest Silent Config](https://vitest.dev/config/silent)
- [Vitest CLI Guide](https://vitest.dev/guide/cli)
- [How to hide console.log from successful tests](https://github.com/vitest-dev/vitest/discussions/6002)
- [Silent mode discussion](https://github.com/vitest-dev/vitest/discussions/4155)
- [Filter stdout/stderr messages issue](https://github.com/vitest-dev/vitest/issues/1700)

**Go Testing Resources:**
- [Go test output behavior documentation](https://github.com/golang/go/issues/21461)
- [Go test -v streaming output by Dave Cheney](https://dave.cheney.net/2020/03/10/go-test-v-streaming-output)
- [Go 1.24 JSON output feature](https://www.bytesizego.com/blog/go-124-json-output)
- [test2json command documentation](https://pkg.go.dev/cmd/test2json)
- [Testing in Go: Intermediate Tips and Techniques](https://betterstack.com/community/guides/testing/intemediate-go-testing/)

## Implementation Priority

**HIGH PRIORITY** (Phase 1 - Configuration changes):
- Immediate 80-85% verbosity reduction
- Zero code changes required
- No risk of breaking tests
- Reversible via config flags

**MEDIUM PRIORITY** (Phase 2 - Helper logging):
- Additional 2-5% reduction
- Minimal code changes
- Improves long-term maintainability

**LOW PRIORITY** (Phase 3 - Advanced options):
- Marginal gains
- Adds complexity
- Consider only if Phase 1-2 insufficient
