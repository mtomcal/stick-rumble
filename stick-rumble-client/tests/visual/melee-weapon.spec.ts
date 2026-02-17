import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for Melee Weapon swing animations
 * Tests Bat and Katana swing rendering to catch case-sensitivity and rendering bugs
 */

test.describe('Melee Weapon Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to test page
    await page.goto('/ui-test.html');

    // Wait for Phaser to initialize (check for data-ready attribute)
    await page.waitForSelector('[data-testid="melee-weapon-ready"][data-ready="true"]', {
      timeout: 10000,
      state: 'attached',
    });
  });

  test('should render bat weapon with correct stats (lowercase type)', async ({ page }) => {
    // Verify bat weapon was created with correct stats (tests case-insensitive creation)
    const batState = await page.evaluate(() => {
      return (window as any).getMeleeWeaponState('bat');
    });

    expect(batState.range).toBe(90); // Bat range
    expect(batState.arcDegrees).toBe(80); // 80 degree arc
    expect(batState.isSwinging).toBe(false);
  });

  test('should render katana weapon with correct stats (lowercase type)', async ({ page }) => {
    // Verify katana weapon was created with correct stats (tests case-insensitive creation)
    const katanaState = await page.evaluate(() => {
      return (window as any).getMeleeWeaponState('katana');
    });

    expect(katanaState.range).toBe(110); // Katana range (longer than bat)
    expect(katanaState.arcDegrees).toBe(80); // 80 degree arc
    expect(katanaState.isSwinging).toBe(false);
  });

  test('should render bat swing animation', async ({ page }) => {
    // Trigger bat swing at 0 radians (pointing right)
    await page.evaluate(() => {
      (window as any).triggerMeleeSwing('bat', 0);
    });

    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    // Verify swing started
    const batState = await page.evaluate(() => {
      return (window as any).getMeleeWeaponState('bat');
    });
    expect(batState.isSwinging).toBe(true);

    // Take screenshot of bat swing (left side of canvas)
    await expect(page).toHaveScreenshot('melee-bat-swing.png', {
      clip: { x: 100, y: 350, width: 200, height: 200 }
    });
  });

  test('should render katana swing animation', async ({ page }) => {
    // Trigger katana swing at PI/2 radians (pointing up)
    await page.evaluate(() => {
      (window as any).triggerMeleeSwing('katana', Math.PI / 2);
    });

    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    // Verify swing started
    const katanaState = await page.evaluate(() => {
      return (window as any).getMeleeWeaponState('katana');
    });
    expect(katanaState.isSwinging).toBe(true);

    // Take screenshot of katana swing (right side of canvas)
    await expect(page).toHaveScreenshot('melee-katana-swing.png', {
      clip: { x: 500, y: 350, width: 200, height: 200 }
    });
  });

  test('should render both weapons idle (no swing)', async ({ page }) => {
    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    // Screenshot bottom area showing both weapons idle
    await expect(page).toHaveScreenshot('melee-weapons-idle.png', {
      clip: { x: 0, y: 350, width: 800, height: 250 }
    });
  });

  test('bat and katana should have visually distinct colors', async ({ page }) => {
    // Trigger both swings
    await page.evaluate(() => {
      (window as any).triggerMeleeSwing('bat', 0);
      (window as any).triggerMeleeSwing('katana', 0);
    });

    // Wait for Phaser to complete a render cycle
    await page.waitForFunction(() => {
      const game = (window as any).game;
      return game && game.loop && game.loop.frame > 0;
    });

    // Screenshot both weapons swinging - should show brown bat vs silver katana
    await expect(page).toHaveScreenshot('melee-weapons-both-swinging.png', {
      clip: { x: 0, y: 350, width: 800, height: 250 }
    });
  });

  test('swing animation should complete after 200ms', async ({ page }) => {
    // Trigger bat swing
    await page.evaluate(() => {
      (window as any).triggerMeleeSwing('bat', 0);
    });

    // Verify swing started
    let batState = await page.evaluate(() => {
      return (window as any).getMeleeWeaponState('bat');
    });
    expect(batState.isSwinging).toBe(true);

    // Wait for swing to complete (200ms + buffer)
    await page.waitForTimeout(300);

    // Verify swing completed
    batState = await page.evaluate(() => {
      return (window as any).getMeleeWeaponState('bat');
    });
    expect(batState.isSwinging).toBe(false);
  });
});
