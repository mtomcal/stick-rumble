# Gemini Service

> **Spec Version**: 1.0.0
> **Last Updated**: 2026-02-16
> **Depends On**: [types-and-events.md](types-and-events.md), [config.md](config.md), [ui.md](ui.md)
> **Depended By**: [ui.md](ui.md), [overview.md](overview.md)

---

## Overview

`services/geminiService.ts` is a thin wrapper around the `@google/genai` SDK that calls Google's Gemini 2.5 Flash model to generate procedural bot trash-talk messages. It exports two async functions: `generateBotTaunt` (used in production) and `generateAnnouncerText` (exported but never called anywhere in the codebase).

The service runs entirely client-side. The API key is injected at build time via Vite's `define` config (see [config.md > Environment Variables](config.md#environment-variables)). If the key is missing or the API call fails, hardcoded fallback strings are returned — the game never crashes due to Gemini unavailability.

---

## Dependencies

### Technology Dependencies

| Technology | Version | Purpose |
|------------|---------|---------|
| @google/genai | ^1.30.0 | Google Generative AI SDK for Gemini API calls |

The SDK is loaded via CDN import map in `index.html`:

```
"@google/genai": "https://aistudiocdn.com/@google/genai@^1.30.0"
```

### Spec Dependencies

- [config.md](config.md) — Vite `define` config injects `process.env.API_KEY` and `process.env.GEMINI_API_KEY` at build time
- [types-and-events.md](types-and-events.md) — `EVENTS.BOT_KILLED` event triggers taunt generation
- [ui.md](ui.md) — `App.tsx` imports and calls `generateBotTaunt` in the `BOT_KILLED` handler

---

## Constants

| Constant | Value | Description |
|----------|-------|-------------|
| Model ID | `'gemini-2.5-flash'` | Gemini model used for all generation |
| Max output tokens (taunts) | `30` | Token limit for `generateBotTaunt` |
| Temperature (taunts) | `1.2` | High creativity for varied trash-talk |
| Temperature (announcer) | `1.0` | Slightly lower creativity for wave text |
| Taunt max words | `10` | Enforced via system instruction |
| Announcer max words | `5` | Enforced via prompt text |
| Taunt fallback | `"Are you cheating?"` | Returned on API error in `generateBotTaunt` |
| Taunt empty fallback | `"gg lag"` | Returned when `response.text` is falsy |
| Announcer fallback | `` `Wave ${wave}` `` | Returned on API error in `generateAnnouncerText` |
| Announcer empty fallback | `` `Wave ${wave} Start!` `` | Returned when `response.text` is falsy |

---

## Data Structures

### Client Initialization

```typescript
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const modelId = 'gemini-2.5-flash';
```

`process.env.API_KEY` is replaced at build time by Vite with the value of the `GEMINI_API_KEY` environment variable (see [config.md](config.md)). If not set, it resolves to `undefined`, and all API calls will fail — triggering the fallback strings.

### System Instruction (Taunts)

The system instruction is a module-level constant applied to every `generateBotTaunt` call:

```typescript
const SYSTEM_INSTRUCTION = `
You are playing a competitive online stick-figure shooter game called "Stick Rumble".
You are a bot.
You need to generate very short, trash-talking chat messages.
Keep it PG-13 but snarky, salty, and competitive.
Use internet gaming slang (n00b, rekt, lag, gg, ez).
Maximum length: 10 words.
`;
```

Key constraints enforced by the prompt:
- **PG-13 content** — no profanity or slurs
- **Gaming slang** — n00b, rekt, lag, gg, ez
- **10 word maximum** — keeps chat messages brief
- **Competitive tone** — snarky, salty

---

## Behavior

### generateBotTaunt

**Signature**: `async (context: string) => Promise<string>`

**Source**: `services/geminiService.ts:17-34`

Generates a short trash-talk message from a killed bot's perspective.

**Calling Convention** (from `App.tsx:46-52`):

```typescript
EventBus.on(EVENTS.BOT_KILLED, async (data: { name: string }) => {
    // 30% chance to trigger a taunt to avoid API spam
    if (Math.random() > 0.7) {
        const taunt = await generateBotTaunt(
            `I am ${data.name}. I just got killed by the player.`
        );
        addChatMessage(data.name, taunt);
    }
});
```

**Flow**:

1. `MainScene.ts:882` emits `EVENTS.BOT_KILLED` with `{ name: enemy.nameText.text }` when an enemy is killed by the player
2. `App.tsx` listener fires with 30% probability (`Math.random() > 0.7`)
3. A context string is constructed: `"I am {botName}. I just got killed by the player."`
4. `generateBotTaunt` sends the context to Gemini with the system instruction
5. The response text is added as a chat message from the bot's name

**API Call Configuration**:

```typescript
const response = await ai.models.generateContent({
    model: modelId,             // 'gemini-2.5-flash'
    contents: `Context: ${context}. Generate a chat message.`,
    config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: 30,    // ~10 words
        temperature: 1.2,       // High creativity
    },
});
```

**Return Value**:
- On success: `response.text` (the generated taunt)
- If `response.text` is falsy: `"gg lag"` (fallback)
- On any exception: `"Are you cheating?"` (fallback)

### generateAnnouncerText

**Signature**: `async (wave: number) => Promise<string>`

**Source**: `services/geminiService.ts:36-49`

Generates a short hype announcement for a new wave. **This function is exported but never called anywhere in the codebase.** It is imported in `App.tsx:8` but no code ever invokes it. This is dead code.

> **Note**: The `stats.wave` field is initialized to `1` but never incremented (see [types-and-events.md](types-and-events.md) Discovery #5). Even if `generateAnnouncerText` were called, it would always receive `wave = 1`.

**API Call Configuration**:

```typescript
const response = await ai.models.generateContent({
    model: modelId,
    contents: `Wave ${wave} is starting in a survival arena game. Generate a short, hype announcement message. Max 5 words.`,
    config: {
        temperature: 1.0,
    },
});
```

No `systemInstruction` is provided. No `maxOutputTokens` limit is set (uses SDK default).

**Return Value**:
- On success: `response.text`
- If `response.text` is falsy: `` `Wave ${wave} Start!` ``
- On any exception: `` `Wave ${wave}` ``

---

## Error Handling

### API Key Missing

**Trigger**: `GEMINI_API_KEY` environment variable not set at build time.
**Detection**: `process.env.API_KEY` resolves to `undefined`; the `GoogleGenAI` constructor receives `{ apiKey: undefined }`.
**Response**: Every `generateContent` call will throw an error (invalid API key). The `try/catch` in each function returns the hardcoded fallback string.
**User Impact**: No crash. Bot taunts always show the fallback text. No error visible in the game UI.

### API Call Failure (Network / Rate Limit / Server Error)

**Trigger**: Gemini API returns a non-200 response or the network request fails.
**Detection**: The `await` in `generateContent` throws an exception.
**Response**: Caught by the `try/catch` block. `generateBotTaunt` returns `"Are you cheating?"`. `generateAnnouncerText` returns `` `Wave ${wave}` ``.
**Logging**: `generateBotTaunt` logs to `console.error("Gemini API Error:", error)`. `generateAnnouncerText` silently swallows the error (no logging).

### Empty Response

**Trigger**: Gemini returns a response object where `response.text` is `undefined`, `null`, or empty string.
**Detection**: The `||` fallback operator in the return statement.
**Response**: `generateBotTaunt` returns `"gg lag"`. `generateAnnouncerText` returns `` `Wave ${wave} Start!` ``.

### Unhandled Rejection in App.tsx

The `BOT_KILLED` event handler in `App.tsx:46` uses `async` but has no `try/catch` around the `await generateBotTaunt(...)` call. However, since `generateBotTaunt` itself has an internal `try/catch` that always returns a string, the `await` will never reject. The outer handler is safe despite the missing error handling.

If the `addChatMessage` call after the `await` were to throw (which it cannot, since it's a simple `setState` call), that would be an unhandled promise rejection logged by the browser.

---

## Integration Points

### Event Flow Diagram

```
MainScene.ts                    App.tsx                      geminiService.ts
─────────────                   ───────                      ────────────────
Enemy killed by player
  │
  ├── stats.kills++
  ├── stats.score += 100
  ├── emit BOT_KILLED
  │     { name: enemy.nameText.text }
  │          │
  │          ▼
  │     on BOT_KILLED
  │       30% chance gate ──────── (70% → no-op)
  │          │
  │          ▼
  │     generateBotTaunt(context) ──► Gemini API
  │          │                            │
  │          ▼                            ▼
  │     addChatMessage(name, taunt) ◄── response.text
  │          │
  │          ▼
  │     ChatBox renders message
```

### Rate Limiting

There is no explicit rate limiting in the service itself. Rate limiting is achieved through:

1. **30% probability gate** in `App.tsx:48` — only 30% of bot kills trigger an API call
2. **Natural game pacing** — bot kills happen every few seconds at most
3. **Gemini API's own rate limits** — if exceeded, the error fallback kicks in

### Cross-References

| Topic | Spec |
|-------|------|
| `BOT_KILLED` event definition | [types-and-events.md > BOT_KILLED](types-and-events.md#bot_killed-bot-killed) |
| `BOT_KILLED` emission (enemy death) | [combat.md > Enemy Kill Flow](combat.md#enemy-kill-flow) |
| App.tsx event listener wiring | [ui.md > EventBus Listeners](ui.md#eventbus-listeners) |
| Vite `define` config for API key | [config.md > Environment Variables](config.md#environment-variables) |
| ChatMessage type | [types-and-events.md > ChatMessage](types-and-events.md#chatmessage) |
| ChatBox component display | [ui.md > ChatBox](ui.md#chatbox) |

---

## Implementation Notes

### TypeScript (Client)

- The module uses top-level `const` initialization for the `GoogleGenAI` client and system instruction — these are evaluated once at module load time
- Both functions are `export const` arrow functions, not class methods
- The `@google/genai` SDK is loaded via CDN import map, not from `node_modules`
- `response.text` is accessed as a property (not a method) on the SDK response object
- Temperature `1.2` exceeds the typical 0-1 range; the Gemini API accepts values up to 2.0 for increased randomness
- No Go / server-side implementation exists — this is a client-only service in the pre-BMM prototype

### Dead Code

- `generateAnnouncerText` is exported and imported in `App.tsx` but never called
- The `wave` parameter it accepts maps to `stats.wave`, which is hardcoded to `1` and never incremented

---

## Test Scenarios

### TS-GEMINI-001: Successful Taunt Generation

**Category**: Integration
**Priority**: Medium

**Preconditions:**
- Valid Gemini API key configured

**Input:**
- Context string: `"I am Noob. I just got killed by the player."`

**Expected Output:**
- A string of 1-10 words with gaming slang (e.g., "get rekt n00b gg ez")

### TS-GEMINI-002: Taunt Fallback on API Error

**Category**: Unit
**Priority**: High

**Preconditions:**
- API key is missing or invalid

**Input:**
- Any context string

**Expected Output:**
- Returns `"Are you cheating?"` (the error fallback)
- `console.error` is called with `"Gemini API Error:"` and the error

### TS-GEMINI-003: Taunt Fallback on Empty Response

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- API call succeeds but `response.text` is falsy

**Input:**
- Any context string

**Expected Output:**
- Returns `"gg lag"`

### TS-GEMINI-004: 30% Trigger Rate

**Category**: Unit
**Priority**: Medium

**Preconditions:**
- `BOT_KILLED` event emitted

**Input:**
- Multiple `BOT_KILLED` events

**Expected Output:**
- `generateBotTaunt` is called approximately 30% of the time (when `Math.random() > 0.7`)

### TS-GEMINI-005: Announcer Text Generation (Dead Code)

**Category**: Unit
**Priority**: Low

**Preconditions:**
- Valid Gemini API key

**Input:**
- `wave = 1`

**Expected Output:**
- A string of 1-5 words (hype announcement)
- Note: This function is never called in the actual codebase

### TS-GEMINI-006: Announcer Fallback on API Error

**Category**: Unit
**Priority**: Low

**Preconditions:**
- API key missing or invalid

**Input:**
- `wave = 3`

**Expected Output:**
- Returns `"Wave 3"` (silent failure, no console.error)

### TS-GEMINI-007: Announcer Fallback on Empty Response

**Category**: Unit
**Priority**: Low

**Preconditions:**
- API call succeeds but `response.text` is falsy

**Input:**
- `wave = 2`

**Expected Output:**
- Returns `"Wave 2 Start!"`

### TS-GEMINI-008: Chat Message Added After Successful Taunt

**Category**: Integration
**Priority**: Medium

**Preconditions:**
- `BOT_KILLED` fires, 30% gate passes, API returns text

**Input:**
- `BOT_KILLED` event with `{ name: "SniperBot" }`

**Expected Output:**
- `addChatMessage("SniperBot", <taunt text>)` is called
- Chat message appears in `ChatBox` component

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-16 | Initial specification |
