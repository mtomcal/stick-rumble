/**
 * Match End Screen React Test Entry Point
 * Mounts the ACTUAL React component for visual regression testing
 */

import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MatchEndScreen } from './ui/match/MatchEndScreen'
import type { MatchEndData } from './shared/types'
import './App.css'

// Window interface for test controls
interface WindowWithTestControls extends Window {
  showMatchEndScreen: (data: MatchEndData, playerId: string) => void
  closeMatchEndScreen: () => void
}

// Test wrapper component
export function MatchEndScreenTestWrapper() {
  const [matchData, setMatchData] = useState<MatchEndData | null>(null)
  const [localPlayerId, setLocalPlayerId] = useState<string>('')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Expose test control functions
    (window as unknown as WindowWithTestControls).showMatchEndScreen = (
      data: MatchEndData,
      playerId: string
    ) => {
      setMatchData(data)
      setLocalPlayerId(playerId)
      setIsVisible(true)
    }

    (window as unknown as WindowWithTestControls).closeMatchEndScreen = () => {
      setIsVisible(false)
    }

    // Mark test harness as ready
    const marker = document.querySelector('[data-testid="match-end-react-ready"]')
    if (marker) {
      marker.setAttribute('data-ready', 'true')
    }

    console.log('Match End React Test initialized')
  }, [])

  // Don't render anything if not visible
  if (!isVisible || !matchData) {
    return null
  }

  // Render the actual MatchEndScreen component
  // Use noop callbacks to disable countdown auto-trigger for testing
  return (
    <MatchEndScreen
      matchData={matchData}
      localPlayerId={localPlayerId}
      onClose={() => {
        console.log('onClose called')
      }}
      onPlayAgain={() => {
        console.log('onPlayAgain called')
      }}
    />
  )
}

// Mount React app
const rootElement = document.getElementById('root')
if (rootElement) {
  const root = createRoot(rootElement)
  root.render(
    <StrictMode>
      <MatchEndScreenTestWrapper />
    </StrictMode>
  )
}
