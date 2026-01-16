/**
 * DodgeRollManager - Manages dodge roll state and cooldowns
 *
 * Responsibilities:
 * - Track roll state (isRolling, rollStartTime, lastRollTime)
 * - Enforce 3 second cooldown between rolls
 * - Detect invincibility frames (first 0.2s of roll)
 * - Calculate cooldown progress for UI
 *
 * Constants (from server):
 * - Roll duration: 0.4 seconds
 * - Invincibility frames: 0.2 seconds (first half of roll)
 * - Cooldown: 3 seconds
 */
export class DodgeRollManager {
  private _isRolling: boolean = false;
  private rollStartTime: number = 0;
  private lastRollTime: number = 0;

  // Roll constants (matching server values)
  private readonly INVINCIBILITY_DURATION_MS = 200; // 0.2 seconds
  private readonly COOLDOWN_MS = 3000; // 3 seconds

  /**
   * Check if player can perform a dodge roll
   * Prevents spam by checking cooldown and current roll state
   */
  canDodgeRoll(): boolean {
    // Can't roll if already rolling
    if (this._isRolling) {
      return false;
    }

    // Can roll if no previous roll (first roll)
    if (this.lastRollTime === 0) {
      return true;
    }

    // Check if cooldown has expired
    const timeSinceLastRoll = Date.now() - this.lastRollTime;
    return timeSinceLastRoll >= this.COOLDOWN_MS;
  }

  /**
   * Start a dodge roll
   * Sets roll state and timestamps
   */
  startRoll(): void {
    const now = Date.now();
    this._isRolling = true;
    this.rollStartTime = now;
    this.lastRollTime = now;
  }

  /**
   * End a dodge roll
   * Resets roll state but preserves lastRollTime for cooldown tracking
   */
  endRoll(): void {
    this._isRolling = false;
    this.rollStartTime = 0;
  }

  /**
   * Update dodge roll state (called every frame)
   * Currently a no-op as state updates are event-driven,
   * but included for future features and consistency with other managers
   */
  update(): void {
    // State updates are event-driven (startRoll/endRoll called by server messages)
    // This method exists for consistency with other managers and future features
  }

  /**
   * Get cooldown progress for UI display
   * Returns value from 0.0 (just rolled) to 1.0 (ready to roll)
   */
  getCooldownProgress(): number {
    // If never rolled, cooldown is complete
    if (this.lastRollTime === 0) {
      return 1.0;
    }

    const timeSinceLastRoll = Date.now() - this.lastRollTime;
    const progress = Math.min(timeSinceLastRoll / this.COOLDOWN_MS, 1.0);
    return progress;
  }

  /**
   * Check if player is currently in invincibility frames
   * Returns true during first 0.2s of roll
   */
  isInInvincibilityFrames(): boolean {
    if (!this._isRolling) {
      return false;
    }

    const timeSinceRollStart = Date.now() - this.rollStartTime;
    return timeSinceRollStart < this.INVINCIBILITY_DURATION_MS;
  }

  /**
   * Check if currently rolling
   */
  isRolling(): boolean {
    return this._isRolling;
  }

  /**
   * Get the timestamp when the current roll started
   * Returns 0 if not currently rolling
   */
  getRollStartTime(): number {
    return this.rollStartTime;
  }

  /**
   * Get the timestamp of the last roll (for cooldown tracking)
   * Returns 0 if no roll has occurred yet
   */
  getLastRollTime(): number {
    return this.lastRollTime;
  }
}
