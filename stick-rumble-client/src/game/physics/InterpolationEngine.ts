/**
 * Position and velocity snapshot with timestamp
 */
export interface PositionSnapshot {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  timestamp: number;
}

/**
 * Result of interpolation calculation
 */
export interface InterpolationResult {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
}

const BUFFER_SIZE = 10; // Keep last 10 snapshots per player
const BUFFER_DELAY_MS = 100; // Render 100ms behind current time for smooth interpolation
const FREEZE_THRESHOLD_MS = 200; // Freeze position if no update for 200ms
const EXTRAPOLATION_MAX_MS = 100; // Extrapolate for max 100ms beyond last snapshot

/**
 * InterpolationEngine handles smooth position interpolation for other players.
 * This addresses varied network latency by:
 * - Buffering position history (last 10 snapshots per player)
 * - Rendering at (current time - 100ms) for smooth interpolation
 * - Extrapolating briefly on packet loss, then freezing
 * - Providing velocity for animation sync
 *
 * Design:
 * - Linear interpolation between snapshots (no jitter)
 * - 100ms buffer = ~2 server updates at 20Hz (smoothing buffer)
 * - Extrapolation: continue last velocity for max 100ms if no data
 * - Freeze: if no update for >200ms, stop at last known position
 */
export class InterpolationEngine {
  // Map of player ID -> array of position snapshots (sorted by timestamp, oldest first)
  private snapshots: Map<string, PositionSnapshot[]> = new Map();

  /**
   * Add a new position snapshot for a player.
   * Maintains buffer of last BUFFER_SIZE snapshots.
   *
   * @param playerId - Player identifier
   * @param snapshot - Position, velocity, and timestamp
   */
  addSnapshot(playerId: string, snapshot: PositionSnapshot): void {
    let playerSnapshots = this.snapshots.get(playerId);

    if (!playerSnapshots) {
      playerSnapshots = [];
      this.snapshots.set(playerId, playerSnapshots);
    }

    // Add new snapshot
    playerSnapshots.push(snapshot);

    // Maintain buffer size by removing oldest snapshots
    if (playerSnapshots.length > BUFFER_SIZE) {
      playerSnapshots.shift();
    }
  }

  /**
   * Get interpolated position and velocity for a player at current time.
   * Applies 100ms delay for smooth interpolation buffer.
   *
   * Algorithm:
   * 1. Calculate render time = currentTime - BUFFER_DELAY_MS
   * 2. Find snapshots bracketing render time
   * 3. Interpolate between snapshots (or extrapolate if beyond last snapshot)
   * 4. Freeze if no update for >FREEZE_THRESHOLD_MS
   *
   * @param playerId - Player identifier
   * @param currentTime - Current time in milliseconds
   * @returns Interpolated position/velocity, or null if player has no snapshots
   */
  getInterpolatedPosition(
    playerId: string,
    currentTime: number
  ): InterpolationResult | null {
    const playerSnapshots = this.snapshots.get(playerId);

    if (!playerSnapshots || playerSnapshots.length === 0) {
      return null;
    }

    // Calculate render time with buffer delay
    const renderTime = currentTime - BUFFER_DELAY_MS;

    // Get latest snapshot
    const latestSnapshot = playerSnapshots[playerSnapshots.length - 1];

    // Check if we should freeze (no update for >FREEZE_THRESHOLD_MS)
    const timeSinceLastUpdate = renderTime - latestSnapshot.timestamp;
    if (timeSinceLastUpdate > FREEZE_THRESHOLD_MS) {
      // Freeze at last known position with zero velocity
      return {
        position: { ...latestSnapshot.position },
        velocity: { x: 0, y: 0 },
      };
    }

    // If render time is before first snapshot, return first snapshot
    if (renderTime <= playerSnapshots[0].timestamp) {
      return {
        position: { ...playerSnapshots[0].position },
        velocity: { ...playerSnapshots[0].velocity },
      };
    }

    // If render time is beyond last snapshot, extrapolate (with cap)
    if (renderTime > latestSnapshot.timestamp) {
      const extrapolationTime = Math.min(
        renderTime - latestSnapshot.timestamp,
        EXTRAPOLATION_MAX_MS
      );

      // Extrapolate position using last velocity (in seconds)
      const extrapolationSeconds = extrapolationTime / 1000;
      const extrapolatedPosition = {
        x: latestSnapshot.position.x + latestSnapshot.velocity.x * extrapolationSeconds,
        y: latestSnapshot.position.y + latestSnapshot.velocity.y * extrapolationSeconds,
      };

      return {
        position: extrapolatedPosition,
        velocity: { ...latestSnapshot.velocity },
      };
    }

    // Find the two snapshots bracketing the render time
    let prevSnapshot = playerSnapshots[0];
    let nextSnapshot = playerSnapshots[0];

    for (let i = 0; i < playerSnapshots.length - 1; i++) {
      if (
        playerSnapshots[i].timestamp <= renderTime &&
        playerSnapshots[i + 1].timestamp > renderTime
      ) {
        prevSnapshot = playerSnapshots[i];
        nextSnapshot = playerSnapshots[i + 1];
        break;
      }
    }

    // If snapshots are the same, return exact position
    if (prevSnapshot === nextSnapshot) {
      return {
        position: { ...prevSnapshot.position },
        velocity: { ...prevSnapshot.velocity },
      };
    }

    // Calculate interpolation factor (0 = prevSnapshot, 1 = nextSnapshot)
    const timeDelta = nextSnapshot.timestamp - prevSnapshot.timestamp;
    const interpolationFactor = timeDelta > 0
      ? (renderTime - prevSnapshot.timestamp) / timeDelta
      : 0;

    // Linear interpolation (lerp) for position
    const interpolatedPosition = {
      x: prevSnapshot.position.x +
        (nextSnapshot.position.x - prevSnapshot.position.x) * interpolationFactor,
      y: prevSnapshot.position.y +
        (nextSnapshot.position.y - prevSnapshot.position.y) * interpolationFactor,
    };

    // Linear interpolation for velocity (for animation sync)
    const interpolatedVelocity = {
      x: prevSnapshot.velocity.x +
        (nextSnapshot.velocity.x - prevSnapshot.velocity.x) * interpolationFactor,
      y: prevSnapshot.velocity.y +
        (nextSnapshot.velocity.y - prevSnapshot.velocity.y) * interpolationFactor,
    };

    return {
      position: interpolatedPosition,
      velocity: interpolatedVelocity,
    };
  }

  /**
   * Clear all snapshots for a player (e.g., when player disconnects)
   *
   * @param playerId - Player identifier
   */
  clearPlayer(playerId: string): void {
    this.snapshots.delete(playerId);
  }
}
