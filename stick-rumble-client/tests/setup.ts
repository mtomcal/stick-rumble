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

const createStorageMock = (): Storage => {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
};

const hasWorkingStorage = (storage: Partial<Storage> | undefined): storage is Storage => {
  return Boolean(
    storage &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function' &&
    typeof storage.clear === 'function' &&
    typeof storage.key === 'function'
  );
};

if (!hasWorkingStorage(globalThis.localStorage as Partial<Storage> | undefined)) {
  const storage = createStorageMock();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage,
  });
}

if (typeof window !== 'undefined' && !hasWorkingStorage(window.localStorage as Partial<Storage> | undefined)) {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: globalThis.localStorage,
  });
}

// Cleanup after each test
afterEach(() => {
  cleanup();
});
