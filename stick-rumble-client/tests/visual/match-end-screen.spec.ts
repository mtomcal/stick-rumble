import { test, expect } from '@playwright/test';

/**
 * Visual regression tests for Match End Screen
 * Tests various scenarios for pixel-perfect rendering
 */

test.describe('Match End Screen Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging for debugging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err));

    // Navigate to React test page
    await page.goto('/match-end-react-test.html');

    // Wait for React app to initialize
    await page.waitForSelector('[data-testid="match-end-react-ready"][data-ready="true"]', {
      timeout: 10000,
      state: 'attached',
    });
  });

  test('should render match end screen with single winner and correct kills', async ({ page }) => {
    // Show match end screen with single winner scenario
    await page.evaluate(() => {
      (window as any).showMatchEndScreen({
        winners: ['Player1'],
        finalScores: [
          { playerId: 'Player1', kills: 5, deaths: 2, xp: 0 },
          { playerId: 'Player2', kills: 3, deaths: 4, xp: 0 },
          { playerId: 'Player3', kills: 1, deaths: 5, xp: 0 },
        ],
        reason: 'time_limit',
      }, 'Player1');
    });

    // Wait for modal to be visible
    await page.waitForSelector('.match-end-modal', {
      state: 'visible',
      timeout: 5000,
    });

    // Take screenshot of the modal
    const modal = page.locator('.match-end-modal');
    await expect(modal).toHaveScreenshot('match-end-single-winner.png');
  });

  test('should render match end screen with multiple winners', async ({ page }) => {
    // Show match end screen with tie scenario
    await page.evaluate(() => {
      (window as any).showMatchEndScreen({
        winners: ['Player1', 'Player2'],
        finalScores: [
          { playerId: 'Player1', kills: 5, deaths: 2, xp: 0 },
          { playerId: 'Player2', kills: 5, deaths: 2, xp: 0 },
          { playerId: 'Player3', kills: 1, deaths: 5, xp: 0 },
        ],
        reason: 'time_limit',
      }, 'Player1');
    });

    // Wait for modal to be visible
    await page.waitForSelector('.match-end-modal', {
      state: 'visible',
      timeout: 5000,
    });

    // Take screenshot of the modal
    const modal = page.locator('.match-end-modal');
    await expect(modal).toHaveScreenshot('match-end-multiple-winners.png');
  });

  test('should render match end screen with local player as winner', async ({ page }) => {
    // Show match end screen where local player won
    await page.evaluate(() => {
      (window as any).showMatchEndScreen({
        winners: ['LocalPlayer'],
        finalScores: [
          { playerId: 'LocalPlayer', kills: 10, deaths: 1, xp: 0 },
          { playerId: 'Player2', kills: 3, deaths: 4, xp: 0 },
          { playerId: 'Player3', kills: 1, deaths: 5, xp: 0 },
        ],
        reason: 'time_limit',
      }, 'LocalPlayer');
    });

    // Wait for modal to be visible
    await page.waitForSelector('.match-end-modal', {
      state: 'visible',
      timeout: 5000,
    });

    // Take screenshot of the modal
    const modal = page.locator('.match-end-modal');
    await expect(modal).toHaveScreenshot('match-end-local-winner.png');
  });

  test('should render match end screen with local player in top 3 but not winner', async ({ page }) => {
    // Show match end screen where local player placed 2nd
    await page.evaluate(() => {
      (window as any).showMatchEndScreen({
        winners: ['Player1'],
        finalScores: [
          { playerId: 'Player1', kills: 8, deaths: 2, xp: 0 },
          { playerId: 'LocalPlayer', kills: 6, deaths: 3, xp: 0 },
          { playerId: 'Player3', kills: 2, deaths: 6, xp: 0 },
          { playerId: 'Player4', kills: 1, deaths: 8, xp: 0 },
        ],
        reason: 'time_limit',
      }, 'LocalPlayer');
    });

    // Wait for modal to be visible
    await page.waitForSelector('.match-end-modal', {
      state: 'visible',
      timeout: 5000,
    });

    // Take screenshot of the modal
    const modal = page.locator('.match-end-modal');
    await expect(modal).toHaveScreenshot('match-end-top-three.png');
  });
});
