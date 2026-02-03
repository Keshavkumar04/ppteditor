/**
 * Theme Parser
 * Parses theme colors and fonts from PPTX XML
 */

import { ColorScheme, FontScheme } from '@/types'
import {
  parseColor,
  getAttr,
  findChild,
  DEFAULT_THEME_COLORS,
} from './utils'

/** Parsed background fill style from theme */
export interface ThemeBgFillStyle {
  type: 'solid' | 'gradient'
  solidColor?: string
  schemeClr?: string
  gradient?: { stops: Array<{ position: number; color?: string; schemeClr?: string }>; angle: number }
}

/**
 * Parse theme XML and extract colors and fonts
 */
export function parseTheme(themeXml: string): {
  colors: Record<string, string>
  fonts: { heading: string; body: string }
  colorScheme: ColorScheme
  fontScheme: FontScheme
  bgFillStyles: ThemeBgFillStyle[]
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(themeXml, 'application/xml')

  const colors = parseThemeColors(doc)
  const fonts = parseThemeFonts(doc)
  const bgFillStyles = parseBgFillStyleLst(doc)

  // Build ColorScheme
  const colorScheme: ColorScheme = {
    dark1: colors.dark1 || DEFAULT_THEME_COLORS.dark1,
    light1: colors.light1 || DEFAULT_THEME_COLORS.light1,
    dark2: colors.dark2 || DEFAULT_THEME_COLORS.dark2,
    light2: colors.light2 || DEFAULT_THEME_COLORS.light2,
    accent1: colors.accent1 || DEFAULT_THEME_COLORS.accent1,
    accent2: colors.accent2 || DEFAULT_THEME_COLORS.accent2,
    accent3: colors.accent3 || DEFAULT_THEME_COLORS.accent3,
    accent4: colors.accent4 || DEFAULT_THEME_COLORS.accent4,
    accent5: colors.accent5 || DEFAULT_THEME_COLORS.accent5,
    accent6: colors.accent6 || DEFAULT_THEME_COLORS.accent6,
    hyperlink: colors.hyperlink || DEFAULT_THEME_COLORS.hyperlink,
    followedHyperlink: colors.followedHyperlink || DEFAULT_THEME_COLORS.followedHyperlink,
    // Semantic aliases (light1 = background1, dark1 = text1, etc.)
    background1: colors.light1 || DEFAULT_THEME_COLORS.light1,
    text1: colors.dark1 || DEFAULT_THEME_COLORS.dark1,
    background2: colors.light2 || DEFAULT_THEME_COLORS.light2,
    text2: colors.dark2 || DEFAULT_THEME_COLORS.dark2,
  }

  // Build FontScheme
  const fontScheme: FontScheme = {
    majorFont: { latin: fonts.heading },
    minorFont: { latin: fonts.body },
  }

  return { colors, fonts, colorScheme, fontScheme, bgFillStyles }
}

/**
 * Parse background fill style list from theme fmtScheme
 * These are referenced by bgRef idx (1001 = index 0, 1002 = index 1, etc.)
 */
function parseBgFillStyleLst(doc: Document): ThemeBgFillStyle[] {
  const styles: ThemeBgFillStyle[] = []

  const bgFillLst = doc.getElementsByTagName('a:bgFillStyleLst')[0]
  if (!bgFillLst) return styles

  // Iterate direct children (solidFill, gradFill, etc.)
  for (let i = 0; i < bgFillLst.childNodes.length; i++) {
    const child = bgFillLst.childNodes[i] as Element
    if (!child.tagName) continue

    if (child.tagName === 'a:solidFill') {
      const srgbEl = child.getElementsByTagName('a:srgbClr')[0]
      const schemeEl = child.getElementsByTagName('a:schemeClr')[0]
      styles.push({
        type: 'solid',
        solidColor: srgbEl ? parseColor(getAttr(srgbEl, 'val') || '') : undefined,
        schemeClr: schemeEl ? getAttr(schemeEl, 'val') || undefined : undefined,
      })
    } else if (child.tagName === 'a:gradFill') {
      const gsLst = child.getElementsByTagName('a:gsLst')[0]
      const stops: ThemeBgFillStyle['gradient'] extends undefined ? never : NonNullable<ThemeBgFillStyle['gradient']>['stops'] = []
      if (gsLst) {
        const gsEls = gsLst.getElementsByTagName('a:gs')
        for (let j = 0; j < gsEls.length; j++) {
          const gs = gsEls[j]
          const pos = parseInt(getAttr(gs, 'pos') || '0') / 100000
          const srgb = gs.getElementsByTagName('a:srgbClr')[0]
          const scheme = gs.getElementsByTagName('a:schemeClr')[0]
          stops.push({
            position: pos,
            color: srgb ? parseColor(getAttr(srgb, 'val') || '') : undefined,
            schemeClr: scheme ? getAttr(scheme, 'val') || undefined : undefined,
          })
        }
      }
      const linEl = child.getElementsByTagName('a:lin')[0]
      const angle = linEl ? parseInt(getAttr(linEl, 'ang') || '0') / 60000 : 0
      styles.push({ type: 'gradient', gradient: { stops, angle } })
    } else {
      // Other fill types (blipFill, pattFill) - treat as solid placeholder
      styles.push({ type: 'solid', schemeClr: 'bg1' })
    }
  }

  return styles
}

/**
 * Parse theme colors from a:clrScheme
 */
function parseThemeColors(doc: Document): Record<string, string> {
  const colors: Record<string, string> = { ...DEFAULT_THEME_COLORS }

  // Find color scheme (a:clrScheme)
  const clrSchemeEl = doc.getElementsByTagName('a:clrScheme')[0]
  if (!clrSchemeEl) {
    return colors
  }

  // Parse each color definition
  const colorMappings = [
    { tag: 'a:dk1', key: 'dark1' },
    { tag: 'a:dk2', key: 'dark2' },
    { tag: 'a:lt1', key: 'light1' },
    { tag: 'a:lt2', key: 'light2' },
    { tag: 'a:accent1', key: 'accent1' },
    { tag: 'a:accent2', key: 'accent2' },
    { tag: 'a:accent3', key: 'accent3' },
    { tag: 'a:accent4', key: 'accent4' },
    { tag: 'a:accent5', key: 'accent5' },
    { tag: 'a:accent6', key: 'accent6' },
    { tag: 'a:hlink', key: 'hyperlink' },
    { tag: 'a:folHlink', key: 'followedHyperlink' },
  ]

  for (const { tag, key } of colorMappings) {
    const elements = clrSchemeEl.getElementsByTagName(tag)
    if (elements.length > 0) {
      const color = extractColor(elements[0])
      if (color) {
        colors[key] = color
      }
    }
  }

  return colors
}

/**
 * Extract color value from color element
 */
function extractColor(colorEl: Element): string | null {
  // Check for srgbClr (direct RGB)
  const srgbClrEls = colorEl.getElementsByTagName('a:srgbClr')
  if (srgbClrEls.length > 0) {
    const val = getAttr(srgbClrEls[0], 'val')
    if (val) {
      return parseColor(val)
    }
  }

  // Check for sysClr (system color)
  const sysClrEls = colorEl.getElementsByTagName('a:sysClr')
  if (sysClrEls.length > 0) {
    const lastClr = getAttr(sysClrEls[0], 'lastClr')
    if (lastClr) {
      return parseColor(lastClr)
    }
    // Fallback to val attribute
    const val = getAttr(sysClrEls[0], 'val')
    if (val) {
      return getSystemColor(val)
    }
  }

  return null
}

/**
 * Get system color value
 */
function getSystemColor(sysColor: string): string {
  const systemColors: Record<string, string> = {
    windowText: '#000000',
    window: '#FFFFFF',
    highlight: '#0078D4',
    highlightText: '#FFFFFF',
    buttonFace: '#F0F0F0',
    buttonText: '#000000',
    captionText: '#000000',
    grayText: '#808080',
    infoBackground: '#FFFFE1',
    infoText: '#000000',
    menuText: '#000000',
    scrollbar: '#C0C0C0',
    windowFrame: '#000000',
    menuHighlight: '#0078D4',
  }
  return systemColors[sysColor] || '#000000'
}

/**
 * Parse theme fonts from a:fontScheme
 */
function parseThemeFonts(doc: Document): { heading: string; body: string } {
  const fonts = {
    heading: 'Calibri Light',
    body: 'Calibri',
  }

  // Find font scheme (a:fontScheme)
  const fontSchemeEl = doc.getElementsByTagName('a:fontScheme')[0]
  if (!fontSchemeEl) {
    return fonts
  }

  // Get major font (headings)
  const majorFontEl = fontSchemeEl.getElementsByTagName('a:majorFont')[0]
  if (majorFontEl) {
    const latinEl = majorFontEl.getElementsByTagName('a:latin')[0]
    if (latinEl) {
      const typeface = getAttr(latinEl, 'typeface')
      if (typeface) {
        fonts.heading = typeface
      }
    }
  }

  // Get minor font (body)
  const minorFontEl = fontSchemeEl.getElementsByTagName('a:minorFont')[0]
  if (minorFontEl) {
    const latinEl = minorFontEl.getElementsByTagName('a:latin')[0]
    if (latinEl) {
      const typeface = getAttr(latinEl, 'typeface')
      if (typeface) {
        fonts.body = typeface
      }
    }
  }

  return fonts
}

/**
 * Parse background color from slide master or slide layout
 */
export function parseBackground(bgEl: Element, themeColors: Record<string, string>): string | null {
  if (!bgEl) return null

  // Check for solid fill
  const bgPrEl = findChild(bgEl, 'bgPr')
  if (bgPrEl) {
    const solidFillEl = findChild(bgPrEl, 'solidFill')
    if (solidFillEl) {
      // Check for srgbClr
      const srgbClrEl = findChild(solidFillEl, 'srgbClr')
      if (srgbClrEl) {
        const val = getAttr(srgbClrEl, 'val')
        if (val) {
          return parseColor(val)
        }
      }
      // Check for schemeClr
      const schemeClrEl = findChild(solidFillEl, 'schemeClr')
      if (schemeClrEl) {
        const val = getAttr(schemeClrEl, 'val')
        if (val && themeColors[val]) {
          return themeColors[val]
        }
      }
    }
  }

  // Check for bgRef (reference to theme)
  const bgRefEl = findChild(bgEl, 'bgRef')
  if (bgRefEl) {
    const schemeClrEl = findChild(bgRefEl, 'schemeClr')
    if (schemeClrEl) {
      const val = getAttr(schemeClrEl, 'val')
      const mappedKey = val === 'lt1' ? 'light1' : val === 'lt2' ? 'light2' : val
      if (mappedKey && themeColors[mappedKey]) {
        return themeColors[mappedKey]
      }
    }
  }

  return null
}

/**
 * Parse slide master for default background
 */
export function parseSlideMaster(
  masterXml: string,
  themeColors: Record<string, string>
): { background: string | null } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(masterXml, 'application/xml')

  // Find cSld element
  const cSldEls = doc.getElementsByTagName('p:cSld')
  if (cSldEls.length === 0) {
    return { background: null }
  }

  // Find background element
  const bgEls = cSldEls[0].getElementsByTagName('p:bg')
  if (bgEls.length === 0) {
    return { background: null }
  }

  const background = parseBackground(bgEls[0], themeColors)
  return { background }
}
