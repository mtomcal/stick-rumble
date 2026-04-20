import { render, screen, fireEvent, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchEndScreen } from './MatchEndScreen'
import type { MatchEndData } from '../../shared/types'

const mockOnClose = vi.fn()
const mockOnPlayAgain = vi.fn()

const matchData: MatchEndData = {
  winners: [{ playerId: 'player-1', displayName: 'Alice' }],
  finalScores: [
    { playerId: 'player-1', displayName: 'Alice', kills: 5, deaths: 2, xp: 650 },
    { playerId: 'player-2', displayName: 'Bob', kills: 3, deaths: 4, xp: 400 },
    { playerId: 'player-3', displayName: 'Cara', kills: 1, deaths: 5, xp: 200 },
  ],
  reason: 'time_limit',
}

describe('MatchEndScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders winner and scoreboard display names instead of raw IDs', () => {
    render(
      <MatchEndScreen
        matchData={matchData}
        localPlayerId="player-2"
        onClose={mockOnClose}
        onPlayAgain={mockOnPlayAgain}
      />,
    )

    expect(screen.getByText(/Winner:/i)).toHaveTextContent('Alice')
    expect(screen.getByRole('row', { name: /1 Alice 5 2/i })).toBeInTheDocument()
    expect(screen.queryByText('player-1')).not.toBeInTheDocument()
  })

  it('is a non-dismissible dialog with only the play-again action', () => {
    render(
      <MatchEndScreen
        matchData={matchData}
        localPlayerId="player-2"
        onClose={mockOnClose}
        onPlayAgain={mockOnPlayAgain}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Match End Results' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
  })

  it('calls play again from the button and from the countdown expiry', () => {
    render(
      <MatchEndScreen
        matchData={matchData}
        localPlayerId="player-2"
        onClose={mockOnClose}
        onPlayAgain={mockOnPlayAgain}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Play Again' }))
    expect(mockOnPlayAgain).toHaveBeenCalledTimes(1)

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(mockOnPlayAgain).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/Returning to lobby in 0s/i)).toBeInTheDocument()
  })

  it('renders ties as plural winners', () => {
    render(
      <MatchEndScreen
        matchData={{
          ...matchData,
          winners: [
            { playerId: 'player-1', displayName: 'Alice' },
            { playerId: 'player-2', displayName: 'Bob' },
          ],
        }}
        localPlayerId="player-2"
        onClose={mockOnClose}
        onPlayAgain={mockOnPlayAgain}
      />,
    )

    expect(screen.getByText(/Winners:/i)).toHaveTextContent('Alice, Bob')
  })
})
