import type { WebSocketClient } from './network/WebSocketClient'
import type {
  GameplayIntentState,
  GameplayViewportLayout,
  MatchSession,
} from '../shared/types'

export interface MatchBootstrap {
  session: MatchSession
  wsClient: WebSocketClient
}

export interface MobilePickupAction {
  crateId: string
  weaponType: string
}

let activeMatchBootstrap: MatchBootstrap | null = null
let mobileGameplayIntent: GameplayIntentState | null = null
let mobilePickupAction: MobilePickupAction | null = null
let viewportLayout: GameplayViewportLayout = {
  mode: 'desktop',
  width: 1280,
  height: 720,
  insets: {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  hudFrame: {
    x: 0,
    y: 0,
    width: 1280,
    height: 720,
  },
}
const mobileIntentListeners = new Set<(intent: GameplayIntentState | null) => void>()
const mobilePickupActionListeners = new Set<(pickup: MobilePickupAction | null) => void>()
const viewportLayoutListeners = new Set<(layout: GameplayViewportLayout) => void>()
const runtimeActionListeners = new Set<(action: 'reload' | 'dodge' | 'pickup') => void>()

export function setActiveMatchBootstrap(bootstrap: MatchBootstrap | null): void {
  activeMatchBootstrap = bootstrap
}

export function getActiveMatchBootstrap(): MatchBootstrap | null {
  return activeMatchBootstrap
}

export function setMobileGameplayIntent(intent: GameplayIntentState | null): void {
  mobileGameplayIntent = intent ? { ...intent } : null
  mobileIntentListeners.forEach((listener) => listener(mobileGameplayIntent ? { ...mobileGameplayIntent } : null))
}

export function getMobileGameplayIntent(): GameplayIntentState | null {
  return mobileGameplayIntent ? { ...mobileGameplayIntent } : null
}

export function setMobilePickupAction(pickup: MobilePickupAction | null): void {
  mobilePickupAction = pickup ? { ...pickup } : null
  mobilePickupActionListeners.forEach((listener) => listener(getMobilePickupAction()))
}

export function getMobilePickupAction(): MobilePickupAction | null {
  return mobilePickupAction ? { ...mobilePickupAction } : null
}

export function subscribeMobileGameplayIntent(
  listener: (intent: GameplayIntentState | null) => void
): () => void {
  mobileIntentListeners.add(listener)
  listener(getMobileGameplayIntent())
  return () => {
    mobileIntentListeners.delete(listener)
  }
}

export function subscribeMobilePickupAction(
  listener: (pickup: MobilePickupAction | null) => void
): () => void {
  mobilePickupActionListeners.add(listener)
  listener(getMobilePickupAction())
  return () => {
    mobilePickupActionListeners.delete(listener)
  }
}

export function triggerRuntimeAction(action: 'reload' | 'dodge' | 'pickup'): void {
  runtimeActionListeners.forEach((listener) => listener(action))
}

export function subscribeRuntimeAction(
  listener: (action: 'reload' | 'dodge' | 'pickup') => void
): () => void {
  runtimeActionListeners.add(listener)
  return () => {
    runtimeActionListeners.delete(listener)
  }
}

export function setViewportLayout(layout: GameplayViewportLayout): void {
  viewportLayout = {
    mode: layout.mode,
    width: layout.width,
    height: layout.height,
    insets: { ...layout.insets },
    hudFrame: { ...layout.hudFrame },
  }
  viewportLayoutListeners.forEach((listener) => listener(getViewportLayout()))
}

export function getViewportLayout(): GameplayViewportLayout {
  return {
    mode: viewportLayout.mode,
    width: viewportLayout.width,
    height: viewportLayout.height,
    insets: { ...viewportLayout.insets },
    hudFrame: { ...viewportLayout.hudFrame },
  }
}

export function subscribeViewportLayout(
  listener: (layout: GameplayViewportLayout) => void
): () => void {
  viewportLayoutListeners.add(listener)
  listener(getViewportLayout())
  return () => {
    viewportLayoutListeners.delete(listener)
  }
}
