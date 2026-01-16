import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for Scene Lifecycle
 * Tests scene restart and sprite cleanup to catch lifecycle bugs
 */

test.describe('Scene Lifecycle Visual Regression', () => {
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
  });

  test('should start with zero sprites in fresh scene', async ({ page }) => {
    // Verify initial sprite count
    const spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(0);

    // Verify player count
    const playerCount = await page.evaluate(() => {
      return (window as any).getPlayerCount();
    });
    expect(playerCount).toBe(0);

    // Take screenshot - should show empty dark scene
    await expect(page).toHaveScreenshot('scene-fresh-start.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });
  });

  test('should leave zero sprites after spawn/remove cycle', async ({ page }) => {
    // Spawn a player
    await page.evaluate(() => {
      (window as any).spawnPlayer('p1', 400, 300, 'green');
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify sprite exists
    let spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(1);

    // Remove player
    await page.evaluate(() => {
      (window as any).removePlayer('p1');
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 4;
    });

    // Verify zero sprites
    spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(0);

    // Take screenshot - should show empty scene
    await expect(page).toHaveScreenshot('scene-after-remove.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });
  });

  test('CRITICAL: should not accumulate zombie sprites after multiple restarts', async ({ page }) => {
    // First cycle: spawn, restart
    await page.evaluate(() => {
      (window as any).spawnPlayer('p1', 400, 300, 'green');
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    await page.evaluate(() => {
      (window as any).restartScene();
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Second cycle: spawn, restart
    await page.evaluate(() => {
      (window as any).spawnPlayer('p2', 400, 300, 'red');
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 4;
    });

    await page.evaluate(() => {
      (window as any).restartScene();
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Third cycle: spawn final player
    await page.evaluate(() => {
      (window as any).spawnPlayer('p3', 400, 300, 'green');
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 4;
    });

    // Verify only 1 sprite exists (no accumulation)
    const spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(1);

    // Verify player count
    const playerCount = await page.evaluate(() => {
      return (window as any).getPlayerCount();
    });
    expect(playerCount).toBe(1);

    // Take screenshot - should show only 1 player
    await expect(page).toHaveScreenshot('scene-multiple-restarts.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });
  });

  test('should completely clear sprites with clearAllSprites', async ({ page }) => {
    // Spawn multiple players and trigger melee
    await page.evaluate(() => {
      (window as any).spawnPlayer('p1', 200, 300, 'green');
      (window as any).spawnPlayer('p2', 400, 300, 'red');
      (window as any).spawnPlayer('p3', 600, 300, 'red');
      (window as any).triggerMeleeSwing('Bat', 0);
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify sprites exist
    let spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(3);

    // Clear all
    await page.evaluate(() => {
      (window as any).clearAllSprites();
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 4;
    });

    // Verify zero sprites
    spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(0);

    // Verify zero players
    const playerCount = await page.evaluate(() => {
      return (window as any).getPlayerCount();
    });
    expect(playerCount).toBe(0);

    // Take screenshot - should show empty scene
    await expect(page).toHaveScreenshot('scene-after-clear.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });
  });

  test('should handle restart with no sprites present', async ({ page }) => {
    // Restart without spawning anything
    await page.evaluate(() => {
      (window as any).restartScene();
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify zero sprites
    const spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(0);

    // Take screenshot
    await expect(page).toHaveScreenshot('scene-restart-empty.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });
  });

  test('should maintain clean state after restart and re-spawn', async ({ page }) => {
    // Initial spawn
    await page.evaluate(() => {
      (window as any).spawnPlayer('p1', 300, 300, 'green');
      (window as any).spawnPlayer('p2', 500, 300, 'red');
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Take screenshot before restart
    await expect(page).toHaveScreenshot('scene-before-restart.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });

    // Restart scene
    await page.evaluate(() => {
      (window as any).restartScene();
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify clean state
    let spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(0);

    // Re-spawn same players
    await page.evaluate(() => {
      (window as any).spawnPlayer('p1', 300, 300, 'green');
      (window as any).spawnPlayer('p2', 500, 300, 'red');
    });

    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 4;
    });

    // Verify correct sprite count
    spriteCount = await page.evaluate(() => {
      return (window as any).getActiveSprites().length;
    });
    expect(spriteCount).toBe(2);

    // Take screenshot after restart - should look identical to before
    await expect(page).toHaveScreenshot('scene-after-restart-respawn.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });
  });
});
