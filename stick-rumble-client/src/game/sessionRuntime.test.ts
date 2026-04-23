import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getMobileGameplayIntent,
  getViewportLayout,
  setMobileGameplayIntent,
  setViewportLayout,
  subscribeMobileGameplayIntent,
  subscribeViewportLayout,
} from './sessionRuntime'

describe('sessionRuntime', () => {
  beforeEach(() => {
    setMobileGameplayIntent(null)
    setViewportLayout({
      mode: 'desktop',
      width: 1280,
      height: 720,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    })
  })

  it('replays the current mobile intent to new subscribers and stops after unsubscribe', () => {
    setMobileGameplayIntent({
      up: true,
      down: false,
      left: false,
      right: false,
      aimAngle: Math.PI / 2,
      isSprinting: false,
      fireActive: true,
    })

    const listener = vi.fn()
    const unsubscribe = subscribeMobileGameplayIntent(listener)

    expect(listener).toHaveBeenCalledWith(getMobileGameplayIntent())

    unsubscribe()
    setMobileGameplayIntent(null)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('replays the current viewport layout to new subscribers and stops after unsubscribe', () => {
    setViewportLayout({
      mode: 'mobile-landscape',
      width: 1600,
      height: 900,
      insets: { top: 12, right: 18, bottom: 24, left: 18 },
    })

    const listener = vi.fn()
    const unsubscribe = subscribeViewportLayout(listener)

    expect(listener).toHaveBeenCalledWith(getViewportLayout())

    unsubscribe()
    setViewportLayout({
      mode: 'desktop',
      width: 1280,
      height: 720,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
    })

    expect(listener).toHaveBeenCalledTimes(1)
  })
})
