import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MobileControls } from './MobileControls'

const testState = vi.hoisted(() => ({
  setMobileGameplayIntent: vi.fn(),
  triggerRuntimeAction: vi.fn(),
  subscribeMobilePickupAction: vi.fn(),
  pickupListener: null as ((pickup: { crateId: string; weaponType: string } | null) => void) | null,
}))

vi.mock('../../game/sessionRuntime', () => ({
  setMobileGameplayIntent: testState.setMobileGameplayIntent,
  triggerRuntimeAction: testState.triggerRuntimeAction,
  subscribeMobilePickupAction: testState.subscribeMobilePickupAction,
}))

function mockStickBounds(element: HTMLElement) {
  element.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 136,
      height: 136,
      right: 136,
      bottom: 136,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect
  ;(element as HTMLDivElement).setPointerCapture = vi.fn()
}

describe('MobileControls', () => {
  beforeEach(() => {
    testState.setMobileGameplayIntent.mockReset()
    testState.triggerRuntimeAction.mockReset()
    testState.pickupListener = null
    testState.subscribeMobilePickupAction.mockImplementation((listener) => {
      testState.pickupListener = listener
      listener(null)
      return () => {
        if (testState.pickupListener === listener) {
          testState.pickupListener = null
        }
      }
    })
  })

  it('publishes left-side movement ownership and clears to neutral on release', () => {
    render(<MobileControls />)

    const movementStick = screen.getByLabelText('Movement Control')
    mockStickBounds(movementStick)

    fireEvent.pointerDown(movementStick, { pointerId: 1, clientX: 10, clientY: 68 })
    fireEvent.pointerUp(movementStick, { pointerId: 1 })

    expect(testState.setMobileGameplayIntent).toHaveBeenCalledWith({
      up: false,
      down: false,
      left: true,
      right: false,
      aimAngle: null,
      isSprinting: false,
      fireActive: false,
    })
    expect(testState.setMobileGameplayIntent).toHaveBeenLastCalledWith({
      up: false,
      down: false,
      left: false,
      right: false,
      aimAngle: null,
      isSprinting: false,
      fireActive: false,
    })
  })

  it('publishes aim and fire intent as soon as the right stick is engaged outside the dead zone', () => {
    render(<MobileControls />)

    const aimStick = screen.getByLabelText('Aim And Fire Control')
    mockStickBounds(aimStick)

    fireEvent.pointerDown(aimStick, { pointerId: 7, clientX: 98, clientY: 68 })
    fireEvent.pointerUp(aimStick, { pointerId: 7 })

    const firstIntent = testState.setMobileGameplayIntent.mock.calls[0]?.[0]
    expect(firstIntent).toEqual({
      up: false,
      down: false,
      left: false,
      right: false,
      aimAngle: expect.any(Number),
      isSprinting: false,
      fireActive: true,
    })
    expect(firstIntent.aimAngle).toBeCloseTo(0, 5)
    expect(testState.setMobileGameplayIntent).toHaveBeenLastCalledWith({
      up: false,
      down: false,
      left: false,
      right: false,
      aimAngle: null,
      isSprinting: false,
      fireActive: false,
    })
  })

  it('publishes aim and fire intent for larger right-stick drags too', () => {
    render(<MobileControls />)

    const aimStick = screen.getByLabelText('Aim And Fire Control')
    mockStickBounds(aimStick)

    fireEvent.pointerDown(aimStick, { pointerId: 7, clientX: 126, clientY: 10 })
    fireEvent.pointerUp(aimStick, { pointerId: 7 })

    const firstIntent = testState.setMobileGameplayIntent.mock.calls[0]?.[0]
    expect(firstIntent).toEqual({
      up: false,
      down: false,
      left: false,
      right: false,
      aimAngle: expect.any(Number),
      isSprinting: false,
      fireActive: true,
    })
    expect(firstIntent.aimAngle).toBeCloseTo(-Math.PI / 4, 1)
  })

  it('preserves the other stick intent when only one stick is released', () => {
    render(<MobileControls />)

    const movementStick = screen.getByLabelText('Movement Control')
    const aimStick = screen.getByLabelText('Aim And Fire Control')
    mockStickBounds(movementStick)
    mockStickBounds(aimStick)

    fireEvent.pointerDown(movementStick, { pointerId: 1, clientX: 10, clientY: 68 })
    fireEvent.pointerDown(aimStick, { pointerId: 2, clientX: 126, clientY: 10 })
    fireEvent.pointerUp(aimStick, { pointerId: 2 })

    expect(testState.setMobileGameplayIntent).toHaveBeenLastCalledWith({
      up: false,
      down: false,
      left: true,
      right: false,
      aimAngle: null,
      isSprinting: false,
      fireActive: false,
    })
  })

  it('clears stuck intent on pointer cancel and unmount', () => {
    const { unmount } = render(<MobileControls />)

    const aimStick = screen.getByLabelText('Aim And Fire Control')
    mockStickBounds(aimStick)

    fireEvent.pointerDown(aimStick, { pointerId: 7, clientX: 126, clientY: 10 })
    fireEvent.pointerCancel(aimStick, { pointerId: 7 })

    expect(testState.setMobileGameplayIntent).toHaveBeenLastCalledWith({
      up: false,
      down: false,
      left: false,
      right: false,
      aimAngle: null,
      isSprinting: false,
      fireActive: false,
    })

    unmount()

    expect(testState.setMobileGameplayIntent).toHaveBeenLastCalledWith(null)
  })

  it('keeps tracking aim when the finger moves outside the stick element', () => {
    render(<MobileControls />)

    const aimStick = screen.getByLabelText('Aim And Fire Control')
    mockStickBounds(aimStick)

    fireEvent.pointerDown(aimStick, { pointerId: 7, clientX: 126, clientY: 68 })
    fireEvent.pointerLeave(aimStick, { pointerId: 7 })
    fireEvent.pointerMove(window, { pointerId: 7, clientX: 200, clientY: 68 })

    expect(testState.setMobileGameplayIntent).toHaveBeenLastCalledWith({
      up: false,
      down: false,
      left: false,
      right: false,
      aimAngle: 0,
      isSprinting: false,
      fireActive: true,
    })

    fireEvent.pointerUp(window, { pointerId: 7 })

    expect(testState.setMobileGameplayIntent).toHaveBeenLastCalledWith({
      up: false,
      down: false,
      left: false,
      right: false,
      aimAngle: null,
      isSprinting: false,
      fireActive: false,
    })
  })

  it('triggers reload and dodge actions without replacing bottom controls', () => {
    render(<MobileControls />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Reload' }))
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Dodge' }))

    expect(testState.triggerRuntimeAction).toHaveBeenNthCalledWith(1, 'reload')
    expect(testState.triggerRuntimeAction).toHaveBeenNthCalledWith(2, 'dodge')
    expect(screen.getByLabelText('Movement Control')).toBeInTheDocument()
    expect(screen.getByLabelText('Aim And Fire Control')).toBeInTheDocument()
  })

  it('shows a mobile pickup action only when a nearby crate is available', () => {
    render(<MobileControls />)

    expect(screen.queryByRole('button', { name: 'Pick Up AK47' })).not.toBeInTheDocument()

    act(() => {
      testState.pickupListener?.({ crateId: 'crate-1', weaponType: 'AK47' })
    })

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Pick Up AK47' }))

    expect(testState.triggerRuntimeAction).toHaveBeenCalledWith('pickup')
  })
})
