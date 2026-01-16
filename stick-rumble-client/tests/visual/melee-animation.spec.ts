import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for Melee Animation
 * Tests melee weapon swing animations to catch rendering bugs
 * Specifically designed to catch the o5y melee animation bug
 */

test.describe('Melee Animation Visual Regression', () => {
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

  test('should render Bat swing with brown arc', async ({ page }) => {
    // Pause game loop for deterministic frame control
    await page.evaluate(() => {
      (window as any).pauseGameLoop();
      (window as any).triggerMeleeSwing('Bat', 0);
      // Advance exactly 3 frames into animation
      (window as any).stepFrame(3);
    });

    // Take screenshot during animation
    await expect(page).toHaveScreenshot('melee-bat-swing.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });

    // Resume game loop for cleanup
    await page.evaluate(() => {
      (window as any).resumeGameLoop();
    });
  });

  test('should render Katana swing with silver arc', async ({ page }) => {
    // Pause game loop for deterministic frame control
    await page.evaluate(() => {
      (window as any).pauseGameLoop();
      (window as any).triggerMeleeSwing('Katana', 0);
      // Advance exactly 3 frames into animation
      (window as any).stepFrame(3);
    });

    // Take screenshot during animation
    await expect(page).toHaveScreenshot('melee-katana-swing.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });

    // Resume game loop for cleanup
    await page.evaluate(() => {
      (window as any).resumeGameLoop();
    });
  });

  test('should render Bat swing at different angles', async ({ page }) => {
    // Pause game loop for deterministic frame control
    await page.evaluate(() => {
      (window as any).pauseGameLoop();
      (window as any).triggerMeleeSwing('Bat', Math.PI / 4);
      // Advance exactly 3 frames into animation
      (window as any).stepFrame(3);
    });

    // Take screenshot during animation
    await expect(page).toHaveScreenshot('melee-bat-swing-45deg.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });

    // Resume game loop for cleanup
    await page.evaluate(() => {
      (window as any).resumeGameLoop();
    });
  });

  test('should render Katana swing at different angles', async ({ page }) => {
    // Pause game loop for deterministic frame control
    await page.evaluate(() => {
      (window as any).pauseGameLoop();
      (window as any).triggerMeleeSwing('Katana', Math.PI / 2);
      // Advance exactly 3 frames into animation
      (window as any).stepFrame(3);
    });

    // Take screenshot during animation
    await expect(page).toHaveScreenshot('melee-katana-swing-90deg.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });

    // Resume game loop for cleanup
    await page.evaluate(() => {
      (window as any).resumeGameLoop();
    });
  });

  test('CRITICAL: arc should be visible during animation', async ({ page }) => {
    // Clear any existing sprites
    await page.evaluate(() => {
      (window as any).clearAllSprites();
      (window as any).pauseGameLoop();
      (window as any).stepFrame(1);
    });

    // Take screenshot of empty scene (baseline)
    await expect(page).toHaveScreenshot('melee-before-swing.png', {
      clip: { x: 300, y: 200, width: 200, height: 200 }
    });

    // Trigger swing and advance to mid-animation
    await page.evaluate(() => {
      (window as any).triggerMeleeSwing('Bat', 0);
      // Advance exactly 3 frames into animation
      (window as any).stepFrame(3);
    });

    // Take screenshot during swing - should show arc
    await expect(page).toHaveScreenshot('melee-during-swing.png', {
      clip: { x: 300, y: 200, width: 200, height: 200 }
    });

    // Resume game loop for cleanup
    await page.evaluate(() => {
      (window as any).resumeGameLoop();
    });
  });

  test('CRITICAL: arc should NOT be visible after animation completes', async ({ page }) => {
    // Trigger swing
    await page.evaluate(() => {
      (window as any).triggerMeleeSwing('Bat', 0);
    });

    // Wait for animation to complete (200ms duration + buffer)
    await page.waitForTimeout(300);

    // Wait for render
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game.loop.frame > 10;
    });

    // Take screenshot after animation - should show no arc
    await expect(page).toHaveScreenshot('melee-after-swing.png', {
      clip: { x: 300, y: 200, width: 200, height: 200 }
    });
  });

  test('should handle multiple sequential swings', async ({ page }) => {
    // First swing with frame-stepping
    await page.evaluate(() => {
      (window as any).pauseGameLoop();
      (window as any).triggerMeleeSwing('Bat', 0);
      // Complete first animation (200ms at 60fps = ~12 frames)
      (window as any).stepFrame(15);
    });

    // Second swing with different weapon
    await page.evaluate(() => {
      (window as any).triggerMeleeSwing('Katana', Math.PI);
      // Advance to mid-animation of second swing
      (window as any).stepFrame(3);
    });

    // Take screenshot - should show Katana arc, not Bat
    await expect(page).toHaveScreenshot('melee-sequential-swings.png', {
      clip: { x: 0, y: 0, width: 800, height: 600 }
    });

    // Resume game loop for cleanup
    await page.evaluate(() => {
      (window as any).resumeGameLoop();
    });
  });

  test('should render Bat and Katana with different colors', async ({ page }) => {
    // Take screenshot of Bat (brown - 0x8B4513)
    await page.evaluate(() => {
      (window as any).clearAllSprites();
      (window as any).pauseGameLoop();
      (window as any).triggerMeleeSwing('Bat', 0);
      // Advance exactly 3 frames into animation
      (window as any).stepFrame(3);
    });

    await expect(page).toHaveScreenshot('melee-bat-color.png', {
      clip: { x: 350, y: 250, width: 100, height: 100 }
    });

    // Complete first animation and start second
    await page.evaluate(() => {
      (window as any).clearAllSprites();
      (window as any).triggerMeleeSwing('Katana', 0);
      // Advance exactly 3 frames into animation
      (window as any).stepFrame(3);
    });

    await expect(page).toHaveScreenshot('melee-katana-color.png', {
      clip: { x: 350, y: 250, width: 100, height: 100 }
    });

    // Resume game loop for cleanup
    await page.evaluate(() => {
      (window as any).resumeGameLoop();
    });
  });
});
