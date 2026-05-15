/**
 * LevelUpToast - A simple toast notification system for level-up events.
 *
 * This module provides functions to show and dismiss a level-up toast
 * overlay in the Phaser game scene.
 */

export const LEVEL_UP_DURATION_MS = 3000;

let toastContainer: HTMLDivElement | null = null;

/**
 * Shows a level-up toast notification with the given level.
 * Creates a DOM overlay element that auto-dismisses after LEVEL_UP_DURATION_MS.
 */
export function showLevelUpToast(level: number): void {
  dismissLevelUpToast();

  toastContainer = document.createElement('div');
  toastContainer.className = 'level-up-toast';
  toastContainer.style.cssText = `
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #f0c040, #e0a800);
    color: #1a1a2e;
    padding: 1rem 2rem;
    border-radius: 1rem;
    font-size: 1.5rem;
    font-weight: bold;
    z-index: 2000;
    text-align: center;
    box-shadow: 0 4px 20px rgba(240, 192, 64, 0.5);
    animation: levelUpToastFadeIn 0.3s ease-out;
  `;
  toastContainer.textContent = `Level Up! You're now Level ${level}`;

  document.body.appendChild(toastContainer);

  setTimeout(() => {
    dismissLevelUpToast();
  }, LEVEL_UP_DURATION_MS);
}

/**
 * Dismisses the current level-up toast notification if one exists.
 */
export function dismissLevelUpToast(): void {
  if (toastContainer && toastContainer.parentNode) {
    toastContainer.parentNode.removeChild(toastContainer);
  }
  toastContainer = null;
}
