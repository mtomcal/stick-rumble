import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for Kill Feed UI
 * Tests kill feed display states for pixel-perfect rendering
 */

test.describe('Kill Feed Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test page
    await page.goto('/ui-test.html');

    // Wait for Phaser to initialize (check for data-ready attribute, not visibility)
    await page.waitForSelector('[data-testid="kill-feed-ready"][data-ready="true"]', {
      timeout: 10000,
      state: 'attached', // Wait for element to exist in DOM, not be visible
    });
  });

  test('should render empty kill feed', async ({ page }) => {
    // Kill feed starts empty, wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    // Screenshot top-right area where kill feed is rendered (x: 500, y: 0, 300x150)
    await expect(page).toHaveScreenshot('kill-feed-empty.png', {
      clip: { x: 500, y: 0, width: 300, height: 150 }
    });
  });

  test('should render kill feed with single kill', async ({ page }) => {
    // Add one kill
    await page.evaluate(() => {
      (window as any).addKillFeedEntry('Player1', 'Player2');
    });

    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    await expect(page).toHaveScreenshot('kill-feed-single.png', {
      clip: { x: 500, y: 0, width: 300, height: 150 }
    });
  });

  test('should render kill feed with multiple kills', async ({ page }) => {
    // Add multiple kills
    await page.evaluate(() => {
      (window as any).addKillFeedEntry('Player1', 'Player2');
      (window as any).addKillFeedEntry('Player3', 'Player1');
      (window as any).addKillFeedEntry('Player2', 'Player3');
    });

    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    await expect(page).toHaveScreenshot('kill-feed-multiple.png', {
      clip: { x: 500, y: 0, width: 300, height: 150 }
    });
  });

  test('should render kill feed at max capacity (5 kills)', async ({ page }) => {
    // Add max kills
    await page.evaluate(() => {
      (window as any).addKillFeedEntry('Player1', 'Player2');
      (window as any).addKillFeedEntry('Player2', 'Player3');
      (window as any).addKillFeedEntry('Player3', 'Player4');
      (window as any).addKillFeedEntry('Player4', 'Player5');
      (window as any).addKillFeedEntry('Player5', 'Player1');
    });

    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    await expect(page).toHaveScreenshot('kill-feed-max.png', {
      clip: { x: 500, y: 0, width: 300, height: 150 }
    });
  });
});
