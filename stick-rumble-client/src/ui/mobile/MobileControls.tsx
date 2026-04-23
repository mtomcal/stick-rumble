import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { setMobileGameplayIntent, triggerRuntimeAction } from '../../game/sessionRuntime'
import type { GameplayIntentState } from '../../shared/types'

const JOYSTICK_RADIUS = 68
const DEAD_ZONE = 12

const NEUTRAL_INTENT: GameplayIntentState = {
  up: false,
  down: false,
  left: false,
  right: false,
  aimAngle: null,
  isSprinting: false,
  fireActive: false,
}

interface JoystickState {
  active: boolean
  angle: number | null
  distance: number
  stickX: number
  stickY: number
  pointerId: number | null
}

function createNeutralJoystickState(): JoystickState {
  return {
    active: false,
    angle: null,
    distance: 0,
    stickX: 0,
    stickY: 0,
    pointerId: null,
  }
}

function clampJoystickPosition(deltaX: number, deltaY: number) {
  const distance = Math.sqrt(deltaX ** 2 + deltaY ** 2)
  const clampedDistance = Math.min(distance, JOYSTICK_RADIUS)
  const angle = distance > 0 ? Math.atan2(deltaY, deltaX) : null

  return {
    angle,
    distance: clampedDistance,
    stickX: angle === null ? 0 : Math.cos(angle) * clampedDistance,
    stickY: angle === null ? 0 : Math.sin(angle) * clampedDistance,
  }
}

function readPointerOffset(
  event: ReactPointerEvent<HTMLDivElement>,
  element: HTMLDivElement
) {
  const rect = element.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  return {
    deltaX: event.clientX - centerX,
    deltaY: event.clientY - centerY,
  }
}

function buildMovementIntent(movement: JoystickState, aiming: JoystickState): GameplayIntentState {
  const isActive = movement.active && movement.distance > DEAD_ZONE
  const angle = isActive ? movement.angle : null

  return {
    up: angle !== null && Math.sin(angle) < -0.35,
    down: angle !== null && Math.sin(angle) > 0.35,
    left: angle !== null && Math.cos(angle) < -0.35,
    right: angle !== null && Math.cos(angle) > 0.35,
    aimAngle: aiming.active && aiming.distance > DEAD_ZONE ? aiming.angle : null,
    isSprinting: false,
    fireActive: aiming.active && aiming.distance > DEAD_ZONE,
  }
}

function suppressPointerEvent(event: ReactPointerEvent<HTMLElement>): void {
  event.preventDefault()
  event.stopPropagation()
}

function MobileStick({
  label,
  state,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  label: string
  state: JoystickState
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      aria-label={label}
      className="mobile-stick"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
      role="presentation"
    >
      <div
        className="mobile-stick__thumb"
        style={{
          transform: `translate(${state.stickX}px, ${state.stickY}px)`,
        }}
      />
    </div>
  )
}

export function MobileControls() {
  const [movementState, setMovementState] = useState<JoystickState>(createNeutralJoystickState)
  const [aimState, setAimState] = useState<JoystickState>(createNeutralJoystickState)
  const latestIntentRef = useRef<GameplayIntentState>(NEUTRAL_INTENT)
  const movementStateRef = useRef<JoystickState>(createNeutralJoystickState())
  const aimStateRef = useRef<JoystickState>(createNeutralJoystickState())

  const publishIntent = (movement: JoystickState, aim: JoystickState) => {
    const nextIntent = buildMovementIntent(movement, aim)
    latestIntentRef.current = nextIntent
    setMobileGameplayIntent(nextIntent)
  }

  const updateMovementState = (nextState: JoystickState) => {
    movementStateRef.current = nextState
    setMovementState(nextState)
  }

  const updateAimState = (nextState: JoystickState) => {
    aimStateRef.current = nextState
    setAimState(nextState)
  }

  useEffect(() => {
    return () => {
      latestIntentRef.current = NEUTRAL_INTENT
      setMobileGameplayIntent(null)
    }
  }, [])

  const handleMovementPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    suppressPointerEvent(event)
    const element = event.currentTarget
    element.setPointerCapture?.(event.pointerId)
    const { deltaX, deltaY } = readPointerOffset(event, element)
    const nextState: JoystickState = {
      active: true,
      pointerId: event.pointerId,
      ...clampJoystickPosition(deltaX, deltaY),
    }
    updateMovementState(nextState)
    publishIntent(nextState, aimStateRef.current)
  }

  const handleMovementPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    suppressPointerEvent(event)
    if (!movementStateRef.current.active || movementStateRef.current.pointerId !== event.pointerId) {
      return
    }
    const { deltaX, deltaY } = readPointerOffset(event, event.currentTarget)
    const nextState: JoystickState = {
      active: true,
      pointerId: event.pointerId,
      ...clampJoystickPosition(deltaX, deltaY),
    }
    updateMovementState(nextState)
    publishIntent(nextState, aimStateRef.current)
  }

  const handleMovementPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    suppressPointerEvent(event)
    if (!movementStateRef.current.active || movementStateRef.current.pointerId !== event.pointerId) {
      return
    }
    const nextState = createNeutralJoystickState()
    updateMovementState(nextState)
    publishIntent(nextState, aimStateRef.current)
  }

  const handleAimPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    suppressPointerEvent(event)
    const element = event.currentTarget
    element.setPointerCapture?.(event.pointerId)
    const { deltaX, deltaY } = readPointerOffset(event, element)
    const nextState: JoystickState = {
      active: true,
      pointerId: event.pointerId,
      ...clampJoystickPosition(deltaX, deltaY),
    }
    updateAimState(nextState)
    publishIntent(movementStateRef.current, nextState)
  }

  const handleAimPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    suppressPointerEvent(event)
    if (!aimStateRef.current.active || aimStateRef.current.pointerId !== event.pointerId) {
      return
    }
    const { deltaX, deltaY } = readPointerOffset(event, event.currentTarget)
    const nextState: JoystickState = {
      active: true,
      pointerId: event.pointerId,
      ...clampJoystickPosition(deltaX, deltaY),
    }
    updateAimState(nextState)
    publishIntent(movementStateRef.current, nextState)
  }

  const handleAimPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    suppressPointerEvent(event)
    if (!aimStateRef.current.active || aimStateRef.current.pointerId !== event.pointerId) {
      return
    }
    const nextState = createNeutralJoystickState()
    updateAimState(nextState)
    publishIntent(movementStateRef.current, nextState)
  }

  return (
    <div className="mobile-controls" data-testid="mobile-controls">
      <div className="mobile-controls__column mobile-controls__column--left">
        <MobileStick
          label="Movement Control"
          state={movementState}
          onPointerDown={handleMovementPointerDown}
          onPointerMove={handleMovementPointerMove}
          onPointerUp={handleMovementPointerUp}
        />
      </div>

      <div className="mobile-controls__column mobile-controls__column--right">
        <div className="mobile-controls__actions">
          <button
            className="mobile-action-button"
            type="button"
            onPointerDown={(event) => {
              suppressPointerEvent(event)
              triggerRuntimeAction('reload')
            }}
          >
            Reload
          </button>
          <button
            className="mobile-action-button"
            type="button"
            onPointerDown={(event) => {
              suppressPointerEvent(event)
              triggerRuntimeAction('dodge')
            }}
          >
            Dodge
          </button>
        </div>
        <MobileStick
          label="Aim And Fire Control"
          state={aimState}
          onPointerDown={handleAimPointerDown}
          onPointerMove={handleAimPointerMove}
          onPointerUp={handleAimPointerUp}
        />
      </div>
    </div>
  )
}
