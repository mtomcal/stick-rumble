import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for Projectile Visuals (Bug wzq)
 * Tests that projectiles render with weapon-specific colors and sizes
 *
 * BUG wzq: All projectiles render yellow instead of weapon-specific colors
 * - Uzi should be orange (0xFFA500)
 * - AK47 should be gold (0xFFD700)
 * - Pistol should be yellow (0xFFFF00)
 * - Shotgun should be orange-red (0xFF4500)
 *
 * These tests verify the actual rendered colors match expected weapon configs.
 *
 * VISUAL TESTING APPROACH (Bug 83b):
 * - Projectiles are spawned with 30x scale for human visibility in snapshots
 * - 400x400px clip regions (instead of 100x100px) provide better context
 * - Target circles in background provide contrast and reference points
 * - This makes snapshots verifiable by human code reviewers
 */

test.describe('Projectile Visuals Visual Regression', () => {
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

  test('Uzi projectile should render orange (0xFFAA00), 3px diameter', async ({ page }) => {
    // Spawn an Uzi projectile in the center with 30x scale for visibility
    await page.evaluate(() => {
      (window as any).spawnProjectile('Uzi', 400, 300, 30);
    });

    // Wait for render
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify projectile count
    const projectileCount = await page.evaluate(() => {
      return (window as any).getProjectileCount();
    });
    expect(projectileCount).toBe(1);

    // Get canvas bounding box to calculate correct clip coordinates
    const canvas = page.locator('canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Take screenshot to verify orange color and 3px diameter
    // Expected: Orange circle (0xFFAA00) with 3px diameter
    // Clip centered on projectile at (400, 300) within canvas coordinates
    await expect(page).toHaveScreenshot('projectile-uzi.png', {
      clip: {
        x: canvasBox!.x + 200,
        y: canvasBox!.y + 100,
        width: 400,
        height: 400,
      },
      threshold: 0.01,
    });
  });

  test('AK47 projectile should render gold (0xFFCC00), 5px diameter', async ({ page }) => {
    // Spawn an AK47 projectile in the center with 30x scale for visibility
    await page.evaluate(() => {
      (window as any).spawnProjectile('AK47', 400, 300, 30);
    });

    // Wait for render
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify projectile count
    const projectileCount = await page.evaluate(() => {
      return (window as any).getProjectileCount();
    });
    expect(projectileCount).toBe(1);

    // Get canvas bounding box to calculate correct clip coordinates
    const canvas = page.locator('canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Take screenshot to verify gold color and 5px diameter
    // Expected: Gold circle (0xFFCC00) with 5px diameter
    // Clip centered on projectile at (400, 300) within canvas coordinates
    await expect(page).toHaveScreenshot('projectile-ak47.png', {
      clip: {
        x: canvasBox!.x + 200,
        y: canvasBox!.y + 100,
        width: 400,
        height: 400,
      },
      threshold: 0.01,
    });
  });

  test('Pistol projectile should render yellow (0xFFFF00), 4px diameter', async ({ page }) => {
    // Spawn a Pistol projectile in the center with 30x scale for visibility
    await page.evaluate(() => {
      (window as any).spawnProjectile('Pistol', 400, 300, 30);
    });

    // Wait for render
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify projectile count
    const projectileCount = await page.evaluate(() => {
      return (window as any).getProjectileCount();
    });
    expect(projectileCount).toBe(1);

    // Get canvas bounding box to calculate correct clip coordinates
    const canvas = page.locator('canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Take screenshot to verify yellow color and 4px diameter
    // Expected: Yellow circle (0xFFFF00) with 4px diameter
    // Clip centered on projectile at (400, 300) within canvas coordinates
    await expect(page).toHaveScreenshot('projectile-pistol.png', {
      clip: {
        x: canvasBox!.x + 200,
        y: canvasBox!.y + 100,
        width: 400,
        height: 400,
      },
      threshold: 0.01,
    });
  });

  test('Shotgun projectile should render orange-red (0xFF8800), 6px diameter', async ({ page }) => {
    // Spawn a Shotgun projectile in the center with 30x scale for visibility
    await page.evaluate(() => {
      (window as any).spawnProjectile('Shotgun', 400, 300, 30);
    });

    // Wait for render
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify projectile count
    const projectileCount = await page.evaluate(() => {
      return (window as any).getProjectileCount();
    });
    expect(projectileCount).toBe(1);

    // Get canvas bounding box to calculate correct clip coordinates
    const canvas = page.locator('canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Take screenshot to verify orange-red color and 6px diameter
    // Expected: Orange-red circle (0xFF8800) with 6px diameter
    // Clip centered on projectile at (400, 300) within canvas coordinates
    await expect(page).toHaveScreenshot('projectile-shotgun.png', {
      clip: {
        x: canvasBox!.x + 200,
        y: canvasBox!.y + 100,
        width: 400,
        height: 400,
      },
      threshold: 0.01,
    });
  });

  test('multiple projectiles should render with different colors', async ({ page }) => {
    // Spawn projectiles from different weapons in a row with 30x scale for visibility
    await page.evaluate(() => {
      (window as any).spawnProjectile('Uzi', 200, 300, 30);      // Orange
      (window as any).spawnProjectile('AK47', 300, 300, 30);     // Gold
      (window as any).spawnProjectile('Pistol', 400, 300, 30);   // Yellow
      (window as any).spawnProjectile('Shotgun', 500, 300, 30);  // Orange-red
    });

    // Wait for render
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 2;
    });

    // Verify projectile count
    const projectileCount = await page.evaluate(() => {
      return (window as any).getProjectileCount();
    });
    expect(projectileCount).toBe(4);

    // Get canvas bounding box to calculate correct clip coordinates
    const canvas = page.locator('canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // Take screenshot to verify all colors are different
    // CRITICAL: This test would FAIL if bug wzq exists (all would be yellow)
    // Wider clip to capture all 4 projectiles spread across x: 200, 300, 400, 500
    await expect(page).toHaveScreenshot('projectiles-multiple-colors.png', {
      clip: {
        x: canvasBox!.x + 50,
        y: canvasBox!.y + 100,
        width: 600,
        height: 400,
      },
      threshold: 0.01,
    });
  });
});
