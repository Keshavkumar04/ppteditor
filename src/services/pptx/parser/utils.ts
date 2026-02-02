/**
 * PPTX Parsing Utilities
 * Conversion functions for EMU (English Metric Units) and other PPTX-specific values
 */

// 914400 EMUs = 1 inch = 96 pixels (at 96 DPI)
const EMU_PER_INCH = 914400
const PIXELS_PER_INCH = 96
const EMU_PER_PIXEL = EMU_PER_INCH / PIXELS_PER_INCH // 9525

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
 * Convert hundredths of a point to pixels
 * PPTX uses hundredths of points for font sizes
 * 1 point = 1/72 inch, 1 pixel = 1/96 inch at 96 DPI
 */
export function hundredthsPointToPixels(hp: number): number {
  const points = hp / 100
  return Math.round(points * (PIXELS_PER_INCH / 72))
}

/**
 * Convert font size in hundredths of a point to standard points
 */
export function hundredthsPointToPoints(hp: number): number {
  return hp / 100
}

/**
 * Convert PPTX percentage value to decimal (0-1)
 * PPTX uses values like 100000 for 100%
 */
export function pptxPercentToDecimal(pptxPercent: number): number {
  return pptxPercent / 100000
}

/**
 * Convert PPTX angle (60000ths of a degree) to degrees
 */
export function pptxAngleToDegrees(pptxAngle: number): number {
  return pptxAngle / 60000
}

/**
 * Parse PPTX color string
 * Colors can be hex values or theme color references
 */
export function parseColor(colorStr: string): string {
  // Remove leading hash if present
  if (colorStr.startsWith('#')) {
    return colorStr
  }
  // Add hash for hex colors
  if (/^[0-9A-Fa-f]{6}$/.test(colorStr)) {
    return `#${colorStr}`
  }
  return colorStr
}

/**
 * Get attribute value from XML element
 */
export function getAttr(element: Element, attrName: string): string | null {
  return element.getAttribute(attrName)
}

/**
 * Get numeric attribute value from XML element
 */
export function getNumericAttr(element: Element, attrName: string, defaultValue = 0): number {
  const value = element.getAttribute(attrName)
  return value ? parseInt(value, 10) : defaultValue
}

/**
 * Find child element by tag name (handles namespaces)
 */
export function findChild(parent: Element, tagName: string): Element | null {
  // Try with and without namespace prefix
  const prefixedMatches = ['a:', 'p:', 'r:', 'c:'].map(prefix =>
    parent.getElementsByTagName(prefix + tagName)[0]
  ).filter(Boolean)

  if (prefixedMatches.length > 0) {
    return prefixedMatches[0]
  }

  // Try without prefix
  return parent.getElementsByTagName(tagName)[0] || null
}

/**
 * Find all child elements by tag name (handles namespaces)
 */
export function findAllChildren(parent: Element, tagName: string): Element[] {
  const results: Element[] = []

  // Try with common namespace prefixes
  for (const prefix of ['a:', 'p:', 'r:', 'c:', '']) {
    const elements = parent.getElementsByTagName(prefix + tagName)
    for (let i = 0; i < elements.length; i++) {
      results.push(elements[i])
    }
  }

  return results
}

/**
 * Get text content from XML element
 */
export function getTextContent(element: Element): string {
  return element.textContent || ''
}

/**
 * Parse XML string to Document
 */
export function parseXML(xmlString: string): Document {
  const parser = new DOMParser()
  return parser.parseFromString(xmlString, 'application/xml')
}

/**
 * Extract relationship ID from reference
 */
export function extractRelId(refString: string): string | null {
  const match = refString.match(/rId\d+/)
  return match ? match[0] : null
}

/**
 * Standard slide dimensions (16:9 ratio in EMU)
 */
export const STANDARD_SLIDE_WIDTH_EMU = 9144000  // 960 pixels
export const STANDARD_SLIDE_HEIGHT_EMU = 5143500 // 540 pixels

/**
 * Theme color mapping
 */
export const THEME_COLOR_MAP: Record<string, string> = {
  dk1: 'dark1',
  dk2: 'dark2',
  lt1: 'light1',
  lt2: 'light2',
  accent1: 'accent1',
  accent2: 'accent2',
  accent3: 'accent3',
  accent4: 'accent4',
  accent5: 'accent5',
  accent6: 'accent6',
  hlink: 'hyperlink',
  folHlink: 'followedHyperlink',
}

/**
 * Default theme colors (Office theme)
 */
export const DEFAULT_THEME_COLORS: Record<string, string> = {
  dark1: '#000000',
  dark2: '#44546A',
  light1: '#FFFFFF',
  light2: '#E7E6E6',
  accent1: '#4472C4',
  accent2: '#ED7D31',
  accent3: '#A5A5A5',
  accent4: '#FFC000',
  accent5: '#5B9BD5',
  accent6: '#70AD47',
  hyperlink: '#0563C1',
  followedHyperlink: '#954F72',
}
