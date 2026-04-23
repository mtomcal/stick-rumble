import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlayerManager, type PlayerState } from './PlayerManager'
import { ManualClock } from '../utils/Clock'

const createMockScene = () => {
  const texts: any[] = []

  return {
    sys: {
      isActive: vi.fn().mockReturnValue(true),
    },
    add: {
      text: vi.fn((x: number, y: number, text: string) => {
        const instance = {
          x,
          y,
          text,
          setOrigin: vi.fn().mockReturnThis(),
          setPosition: vi.fn(),
          setVisible: vi.fn(),
          setText: vi.fn(),
          destroy: vi.fn(),
        }
        texts.push(instance)
        return instance
      }),
      sprite: vi.fn(() => ({
        setPosition: vi.fn(),
        setAlpha: vi.fn().mockReturnThis(),
        setAngle: vi.fn().mockReturnThis(),
        setTint: vi.fn().mockReturnThis(),
        clearTint: vi.fn().mockReturnThis(),
        setOrigin: vi.fn().mockReturnThis(),
        setRotation: vi.fn().mockReturnThis(),
        setFlipY: vi.fn().mockReturnThis(),
        setTexture: vi.fn().mockReturnThis(),
        play: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      line: vi.fn(() => ({
        setTo: vi.fn(),
        setVisible: vi.fn(),
        destroy: vi.fn(),
      })),
      container: vi.fn(() => ({
        add: vi.fn(),
        removeAll: vi.fn(),
        setRotation: vi.fn(),
        setPosition: vi.fn(),
        setVisible: vi.fn(),
        setScale: vi.fn(),
        destroy: vi.fn(),
        scaleY: 1,
        rotation: 0,
      })),
      circle: vi.fn(() => ({
        setDepth: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
      rectangle: vi.fn(() => ({
        setRotation: vi.fn(),
      })),
      graphics: vi.fn(() => ({
        clear: vi.fn().mockReturnThis(),
        lineStyle: vi.fn().mockReturnThis(),
        fillStyle: vi.fn().mockReturnThis(),
        fillRect: vi.fn().mockReturnThis(),
        beginPath: vi.fn().mockReturnThis(),
        moveTo: vi.fn().mockReturnThis(),
        lineTo: vi.fn().mockReturnThis(),
        strokePath: vi.fn().mockReturnThis(),
        fillCircle: vi.fn().mockReturnThis(),
        strokeCircle: vi.fn().mockReturnThis(),
        setDepth: vi.fn().mockReturnThis(),
        setVisible: vi.fn().mockReturnThis(),
        setPosition: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
      })),
    },
    tweens: {
      add: vi.fn(),
    },
    texts,
  }
}

describe('PlayerManager', () => {
  let manager: PlayerManager
  let mockScene: ReturnType<typeof createMockScene>

  beforeEach(() => {
    mockScene = createMockScene()
    manager = new PlayerManager(mockScene as any, new ManualClock())
  })

  it('renders the local player label as YOU', () => {
    manager.setLocalPlayerId('local-player')

    const players: PlayerState[] = [
      { id: 'local-player', displayName: 'Alice', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
    ]

    manager.updatePlayers(players)

    expect(mockScene.add.text).toHaveBeenCalledWith(100, 158, 'YOU', expect.any(Object))
  })

  it('falls back to Guest for unnamed remote players', () => {
    manager.setLocalPlayerId('local-player')

    const players: PlayerState[] = [
      { id: 'remote-player', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
    ]

    manager.updatePlayers(players)

    expect(mockScene.add.text).toHaveBeenCalledWith(100, 150, 'Guest', expect.any(Object))
  })

  it('does not create a local overhead health bar but does create one for remote players', () => {
    manager.setLocalPlayerId('local-player')

    manager.updatePlayers([
      { id: 'local-player', displayName: 'Alice', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
    ])
    expect((manager as any).healthBars.size).toBe(0)

    manager.updatePlayers([
      { id: 'local-player', displayName: 'Alice', position: { x: 100, y: 200 }, velocity: { x: 0, y: 0 } },
      { id: 'remote-player', displayName: 'Bob', position: { x: 120, y: 200 }, velocity: { x: 0, y: 0 } },
    ])
    expect((manager as any).healthBars.size).toBe(1)
  })
})
