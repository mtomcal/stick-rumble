import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { createCanvas } from 'canvas';

// Mock canvas for Phaser
if (!globalThis.HTMLCanvasElement) {
  (globalThis as any).HTMLCanvasElement = class HTMLCanvasElement {
    getContext() {
      return createCanvas(800, 600).getContext('2d');
    }
  };
}

// Cleanup after each test
afterEach(() => {
  cleanup();
});
