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

  it('widens mobile landscape based on aspect ratio without an artificial max-width cap', () => {
    expect(getLogicalViewportSize('mobile-landscape', 760, 390)).toEqual({
      width: 1403,
      height: DESKTOP_VIEWPORT_HEIGHT,
    })
    expect(getLogicalViewportSize('mobile-landscape', 844, 390)).toEqual({
      width: 1558,
      height: DESKTOP_VIEWPORT_HEIGHT,
    })
  })

  it('centers the HUD frame inside widened world widths', () => {
    expect(getHudFrame(1280, 720)).toEqual({ x: 0, y: 0, width: 1280, height: 720 })
    expect(getHudFrame(1558, 720)).toEqual({ x: 139, y: 0, width: 1280, height: 720 })
  })

  it('builds a widened mobile layout with scaled insets and a constrained HUD frame', () => {
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
      width: 1558,
      height: 720,
      insets: {
        top: 11,
        right: 11,
        bottom: 11,
        left: 11,
      },
      hudFrame: {
        x: 139,
        y: 0,
        width: 1280,
        height: 720,
      },
    })
  })
})
