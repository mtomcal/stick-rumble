import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectStageMode } from './mobileMode'

function setTouchEnvironment(enabled: boolean) {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: enabled ? 5 : 0,
  })
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: enabled && query === '(pointer: coarse)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia
}

describe('detectStageMode', () => {
  beforeEach(() => {
    setTouchEnvironment(false)
  })

  it('keeps desktop mode for large layouts even when touch is available', () => {
    setTouchEnvironment(true)
    expect(detectStageMode(1180, 820)).toBe('desktop')
  })

  it('detects mobile landscape on phone-sized touch layouts', () => {
    setTouchEnvironment(true)
    expect(detectStageMode(844, 390)).toBe('mobile-landscape')
  })

  it('detects portrait blocking on phone-sized touch layouts', () => {
    setTouchEnvironment(true)
    expect(detectStageMode(390, 844)).toBe('mobile-portrait-blocked')
  })
})
