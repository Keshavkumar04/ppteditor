/**
 * Shape Parser
 * Parses shape elements from PPTX XML
 */

import { ShapeElement, ShapeType, Fill, Stroke, TextContent } from '@/types'
import { generateId } from '@/utils'
import {
  emuToPixels,
  parseColor,
  getAttr,
  getNumericAttr,
  findChild,
  findAllChildren,
  DEFAULT_THEME_COLORS,
  THEME_COLOR_MAP,
} from './utils'
import { parseTextBody } from './textParser'

/**
 * Map PPTX preset geometry to our shape types
 */
const PRESET_GEOMETRY_MAP: Record<string, ShapeType> = {
  // Rectangles
  rect: 'rectangle',
  roundRect: 'roundedRectangle',
  snip1Rect: 'rectangle',
  snip2DiagRect: 'rectangle',
  snip2SameRect: 'rectangle',
  snipRoundRect: 'roundedRectangle',
  round1Rect: 'roundedRectangle',
  round2DiagRect: 'roundedRectangle',
  round2SameRect: 'roundedRectangle',

  // Ellipses
  ellipse: 'ellipse',
  pie: 'ellipse',
  chord: 'ellipse',
  arc: 'ellipse',

  // Triangles
  triangle: 'triangle',
  rtTriangle: 'rightTriangle',

  // Arrows
  rightArrow: 'arrowRight',
  leftArrow: 'arrowLeft',
  upArrow: 'arrowUp',
  downArrow: 'arrowDown',
  leftRightArrow: 'arrow',
  upDownArrow: 'arrow',
  bentArrow: 'arrow',
  uturnArrow: 'arrow',
  stripedRightArrow: 'arrowRight',
  notchedRightArrow: 'arrowRight',
  homePlate: 'pentagon',
  chevron: 'arrow',

  // Stars
  star4: 'star5',
  star5: 'star5',
  star6: 'star6',
  star8: 'star5',
  star10: 'star5',
  star12: 'star5',
  star16: 'star5',
  star24: 'star5',
  star32: 'star5',

  // Polygons
  diamond: 'diamond',
  pentagon: 'pentagon',
  hexagon: 'hexagon',
  octagon: 'octagon',
  parallelogram: 'rectangle',
  trapezoid: 'rectangle',

  // Lines
  line: 'line',
  straightConnector1: 'line',
  bentConnector2: 'line',
  bentConnector3: 'line',
  curvedConnector2: 'line',
  curvedConnector3: 'line',

  // Callouts
  wedgeRectCallout: 'callout',
  wedgeRoundRectCallout: 'callout',
  wedgeEllipseCallout: 'callout',
  cloudCallout: 'callout',
  borderCallout1: 'callout',
  borderCallout2: 'callout',
  borderCallout3: 'callout',

  // Special shapes
  heart: 'heart',
  cloud: 'cloud',
  plus: 'plus',
  cross: 'plus',
  donut: 'ellipse',
  cube: 'rectangle',
  can: 'ellipse',
  flowChartProcess: 'rectangle',
  flowChartDecision: 'diamond',
  flowChartTerminator: 'roundedRectangle',
  flowChartDocument: 'rectangle',
}

/**
 * Parse a shape element (p:sp)
 * If fallback position/size is provided, it will be used when xfrm is missing.
 */
export function parseShape(
  spEl: Element,
  _slideIndex: number,
  themeColors: Record<string, string> = DEFAULT_THEME_COLORS,
  fallback?: { x: number; y: number; width: number; height: number },
): ShapeElement | null {
  // Get shape properties (p:spPr)
  const spPrEl = findChild(spEl, 'spPr')
  if (!spPrEl) return null

  // Get transformation (a:xfrm)
  const xfrmEl = findChild(spPrEl, 'xfrm')

  let x = 0, y = 0, width = 0, height = 0, rotation = 0

  if (xfrmEl) {
    const offEl = findChild(xfrmEl, 'off')
    const extEl = findChild(xfrmEl, 'ext')

    if (offEl) {
      x = emuToPixels(getNumericAttr(offEl, 'x', 0))
      y = emuToPixels(getNumericAttr(offEl, 'y', 0))
    }
    if (extEl) {
      width = emuToPixels(getNumericAttr(extEl, 'cx', 0))
      height = emuToPixels(getNumericAttr(extEl, 'cy', 0))
    }

    const rot = getNumericAttr(xfrmEl, 'rot', 0)
    rotation = rot / 60000
  }

  // Use fallback if no position/size from xfrm
  if (width === 0 && height === 0 && fallback) {
    x = fallback.x
    y = fallback.y
    width = fallback.width
    height = fallback.height
  }

  // Skip if still no size
  if (width === 0 && height === 0) return null

  // Get shape type from preset geometry
  const prstGeomEl = findChild(spPrEl, 'prstGeom')
  const presetType = prstGeomEl ? getAttr(prstGeomEl, 'prst') : 'rect'
  const shapeType: ShapeType = PRESET_GEOMETRY_MAP[presetType || 'rect'] || 'rectangle'

  // Parse fill
  const fill = parseFill(spPrEl, themeColors)

  // Parse stroke/outline (a:ln)
  const stroke = parseStroke(spPrEl, themeColors)

  // Parse text content if present
  const txBodyEl = findChild(spEl, 'txBody')
  const text: TextContent | undefined = txBodyEl
    ? parseTextBody(txBodyEl, themeColors)
    : undefined

  return {
    id: generateId(),
    type: 'shape',
    shapeType,
    position: { x, y },
    size: { width, height },
    rotation: rotation || 0,
    zIndex: 0, // Will be set by slide parser
    fill,
    stroke,
    text,
  }
}

/**
 * Parse fill properties
 */
function parseFill(
  spPrEl: Element,
  themeColors: Record<string, string>
): Fill | undefined {
  // Check for solid fill
  const solidFillEl = findChild(spPrEl, 'solidFill')
  if (solidFillEl) {
    const color = parseColorElement(solidFillEl, themeColors)
    if (color) {
      return { type: 'solid', color }
    }
  }

  // Check for no fill
  const noFillEl = findChild(spPrEl, 'noFill')
  if (noFillEl) {
    return { type: 'none' }
  }

  // Check for gradient fill
  const gradFillEl = findChild(spPrEl, 'gradFill')
  if (gradFillEl) {
    const gradient = parseGradientFill(gradFillEl, themeColors)
    if (gradient) {
      return gradient
    }
  }

  // Default fill
  return { type: 'solid', color: '#4472C4' }
}

/**
 * Parse gradient fill
 */
function parseGradientFill(
  gradFillEl: Element,
  themeColors: Record<string, string>
): Fill | undefined {
  const gsLst = findChild(gradFillEl, 'gsLst')
  if (!gsLst) return undefined

  const stops = findAllChildren(gsLst, 'gs')
  if (stops.length < 2) return undefined

  const colors: string[] = []
  for (const stop of stops) {
    const color = parseColorElement(stop, themeColors)
    if (color) {
      colors.push(color)
    }
  }

  if (colors.length >= 2) {
    // Determine gradient direction
    const linEl = findChild(gradFillEl, 'lin')
    let angle = 0
    if (linEl) {
      const angAttr = getNumericAttr(linEl, 'ang', 0)
      angle = angAttr / 60000
    }

    return {
      type: 'gradient',
      gradient: {
        type: 'linear',
        angle,
        stops: colors.map((color, i) => ({
          color,
          position: i / (colors.length - 1),
        })),
      },
    }
  }

  return undefined
}

/**
 * Parse stroke/outline properties
 */
function parseStroke(
  spPrEl: Element,
  themeColors: Record<string, string>
): Stroke | undefined {
  const lnEl = findChild(spPrEl, 'ln')
  if (!lnEl) return undefined

  // Check for no line
  const noFillEl = findChild(lnEl, 'noFill')
  if (noFillEl) return undefined

  // Get width (in EMU)
  const wAttr = getNumericAttr(lnEl, 'w', 12700) // Default ~1pt
  const width = Math.max(1, emuToPixels(wAttr))

  // Get color
  const solidFillEl = findChild(lnEl, 'solidFill')
  let color = '#2F528F' // Default outline color
  if (solidFillEl) {
    const parsedColor = parseColorElement(solidFillEl, themeColors)
    if (parsedColor) {
      color = parsedColor
    }
  }

  // Get line style
  const prstDashEl = findChild(lnEl, 'prstDash')
  let style: 'solid' | 'dashed' | 'dotted' = 'solid'
  if (prstDashEl) {
    const val = getAttr(prstDashEl, 'val')
    if (val === 'dash' || val === 'lgDash' || val === 'sysDash') {
      style = 'dashed'
    } else if (val === 'dot' || val === 'sysDot') {
      style = 'dotted'
    }
  }

  return { color, width, style }
}

/**
 * Parse color from various color elements
 */
function parseColorElement(
  parentEl: Element,
  themeColors: Record<string, string>
): string | null {
  // Check for srgbClr (direct RGB color)
  const srgbClrEl = findChild(parentEl, 'srgbClr')
  if (srgbClrEl) {
    const val = getAttr(srgbClrEl, 'val')
    if (val) {
      return parseColor(val)
    }
  }

  // Check for schemeClr (theme color reference)
  const schemeClrEl = findChild(parentEl, 'schemeClr')
  if (schemeClrEl) {
    const val = getAttr(schemeClrEl, 'val')
    if (val) {
      const themeKey = THEME_COLOR_MAP[val] || val
      return themeColors[themeKey] || DEFAULT_THEME_COLORS[themeKey] || null
    }
  }

  // Check for prstClr (preset color)
  const prstClrEl = findChild(parentEl, 'prstClr')
  if (prstClrEl) {
    const val = getAttr(prstClrEl, 'val')
    if (val) {
      return getPresetColor(val)
    }
  }

  return null
}

/**
 * Get preset color value
 */
function getPresetColor(name: string): string {
  const presetColors: Record<string, string> = {
    black: '#000000',
    white: '#FFFFFF',
    red: '#FF0000',
    green: '#00FF00',
    blue: '#0000FF',
    yellow: '#FFFF00',
    cyan: '#00FFFF',
    magenta: '#FF00FF',
    gray: '#808080',
    grey: '#808080',
    silver: '#C0C0C0',
    maroon: '#800000',
    olive: '#808000',
    navy: '#000080',
    purple: '#800080',
    teal: '#008080',
    orange: '#FFA500',
    pink: '#FFC0CB',
  }
  return presetColors[name.toLowerCase()] || '#000000'
}
