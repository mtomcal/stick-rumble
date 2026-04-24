import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getMobilePickupAction,
  getMobileGameplayIntent,
  getViewportLayout,
  setMobilePickupAction,
  setMobileGameplayIntent,
  setViewportLayout,
  subscribeMobilePickupAction,
  subscribeMobileGameplayIntent,
  subscribeViewportLayout,
} from './sessionRuntime'

describe('sessionRuntime', () => {
  beforeEach(() => {
    setMobilePickupAction(null)
    setMobileGameplayIntent(null)
    setViewportLayout({
      mode: 'desktop',
      width: 1280,
      height: 720,
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      hudFrame: { x: 0, y: 0, width: 1280, height: 720 },
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
      width: 1558,
      height: 720,
      insets: { top: 12, right: 18, bottom: 24, left: 18 },
      hudFrame: { x: 139, y: 0, width: 1280, height: 720 },
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
      hudFrame: { x: 0, y: 0, width: 1280, height: 720 },
    })

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('replays the current mobile pickup action to new subscribers and stops after unsubscribe', () => {
    setMobilePickupAction({
      crateId: 'crate-1',
      weaponType: 'AK47',
    })

    const listener = vi.fn()
    const unsubscribe = subscribeMobilePickupAction(listener)

    expect(listener).toHaveBeenCalledWith(getMobilePickupAction())

    unsubscribe()
    setMobilePickupAction(null)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('returns defensive copies for bridge getters and subscriber payloads', () => {
    setMobileGameplayIntent({
      up: true,
      down: false,
      left: false,
      right: false,
      aimAngle: Math.PI / 4,
      isSprinting: false,
      fireActive: true,
    })
    setViewportLayout({
      mode: 'mobile-landscape',
      width: 844,
      height: 390,
      insets: { top: 12, right: 16, bottom: 20, left: 16 },
      hudFrame: { x: 0, y: 0, width: 844, height: 390 },
    })
    setMobilePickupAction({
      crateId: 'crate-1',
      weaponType: 'AK47',
    })

    const intent = getMobileGameplayIntent()
    const layout = getViewportLayout()
    const pickup = getMobilePickupAction()

    intent!.up = false
    intent!.aimAngle = 0
    layout.width = 1280
    layout.insets.top = 0
    pickup!.weaponType = 'SHOTGUN'

    expect(getMobileGameplayIntent()).toEqual({
      up: true,
      down: false,
      left: false,
      right: false,
      aimAngle: Math.PI / 4,
      isSprinting: false,
      fireActive: true,
    })
    expect(getViewportLayout()).toEqual({
      mode: 'mobile-landscape',
      width: 844,
      height: 390,
      insets: { top: 12, right: 16, bottom: 20, left: 16 },
      hudFrame: { x: 0, y: 0, width: 844, height: 390 },
    })
    expect(getMobilePickupAction()).toEqual({
      crateId: 'crate-1',
      weaponType: 'AK47',
    })
  })
})
