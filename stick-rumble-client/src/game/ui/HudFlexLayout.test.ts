import { describe, expect, it, vi } from 'vitest'
import { HudFlexLayout, createHudLayoutItem } from './HudFlexLayout'

describe('HudFlexLayout', () => {
  it('lays out a row with gap and center alignment', () => {
    const first = vi.fn()
    const second = vi.fn()
    const layout = new HudFlexLayout('row', 8, 'center')

    layout.add(createHudLayoutItem({ width: 20, height: 10 }, first))
    layout.add(createHudLayoutItem({ width: 40, height: 20 }, second))

    layout.setPosition(20, 30)

    expect(first).toHaveBeenCalledWith(20, 35)
    expect(second).toHaveBeenCalledWith(48, 30)
    expect(layout.measure()).toEqual({ width: 68, height: 20 })
  })

  it('lays out a column using measured child heights', () => {
    const first = vi.fn()
    const second = vi.fn()
    const layout = new HudFlexLayout('column', 12, 'start')

    layout.add(createHudLayoutItem({ width: 200, height: 34 }, first))
    layout.add(createHudLayoutItem({ width: 120, height: 16 }, second))

    layout.setPosition(20, 20)

    expect(first).toHaveBeenCalledWith(20, 20)
    expect(second).toHaveBeenCalledWith(20, 66)
    expect(layout.measure()).toEqual({ width: 200, height: 62 })
  })
})
