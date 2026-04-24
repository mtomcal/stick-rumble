import type { GameplayHudFrame, GameplayViewportLayout, StageMode, ViewportInsets } from '../../shared/types'

export const DESKTOP_VIEWPORT_WIDTH = 1280
export const DESKTOP_VIEWPORT_HEIGHT = 720
export const HUD_FRAME_MAX_WIDTH = DESKTOP_VIEWPORT_WIDTH

export interface ViewportPadding {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ViewportLayoutInput {
  stageMode: StageMode
  viewportWidth: number
  viewportHeight: number
  contentWidth: number
  contentHeight: number
  padding: ViewportPadding
}

export function getLogicalViewportSize(stageMode: StageMode, viewportWidth: number, viewportHeight: number): {
  width: number
  height: number
} {
  if (stageMode !== 'mobile-landscape') {
    return {
      width: DESKTOP_VIEWPORT_WIDTH,
      height: DESKTOP_VIEWPORT_HEIGHT,
    }
  }

  return {
    width: Math.max(Math.round(viewportWidth), 1),
    height: Math.max(Math.round(viewportHeight), 1),
  }
}

export function getHudFrame(width: number, height: number): GameplayHudFrame {
  const hudWidth = Math.min(width, HUD_FRAME_MAX_WIDTH)
  return {
    x: Math.round((width - hudWidth) / 2),
    y: 0,
    width: hudWidth,
    height,
  }
}

export function scaleViewportInsets(
  logicalWidth: number,
  logicalHeight: number,
  contentWidth: number,
  contentHeight: number,
  padding: ViewportPadding
): ViewportInsets {
  const safeContentWidth = Math.max(contentWidth, 1)
  const safeContentHeight = Math.max(contentHeight, 1)
  const viewportScale = Math.min(
    logicalWidth / safeContentWidth,
    logicalHeight / safeContentHeight
  )

  return {
    top: Math.round(padding.top * viewportScale),
    right: Math.round(padding.right * viewportScale),
    bottom: Math.round(padding.bottom * viewportScale),
    left: Math.round(padding.left * viewportScale),
  }
}

export function buildGameplayViewportLayout(input: ViewportLayoutInput): GameplayViewportLayout {
  const viewportSize = getLogicalViewportSize(input.stageMode, input.viewportWidth, input.viewportHeight)

  return {
    mode: input.stageMode,
    width: viewportSize.width,
    height: viewportSize.height,
    insets: scaleViewportInsets(
      viewportSize.width,
      viewportSize.height,
      input.contentWidth,
      input.contentHeight,
      input.padding
    ),
    hudFrame: getHudFrame(viewportSize.width, viewportSize.height),
  }
}
