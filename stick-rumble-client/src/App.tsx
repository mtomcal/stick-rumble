import { useState } from 'react'
import { PhaserGame } from './ui/common/PhaserGame'
import { MatchEndScreen } from './ui/match/MatchEndScreen'
import type { MatchEndData } from './shared/types'
import './App.css'

function App() {
  const [matchEndData, setMatchEndData] = useState<MatchEndData | null>(null)
  const [localPlayerId, setLocalPlayerId] = useState<string>('')

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
    </div>
  )
}

export default App
