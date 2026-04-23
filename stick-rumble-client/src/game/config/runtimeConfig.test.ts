import { getWebSocketUrl } from './runtimeConfig';

describe('runtimeConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses the configured WebSocket URL when VITE_WS_URL is set', async () => {
    vi.stubEnv('VITE_WS_URL', 'ws://10.0.0.5:8080/ws');

    const { getWebSocketUrl: getConfiguredWebSocketUrl } = await import('./runtimeConfig');

    expect(getConfiguredWebSocketUrl()).toBe('ws://10.0.0.5:8080/ws');
  });

  it('derives the default WebSocket URL from the current browser hostname', () => {
    vi.stubGlobal('location', {
      hostname: '192.168.1.25',
      protocol: 'http:',
    });

    expect(getWebSocketUrl()).toBe('ws://192.168.1.25:8080/ws');
  });

  it('uses wss when the page is served over https', () => {
    vi.stubGlobal('location', {
      hostname: 'play.stickrumble.test',
      protocol: 'https:',
    });

    expect(getWebSocketUrl()).toBe('wss://play.stickrumble.test:8080/ws');
  });
});
