import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Phaser from 'phaser'
import { GameSceneUI } from './GameSceneUI'

vi.mock('phaser', () => ({
  default: {
    Scene: class {
      scene = { key: '' }
      constructor(config: { key: string }) {
        this.scene.key = config.key
      }
    },
    Math: {
      DegToRad: (degrees: number) => degrees * (Math.PI / 180),
    },
  },
}))

describe('GameSceneUI', () => {
  let ui: GameSceneUI
  let createdTextCalls: Array<[number, number, string]>
  let createdGraphics: any[]
  let mockScene: Phaser.Scene

  beforeEach(() => {
    createdTextCalls = []
    createdGraphics = []

    mockScene = {
      sys: {
        isActive: vi.fn().mockReturnValue(true),
      },
      add: {
        text: vi.fn((x: number, y: number, text: string) => {
          createdTextCalls.push([x, y, text])
          return {
            setOrigin: vi.fn().mockReturnThis(),
            setScrollFactor: vi.fn().mockReturnThis(),
            setText: vi.fn().mockReturnThis(),
            setColor: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setScale: vi.fn().mockReturnThis(),
            setAlpha: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          }
        }),
        rectangle: vi.fn().mockReturnValue({
          setScrollFactor: vi.fn().mockReturnThis(),
          setDepth: vi.fn().mockReturnThis(),
          setAlpha: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        }),
        line: vi.fn(),
        sprite: vi.fn().mockReturnValue({
          setDepth: vi.fn().mockReturnThis(),
          setTint: vi.fn().mockReturnThis(),
          setScale: vi.fn().mockReturnThis(),
          setRotation: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
          scale: 1,
        }),
        circle: vi.fn().mockReturnValue({ destroy: vi.fn() }),
        graphics: vi.fn().mockImplementation(() => {
          const graphics = {
            fillStyle: vi.fn().mockReturnThis(),
            fillRect: vi.fn().mockReturnThis(),
            fillCircle: vi.fn().mockReturnThis(),
            setPosition: vi.fn().mockReturnThis(),
            lineStyle: vi.fn().mockReturnThis(),
            strokeRect: vi.fn().mockReturnThis(),
            strokeCircle: vi.fn().mockReturnThis(),
            beginPath: vi.fn().mockReturnThis(),
            moveTo: vi.fn().mockReturnThis(),
            lineTo: vi.fn().mockReturnThis(),
            arc: vi.fn().mockReturnThis(),
            strokePath: vi.fn().mockReturnThis(),
            clear: vi.fn().mockReturnThis(),
            setScrollFactor: vi.fn().mockReturnThis(),
            setDepth: vi.fn().mockReturnThis(),
            setVisible: vi.fn().mockReturnThis(),
            destroy: vi.fn(),
          }
          createdGraphics.push(graphics)
          return graphics
        }),
      },
      make: {
        graphics: vi.fn().mockReturnValue({
          lineStyle: vi.fn().mockReturnThis(),
          fillStyle: vi.fn().mockReturnThis(),
          beginPath: vi.fn().mockReturnThis(),
          moveTo: vi.fn().mockReturnThis(),
          lineTo: vi.fn().mockReturnThis(),
          closePath: vi.fn().mockReturnThis(),
          fillPath: vi.fn().mockReturnThis(),
          strokePath: vi.fn().mockReturnThis(),
          generateTexture: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        }),
      },
      cameras: {
        main: {
          width: 1920,
          height: 1080,
          scrollX: 0,
          scrollY: 0,
          shake: vi.fn(),
        },
      },
      input: {
        activePointer: {
          worldX: 100,
          worldY: 100,
        },
      },
      tweens: {
        add: vi.fn().mockReturnValue({ remove: vi.fn() }),
      },
    } as unknown as Phaser.Scene

    ui = new GameSceneUI(mockScene)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('creates a weapon label and ammo text without a RELOADING banner', () => {
    ui.createAmmoDisplay(48, 58)

    expect(createdTextCalls).toContainEqual([48, 40, 'PISTOL'])
    expect(createdTextCalls).toContainEqual([48, 58, '15/15'])
    expect(createdTextCalls.some(([, , text]) => text.includes('RELOADING'))).toBe(false)
  })

  it('updates the ammo cluster using the current weapon label', () => {
    ui.createAmmoDisplay(48, 58)

    const shootingManager = {
      getAmmoInfo: vi.fn().mockReturnValue([10, 15]),
      isReloading: vi.fn().mockReturnValue(false),
      isEmpty: vi.fn().mockReturnValue(false),
      isMeleeWeapon: vi.fn().mockReturnValue(false),
      getWeaponState: vi.fn().mockReturnValue({ weaponType: 'Shotgun' }),
    } as any

    expect(() => ui.updateAmmoDisplay(shootingManager)).not.toThrow()
    expect(shootingManager.getWeaponState).toHaveBeenCalled()
  })

  it('retains the reload bar helpers as hidden compatibility-only elements', () => {
    ui.createReloadProgressBar(10, 70, 100, 10)
    ui.updateReloadProgress(0.5, 500, 300, 60, 4)

    expect(createdGraphics).toHaveLength(2)
    expect(createdGraphics[0].setVisible).toHaveBeenCalledWith(false)
    expect(createdGraphics[1].setVisible).toHaveBeenCalledWith(false)
  })
})
