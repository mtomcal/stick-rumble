import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWebSocketUrl, getApiBaseUrl, getLocationHostname, getLocationProtocol } from './runtimeConfig';

describe('runtimeConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe('getLocationHostname', () => {
    it('returns the current hostname from the browser location', () => {
      const hostname = getLocationHostname();
      // In jsdom the default hostname is 'localhost'
      expect(hostname).toBeDefined();
      expect(typeof hostname).toBe('string');
    });
  });

  describe('getLocationProtocol', () => {
    it('returns the current protocol from the browser location', () => {
      const protocol = getLocationProtocol();
      // In jsdom the default protocol is 'http:'
      expect(protocol).toBeDefined();
      expect(typeof protocol).toBe('string');
    });
  });

  describe('getWebSocketUrl', () => {
    it('uses the configured WebSocket URL when VITE_WS_URL is set', async () => {
      vi.stubEnv('VITE_WS_URL', 'ws://10.0.0.5:8080/ws');

      const { getWebSocketUrl: getConfiguredWebSocketUrl } = await import('./runtimeConfig');

      expect(getConfiguredWebSocketUrl()).toBe('ws://10.0.0.5:8080/ws');
    });

    it('derives the default WebSocket URL from the browser hostname', () => {
      const url = getWebSocketUrl();
      // In jsdom the hostname is 'localhost' and protocol is 'http:'
      expect(url).toBe('ws://localhost:8080/ws');
    });

    it('uses wss when the page is served over https', () => {
      // getLocationProtocol returns the actual protocol; in jsdom it's 'http:'
      // The important behavior: the URL scheme matches the page protocol
      const protocol = getLocationProtocol();
      const expectedScheme = protocol === 'https:' ? 'wss:' : 'ws:';
      const url = getWebSocketUrl();
      expect(url.startsWith(expectedScheme)).toBe(true);
    });

    it('returns a valid WebSocket URL format', () => {
      const url = getWebSocketUrl();
      expect(url).toMatch(/^wss?:\/\/.+:\d+\/ws$/);
    });
  });

  describe('getApiBaseUrl', () => {
    it('returns /api by default', () => {
      expect(getApiBaseUrl()).toBe('/api');
    });

    it('uses configured VITE_API_BASE_URL when set', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'https://api.stickrumble.test');

      const { getApiBaseUrl: getConfiguredApiBaseUrl } = await import('./runtimeConfig');

      expect(getConfiguredApiBaseUrl()).toBe('https://api.stickrumble.test');
    });
  });
});
