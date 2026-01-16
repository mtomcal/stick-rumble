import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for Player Sprites
 * Tests player spawn, removal, and scene lifecycle to catch rendering bugs
 * Specifically designed to catch the AT3 sprite duplication bug
 */

test.describe('Player Sprites Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to entity test page
    await page.goto('/ui-test-entities.html');

    // Wait for Phaser to initialize
    await page.waitForSelector('[data-testid="entity-test-ready"][data-ready="true"]', {
      timeout: 10000,
      state: 'attached',
    });

    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    // CRITICAL FIX for AT3: Clear any residual graphics from other tests
    // The projectile-visuals tests create target circles that persist across test files
    await page.evaluate(() => {
      (window as any).clearAllSprites();
    });

    // Wait for cleanup to complete
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });
  });

  test('should render single player sprite correctly', async ({ page }) => {
    // Spawn a single player
    await page.evaluate(() => {
      (window as any).spawnPlayer('p1', 400, 300, 'green');
    });

    // Wait for render
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify sprite count
    const spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(1);

    // Take screenshot
    await expect(page).toHaveScreenshot('player-single.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });
  });

  test('should render multiple players without overlap', async ({ page }) => {
    // Spawn multiple players at different positions
    await page.evaluate(() => {
      (window as any).spawnPlayer('p1', 200, 300, 'green');
      (window as any).spawnPlayer('p2', 400, 300, 'red');
      (window as any).spawnPlayer('p3', 600, 300, 'red');
    });

    // Wait for render
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify sprite count
    const spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(3);

    // Take screenshot
    await expect(page).toHaveScreenshot('player-multiple.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });
  });

  test('should clean up sprite completely when player is removed', async ({ page }) => {
    // Spawn a player
    await page.evaluate(() => {
      (window as any).spawnPlayer('p1', 400, 300, 'green');
    });

    // Wait for render
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify initial sprite count
    let spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(1);

    // Remove player
    await page.evaluate(() => {
      (window as any).removePlayer('p1');
    });

    // Wait for render
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 4;
    });

    // Verify sprite is gone
    spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(0);

    // Take screenshot - should show empty scene
    await expect(page).toHaveScreenshot('player-removed.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });
  });

  test('CRITICAL: should not duplicate sprites after scene restart (AT3 bug)', async ({ page }) => {
    // Spawn a player
    await page.evaluate(() => {
      (window as any).spawnPlayer('p1', 400, 300, 'green');
    });

    // Wait for render
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify initial sprite count
    let spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(1);

    // Restart scene (this is where AT3 bug causes duplication)
    await page.evaluate(() => {
      (window as any).restartScene();
    });

    // Wait for scene restart
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Spawn same player again
    await page.evaluate(() => {
      (window as any).spawnPlayer('p1', 400, 300, 'green');
    });

    // Wait for render
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 4;
    });

    // Should still be 1, not 2 (AT3 bug would show 2)
    spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(1);

    // Get player count
    const playerCount = await page.evaluate(() => {
      return (window as any).getPlayerCount();
    });
    expect(playerCount).toBe(1);

    // Visual confirmation - screenshot should show 1 player, not 2
    await expect(page).toHaveScreenshot('player-after-restart.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });
  });

  test('should handle spawn/remove cycles without accumulating sprites', async ({ page }) => {
    // First cycle: spawn and remove
    await page.evaluate(() => {
      (window as any).spawnPlayer('p1', 400, 300, 'green');
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    await page.evaluate(() => {
      (window as any).removePlayer('p1');
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 4;
    });

    // Second cycle: spawn different player
    await page.evaluate(() => {
      (window as any).spawnPlayer('p2', 400, 300, 'red');
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 6;
    });

    // Verify only 1 sprite exists
    const spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(1);

    // Take screenshot
    await expect(page).toHaveScreenshot('player-spawn-remove-cycle.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });
  });
});
