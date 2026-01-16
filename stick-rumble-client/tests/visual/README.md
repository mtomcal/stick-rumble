# Visual Regression Testing

This directory contains visual regression tests for UI components using Playwright.

## Overview

Visual regression tests capture screenshots of UI components and compare them against baseline images to detect unintended visual changes. These tests complement unit tests by verifying pixel-perfect rendering.

## Prerequisites

### System Dependencies

**⚠️ IMPORTANT**: Visual tests require system libraries that must be installed with sudo access.

```bash
npx playwright install-deps chromium
```

**Status**: System dependencies are NOT currently installed. Baseline screenshots cannot be generated until dependencies are installed.

For detailed installation instructions, troubleshooting, and alternatives (Docker, CI setup), see:
📄 **[SYSTEM_DEPENDENCIES.md](./SYSTEM_DEPENDENCIES.md)**

### Project Dependencies

All npm dependencies are already installed via `npm install`.

## Running Tests

### Generate Baseline Screenshots (First Time)

```bash
npm run test:visual:update
```

This creates baseline screenshots in `tests/screenshots/`.

### Run Visual Regression Tests

```bash
npm run test:visual
```

This compares current screenshots against baselines and fails if differences exceed 1% pixel threshold.

### Updating Baselines

When intentional UI changes are made, update baselines with:

```bash
npm run test:visual:update
```

## Test Coverage

### Health Bar UI (`health-bar.spec.ts`)

- **100% health**: Green bar, full width
- **50% health**: Yellow bar, half width
- **10% health**: Red bar, narrow width
- **0% health**: No bar visible, just background
- **Regeneration state**: Visual feedback for health regeneration

### Kill Feed UI (`kill-feed.spec.ts`)

- **Empty state**: No kill entries
- **Single kill**: One kill entry displayed
- **Multiple kills**: 2-3 kill entries stacked
- **Max capacity**: 5 kill entries (maximum)

### Melee Weapon (`melee-weapon.spec.ts`)

- **Bat stats validation**: Verifies lowercase 'bat' creates weapon with correct range (64) and arc (90 degrees)
- **Katana stats validation**: Verifies lowercase 'katana' creates weapon with correct range (80) and arc (90 degrees)
- **Bat swing animation**: Visual snapshot of bat swing (brown color)
- **Katana swing animation**: Visual snapshot of katana swing (silver color)
- **Idle state**: Both weapons visible but not swinging
- **Both weapons swinging**: Visual distinction between bat and katana colors
- **Swing completion**: Verifies swing animation completes after 200ms

These tests specifically guard against the case-sensitivity bug where server sends lowercase weapon types ('katana', 'bat') but client code may check for capitalized names ('Katana', 'Bat').

## Test Architecture

### Test Page

`/ui-test.html` - Dedicated test page that renders UI components in isolation without game logic.

### Component Control

Tests use global functions exposed by the test scene:

```javascript
window.setHealthBarState(currentHealth, maxHealth, isRegenerating);
window.addKillFeedEntry(killerName, victimName);
```

### Screenshot Configuration

- **Threshold**: 1% pixel difference tolerance
- **Format**: PNG images
- **Location**: `tests/screenshots/` (gitignored)
- **Naming**: `{test-file-path}/{test-name}.png`

## CI Integration

Visual tests run in CI after unit tests pass. If visual differences are detected:

1. Tests fail with diff percentage
2. Diff images are uploaded as artifacts
3. Review diff images to determine if change is intentional
4. If intentional, update baselines and commit

## Troubleshooting

### Missing libatk-1.0.so.0 Error

This means Playwright system dependencies are not installed. Run:

```bash
npx playwright install-deps chromium
```

### Dev Server Not Starting

Ensure Vite dev server can start:

```bash
npm run dev
```

Then run visual tests in a separate terminal.

### Screenshot Differences in CI

Rendering can vary slightly between environments. If tests pass locally but fail in CI:

1. Review diff images in CI artifacts
2. If differences are minor, adjust threshold in `playwright.config.ts`
3. If differences are significant, investigate environment-specific rendering issues

## Best Practices

1. **Keep tests focused**: Test one UI state per test case
2. **Disable animations**: Tests capture static states, not animations
3. **Use consistent viewport**: All tests use same browser viewport size
4. **Commit baselines**: After verifying they are correct, commit baseline images
5. **Review diffs carefully**: Visual changes might indicate bugs or unintended side effects
