import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NetworkSimulator } from './NetworkSimulator';

describe('NetworkSimulator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('constructor and defaults', () => {
    it('should initialize with default settings (0ms latency, 0% packet loss)', () => {
      const simulator = new NetworkSimulator();
      expect(simulator.getLatency()).toBe(0);
      expect(simulator.getPacketLoss()).toBe(0);
      expect(simulator.isEnabled()).toBe(false);
    });

    it('should initialize with custom settings', () => {
      const simulator = new NetworkSimulator({ latency: 100, packetLoss: 5, enabled: true });
      expect(simulator.getLatency()).toBe(100);
      expect(simulator.getPacketLoss()).toBe(5);
      expect(simulator.isEnabled()).toBe(true);
    });
  });

  describe('enable/disable', () => {
    it('should enable and disable simulation', () => {
      const simulator = new NetworkSimulator();
      expect(simulator.isEnabled()).toBe(false);

      simulator.setEnabled(true);
      expect(simulator.isEnabled()).toBe(true);

      simulator.setEnabled(false);
      expect(simulator.isEnabled()).toBe(false);
    });
  });

  describe('latency configuration', () => {
    it('should set latency within valid range', () => {
      const simulator = new NetworkSimulator();
      simulator.setLatency(150);
      expect(simulator.getLatency()).toBe(150);
    });

    it('should clamp latency to 0ms minimum', () => {
      const simulator = new NetworkSimulator();
      simulator.setLatency(-10);
      expect(simulator.getLatency()).toBe(0);
    });

    it('should clamp latency to 300ms maximum', () => {
      const simulator = new NetworkSimulator();
      simulator.setLatency(500);
      expect(simulator.getLatency()).toBe(300);
    });
  });

  describe('packet loss configuration', () => {
    it('should set packet loss within valid range', () => {
      const simulator = new NetworkSimulator();
      simulator.setPacketLoss(10);
      expect(simulator.getPacketLoss()).toBe(10);
    });

    it('should clamp packet loss to 0% minimum', () => {
      const simulator = new NetworkSimulator();
      simulator.setPacketLoss(-5);
      expect(simulator.getPacketLoss()).toBe(0);
    });

    it('should clamp packet loss to 20% maximum', () => {
      const simulator = new NetworkSimulator();
      simulator.setPacketLoss(30);
      expect(simulator.getPacketLoss()).toBe(20);
    });
  });

  describe('simulateSend', () => {
    it('should call sendFn immediately when disabled', () => {
      const simulator = new NetworkSimulator();
      const sendFn = vi.fn();
      const message = { type: 'test', timestamp: 123 };

      simulator.simulateSend(message, sendFn);

      expect(sendFn).toHaveBeenCalledWith(message);
      expect(sendFn).toHaveBeenCalledTimes(1);
    });

    it('should call sendFn immediately when latency is 0', () => {
      const simulator = new NetworkSimulator({ latency: 0, enabled: true });
      const sendFn = vi.fn();
      const message = { type: 'test', timestamp: 123 };

      simulator.simulateSend(message, sendFn);

      expect(sendFn).toHaveBeenCalledWith(message);
      expect(sendFn).toHaveBeenCalledTimes(1);
    });

    it('should delay sendFn when latency is set and enabled', () => {
      const simulator = new NetworkSimulator({ latency: 100, enabled: true });
      const sendFn = vi.fn();
      const message = { type: 'test', timestamp: 123 };

      simulator.simulateSend(message, sendFn);

      // Should not be called immediately
      expect(sendFn).not.toHaveBeenCalled();

      // Fast-forward time (100ms base + up to 40ms jitter)
      vi.advanceTimersByTime(150);

      expect(sendFn).toHaveBeenCalledWith(message);
      expect(sendFn).toHaveBeenCalledTimes(1);
    });

    it('should drop packets based on packet loss rate', () => {
      const simulator = new NetworkSimulator({ latency: 100, packetLoss: 20, enabled: true });
      const sendFn = vi.fn();
      const message = { type: 'test', timestamp: 123 };

      // Mock Math.random to return 0.1 on first call (packet loss check)
      // 0.1 * 100 = 10 which is < 20, so packet should be dropped
      const randomMock = vi.spyOn(Math, 'random').mockReturnValue(0.1);

      simulator.simulateSend(message, sendFn);

      // Wait for potential delay
      vi.advanceTimersByTime(500);

      // Should be dropped since 10 < 20
      expect(sendFn).not.toHaveBeenCalled();

      randomMock.mockRestore();
    });

    it('should not drop packets when packet loss is 0', () => {
      const simulator = new NetworkSimulator({ packetLoss: 0, enabled: true });
      const sendFn = vi.fn();
      const message = { type: 'test', timestamp: 123 };

      simulator.simulateSend(message, sendFn);

      vi.advanceTimersByTime(50);

      expect(sendFn).toHaveBeenCalledTimes(1);
    });

    it('should apply jitter to latency (+/-20ms)', () => {
      const simulator = new NetworkSimulator({ latency: 100, enabled: true });
      const sendFn = vi.fn();
      const message = { type: 'test', timestamp: 123 };

      // Mock Math.random to return specific jitter value
      // Math.random() * 40 - 20 = 0.75 * 40 - 20 = 10ms jitter
      vi.spyOn(Math, 'random').mockReturnValue(0.75);

      simulator.simulateSend(message, sendFn);

      expect(sendFn).not.toHaveBeenCalled();

      // Should be called after 100ms + 10ms = 110ms
      vi.advanceTimersByTime(109);
      expect(sendFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2);
      expect(sendFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('simulateReceive', () => {
    it('should call receiveFn immediately when disabled', () => {
      const simulator = new NetworkSimulator();
      const receiveFn = vi.fn();
      const message = { type: 'test', timestamp: 123 };

      simulator.simulateReceive(message, receiveFn);

      expect(receiveFn).toHaveBeenCalledWith(message);
      expect(receiveFn).toHaveBeenCalledTimes(1);
    });

    it('should call receiveFn immediately when latency is 0', () => {
      const simulator = new NetworkSimulator({ latency: 0, enabled: true });
      const receiveFn = vi.fn();
      const message = { type: 'test', timestamp: 123 };

      simulator.simulateReceive(message, receiveFn);

      expect(receiveFn).toHaveBeenCalledWith(message);
      expect(receiveFn).toHaveBeenCalledTimes(1);
    });

    it('should delay receiveFn when latency is set and enabled', () => {
      const simulator = new NetworkSimulator({ latency: 100, enabled: true });
      const receiveFn = vi.fn();
      const message = { type: 'test', timestamp: 123 };

      simulator.simulateReceive(message, receiveFn);

      expect(receiveFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(150);

      expect(receiveFn).toHaveBeenCalledWith(message);
      expect(receiveFn).toHaveBeenCalledTimes(1);
    });

    it('should drop incoming packets based on packet loss rate', () => {
      const simulator = new NetworkSimulator({ latency: 100, packetLoss: 20, enabled: true });
      const receiveFn = vi.fn();
      const message = { type: 'test', timestamp: 123 };

      // Mock Math.random to return 0.1 on first call (packet loss check)
      // 0.1 * 100 = 10 which is < 20, so packet should be dropped
      const randomMock = vi.spyOn(Math, 'random').mockReturnValue(0.1);

      simulator.simulateReceive(message, receiveFn);

      vi.advanceTimersByTime(500);

      expect(receiveFn).not.toHaveBeenCalled();

      randomMock.mockRestore();
    });
  });

  describe('getStats', () => {
    it('should return current configuration stats', () => {
      const simulator = new NetworkSimulator({ latency: 150, packetLoss: 10, enabled: true });
      const stats = simulator.getStats();

      expect(stats).toEqual({
        enabled: true,
        latency: 150,
        packetLoss: 10,
      });
    });
  });
});
