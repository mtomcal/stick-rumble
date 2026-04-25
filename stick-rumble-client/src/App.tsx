import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { PhaserGame } from './ui/common/PhaserGame'
import { MatchEndScreen } from './ui/match/MatchEndScreen'
import { DebugNetworkPanel } from './ui/debug/DebugNetworkPanel'
import { WebSocketClient } from './game/network/WebSocketClient'
import type { MatchBootstrap } from './game/sessionRuntime'
import {
  applyJoinError,
  applyMatchEnd,
  applyReconnectReplayFailed,
  applySessionStatus,
  beginJoin,
  beginReplay,
  createInitialSessionFlowState,
  returnToJoinForm,
  type AppViewState,
  type MatchSessionFlowState,
} from './game/sessionFlow'
import type {
  GameplayViewportLayout,
  JoinErrorPayload,
  JoinIntent,
  MatchEndData,
  StageMode,
  SessionStatusData,
} from './shared/types'
import type { NetworkSimulatorStats } from './game/network/NetworkSimulator'
import { buildInviteLink, formatReconnectLabel, getInviteCodeFromLocation, getWebSocketUrl } from './game/config/runtimeConfig'
import { useStageMode } from './ui/common/mobileMode'
import {
  buildGameplayViewportLayout,
  getHudFrame,
  getLogicalViewportSize,
} from './game/config/viewport'
import { MobileControls } from './ui/mobile/MobileControls'
import { RotateDeviceGate } from './ui/mobile/RotateDeviceGate'
import './App.css'

const DEFAULT_STATS: NetworkSimulatorStats = {
  enabled: false,
  latency: 0,
  packetLoss: 0,
}

const DISPLAY_NAME_STORAGE_KEY = 'stick-rumble.display-name'
const DUPLICATE_TAB_TTL_MS = 5000
const DUPLICATE_TAB_HEARTBEAT_MS = 2000

type OverlayMode = 'join' | 'duplicate'

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  const storage = window.localStorage as Partial<Storage> | undefined
  if (
    storage &&
    typeof storage.getItem === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function' &&
    typeof storage.clear === 'function'
  ) {
    return window.localStorage
  }

  return null
}

function formatJoinError(error: JoinErrorPayload | null, currentCode: string): string | null {
  if (!error) {
    return null
  }

  if (error.type === 'error:bad_room_code') {
    return `Bad room code: ${error.reason ?? 'invalid'}.`
  }
  if (error.type === 'error:room_full') {
    return `Room ${error.code ?? currentCode} is full.`
  }
  return `Server rejected ${error.offendingType ?? 'message'} before hello.`
}

function readPixelValue(value: string): number {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function buildViewportLayout(
  stageElement: HTMLElement,
  stageMode: StageMode,
  viewportWidth: number,
  viewportHeight: number
): GameplayViewportLayout {
  const style = window.getComputedStyle(stageElement)
  const paddingTop = readPixelValue(style.paddingTop)
  const paddingRight = readPixelValue(style.paddingRight)
  const paddingBottom = readPixelValue(style.paddingBottom)
  const paddingLeft = readPixelValue(style.paddingLeft)
  const viewportInsetTop = readPixelValue(style.getPropertyValue('--viewport-inset-top'))
  const viewportInsetRight = readPixelValue(style.getPropertyValue('--viewport-inset-right'))
  const viewportInsetBottom = readPixelValue(style.getPropertyValue('--viewport-inset-bottom'))
  const viewportInsetLeft = readPixelValue(style.getPropertyValue('--viewport-inset-left'))
  const contentWidth = Math.max(stageElement.clientWidth - paddingLeft - paddingRight, 1)
  const contentHeight = Math.max(stageElement.clientHeight - paddingTop - paddingBottom, 1)

  return buildGameplayViewportLayout({
    stageMode,
    viewportWidth,
    viewportHeight,
    contentWidth,
    contentHeight,
    padding: {
      top: paddingTop + viewportInsetTop,
      right: paddingRight + viewportInsetRight,
      bottom: paddingBottom + viewportInsetBottom,
      left: paddingLeft + viewportInsetLeft,
    },
  })
}

function buildInitialViewportLayout(
  stageMode: StageMode,
  viewportWidth: number,
  viewportHeight: number
): GameplayViewportLayout {
  const logicalViewport = getLogicalViewportSize(stageMode, viewportWidth, viewportHeight)

  return {
    mode: stageMode,
    width: logicalViewport.width,
    height: logicalViewport.height,
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    hudFrame: getHudFrame(logicalViewport.width, logicalViewport.height),
  }
}

function App() {
  const stageShellRef = useRef<HTMLDivElement | null>(null)
  const inviteCode = useMemo(() => getInviteCodeFromLocation(), [])
  const initialSavedDisplayName = useMemo(
    () => getBrowserStorage()?.getItem(DISPLAY_NAME_STORAGE_KEY) ?? '',
    []
  )
  const [activeClient] = useState(() => new WebSocketClient(getWebSocketUrl(), false))
  const clientRef = useRef<WebSocketClient | null>(activeClient)
  const [tabId] = useState(() => `tab-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`)
  const claimIntervalRef = useRef<number | null>(null)
  const claimedInviteKeyRef = useRef<string | null>(null)
  const autoJoinAttemptedRef = useRef(false)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)
  const duplicateBlockedKeyRef = useRef<string | null>(null)
  const displayNameDirtyRef = useRef(false)

  const [sessionFlow, setSessionFlow] = useState(() => createInitialSessionFlowState())
  const [isSocketReady, setIsSocketReady] = useState(false)
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('join')
  const [debugPanelVisible, setDebugPanelVisible] = useState(false)
  const [networkStats, setNetworkStats] = useState<NetworkSimulatorStats>(DEFAULT_STATS)
  const { stageMode, width: viewportWidth, height: viewportHeight, isSettling } = useStageMode()
  const [mobileGameplayEntered, setMobileGameplayEntered] = useState(false)
  const [viewportLayout, setViewportLayoutState] = useState<GameplayViewportLayout>({
    ...buildInitialViewportLayout(stageMode, viewportWidth, viewportHeight),
  })
  const [joinForm, setJoinForm] = useState(() => ({
    displayName: initialSavedDisplayName,
    code: inviteCode ?? '',
  }))

  const viewState: AppViewState = sessionFlow.viewState
  const sessionStatus = sessionFlow.sessionStatus
  const matchEndData = sessionFlow.matchEndData
  const localPlayerId = sessionFlow.localPlayerId
  const joinError = sessionFlow.joinError
  const reconnectIntent = sessionFlow.reconnectIntent
  const matchBootstrap: MatchBootstrap | null =
    sessionFlow.matchSession && activeClient
      ? { session: sessionFlow.matchSession, wsClient: activeClient }
      : null

  const captureCurrentViewportLayout = useCallback((): GameplayViewportLayout | null => {
    if (!stageShellRef.current) {
      return null
    }

    return buildViewportLayout(stageShellRef.current, stageMode, viewportWidth, viewportHeight)
  }, [stageMode, viewportWidth, viewportHeight])

  const getClient = useCallback(() => clientRef.current, [])

  const updateSessionFlow = useCallback((recipe: (state: MatchSessionFlowState) => MatchSessionFlowState) => {
    setSessionFlow((prev) => {
      const next = recipe(prev)
      if (next.shouldResetMobileEntry) {
        setMobileGameplayEntered(false)
      }
      return next
    })
  }, [])

  const getNetworkStats = useCallback(() => {
    if (window.getNetworkSimulatorStats) {
      return window.getNetworkSimulatorStats()
    }
    return null
  }, [])

  const releaseInviteClaim = useCallback(() => {
    if (claimIntervalRef.current !== null) {
      window.clearInterval(claimIntervalRef.current)
      claimIntervalRef.current = null
    }
    if (claimedInviteKeyRef.current) {
      getBrowserStorage()?.removeItem(claimedInviteKeyRef.current)
      try {
        broadcastChannelRef.current?.postMessage({ type: 'release', key: claimedInviteKeyRef.current })
      } catch {
        // Ignore closed-channel races during teardown.
      }
      claimedInviteKeyRef.current = null
    }
  }, [])

  const claimInviteSlot = useCallback((intent: JoinIntent): boolean => {
    releaseInviteClaim()

    if (intent.mode !== 'code' || !intent.code || !intent.displayName?.trim()) {
      return true
    }

    const normalizedDisplayName = intent.displayName.trim().toLowerCase()
    const normalizedCode = intent.code.trim().toUpperCase()
    const key = `stick-rumble.active-invite.${normalizedCode}.${normalizedDisplayName}`
    duplicateBlockedKeyRef.current = key
    const now = Date.now()
    const storage = getBrowserStorage()
    const current = storage?.getItem(key)
    if (current) {
      try {
        const parsed = JSON.parse(current) as { owner: string; updatedAt: number }
        if (parsed.owner !== tabId && now - parsed.updatedAt < DUPLICATE_TAB_TTL_MS) {
          setOverlayMode('duplicate')
          return false
        }
      } catch {
        // Ignore malformed stale claims and replace them.
      }
    }

    const writeClaim = () => {
      storage?.setItem(key, JSON.stringify({ owner: tabId, updatedAt: Date.now() }))
    }

    writeClaim()
    broadcastChannelRef.current?.postMessage({ type: 'claim', key })
    claimedInviteKeyRef.current = key
    duplicateBlockedKeyRef.current = null
    claimIntervalRef.current = window.setInterval(writeClaim, DUPLICATE_TAB_HEARTBEAT_MS)
    return true
  }, [releaseInviteClaim, tabId])

  const submitJoinIntent = useCallback((intent: JoinIntent) => {
    const client = getClient()
    if (!client || !isSocketReady) {
      return
    }

    if (!claimInviteSlot(intent)) {
      return
    }

    setOverlayMode('join')
    updateSessionFlow((prev) => beginJoin(prev))
    client.setGameplayReady(false)
    client.sendHello(intent)
  }, [claimInviteSlot, getClient, isSocketReady, updateSessionFlow])

  useEffect(() => {
    const client = activeClient
    clientRef.current = client
    client.setConnectionStateHandler((connected) => {
      setIsSocketReady(connected)
    })
    client.setReconnectReplayFailedHandler((intent) => {
      updateSessionFlow((prev) => applyReconnectReplayFailed(prev, intent))
    })

    const onSessionStatus = (payload: unknown) => {
      const status = payload as SessionStatusData
      setJoinForm((prev) => ({ ...prev, displayName: status.displayName, code: status.code ?? prev.code }))
      getBrowserStorage()?.setItem(DISPLAY_NAME_STORAGE_KEY, status.displayName)
      updateSessionFlow((prev) => applySessionStatus(prev, status))
    }

    const onBadRoomCode = (payload: unknown) => {
      updateSessionFlow((prev) => applyJoinError(prev, {
        type: 'error:bad_room_code',
        reason: (payload as { reason?: string })?.reason,
      }))
    }

    const onRoomFull = (payload: unknown) => {
      updateSessionFlow((prev) => applyJoinError(prev, {
        type: 'error:room_full',
        code: (payload as { code?: string })?.code,
      }))
    }

    const onNoHello = (payload: unknown) => {
      updateSessionFlow((prev) => applyJoinError(prev, {
        type: 'error:no_hello',
        offendingType: (payload as { offendingType?: string })?.offendingType,
      }))
    }

    client.on('session:status', onSessionStatus)
    client.on('error:bad_room_code', onBadRoomCode)
    client.on('error:room_full', onRoomFull)
    client.on('error:no_hello', onNoHello)

    client.connect().catch(() => {
      // Initial socket failures are transport state, not a server-side join rejection.
      // The overlay already renders a connection-status message while the client retries.
    })

    return () => {
      client.off('session:status', onSessionStatus)
      client.off('error:bad_room_code', onBadRoomCode)
      client.off('error:room_full', onRoomFull)
      client.off('error:no_hello', onNoHello)
      client.setConnectionStateHandler(undefined)
      client.disconnect()
      clientRef.current = null
    }
  }, [activeClient, updateSessionFlow])

  useEffect(() => {
    window.onNetworkSimulatorToggle = () => {
      const stats = getNetworkStats()
      if (stats) {
        setNetworkStats(stats)
      }
      setDebugPanelVisible((prev) => !prev)
    }

    return () => {
      delete window.onNetworkSimulatorToggle
    }
  }, [getNetworkStats])

  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannelRef.current = new BroadcastChannel('stick-rumble-invite-claims')
      broadcastChannelRef.current.onmessage = (event: MessageEvent<{ type: string; key: string }>) => {
        if (!event.data?.key) {
          return
        }

        if (event.data.type === 'release' && duplicateBlockedKeyRef.current === event.data.key) {
          setOverlayMode('join')
        }
      }
    }

    const onStorage = (event: StorageEvent) => {
      if (!event.key) {
        return
      }

      const trackedKey = claimedInviteKeyRef.current ?? duplicateBlockedKeyRef.current
      if (!trackedKey || event.key !== trackedKey) {
        return
      }

      if (!event.newValue) {
        if (duplicateBlockedKeyRef.current === trackedKey) {
          setOverlayMode('join')
        }
        return
      }

      try {
        const parsed = JSON.parse(event.newValue) as { owner: string }
        if (parsed.owner !== tabId) {
          setOverlayMode('duplicate')
        }
      } catch {
        // Ignore malformed storage noise.
      }
    }

    window.addEventListener('storage', onStorage)
    return () => {
      broadcastChannelRef.current?.close()
      window.removeEventListener('storage', onStorage)
      releaseInviteClaim()
    }
  }, [releaseInviteClaim, tabId])

  useEffect(() => {
    const hasPrefilledDisplayName = initialSavedDisplayName.trim().length > 0
    if (
      !inviteCode ||
      !hasPrefilledDisplayName ||
      displayNameDirtyRef.current ||
      autoJoinAttemptedRef.current ||
      !isSocketReady
    ) {
      return
    }

    autoJoinAttemptedRef.current = true
    const frameId = window.requestAnimationFrame(() => {
      submitJoinIntent({
        displayName: initialSavedDisplayName,
        mode: 'code',
        code: inviteCode,
      })
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [initialSavedDisplayName, inviteCode, isSocketReady, submitJoinIntent])

  const handleMatchEnd = useCallback((data: MatchEndData, playerId: string) => {
    updateSessionFlow((prev) => applyMatchEnd(prev, data, playerId))
  }, [updateSessionFlow])

  const handleCancelWaiting = useCallback(() => {
    const client = getClient()
    client?.sendSessionLeave()
    releaseInviteClaim()
    updateSessionFlow((prev) => returnToJoinForm(prev))
  }, [getClient, releaseInviteClaim, updateSessionFlow])

  const handlePlayAgain = useCallback(() => {
    const client = getClient()
    if (!client) {
      return
    }

    const lastIntent = reconnectIntent ?? {
      displayName: sessionStatus?.displayName ?? joinForm.displayName,
      mode: sessionStatus?.joinMode ?? (joinForm.code.trim() ? 'code' : 'public'),
      code: sessionStatus?.code ?? (joinForm.code.trim() || undefined),
    }

    updateSessionFlow((prev) => beginReplay(prev))
    client.restartSession(lastIntent)
  }, [getClient, joinForm.code, joinForm.displayName, reconnectIntent, sessionStatus, updateSessionFlow])

  const handleLatencyChange = (latency: number) => {
    if (window.setNetworkSimulatorLatency) {
      window.setNetworkSimulatorLatency(latency)
      setNetworkStats((prev) => ({ ...prev, latency }))
    }
  }

  const handlePacketLossChange = (packetLoss: number) => {
    if (window.setNetworkSimulatorPacketLoss) {
      window.setNetworkSimulatorPacketLoss(packetLoss)
      setNetworkStats((prev) => ({ ...prev, packetLoss }))
    }
  }

  const handleEnabledChange = (enabled: boolean) => {
    if (window.setNetworkSimulatorEnabled) {
      window.setNetworkSimulatorEnabled(enabled)
      setNetworkStats((prev) => ({ ...prev, enabled }))
    }
  }

  const copyInviteLink = async () => {
    if (!sessionStatus?.code) {
      return
    }

    const link = buildInviteLink(sessionStatus.code)
    await navigator.clipboard?.writeText(link)
  }

  const errorText = formatJoinError(joinError, joinForm.code)
  const shouldShowGameplayStage = viewState === 'in_match' && matchBootstrap
  const shouldRenderPhaser =
    shouldShowGameplayStage &&
    (stageMode === 'desktop' || mobileGameplayEntered)
  const inMobileStage = shouldShowGameplayStage && stageMode !== 'desktop'

  useEffect(() => {
    if (!shouldRenderPhaser || !stageShellRef.current) {
      return undefined
    }

    const updateViewportLayout = () => {
      if (!stageShellRef.current) {
        return
      }
      setViewportLayoutState(buildViewportLayout(stageShellRef.current, stageMode, viewportWidth, viewportHeight))
    }

    updateViewportLayout()
    window.addEventListener('resize', updateViewportLayout)

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => updateViewportLayout())
        : null
    resizeObserver?.observe(stageShellRef.current)

    return () => {
      window.removeEventListener('resize', updateViewportLayout)
      resizeObserver?.disconnect()
    }
  }, [shouldRenderPhaser, stageMode, viewportWidth, viewportHeight])

  return (
    <div className={`app-shell${inMobileStage ? ' app-shell--mobile-stage' : ''}`}>
      <div className={`app-header${inMobileStage ? ' app-header--hidden' : ''}`}>
        <h1>Stick Rumble - Multiplayer Arena Shooter</h1>
      </div>

      <div className={`app-container${inMobileStage ? ' app-container--mobile-stage' : ''}`}>
        {shouldShowGameplayStage && matchBootstrap && (
          <div
            ref={stageShellRef}
            className={`game-frame game-frame--${stageMode}`}
            data-testid="stage-shell"
            data-stage-mode={stageMode}
          >
            {shouldRenderPhaser ? (
              <>
                <PhaserGame
                  bootstrap={matchBootstrap}
                  layout={viewportLayout.mode === stageMode ? viewportLayout : { ...viewportLayout, mode: stageMode }}
                  onMatchEnd={handleMatchEnd}
                />
                {stageMode === 'mobile-landscape' ? <MobileControls /> : null}
              </>
            ) : null}
            {stageMode === 'mobile-portrait-blocked' || (stageMode !== 'desktop' && isSettling) ? (
              <RotateDeviceGate />
            ) : null}
            {stageMode === 'mobile-landscape' && !isSettling && !mobileGameplayEntered ? (
              <RotateDeviceGate
                title="Enter Game"
                body="Landscape is ready. Tap to enter with the final phone viewport."
                actionLabel="Enter Game"
                onAction={() => {
                  const nextLayout = captureCurrentViewportLayout()
                  if (nextLayout) {
                    setViewportLayoutState(nextLayout)
                  }
                  setMobileGameplayEntered(true)
                }}
              />
            ) : null}
          </div>
        )}

        {overlayMode === 'duplicate' ? (
          <div className="overlay-card">
            <h2>Invite Already Open</h2>
            <p>This browser profile already claimed this invite in another tab. Return to the original tab to keep playing.</p>
          </div>
        ) : null}

        {overlayMode === 'join' && (viewState === 'join_form' || viewState === 'joining' || viewState === 'recoverable_error') && (
          <div className="overlay-card">
            <h2>{inviteCode ? 'Join Invite' : 'Enter Match'}</h2>
            <label>
              Display Name
              <input
                aria-label="Display Name"
                className="overlay-card__input"
                value={joinForm.displayName}
                onChange={(event) => {
                  displayNameDirtyRef.current = true
                  setJoinForm((prev) => ({ ...prev, displayName: event.target.value }))
                }}
                placeholder="Guest"
              />
            </label>
            <label>
              Room Code
              <input
                aria-label="Room Code"
                className="overlay-card__input"
                value={joinForm.code}
                onChange={(event) => setJoinForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="PIZZA"
              />
            </label>
            {errorText ? <p className="overlay-error">{errorText}</p> : null}
            {!isSocketReady ? <p className="overlay-status">Connecting to game...</p> : null}
            {viewState === 'joining' ? <p className="overlay-status">Joining...</p> : null}
            {reconnectIntent ? <p className="overlay-status">Reconnect failed. Choose a new action.</p> : null}
            <div className="overlay-actions">
              <button
                className="overlay-card__button"
                disabled={!isSocketReady || viewState === 'joining'}
                onClick={() => submitJoinIntent({ displayName: joinForm.displayName, mode: 'public' })}
              >
                Play Public
              </button>
              <button
                className="overlay-card__button"
                disabled={!isSocketReady || viewState === 'joining'}
                onClick={() => submitJoinIntent({ displayName: joinForm.displayName, mode: 'code', code: joinForm.code })}
              >
                Join with Code
              </button>
            </div>
            {reconnectIntent ? (
              <div className="overlay-actions">
                <button className="overlay-card__button" onClick={() => submitJoinIntent(reconnectIntent)}>
                  {formatReconnectLabel(reconnectIntent)}
                </button>
                <button
                  className="overlay-card__button"
                  onClick={() => submitJoinIntent({ displayName: joinForm.displayName, mode: 'public' })}
                >
                  Play Public
                </button>
              </div>
            ) : null}
          </div>
        )}

        {viewState === 'searching_for_match' && sessionStatus ? (
          <div className="overlay-card">
            <h2>Searching For Match</h2>
            <p>Display Name: {sessionStatus.displayName}</p>
            <button onClick={handleCancelWaiting}>Back</button>
          </div>
        ) : null}

        {viewState === 'waiting_for_players' && sessionStatus ? (
          <div className="overlay-card">
            <h2>Waiting For Players</h2>
            <p>Display Name: {sessionStatus.displayName}</p>
            <p>Room Code: {sessionStatus.code}</p>
            <p>Players: {sessionStatus.rosterSize ?? 0}/{sessionStatus.minPlayers ?? 2}</p>
            <div className="overlay-actions">
              <button onClick={() => void copyInviteLink()}>Copy Invite Link</button>
              <button onClick={handleCancelWaiting}>Cancel</button>
            </div>
          </div>
        ) : null}

        {viewState === 'match_end' && matchEndData ? (
          <MatchEndScreen
            matchData={matchEndData}
            localPlayerId={localPlayerId}
            onClose={() => {
              updateSessionFlow((prev) => returnToJoinForm(prev))
            }}
            onPlayAgain={handlePlayAgain}
          />
        ) : null}
      </div>

      <DebugNetworkPanel
        isVisible={debugPanelVisible}
        onClose={() => setDebugPanelVisible(false)}
        stats={networkStats}
        onLatencyChange={handleLatencyChange}
        onPacketLossChange={handlePacketLossChange}
        onEnabledChange={handleEnabledChange}
      />
    </div>
  )
}

export default App
