import { useState, useEffect, useCallback } from 'react'
import { PhaserGame } from './ui/common/PhaserGame'
import { MatchEndScreen } from './ui/match/MatchEndScreen'
import { DebugNetworkPanel } from './ui/debug/DebugNetworkPanel'
import type { MatchEndData } from './shared/types'
import type { NetworkSimulatorStats } from './game/network/NetworkSimulator'
import './App.css'

const DEFAULT_STATS: NetworkSimulatorStats = {
  enabled: false,
  latency: 0,
  packetLoss: 0,
}

function App() {
  const [matchEndData, setMatchEndData] = useState<MatchEndData | null>(null)
  const [localPlayerId, setLocalPlayerId] = useState<string>('')
  const [debugPanelVisible, setDebugPanelVisible] = useState(false)
  const [networkStats, setNetworkStats] = useState<NetworkSimulatorStats>(DEFAULT_STATS)

  // Refresh network stats from Phaser (returns stats, doesn't set state directly)
  const getNetworkStats = useCallback(() => {
    if (window.getNetworkSimulatorStats) {
      return window.getNetworkSimulatorStats()
    }
    return null
  }, [])

  // Setup F8 toggle callback
  useEffect(() => {
    window.onNetworkSimulatorToggle = () => {
      // Refresh stats when toggle is triggered
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


  const handleMatchEnd = (data: MatchEndData, playerId: string) => {
    setMatchEndData(data)
    setLocalPlayerId(playerId)
  }

  const handleCloseMatchEnd = () => {
    setMatchEndData(null)
  }

  const handlePlayAgain = () => {
    // Clear match end screen
    setMatchEndData(null)

    // Trigger scene restart via window.restartGame
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

  return (
    <div className="app-container">
      <h1 style={{ textAlign: 'center', color: '#ffffff' }}>
        Stick Rumble - Multiplayer Arena Shooter
      </h1>
      <PhaserGame onMatchEnd={handleMatchEnd} />
      {matchEndData && (
        <MatchEndScreen
          matchData={matchEndData}
          localPlayerId={localPlayerId}
          onClose={handleCloseMatchEnd}
          onPlayAgain={handlePlayAgain}
        />
      )}
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
