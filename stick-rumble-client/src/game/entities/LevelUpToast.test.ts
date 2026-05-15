import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { showLevelUpToast, dismissLevelUpToast, LEVEL_UP_DURATION_MS } from './LevelUpToast';

// TS-PROG-005: Level-up toast behavior
describe('LevelUpToast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    const toast = document.querySelector('.level-up-toast');
    if (toast) {
      document.body.removeChild(toast);
    }
  });

  it('showLevelUpToast creates a toast with the correct level text', () => {
    showLevelUpToast(5);
    const toast = document.querySelector('.level-up-toast');
    expect(toast).not.toBeNull();
    expect(toast?.textContent).toContain('Level 5');
  });

  it('dismissLevelUpToast removes the toast from the DOM', () => {
    showLevelUpToast(10);
    expect(document.querySelector('.level-up-toast')).not.toBeNull();
    dismissLevelUpToast();
    expect(document.querySelector('.level-up-toast')).toBeNull();
  });

  it('exports LEVEL_UP_DURATION_MS as a positive number', () => {
    expect(LEVEL_UP_DURATION_MS).toBeGreaterThan(0);
  });
});
