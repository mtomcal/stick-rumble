import { vi } from 'vitest'
import type { WebSocketClient } from '../network/WebSocketClient'
import { setActiveMatchBootstrap } from '../sessionRuntime'
import { createMockScene } from './GameScene.test.setup'
import { GameScene } from './GameScene'

type Handler = (payload: unknown) => void

export function createBootstrapWsClient() {
  const handlers = new Map<string, Set<Handler>>()

  return {
    on: vi.fn((event: string, handler: Handler) => {
      const eventHandlers = handlers.get(event) ?? new Set<Handler>()
      eventHandlers.add(handler)
      handlers.set(event, eventHandlers)
    }),
    off: vi.fn((event: string, handler: Handler) => {
      handlers.get(event)?.delete(handler)
    }),
    send: vi.fn(),
    setGameplayReady: vi.fn(),
    getTotalHandlerCount: vi.fn(() => [...handlers.values()].reduce((total, set) => total + set.size, 0)),
    emit(event: string, payload: unknown) {
      handlers.get(event)?.forEach((handler) => handler(payload))
    },
  }
}

export function setupBootstrappedGameScene() {
  const scene = new GameScene()
  const mockSceneContext = createMockScene()
  const wsClient = createBootstrapWsClient()

  mockSceneContext.input = {
    ...mockSceneContext.input,
    mouse: {
      disableContextMenu: vi.fn(),
    },
  } as unknown as typeof mockSceneContext.input & {
    mouse: { disableContextMenu: ReturnType<typeof vi.fn> }
  }

  setActiveMatchBootstrap({
    session: {
      roomId: 'room-1',
      playerId: 'player-1',
      mapId: 'default_office',
      displayName: 'Alice',
      joinMode: 'public',
    },
    wsClient: wsClient as unknown as WebSocketClient,
  })

  Object.assign(scene, mockSceneContext)
  scene.create()

  return { scene, mockSceneContext, wsClient }
}
