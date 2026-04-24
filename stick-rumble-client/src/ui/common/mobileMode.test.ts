import { beforeEach, describe, expect, it, vi } from 'vitest'
import { detectStageMode, useStageMode } from './mobileMode'
import { renderHook, act, waitFor } from '@testing-library/react'

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

function setUserAgent(userAgent: string) {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: userAgent,
  })
}

function setTouchStartSupport(enabled: boolean) {
  if (enabled) {
    Object.defineProperty(window, 'ontouchstart', {
      configurable: true,
      value: vi.fn(),
    })
    return
  }

  delete (window as Window & { ontouchstart?: unknown }).ontouchstart
}

describe('detectStageMode', () => {
  beforeEach(() => {
    setTouchEnvironment(false)
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    setTouchStartSupport(false)
  })

  it('keeps desktop mode for large layouts even when touch is available', () => {
    setTouchEnvironment(true)
    expect(detectStageMode(1180, 820)).toBe('desktop')
  })

  it('detects mobile landscape on phone-sized touch layouts', () => {
    setTouchEnvironment(true)
    setTouchStartSupport(true)
    expect(detectStageMode(844, 390)).toBe('mobile-landscape')
  })

  it('detects portrait blocking on phone-sized touch layouts', () => {
    setTouchEnvironment(true)
    setTouchStartSupport(true)
    expect(detectStageMode(390, 844)).toBe('mobile-portrait-blocked')
  })

  it('treats phone-sized Android device emulation as mobile even without touch APIs', () => {
    setTouchEnvironment(false)
    setUserAgent(
      'Mozilla/5.0 (Linux; Android 10; Samsung Galaxy S20) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36'
    )

    expect(detectStageMode(915, 412)).toBe('mobile-landscape')
  })

  it('treats phone-sized viewport previews as mobile even without touch or handset signals', () => {
    setTouchEnvironment(false)
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')

    expect(detectStageMode(915, 412)).toBe('mobile-landscape')
  })

  it('publishes the pending mobile stage mode immediately while the phone layout is settling', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 })

    const { result } = renderHook(() => useStageMode())

    expect(result.current.stageMode).toBe('desktop')
    expect(result.current.isSettling).toBe(false)

    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 915 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 412 })

    act(() => {
      window.dispatchEvent(new Event('resize'))
    })

    await waitFor(() => {
      expect(result.current.stageMode).toBe('mobile-landscape')
      expect(result.current.isSettling).toBe(true)
    })
  })
})
