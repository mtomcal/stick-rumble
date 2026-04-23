export type HudFlexDirection = 'row' | 'column'
export type HudFlexAlign = 'start' | 'center' | 'end'

export type HudLayoutSize = {
  width: number
  height: number
}

export interface HudLayoutItem {
  measure(): HudLayoutSize
  setPosition(x: number, y: number): void
}

export class HudFlexLayout implements HudLayoutItem {
  private readonly children: HudLayoutItem[] = []
  private readonly direction: HudFlexDirection
  private readonly gap: number
  private readonly align: HudFlexAlign

  constructor(direction: HudFlexDirection, gap: number = 0, align: HudFlexAlign = 'start') {
    this.direction = direction
    this.gap = gap
    this.align = align
  }

  add(child: HudLayoutItem): void {
    this.children.push(child)
  }

  measure(): HudLayoutSize {
    if (this.children.length === 0) {
      return { width: 0, height: 0 }
    }

    const sizes = this.children.map((child) => child.measure())
    const totalGap = this.gap * Math.max(0, this.children.length - 1)

    if (this.direction === 'row') {
      return {
        width: sizes.reduce((total, size) => total + size.width, 0) + totalGap,
        height: sizes.reduce((max, size) => Math.max(max, size.height), 0),
      }
    }

    return {
      width: sizes.reduce((max, size) => Math.max(max, size.width), 0),
      height: sizes.reduce((total, size) => total + size.height, 0) + totalGap,
    }
  }

  setPosition(x: number, y: number): void {
    const layoutSize = this.measure()
    let cursor = 0

    for (const child of this.children) {
      const childSize = child.measure()

      if (this.direction === 'row') {
        child.setPosition(x + cursor, y + this.getCrossAxisOffset(layoutSize.height, childSize.height))
        cursor += childSize.width + this.gap
      } else {
        child.setPosition(x + this.getCrossAxisOffset(layoutSize.width, childSize.width), y + cursor)
        cursor += childSize.height + this.gap
      }
    }
  }

  private getCrossAxisOffset(containerSize: number, childSize: number): number {
    if (this.align === 'center') {
      return (containerSize - childSize) / 2
    }

    if (this.align === 'end') {
      return containerSize - childSize
    }

    return 0
  }
}

export function createHudLayoutItem(
  size: HudLayoutSize | (() => HudLayoutSize),
  place: (x: number, y: number) => void
): HudLayoutItem {
  return {
    measure: () => (typeof size === 'function' ? size() : size),
    setPosition: place,
  }
}
