import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for Health Bar UI
 * Tests various health states for pixel-perfect rendering
 */

test.describe('Health Bar Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test page
    await page.goto('/ui-test.html');

    // Wait for Phaser to initialize
    await page.waitForSelector('[data-testid="health-bar-ready"]', { timeout: 10000 });
  });

  test('should render health bar at 100% health', async ({ page }) => {
    // Set health to 100%
    await page.evaluate(() => {
      (window as any).setHealthBarState(100, 100, false);
    });

    // Wait for rendering
    await page.waitForTimeout(100);

    // Take screenshot and compare
    await expect(page.locator('[data-testid="health-bar"]')).toHaveScreenshot('health-bar-100.png');
  });

  test('should render health bar at 50% health', async ({ page }) => {
    // Set health to 50%
    await page.evaluate(() => {
      (window as any).setHealthBarState(50, 100, false);
    });

    await page.waitForTimeout(100);

    await expect(page.locator('[data-testid="health-bar"]')).toHaveScreenshot('health-bar-50.png');
  });

  test('should render health bar at 10% health', async ({ page }) => {
    // Set health to 10%
    await page.evaluate(() => {
      (window as any).setHealthBarState(10, 100, false);
    });

    await page.waitForTimeout(100);

    await expect(page.locator('[data-testid="health-bar"]')).toHaveScreenshot('health-bar-10.png');
  });

  test('should render health bar at 0% health', async ({ page }) => {
    // Set health to 0%
    await page.evaluate(() => {
      (window as any).setHealthBarState(0, 100, false);
    });

    await page.waitForTimeout(100);

    await expect(page.locator('[data-testid="health-bar"]')).toHaveScreenshot('health-bar-0.png');
  });

  test('should render health bar with regeneration effect disabled', async ({ page }) => {
    // Set health with regeneration (but capture static state without animation)
    await page.evaluate(() => {
      (window as any).setHealthBarState(75, 100, true);
    });

    await page.waitForTimeout(100);

    await expect(page.locator('[data-testid="health-bar"]')).toHaveScreenshot('health-bar-regenerating.png');
  });
});
