import { useEffect, useState } from 'react'
import type { StageMode } from '../../shared/types'

const MAX_PHONE_SHORT_EDGE = 540
const MAX_PHONE_LONG_EDGE = 960
const MOBILE_STAGE_SETTLE_MS = 180

export interface DeviceViewportSnapshot {
  width: number
  height: number
  stageMode: StageMode
  isTouchPhoneLayout: boolean
  isSettling: boolean
}

function getViewportWidth(): number {
  return window.innerWidth
}

function getViewportHeight(): number {
  return window.innerHeight
}

export function detectStageMode(width: number, height: number): StageMode {
  const shortEdge = Math.min(width, height)
  const longEdge = Math.max(width, height)
  const isPhoneSized = shortEdge <= MAX_PHONE_SHORT_EDGE && longEdge <= MAX_PHONE_LONG_EDGE

  if (!isPhoneSized) {
    return 'desktop'
  }

  return width >= height ? 'mobile-landscape' : 'mobile-portrait-blocked'
}

function readSnapshot(): DeviceViewportSnapshot {
  const width = getViewportWidth()
  const height = getViewportHeight()
  const stageMode = detectStageMode(width, height)

  return {
    width,
    height,
    stageMode,
    isTouchPhoneLayout: stageMode !== 'desktop',
    isSettling: false,
  }
}

export function useStageMode(): DeviceViewportSnapshot {
  const [snapshot, setSnapshot] = useState<DeviceViewportSnapshot>(() =>
    typeof window === 'undefined'
      ? { width: 1280, height: 720, stageMode: 'desktop', isTouchPhoneLayout: false, isSettling: false }
      : readSnapshot()
  )

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    let settleTimeout: number | null = null
    let stableSnapshot = readSnapshot()

    const updateSnapshot = () => {
      const nextSnapshot = readSnapshot()
      const isPhoneModeTransition = nextSnapshot.stageMode !== 'desktop' || stableSnapshot.stageMode !== 'desktop'

      if (!isPhoneModeTransition) {
        stableSnapshot = nextSnapshot
        setSnapshot(nextSnapshot)
        return
      }

      if (settleTimeout !== null) {
        window.clearTimeout(settleTimeout)
      }

      setSnapshot({
        ...nextSnapshot,
        isSettling: true,
      })

      settleTimeout = window.setTimeout(() => {
        stableSnapshot = nextSnapshot
        setSnapshot({
          ...nextSnapshot,
          isSettling: false,
        })
        settleTimeout = null
      }, MOBILE_STAGE_SETTLE_MS)
    }

    window.addEventListener('resize', updateSnapshot)
    return () => {
      if (settleTimeout !== null) {
        window.clearTimeout(settleTimeout)
      }
      window.removeEventListener('resize', updateSnapshot)
    }
  }, [])

  return snapshot
}
