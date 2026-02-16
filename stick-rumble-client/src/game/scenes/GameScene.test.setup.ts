import { vi } from 'vitest';

// Mock Phaser scene context for the new arena-based implementation
// Note: vi.mock('phaser') must be in each test file, not in this shared setup
export const createMockScene = () => {
  const mockRectangle = {
    setOrigin: vi.fn().mockReturnThis(),
    setStrokeStyle: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setTint: vi.fn().mockReturnThis(),
    clearTint: vi.fn().mockReturnThis(),
    setFillStyle: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(),
    fillColor: 0x00ff00,
    destroy: vi.fn(),
  };

  const mockText = {
    setOrigin: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setColor: vi.fn().mockReturnThis(),
    setPosition: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    visible: false,
    destroy: vi.fn().mockReturnThis(),
  };

  const mockCamera = {
    centerX: 960,
    centerY: 540,
    width: 1920,
    height: 1080,
    scrollX: 0,
    scrollY: 0,
    setBounds: vi.fn(),
    startFollow: vi.fn(),
    stopFollow: vi.fn(),
  };

  const mockLine = {
    setTo: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setLineWidth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };

  const delayedCallCallbacks: Array<() => void> = [];
  const mockTime = {
    delayedCall: vi.fn((_delay: number, callback: () => void) => {
      delayedCallCallbacks.push(callback);
      return { callback };
    }),
  };

  const mockContainer = {
    add: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
  };

  const mockMakeGraphics = {
    lineStyle: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(),
    lineTo: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    generateTexture: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };

  const mockGraphics = {
    fillStyle: vi.fn().mockReturnThis(),
    fillRect: vi.fn().mockReturnThis(),
    fillCircle: vi.fn().mockReturnThis(),
    lineStyle: vi.fn().mockReturnThis(),
    beginPath: vi.fn().mockReturnThis(),
    arc: vi.fn().mockReturnThis(),
    closePath: vi.fn().mockReturnThis(),
    fillPath: vi.fn().mockReturnThis(),
    strokePath: vi.fn().mockReturnThis(),
    clear: vi.fn().mockReturnThis(),
    setScrollFactor: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    setVisible: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };

  const mockSprite = {
    x: 0,
    y: 0,
    setPosition: vi.fn().mockReturnThis(),
    setAlpha: vi.fn().mockReturnThis(),
    setAngle: vi.fn().mockReturnThis(),
    setTint: vi.fn().mockReturnThis(),
    clearTint: vi.fn().mockReturnThis(),
    setOrigin: vi.fn().mockReturnThis(),
    setRotation: vi.fn().mockReturnThis(),
    setFlipY: vi.fn().mockReturnThis(),
    setTexture: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
    play: vi.fn().mockReturnThis(),
    anims: {
      currentAnim: null,
    },
  };

  const mockContext = {
    sys: {
      isActive: vi.fn().mockReturnValue(true),
    },
    add: {
      text: vi.fn().mockReturnValue(mockText),
      rectangle: vi.fn().mockReturnValue(mockRectangle),
      sprite: vi.fn().mockReturnValue(mockSprite),
      line: vi.fn().mockReturnValue(mockLine),
      circle: vi.fn().mockReturnValue({ destroy: vi.fn() }),
      container: vi.fn().mockReturnValue(mockContainer),
      graphics: vi.fn().mockReturnValue(mockGraphics),
    },
    make: {
      graphics: vi.fn().mockReturnValue(mockMakeGraphics),
    },
    load: {
      audio: vi.fn(),
      spritesheet: vi.fn(),
      image: vi.fn(),
    },
    sound: {
      add: vi.fn().mockReturnValue({
        play: vi.fn(),
        stop: vi.fn(),
        setVolume: vi.fn().mockReturnThis(),
        setPan: vi.fn().mockReturnThis(),
        once: vi.fn(),
      }),
      volume: 1,
      mute: false,
    },
    anims: {
      create: vi.fn(),
      generateFrameNumbers: vi.fn(),
    },
    cameras: {
      main: mockCamera,
    },
    physics: {
      world: {
        setBounds: vi.fn(),
      },
    },
    input: {
      keyboard: {
        addKeys: vi.fn().mockReturnValue({
          W: { isDown: false },
          A: { isDown: false },
          S: { isDown: false },
          D: { isDown: false },
          SHIFT: { isDown: false },
        }),
        addKey: vi.fn().mockReturnValue({
          on: vi.fn(),
        }),
      },
      on: vi.fn(),
    },
    tweens: {
      add: vi.fn().mockReturnValue({ remove: vi.fn() }),
    },
    time: mockTime,
    events: {
      once: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
    delayedCallCallbacks,
  };
  return mockContext;
};

export interface MockWebSocketInstance {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
}

export const createMockWebSocket = () => {
  const mockWebSocketInstance: MockWebSocketInstance = {
    readyState: 0, // Start as CONNECTING, not OPEN
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
  };

  // Mock WebSocket constructor as a class that tracks calls
  const MockWebSocket = vi.fn().mockImplementation(function(this: MockWebSocketInstance) {
    this.readyState = mockWebSocketInstance.readyState;
    this.send = mockWebSocketInstance.send;
    this.close = mockWebSocketInstance.close;
    this.addEventListener = mockWebSocketInstance.addEventListener;
    this.removeEventListener = mockWebSocketInstance.removeEventListener;

    // Use defineProperty to set up getters/setters that route to shared state
    Object.defineProperty(this, 'onopen', {
      get: () => mockWebSocketInstance.onopen,
      set: (handler) => { mockWebSocketInstance.onopen = handler; },
    });
    Object.defineProperty(this, 'onmessage', {
      get: () => mockWebSocketInstance.onmessage,
      set: (handler) => { mockWebSocketInstance.onmessage = handler; },
    });
    Object.defineProperty(this, 'onerror', {
      get: () => mockWebSocketInstance.onerror,
      set: (handler) => { mockWebSocketInstance.onerror = handler; },
    });
    Object.defineProperty(this, 'onclose', {
      get: () => mockWebSocketInstance.onclose,
      set: (handler) => { mockWebSocketInstance.onclose = handler; },
    });
  });

  (MockWebSocket as unknown as Record<string, number>).OPEN = 1;
  (MockWebSocket as unknown as Record<string, number>).CONNECTING = 0;

  return { MockWebSocket, mockWebSocketInstance };
};
