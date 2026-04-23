import type { WebSocketClient } from './network/WebSocketClient'
import type { MatchSession } from '../shared/types'

export interface MatchBootstrap {
  session: MatchSession
  wsClient: WebSocketClient
}

let activeMatchBootstrap: MatchBootstrap | null = null

export function setActiveMatchBootstrap(bootstrap: MatchBootstrap | null): void {
  activeMatchBootstrap = bootstrap
}

export function getActiveMatchBootstrap(): MatchBootstrap | null {
  return activeMatchBootstrap
}
