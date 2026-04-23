import { act, fireEvent, render, screen } from '@testing-library/react'
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

  it('renders display-ready winner and scoreboard names instead of raw ids', () => {
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
    expect(screen.queryByText(/^player-1$/)).not.toBeInTheDocument()
  })

  it('is a non-dismissible dialog with no close affordance', () => {
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

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    expect(mockOnClose).not.toHaveBeenCalled()
  })

  it('shares rank for kill ties and orders tied players by display name', () => {
    render(
      <MatchEndScreen
        matchData={{
          ...matchData,
          finalScores: [
            { playerId: 'player-1', displayName: 'Zed', kills: 5, deaths: 1, xp: 650 },
            { playerId: 'player-2', displayName: 'Amy', kills: 5, deaths: 9, xp: 400 },
            { playerId: 'player-3', displayName: 'Cara', kills: 1, deaths: 5, xp: 200 },
          ],
        }}
        localPlayerId="player-2"
        onClose={mockOnClose}
        onPlayAgain={mockOnPlayAgain}
      />,
    )

    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('1Amy59')
    expect(rows[2]).toHaveTextContent('1Zed51')
    expect(rows[3]).toHaveTextContent('3Cara15')
  })

  it('renders tied winners as a plural list', () => {
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

  it('falls back to Guest instead of showing raw ids when names are blank', () => {
    render(
      <MatchEndScreen
        matchData={{
          ...matchData,
          winners: [{ playerId: 'player-2', displayName: '   ' }],
          finalScores: [
            { playerId: 'player-1', displayName: 'Alice', kills: 5, deaths: 2, xp: 650 },
            { playerId: 'player-2', displayName: '', kills: 6, deaths: 1, xp: 800 },
          ],
        }}
        localPlayerId="player-2"
        onClose={mockOnClose}
        onPlayAgain={mockOnPlayAgain}
      />,
    )

    expect(screen.getByText(/Winner:/i)).toHaveTextContent('Guest')
    expect(screen.getAllByText('Guest')).toHaveLength(2)
    expect(screen.queryByText(/^player-2$/)).not.toBeInTheDocument()
  })

  it('calls play again immediately from the button and does not double-fire on countdown expiry', () => {
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

    expect(mockOnPlayAgain).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Returning to lobby in 0s/i)).toBeInTheDocument()
  })

  it('calls play again once when the countdown reaches zero', () => {
    render(
      <MatchEndScreen
        matchData={matchData}
        localPlayerId="player-2"
        onClose={mockOnClose}
        onPlayAgain={mockOnPlayAgain}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(mockOnPlayAgain).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/Returning to lobby in 0s/i)).toBeInTheDocument()
  })
})
