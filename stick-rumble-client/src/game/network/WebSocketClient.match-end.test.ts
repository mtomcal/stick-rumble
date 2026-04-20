import { describe, expect, it } from 'vitest'
import type { MatchEndedData } from '@stick-rumble/events-schema'

describe('match:ended payload shape', () => {
  it('uses display-ready winners and final score rows', () => {
    const payload: MatchEndedData = {
      winners: [{ playerId: 'player-1', displayName: 'Alice' }],
      finalScores: [
        { playerId: 'player-1', displayName: 'Alice', kills: 10, deaths: 2, xp: 750 },
        { playerId: 'player-2', displayName: 'Bob', kills: 5, deaths: 5, xp: 400 },
      ],
      reason: 'kill_target',
    }

    expect(payload.winners[0]).toEqual({ playerId: 'player-1', displayName: 'Alice' })
    expect(payload.finalScores[0].displayName).toBe('Alice')
    expect(payload.finalScores[1].displayName).toBe('Bob')
  })

  it('still sorts rankings by kills desc then deaths asc', () => {
    const ranked = [
      { playerId: 'player-1', displayName: 'Alice', kills: 5, deaths: 2, xp: 400 },
      { playerId: 'player-2', displayName: 'Bob', kills: 10, deaths: 3, xp: 750 },
      { playerId: 'player-3', displayName: 'Cara', kills: 10, deaths: 1, xp: 800 },
    ].sort((a, b) => {
      if (b.kills !== a.kills) {
        return b.kills - a.kills
      }
      return a.deaths - b.deaths
    })

    expect(ranked.map((player) => player.displayName)).toEqual(['Cara', 'Bob', 'Alice'])
  })
})
