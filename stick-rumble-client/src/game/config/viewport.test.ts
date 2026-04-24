import { describe, expect, it } from 'vitest'
import {
  DESKTOP_VIEWPORT_HEIGHT,
  DESKTOP_VIEWPORT_WIDTH,
  buildGameplayViewportLayout,
  getHudFrame,
  getLogicalViewportSize,
} from './viewport'

describe('viewport layout helpers', () => {
  it('keeps the desktop baseline viewport outside mobile landscape', () => {
    expect(getLogicalViewportSize('desktop', 1280, 720)).toEqual({
      width: DESKTOP_VIEWPORT_WIDTH,
      height: DESKTOP_VIEWPORT_HEIGHT,
    })
    expect(getLogicalViewportSize('mobile-portrait-blocked', 390, 844)).toEqual({
      width: DESKTOP_VIEWPORT_WIDTH,
      height: DESKTOP_VIEWPORT_HEIGHT,
    })
  })

  it('uses the settled mobile landscape viewport dimensions directly', () => {
    expect(getLogicalViewportSize('mobile-landscape', 760, 390)).toEqual({
      width: 760,
      height: 390,
    })
    expect(getLogicalViewportSize('mobile-landscape', 844, 390)).toEqual({
      width: 844,
      height: 390,
    })
  })

  it('limits the HUD frame to the current logical viewport width', () => {
    expect(getHudFrame(1280, 720)).toEqual({ x: 0, y: 0, width: 1280, height: 720 })
    expect(getHudFrame(844, 390)).toEqual({ x: 0, y: 0, width: 844, height: 390 })
  })

  it('builds a fill-viewport mobile layout with viewport-scaled insets', () => {
    expect(
      buildGameplayViewportLayout({
        stageMode: 'mobile-landscape',
        viewportWidth: 844,
        viewportHeight: 390,
        contentWidth: 832,
        contentHeight: 378,
        padding: {
          top: 6,
          right: 6,
          bottom: 6,
          left: 6,
        },
      })
    ).toEqual({
      mode: 'mobile-landscape',
      width: 844,
      height: 390,
      insets: {
        top: 6,
        right: 6,
        bottom: 6,
        left: 6,
      },
      hudFrame: {
        x: 0,
        y: 0,
        width: 844,
        height: 390,
      },
    })
  })
})
