import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for Health Bar UI
 * Tests various health states for pixel-perfect rendering
 */

test.describe('Health Bar Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test page
    await page.goto('/ui-test.html');

    // Wait for Phaser to initialize (check for data-ready attribute, not visibility)
    await page.waitForSelector('[data-testid="health-bar-ready"][data-ready="true"]', {
      timeout: 10000,
      state: 'attached', // Wait for element to exist in DOM, not be visible
    });
  });

  test('should render health bar at 100% health', async ({ page }) => {
    // Set health to 100%
    await page.evaluate(() => {
      (window as any).setHealthBarState(100, 100, false);
    });

    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    // Take screenshot of the canvas area where health bar is rendered
    await expect(page).toHaveScreenshot('health-bar-100.png', {
      clip: { x: 0, y: 0, width: 250, height: 70 }
    });
  });

  test('should render health bar at 50% health', async ({ page }) => {
    // Set health to 50%
    await page.evaluate(() => {
      (window as any).setHealthBarState(50, 100, false);
    });

    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    await expect(page).toHaveScreenshot('health-bar-50.png', {
      clip: { x: 0, y: 0, width: 250, height: 70 }
    });
  });

  test('should render health bar at 10% health', async ({ page }) => {
    // Set health to 10%
    await page.evaluate(() => {
      (window as any).setHealthBarState(10, 100, false);
    });

    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    await expect(page).toHaveScreenshot('health-bar-10.png', {
      clip: { x: 0, y: 0, width: 250, height: 70 }
    });
  });

  test('should render health bar at 0% health', async ({ page }) => {
    // Set health to 0%
    await page.evaluate(() => {
      (window as any).setHealthBarState(0, 100, false);
    });

    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    await expect(page).toHaveScreenshot('health-bar-0.png', {
      clip: { x: 0, y: 0, width: 250, height: 70 }
    });
  });

  test('should render health bar with regeneration effect', async ({ page }) => {
    // Set health with regeneration enabled
    await page.evaluate(() => {
      (window as any).setHealthBarState(75, 100, true);
    });

    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    await expect(page).toHaveScreenshot('health-bar-regenerating.png', {
      clip: { x: 0, y: 0, width: 250, height: 70 }
    });
  });
});
