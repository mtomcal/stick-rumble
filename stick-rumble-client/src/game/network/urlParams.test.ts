import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseNetworkSimulatorParams } from './urlParams';

describe('parseNetworkSimulatorParams', () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  it('should return null when no params are present', () => {
    window.location.search = '';
    expect(parseNetworkSimulatorParams()).toBeNull();
  });

  it('should return null when only unrelated params are present', () => {
    window.location.search = '?foo=bar&baz=123';
    expect(parseNetworkSimulatorParams()).toBeNull();
  });

  it('should parse latency parameter', () => {
    window.location.search = '?latency=100';
    const config = parseNetworkSimulatorParams();

    expect(config).not.toBeNull();
    expect(config?.latency).toBe(100);
    expect(config?.enabled).toBe(true);
  });

  it('should parse loss parameter', () => {
    window.location.search = '?loss=10';
    const config = parseNetworkSimulatorParams();

    expect(config).not.toBeNull();
    expect(config?.packetLoss).toBe(10);
    expect(config?.enabled).toBe(true);
  });

  it('should parse both latency and loss parameters', () => {
    window.location.search = '?latency=150&loss=5';
    const config = parseNetworkSimulatorParams();

    expect(config).not.toBeNull();
    expect(config?.latency).toBe(150);
    expect(config?.packetLoss).toBe(5);
    expect(config?.enabled).toBe(true);
  });

  it('should handle zero values', () => {
    window.location.search = '?latency=0&loss=0';
    const config = parseNetworkSimulatorParams();

    // Zero values are valid and should enable simulation (user explicitly set them)
    expect(config).not.toBeNull();
    expect(config?.latency).toBe(0);
    expect(config?.packetLoss).toBe(0);
    expect(config?.enabled).toBe(true);
  });

  it('should handle non-zero latency with zero loss', () => {
    window.location.search = '?latency=100&loss=0';
    const config = parseNetworkSimulatorParams();

    expect(config).not.toBeNull();
    expect(config?.latency).toBe(100);
    expect(config?.packetLoss).toBe(0);
    expect(config?.enabled).toBe(true);
  });

  it('should ignore invalid latency values', () => {
    window.location.search = '?latency=abc';
    expect(parseNetworkSimulatorParams()).toBeNull();
  });

  it('should ignore invalid loss values', () => {
    window.location.search = '?loss=xyz';
    expect(parseNetworkSimulatorParams()).toBeNull();
  });

  it('should ignore negative latency values', () => {
    window.location.search = '?latency=-50';
    expect(parseNetworkSimulatorParams()).toBeNull();
  });

  it('should ignore negative loss values', () => {
    window.location.search = '?loss=-10';
    expect(parseNetworkSimulatorParams()).toBeNull();
  });

  it('should handle valid latency with invalid loss', () => {
    window.location.search = '?latency=100&loss=invalid';
    const config = parseNetworkSimulatorParams();

    expect(config).not.toBeNull();
    expect(config?.latency).toBe(100);
    expect(config?.packetLoss).toBeUndefined();
    expect(config?.enabled).toBe(true);
  });

  it('should handle mixed case in params', () => {
    window.location.search = '?Latency=100';
    // URLSearchParams is case-sensitive, so this should not match
    expect(parseNetworkSimulatorParams()).toBeNull();
  });

  it('should work with other unrelated params', () => {
    window.location.search = '?debug=true&latency=200&mode=test';
    const config = parseNetworkSimulatorParams();

    expect(config).not.toBeNull();
    expect(config?.latency).toBe(200);
    expect(config?.enabled).toBe(true);
  });
});
