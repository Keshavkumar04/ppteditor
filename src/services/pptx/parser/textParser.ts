/**
 * Text Parser
 * Parses text content from PPTX XML including formatting
 */

import { TextContent, Paragraph, TextRun, TextStyle, FontScheme } from '@/types'
import { generateId } from '@/utils'
import {
  parseColor,
  hundredthsPointToPoints,
  findAllChildren,
  findChild,
  getAttr,
  getNumericAttr,
  getTextContent,
  DEFAULT_THEME_COLORS,
  THEME_COLOR_MAP,
} from './utils'

// Default font scheme for fallback
const DEFAULT_FONT_SCHEME: FontScheme = {
  majorFont: { latin: 'Calibri Light' },
  minorFont: { latin: 'Calibri' },
}

// Module-level state for font scheme (set by importer)
let currentFontScheme: FontScheme = DEFAULT_FONT_SCHEME
let currentScaleFactor: number = 1

/**
 * Set the font scheme for text parsing
 */
export function setFontScheme(fontScheme: FontScheme): void {
  currentFontScheme = fontScheme
}

/**
 * Set the scale factor for font sizes
 */
export function setScaleFactor(scale: number): void {
  currentScaleFactor = scale
}

/**
 * Resolve theme font reference to actual font name
 */
function resolveThemeFont(typeface: string): string {
  // Theme font references start with + followed by mn (minor) or mj (major)
  // Examples: +mn-lt (minor latin), +mj-lt (major latin), +mn-ea (minor east asian)
  if (typeface.startsWith('+mn')) {
    return currentFontScheme.minorFont.latin
  }
  if (typeface.startsWith('+mj')) {
    return currentFontScheme.majorFont.latin
  }
  return typeface
}

/**
 * Parse text body element (p:txBody or a:txBody)
 */
export function parseTextBody(
  txBody: Element,
  themeColors: Record<string, string> = DEFAULT_THEME_COLORS
): TextContent {
  const paragraphs: Paragraph[] = []
  const pElements = findAllChildren(txBody, 'p')

  for (const pEl of pElements) {
    const paragraph = parseParagraph(pEl, themeColors)
    if (paragraph.runs.length > 0 || paragraphs.length === 0) {
      paragraphs.push(paragraph)
    }
  }

  // Ensure at least one paragraph
  if (paragraphs.length === 0) {
    paragraphs.push({
      id: generateId(),
      runs: [{ id: generateId(), text: '', style: getDefaultTextStyle() }],
      alignment: 'left',
    })
  }

  return { paragraphs }
}

/**
 * Parse a single paragraph
 */
function parseParagraph(
  pEl: Element,
  themeColors: Record<string, string>
): Paragraph {
  const runs: TextRun[] = []
  const alignment = parseAlignment(pEl)

  // Find text runs (a:r elements)
  const rElements = findAllChildren(pEl, 'r')

  for (const rEl of rElements) {
    const run = parseTextRun(rEl, themeColors)
    if (run) {
      runs.push(run)
    }
  }

  // Handle field elements (a:fld) - like page numbers, dates
  const fldElements = findAllChildren(pEl, 'fld')
  for (const fldEl of fldElements) {
    const run = parseTextField(fldEl, themeColors)
    if (run) {
      runs.push(run)
    }
  }

  // If no runs found, check for direct text content
  if (runs.length === 0) {
    const textContent = getTextContent(pEl).trim()
    if (textContent) {
      runs.push({
        id: generateId(),
        text: textContent,
        style: getDefaultTextStyle(),
      })
    }
  }

  return { id: generateId(), runs, alignment }
}

/**
 * Parse a text run (a:r element)
 */
function parseTextRun(
  rEl: Element,
  themeColors: Record<string, string>
): TextRun | null {
  // Get text content (a:t element)
  const tEl = findChild(rEl, 't')
  if (!tEl) return null

  const text = getTextContent(tEl)
  if (!text) return null

  // Get run properties (a:rPr)
  const rPrEl = findChild(rEl, 'rPr')
  const style = rPrEl
    ? parseTextRunProperties(rPrEl, themeColors)
    : getDefaultTextStyle()

  return { id: generateId(), text, style }
}

/**
 * Parse field element (dates, page numbers, etc.)
 */
function parseTextField(
  fldEl: Element,
  themeColors: Record<string, string>
): TextRun | null {
  const tEl = findChild(fldEl, 't')
  if (!tEl) return null

  const text = getTextContent(tEl)
  const rPrEl = findChild(fldEl, 'rPr')
  const style = rPrEl
    ? parseTextRunProperties(rPrEl, themeColors)
    : getDefaultTextStyle()

  return { id: generateId(), text, style }
}

/**
 * Parse text run properties (a:rPr)
 */
function parseTextRunProperties(
  rPrEl: Element,
  themeColors: Record<string, string>
): TextStyle {
  const style: TextStyle = getDefaultTextStyle()

  // Font size (sz attribute in hundredths of a point)
  const sz = getNumericAttr(rPrEl, 'sz', 0)
  if (sz > 0) {
    // Apply scale factor to font size
    style.fontSize = Math.round(hundredthsPointToPoints(sz) * currentScaleFactor)
  }

  // Bold (b attribute)
  const bold = getAttr(rPrEl, 'b')
  if (bold === '1' || bold === 'true') {
    style.fontWeight = 'bold'
  }

  // Italic (i attribute)
  const italic = getAttr(rPrEl, 'i')
  if (italic === '1' || italic === 'true') {
    style.fontStyle = 'italic'
  }

  // Underline (u attribute)
  const underline = getAttr(rPrEl, 'u')
  if (underline && underline !== 'none') {
    style.textDecoration = 'underline'
  }

  // Strikethrough (strike attribute)
  const strike = getAttr(rPrEl, 'strike')
  if (strike && strike !== 'noStrike') {
    style.textDecoration = 'line-through'
  }

  // Font family - check latin element first
  const latinEl = findChild(rPrEl, 'latin')
  if (latinEl) {
    const typeface = getAttr(latinEl, 'typeface')
    if (typeface) {
      // Resolve theme font references like +mn-lt or +mj-lt
      style.fontFamily = resolveThemeFont(typeface)
    }
  }

  // If no font specified, use minor (body) font from theme
  if (style.fontFamily === 'Calibri') {
    style.fontFamily = currentFontScheme.minorFont.latin
  }

  // Color
  const solidFillEl = findChild(rPrEl, 'solidFill')
  if (solidFillEl) {
    const color = parseSolidFill(solidFillEl, themeColors)
    if (color) {
      style.color = color
    }
  }

  return style
}

/**
 * Parse paragraph alignment
 */
function parseAlignment(pEl: Element): 'left' | 'center' | 'right' | 'justify' {
  const pPrEl = findChild(pEl, 'pPr')
  if (!pPrEl) return 'left'

  const algn = getAttr(pPrEl, 'algn')
  switch (algn) {
    case 'ctr':
      return 'center'
    case 'r':
      return 'right'
    case 'just':
      return 'justify'
    default:
      return 'left'
  }
}

/**
 * Parse solid fill color
 */
function parseSolidFill(
  solidFillEl: Element,
  themeColors: Record<string, string>
): string | null {
  // Check for srgbClr (direct RGB color)
  const srgbClrEl = findChild(solidFillEl, 'srgbClr')
  if (srgbClrEl) {
    const val = getAttr(srgbClrEl, 'val')
    if (val) {
      return parseColor(val)
    }
  }

  // Check for schemeClr (theme color reference)
  const schemeClrEl = findChild(solidFillEl, 'schemeClr')
  if (schemeClrEl) {
    const val = getAttr(schemeClrEl, 'val')
    if (val) {
      const themeKey = THEME_COLOR_MAP[val] || val
      return themeColors[themeKey] || DEFAULT_THEME_COLORS[themeKey] || '#000000'
    }
  }

  return null
}

/**
 * Get default text style
 */
function getDefaultTextStyle(): TextStyle {
  return {
    fontFamily: 'Calibri',
    fontSize: 18,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#000000',
  }
}

/**
 * Parse text body and extract plain text
 */
export function extractPlainText(txBody: Element): string {
  const textContent = parseTextBody(txBody)
  return textContent.paragraphs
    .map(p => p.runs.map(r => r.text).join(''))
    .join('\n')
}
