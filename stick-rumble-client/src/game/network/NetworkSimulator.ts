/**
 * NetworkSimulator - Simulates artificial network latency, jitter, and packet loss
 * for testing netcode under poor network conditions.
 */

export interface NetworkSimulatorConfig {
  latency?: number; // Base latency in ms (0-300)
  packetLoss?: number; // Packet loss percentage (0-20)
  enabled?: boolean; // Whether simulation is active
}

export interface NetworkSimulatorStats {
  enabled: boolean;
  latency: number;
  packetLoss: number;
}

export class NetworkSimulator {
  private latency = 0; // Base latency in ms
  private packetLoss = 0; // Packet loss percentage (0-100)
  private enabled = false;

  constructor(config?: NetworkSimulatorConfig) {
    if (config) {
      this.setLatency(config.latency ?? 0);
      this.setPacketLoss(config.packetLoss ?? 0);
      this.enabled = config.enabled ?? false;
    }
  }

  /**
   * Enable or disable network simulation
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if network simulation is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set base latency in milliseconds (clamped to 0-300ms)
   */
  setLatency(latency: number): void {
    this.latency = Math.max(0, Math.min(300, latency));
  }

  /**
   * Get current base latency
   */
  getLatency(): number {
    return this.latency;
  }

  /**
   * Set packet loss percentage (clamped to 0-20%)
   */
  setPacketLoss(packetLoss: number): void {
    this.packetLoss = Math.max(0, Math.min(20, packetLoss));
  }

  /**
   * Get current packet loss percentage
   */
  getPacketLoss(): number {
    return this.packetLoss;
  }

  /**
   * Get current simulator stats
   */
  getStats(): NetworkSimulatorStats {
    return {
      enabled: this.enabled,
      latency: this.latency,
      packetLoss: this.packetLoss,
    };
  }

  /**
   * Simulate sending a message with artificial latency and packet loss
   * @param message - Message to send
   * @param sendFn - Actual send function to call after simulation
   */
  simulateSend<T>(message: T, sendFn: (msg: T) => void): void {
    if (!this.enabled || this.latency === 0) {
      // No simulation or zero latency - send immediately
      sendFn(message);
      return;
    }

    // Check for packet loss
    if (this.shouldDropPacket()) {
      // Packet dropped - don't send
      return;
    }

    // Calculate delay with jitter
    const delay = this.calculateDelay();

    // Delay the send
    setTimeout(() => {
      sendFn(message);
    }, delay);
  }

  /**
   * Simulate receiving a message with artificial latency and packet loss
   * @param message - Message received
   * @param receiveFn - Function to call after simulated delay
   */
  simulateReceive<T>(message: T, receiveFn: (msg: T) => void): void {
    if (!this.enabled || this.latency === 0) {
      // No simulation or zero latency - receive immediately
      receiveFn(message);
      return;
    }

    // Check for packet loss
    if (this.shouldDropPacket()) {
      // Packet dropped - don't receive
      return;
    }

    // Calculate delay with jitter
    const delay = this.calculateDelay();

    // Delay the receive
    setTimeout(() => {
      receiveFn(message);
    }, delay);
  }

  /**
   * Calculate delay with jitter (+/-20ms)
   */
  private calculateDelay(): number {
    const jitter = Math.random() * 40 - 20; // +/-20ms
    return Math.max(0, this.latency + jitter);
  }

  /**
   * Determine if packet should be dropped based on packet loss rate
   */
  private shouldDropPacket(): boolean {
    if (this.packetLoss === 0) {
      return false;
    }
    return Math.random() * 100 < this.packetLoss;
  }
}
