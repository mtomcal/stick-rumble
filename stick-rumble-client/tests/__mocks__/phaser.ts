import { vi } from 'vitest';

// Mock Graphics object with state tracking
class MockGraphics {
  private _visible: boolean = true;
  private _destroyed: boolean = false;
  private _depth: number = 0;

  // Track method calls
  clear = vi.fn();
  lineStyle = vi.fn();
  fillStyle = vi.fn();
  beginPath = vi.fn();
  arc = vi.fn();
  strokePath = vi.fn();
  fillPath = vi.fn();
  moveTo = vi.fn();
  closePath = vi.fn();

  setVisible(visible: boolean) {
    this._visible = visible;
    return this;
  }

  setDepth(depth: number) {
    this._depth = depth;
    return this;
  }

  destroy() {
    this._destroyed = true;
  }

  // Getters for testing
  get visible() {
    return this._visible;
  }

  get destroyed() {
    return this._destroyed;
  }

  get depth() {
    return this._depth;
  }
}

// Mock Rectangle object with state tracking
class MockRectangle {
  private _destroyed: boolean = false;
  private _visible: boolean = true;
  private _alpha: number = 1;
  private _angle: number = 0;
  private _fillColor: number;

  x: number;
  y: number;
  width: number;
  height: number;

  constructor(x: number, y: number, width: number, height: number, fillColor: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this._fillColor = fillColor;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }

  setAlpha(alpha: number) {
    this._alpha = alpha;
    return this;
  }

  setAngle(angle: number) {
    this._angle = angle;
    return this;
  }

  setFillStyle(color: number) {
    this._fillColor = color;
    return this;
  }

  setVisible(visible: boolean) {
    this._visible = visible;
    return this;
  }

  destroy() {
    this._destroyed = true;
  }

  // Getters for testing
  get destroyed() {
    return this._destroyed;
  }

  get visible() {
    return this._visible;
  }

  get alpha() {
    return this._alpha;
  }

  get angle() {
    return this._angle;
  }

  get fillColor() {
    return this._fillColor;
  }
}

// Mock Text object with state tracking
class MockText {
  private _destroyed: boolean = false;

  x: number;
  y: number;
  text: string;
  style: any;

  constructor(x: number, y: number, text: string, style?: any) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.style = style;
  }

  setOrigin(x: number, y?: number) {
    // Origin tracking not needed for current tests
    void x;
    void y;
    return this;
  }

  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
    return this;
  }

  destroy() {
    this._destroyed = true;
  }

  get destroyed() {
    return this._destroyed;
  }
}

// Mock Line object with state tracking
class MockLine {
  private _destroyed: boolean = false;

  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor: number;

  constructor(_x: number, _y: number, x1: number, y1: number, x2: number, y2: number, strokeColor: number) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.strokeColor = strokeColor;
  }

  setTo(x1: number, y1: number, x2: number, y2: number) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    return this;
  }

  destroy() {
    this._destroyed = true;
  }

  get destroyed() {
    return this._destroyed;
  }
}

// Mock Phaser.Scene
class MockScene {
  scene = { key: 'GameScene' };
  time = {
    now: 0,
  };
  add = {
    text: (x: number, y: number, text: string, style?: any) => new MockText(x, y, text, style),
    circle: vi.fn(),
    graphics: () => new MockGraphics(),
    rectangle: (x: number, y: number, width: number, height: number, fillColor: number) =>
      new MockRectangle(x, y, width, height, fillColor),
    line: (x: number, y: number, x1: number, y1: number, x2: number, y2: number, strokeColor: number) =>
      new MockLine(x, y, x1, y1, x2, y2, strokeColor),
  };
  cameras = {
    main: {
      centerX: 640,
      centerY: 360,
    },
  };
  tweens = {
    add: vi.fn(),
  };

  constructor(config?: any) {
    if (config?.key) {
      this.scene.key = config.key;
    }
  }

  preload() {}
  create() {}
  update() {}
}

// Mock Phaser.Game
class MockGame {
  config: any;
  destroy: any;

  constructor(config: any) {
    this.config = config;
    this.destroy = vi.fn();
  }
}

// Mock Phaser namespace
const Phaser = {
  AUTO: 0,
  Scene: MockScene,
  Game: MockGame,
  Scale: {
    FIT: 1,
    CENTER_BOTH: 2,
  },
  Types: {
    Core: {},
    Physics: {
      Arcade: {},
    },
  },
};

export default Phaser;
