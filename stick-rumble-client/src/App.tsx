import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { PhaserGame } from './ui/common/PhaserGame'
import { MatchEndScreen } from './ui/match/MatchEndScreen'
import { DebugNetworkPanel } from './ui/debug/DebugNetworkPanel'
import type { MatchEndData, JoinErrorPayload, JoinIntent, JoinSuccessPayload } from './shared/types'
import type { NetworkSimulatorStats } from './game/network/NetworkSimulator'
import { buildInviteLink, formatReconnectLabel, getInviteCodeFromLocation } from './game/config/runtimeConfig'
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
const JOIN_BRIDGE_READY_EVENT = 'stick-rumble:submit-join-intent-ready'

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

function App() {
  const inviteCode = useMemo(() => getInviteCodeFromLocation(), [])
  const initialSavedDisplayName = useMemo(
    () => getBrowserStorage()?.getItem(DISPLAY_NAME_STORAGE_KEY) ?? '',
    []
  )
  const [tabId] = useState(() => `tab-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`)
  const claimIntervalRef = useRef<number | null>(null)
  const claimedInviteKeyRef = useRef<string | null>(null)
  const autoJoinAttemptedRef = useRef(false)
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null)
  const duplicateBlockedKeyRef = useRef<string | null>(null)
  const displayNameDirtyRef = useRef(false)

  const [matchEndData, setMatchEndData] = useState<MatchEndData | null>(null)
  const [localPlayerId, setLocalPlayerId] = useState<string>('')
  const [debugPanelVisible, setDebugPanelVisible] = useState(false)
  const [networkStats, setNetworkStats] = useState<NetworkSimulatorStats>(DEFAULT_STATS)
  const [joinError, setJoinError] = useState<JoinErrorPayload | null>(null)
  const [joinedRoom, setJoinedRoom] = useState<JoinSuccessPayload | null>(null)
  const [rosterSize, setRosterSize] = useState(0)
  const [reconnectIntent, setReconnectIntent] = useState<JoinIntent | null>(null)
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('join')
  const [isJoinBridgeReady, setIsJoinBridgeReady] = useState(() => typeof window.submitJoinIntent === 'function')
  const [isJoinPending, setIsJoinPending] = useState(false)
  const [joinBridgeReadyTick, setJoinBridgeReadyTick] = useState(0)
  const [joinForm, setJoinForm] = useState(() => {
    return {
      displayName: initialSavedDisplayName,
      code: inviteCode ?? '',
    }
  })

  const waitingForFriend = Boolean(joinedRoom?.code) && rosterSize < 2

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
        if (parsed.owner !== tabId && now-parsed.updatedAt < DUPLICATE_TAB_TTL_MS) {
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
    if (!window.submitJoinIntent) {
      setIsJoinBridgeReady(false)
      return
    }

    if (!claimInviteSlot(intent)) {
      return
    }

    setOverlayMode('join')
    setJoinError(null)
    setReconnectIntent(null)
    setJoinedRoom(null)
    setRosterSize(0)
    setIsJoinPending(true)
    window.submitJoinIntent(intent)
  }, [claimInviteSlot])

  useEffect(() => {
    window.onNetworkSimulatorToggle = () => {
      const stats = getNetworkStats()
      if (stats) {
        setNetworkStats(stats)
      }
      setDebugPanelVisible((prev) => !prev)
    }

    window.onJoinSuccess = (payload) => {
      setIsJoinPending(false)
      setJoinError(null)
      setOverlayMode('join')
      setReconnectIntent(null)
      setJoinedRoom(payload)
      setJoinForm((prev) => ({ ...prev, displayName: payload.displayName, code: payload.code ?? prev.code }))
      getBrowserStorage()?.setItem(DISPLAY_NAME_STORAGE_KEY, payload.displayName)
    }

    window.onJoinError = (payload) => {
      setIsJoinPending(false)
      setJoinError(payload)
      setJoinedRoom(null)
      setRosterSize(0)
    }

    window.onRosterSizeChanged = (count) => {
      setRosterSize(count)
    }

    window.onReconnectReplayFailed = (intent) => {
      setIsJoinPending(false)
      setReconnectIntent(intent)
    }

    return () => {
      delete window.onNetworkSimulatorToggle
      delete window.onJoinSuccess
      delete window.onJoinError
      delete window.onRosterSizeChanged
      delete window.onReconnectReplayFailed
    }
  }, [getNetworkStats])

  useEffect(() => {
    const onJoinBridgeReady = () => {
      setIsJoinBridgeReady(true)
      setJoinBridgeReadyTick((prev) => prev + 1)
    }

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

    window.addEventListener(JOIN_BRIDGE_READY_EVENT, onJoinBridgeReady)
    window.addEventListener('storage', onStorage)
    return () => {
      broadcastChannelRef.current?.close()
      window.removeEventListener(JOIN_BRIDGE_READY_EVENT, onJoinBridgeReady)
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
      !window.submitJoinIntent
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
  }, [initialSavedDisplayName, inviteCode, joinBridgeReadyTick, submitJoinIntent])

  const handleMatchEnd = useCallback((data: MatchEndData, playerId: string) => {
    setMatchEndData(data)
    setLocalPlayerId(playerId)
  }, [])

  const handleCloseMatchEnd = () => {
    setMatchEndData(null)
  }

  const handlePlayAgain = () => {
    setMatchEndData(null)
    if (window.restartGame) {
      window.restartGame()
    } else {
      console.warn('App: window.restartGame is not available')
    }
  }

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
    if (!joinedRoom?.code) {
      return
    }

    const link = buildInviteLink(joinedRoom.code)
    await navigator.clipboard?.writeText(link)
  }

  const joinActionsDisabled = !isJoinBridgeReady || isJoinPending

  return (
    <div className="app-shell">
      <div className="app-container">
        <h1 style={{ textAlign: 'center', color: '#ffffff' }}>Stick Rumble - Multiplayer Arena Shooter</h1>
        <PhaserGame onMatchEnd={handleMatchEnd} />
        <DebugNetworkPanel
          isVisible={debugPanelVisible}
          onClose={() => setDebugPanelVisible(false)}
          stats={networkStats}
          onLatencyChange={handleLatencyChange}
          onPacketLossChange={handlePacketLossChange}
          onEnabledChange={handleEnabledChange}
        />
      </div>
      <div className="overlay-layer">
        {overlayMode === 'join' && !joinedRoom && (
          <div className="overlay-card">
            <h2>{inviteCode ? 'Join Invite' : 'Enter Match'}</h2>
            <label>
              Display Name
              <input
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
                value={joinForm.code}
                onChange={(event) => setJoinForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="PIZZA"
              />
            </label>
            {joinError && (
              <p className="overlay-error">
                {joinError.type === 'error:bad_room_code' && `Bad room code: ${joinError.reason ?? 'invalid'}.`}
                {joinError.type === 'error:room_full' && `Room ${joinError.code ?? joinForm.code} is full.`}
                {joinError.type === 'error:no_hello' && `Server rejected ${joinError.offendingType ?? 'message'} before hello.`}
              </p>
            )}
            {!isJoinBridgeReady && <p className="overlay-status">Connecting to game...</p>}
            {isJoinPending && <p className="overlay-status">Joining...</p>}
            <div className="overlay-actions">
              <button
                disabled={joinActionsDisabled}
                onClick={() => submitJoinIntent({ displayName: joinForm.displayName, mode: 'public' })}
              >
                Play Public
              </button>
              <button
                disabled={joinActionsDisabled}
                onClick={() => submitJoinIntent({ displayName: joinForm.displayName, mode: 'code', code: joinForm.code })}
              >
                {isJoinPending ? 'Joining...' : 'Join Code'}
              </button>
            </div>
          </div>
        )}
        {overlayMode === 'duplicate' && (
          <div className="overlay-card">
            <h2>Invite Already Open</h2>
            <p>This browser profile already claimed this invite in another tab. Return to the original tab to keep playing.</p>
          </div>
        )}
        {waitingForFriend && (
          <div className="overlay-card overlay-card--corner">
            <h2>Waiting For Friend</h2>
            <p>Code: {joinedRoom?.code}</p>
            <button onClick={() => void copyInviteLink()}>Copy Invite Link</button>
          </div>
        )}
        {reconnectIntent && (
          <div className="overlay-card overlay-card--corner">
            <h2>Reconnect Failed</h2>
            <div className="overlay-actions">
              <button onClick={() => submitJoinIntent(reconnectIntent)}>
                {formatReconnectLabel(reconnectIntent)}
              </button>
              <button onClick={() => submitJoinIntent({ displayName: joinForm.displayName, mode: 'public' })}>
                Play Public
              </button>
            </div>
          </div>
        )}
        {matchEndData && (
          <MatchEndScreen
            matchData={matchEndData}
            localPlayerId={localPlayerId}
            onClose={handleCloseMatchEnd}
            onPlayAgain={handlePlayAgain}
          />
        )}
      </div>
    </div>
  )
}

export default App
