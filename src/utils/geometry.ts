import { Position, Size, SelectionBounds } from '@/types'

// EMU (English Metric Units) conversions
// 1 inch = 914400 EMU, 1 inch = 96 pixels (at 96 DPI)
export const EMU_PER_INCH = 914400
export const PIXELS_PER_INCH = 96
export const EMU_PER_PIXEL = EMU_PER_INCH / PIXELS_PER_INCH

/**
 * Convert EMU to pixels
 */
export function emuToPixels(emu: number): number {
  return Math.round(emu / EMU_PER_PIXEL)
}

/**
 * Convert pixels to EMU
 */
export function pixelsToEmu(pixels: number): number {
  return Math.round(pixels * EMU_PER_PIXEL)
}

/**
 * PPTX uses percentages * 100000 for some values
 */
export function pptxPercentToDecimal(value: number): number {
  return value / 100000
}

/**
 * Convert decimal to PPTX percentage format
 */
export function decimalToPptxPercent(value: number): number {
  return Math.round(value * 100000)
}

/**
 * Calculate the bounding box of multiple elements
 */
export function calculateBounds(
  positions: Position[],
  sizes: Size[]
): SelectionBounds | null {
  if (positions.length === 0 || positions.length !== sizes.length) {
    return null
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]
    const size = sizes[i]

    minX = Math.min(minX, pos.x)
    minY = Math.min(minY, pos.y)
    maxX = Math.max(maxX, pos.x + size.width)
    maxY = Math.max(maxY, pos.y + size.height)
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Check if a point is inside a rectangle
 */
export function isPointInRect(
  point: Position,
  rect: SelectionBounds
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  )
}

/**
 * Check if two rectangles intersect
 */
export function doRectsIntersect(
  rect1: SelectionBounds,
  rect2: SelectionBounds
): boolean {
  return !(
    rect1.x + rect1.width < rect2.x ||
    rect2.x + rect2.width < rect1.x ||
    rect1.y + rect1.height < rect2.y ||
    rect2.y + rect2.height < rect1.y
  )
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Snap a value to a grid
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize
}

/**
 * Convert degrees to radians
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Convert radians to degrees
 */
export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI
}

/**
 * Rotate a point around an origin
 */
export function rotatePoint(
  point: Position,
  origin: Position,
  angleDegrees: number
): Position {
  const angleRadians = degreesToRadians(angleDegrees)
  const cos = Math.cos(angleRadians)
  const sin = Math.sin(angleRadians)

  const dx = point.x - origin.x
  const dy = point.y - origin.y

  return {
    x: origin.x + dx * cos - dy * sin,
    y: origin.y + dx * sin + dy * cos,
  }
}

/**
 * Get the center point of a rectangle
 */
export function getRectCenter(rect: SelectionBounds): Position {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  }
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Position, p2: Position): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}
