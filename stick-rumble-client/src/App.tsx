import { useState, useEffect, useCallback, useRef } from 'react'
import { PhaserGame } from './ui/common/PhaserGame'
import { MatchEndScreen } from './ui/match/MatchEndScreen'
import { DebugNetworkPanel } from './ui/debug/DebugNetworkPanel'
import type { GameplayViewportLayout, StageMode } from './shared/types'
import type { NetworkSimulatorStats } from './game/network/NetworkSimulator'
import { useStageMode } from './ui/common/mobileMode'
import {
  buildGameplayViewportLayout,
  getHudFrame,
  getLogicalViewportSize,
} from './game/config/viewport'
import { MobileControls } from './ui/mobile/MobileControls'
import { RotateDeviceGate } from './ui/mobile/RotateDeviceGate'
import { useMatchAppShell } from './game/useMatchAppShell'
import './App.css'

const DEFAULT_STATS: NetworkSimulatorStats = {
  enabled: false,
  latency: 0,
  packetLoss: 0,
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
  const [debugPanelVisible, setDebugPanelVisible] = useState(false)
  const [networkStats, setNetworkStats] = useState<NetworkSimulatorStats>(DEFAULT_STATS)
  const { stageMode, width: viewportWidth, height: viewportHeight, isSettling } = useStageMode()
  const shell = useMatchAppShell()
  const [viewportLayout, setViewportLayoutState] = useState<GameplayViewportLayout>({
    ...buildInitialViewportLayout(stageMode, viewportWidth, viewportHeight),
  })

  const captureCurrentViewportLayout = useCallback((): GameplayViewportLayout | null => {
    if (!stageShellRef.current) {
      return null
    }

    return buildViewportLayout(stageShellRef.current, stageMode, viewportWidth, viewportHeight)
  }, [stageMode, viewportWidth, viewportHeight])

  const getNetworkStats = useCallback(() => {
    if (window.getNetworkSimulatorStats) {
      return window.getNetworkSimulatorStats()
    }
    return null
  }, [])

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

  const shouldShowGameplayStage = shell.viewState === 'in_match' && shell.matchBootstrap
  const shouldRenderPhaser =
    shouldShowGameplayStage &&
    (stageMode === 'desktop' || shell.mobileGameplayEntered)
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
        {shouldShowGameplayStage && shell.matchBootstrap && (
          <div
            ref={stageShellRef}
            className={`game-frame game-frame--${stageMode}`}
            data-testid="stage-shell"
            data-stage-mode={stageMode}
          >
            {shouldRenderPhaser ? (
              <>
                <PhaserGame
                  bootstrap={shell.matchBootstrap}
                  layout={viewportLayout.mode === stageMode ? viewportLayout : { ...viewportLayout, mode: stageMode }}
                  onMatchEnd={shell.actions.handleMatchEnd}
                />
                {stageMode === 'mobile-landscape' ? <MobileControls /> : null}
              </>
            ) : null}
            {stageMode === 'mobile-portrait-blocked' || (stageMode !== 'desktop' && isSettling) ? (
              <RotateDeviceGate />
            ) : null}
            {stageMode === 'mobile-landscape' && !isSettling && !shell.mobileGameplayEntered ? (
              <RotateDeviceGate
                title="Enter Game"
                body="Landscape is ready. Tap to enter with the final phone viewport."
                actionLabel="Enter Game"
                onAction={() => {
                  const nextLayout = captureCurrentViewportLayout()
                  if (nextLayout) {
                    setViewportLayoutState(nextLayout)
                  }
                  shell.actions.confirmMobileEntry()
                }}
              />
            ) : null}
          </div>
        )}

        {shell.overlayMode === 'duplicate' ? (
          <div className="overlay-card">
            <h2>Invite Already Open</h2>
            <p>This browser profile already claimed this invite in another tab. Return to the original tab to keep playing.</p>
          </div>
        ) : null}

        {shell.overlayMode === 'join' && (shell.viewState === 'join_form' || shell.viewState === 'joining' || shell.viewState === 'recoverable_error') ? (
          <div className="overlay-card">
            <h2>{shell.inviteCode ? 'Join Invite' : 'Enter Match'}</h2>
            <label>
              Display Name
              <input
                aria-label="Display Name"
                className="overlay-card__input"
                value={shell.joinForm.displayName}
                onChange={(event) => shell.actions.setDisplayName(event.target.value)}
                placeholder="Guest"
              />
            </label>
            <label>
              Room Code
              <input
                aria-label="Room Code"
                className="overlay-card__input"
                value={shell.joinForm.code}
                onChange={(event) => shell.actions.setRoomCode(event.target.value)}
                placeholder="PIZZA"
              />
            </label>
            {shell.errorText ? <p className="overlay-error">{shell.errorText}</p> : null}
            {!shell.isSocketReady ? <p className="overlay-status">Connecting to game...</p> : null}
            {shell.viewState === 'joining' ? <p className="overlay-status">Joining...</p> : null}
            {shell.reconnectIntent ? <p className="overlay-status">Reconnect failed. Choose a new action.</p> : null}
            <div className="overlay-actions">
              <button
                className="overlay-card__button"
                disabled={!shell.isSocketReady || shell.viewState === 'joining'}
                onClick={shell.actions.submitPublicJoin}
              >
                Play Public
              </button>
              <button
                className="overlay-card__button"
                disabled={!shell.isSocketReady || shell.viewState === 'joining'}
                onClick={shell.actions.submitCodeJoin}
              >
                Join with Code
              </button>
            </div>
            {shell.reconnectIntent ? (
              <div className="overlay-actions">
                <button className="overlay-card__button" onClick={shell.actions.submitReconnectIntent}>
                  {shell.reconnectLabel}
                </button>
                <button
                  className="overlay-card__button"
                  onClick={shell.actions.submitPublicJoin}
                >
                  Play Public
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {shell.viewState === 'searching_for_match' && shell.sessionStatus ? (
          <div className="overlay-card">
            <h2>Searching For Match</h2>
            <p>Display Name: {shell.sessionStatus.displayName}</p>
            <button onClick={shell.actions.cancelWaiting}>Back</button>
          </div>
        ) : null}

        {shell.viewState === 'waiting_for_players' && shell.sessionStatus ? (
          <div className="overlay-card">
            <h2>Waiting For Players</h2>
            <p>Display Name: {shell.sessionStatus.displayName}</p>
            <p>Room Code: {shell.sessionStatus.code}</p>
            <p>Players: {shell.sessionStatus.rosterSize ?? 0}/{shell.sessionStatus.minPlayers ?? 2}</p>
            <div className="overlay-actions">
              <button onClick={() => void shell.actions.copyInviteLink()}>Copy Invite Link</button>
              <button onClick={shell.actions.cancelWaiting}>Cancel</button>
            </div>
          </div>
        ) : null}

        {shell.viewState === 'match_end' && shell.matchEndData ? (
          <MatchEndScreen
            matchData={shell.matchEndData}
            localPlayerId={shell.localPlayerId}
            onClose={shell.actions.returnToJoinForm}
            onPlayAgain={shell.actions.playAgain}
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
