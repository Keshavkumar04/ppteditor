/**
 * Slide Parser
 * Parses slide XML and extracts all elements
 */

import { Slide, SlideElement, TextElement, ShapeElement, Background } from '@/types'
import { generateId } from '@/utils'
import {
  findChild,
  findAllChildren,
  getAttr,
  getNumericAttr,
  emuToPixels,
  parseColor,
  DEFAULT_THEME_COLORS,
} from './utils'
import { parseShape } from './shapeParser'
import { parseImage, buildSlideImageMap, parseSlideRelationships } from './imageParser'
import { parseTextBody } from './textParser'

export interface SlideParseContext {
  slideXml: string
  slideRelsXml: string
  slideIndex: number
  themeColors: Record<string, string>
  globalImageMap: Map<string, string>
  masterBackground?: Background
}

/**
 * Parse a slide XML document
 */
export function parseSlide(
  slideXml: string,
  slideRelsXml: string,
  slideIndex: number,
  themeColors: Record<string, string>,
  globalImageMap: Map<string, string>,
  masterBackground?: Background,
  scaleFactor: number = 1
): Slide {
  const parser = new DOMParser()
  const doc = parser.parseFromString(slideXml, 'application/xml')

  // Parse slide relationships to get image mappings
  const relMap = parseSlideRelationships(slideRelsXml)
  const imageMap = buildSlideImageMap(relMap, globalImageMap)

  // Get common slide data (p:cSld)
  const cSldEl = doc.getElementsByTagName('p:cSld')[0]
  if (!cSldEl) {
    return createEmptySlide(slideIndex, masterBackground)
  }

  // Parse background - use master background as fallback
  let background = parseSlideBackground(cSldEl, themeColors)
  if (background.type === 'solid' && background.color === '#FFFFFF' && masterBackground) {
    background = masterBackground
  }

  // Get shape tree (p:spTree)
  const spTreeEl = cSldEl.getElementsByTagName('p:spTree')[0]
  if (!spTreeEl) {
    return {
      id: generateId(),
      order: slideIndex,
      elements: [],
      background,
    }
  }

  // Parse all elements
  const elements: SlideElement[] = []
  let zIndex = 1

  // Helper to scale element dimensions
  const scaleElement = (el: SlideElement): SlideElement => {
    el.position.x = Math.round(el.position.x * scaleFactor)
    el.position.y = Math.round(el.position.y * scaleFactor)
    el.size.width = Math.round(el.size.width * scaleFactor)
    el.size.height = Math.round(el.size.height * scaleFactor)
    return el
  }

  // Parse shapes (p:sp) - get direct children only to avoid duplicates from groups
  const allShapeEls = spTreeEl.getElementsByTagName('p:sp')
  for (let i = 0; i < allShapeEls.length; i++) {
    const shapeEl = allShapeEls[i]

    // Skip if this shape is inside a group (will be handled by group parser)
    if (isInsideGroup(shapeEl, spTreeEl)) {
      continue
    }

    const element = parseShapeElement(shapeEl, themeColors)
    if (element) {
      element.zIndex = zIndex++
      elements.push(scaleElement(element))
    }
  }

  // Parse pictures (p:pic)
  const allPicEls = spTreeEl.getElementsByTagName('p:pic')
  for (let i = 0; i < allPicEls.length; i++) {
    const picEl = allPicEls[i]

    // Skip if inside a group
    if (isInsideGroup(picEl, spTreeEl)) {
      continue
    }

    const image = parseImage(picEl, slideIndex, imageMap)
    if (image) {
      image.zIndex = zIndex++
      elements.push(scaleElement(image))
    }
  }

  // Parse group shapes (p:grpSp) - only direct children of spTree
  const allGrpSpEls = spTreeEl.getElementsByTagName('p:grpSp')
  for (let i = 0; i < allGrpSpEls.length; i++) {
    const grpSpEl = allGrpSpEls[i]

    // Only process top-level groups
    if (grpSpEl.parentElement === spTreeEl) {
      const groupElements = parseGroupShape(grpSpEl, slideIndex, themeColors, imageMap)
      for (const el of groupElements) {
        el.zIndex = zIndex++
        elements.push(scaleElement(el))
      }
    }
  }

  return {
    id: generateId(),
    order: slideIndex,
    elements,
    background,
  }
}

/**
 * Check if an element is inside a group shape
 */
function isInsideGroup(el: Element, spTreeEl: Element): boolean {
  let parent = el.parentElement
  while (parent && parent !== spTreeEl) {
    if (parent.tagName === 'p:grpSp') {
      return true
    }
    parent = parent.parentElement
  }
  return false
}

/**
 * Default placeholder positions (in pixels, based on 960x540 canvas)
 */
const PLACEHOLDER_DEFAULTS: Record<string, { x: number; y: number; width: number; height: number }> = {
  'title': { x: 50, y: 20, width: 860, height: 80 },
  'ctrTitle': { x: 100, y: 180, width: 760, height: 100 },
  'subTitle': { x: 100, y: 300, width: 760, height: 60 },
  'body': { x: 50, y: 120, width: 860, height: 350 },
  'dt': { x: 50, y: 500, width: 200, height: 30 },
  'ftr': { x: 300, y: 500, width: 360, height: 30 },
  'sldNum': { x: 700, y: 500, width: 200, height: 30 },
}

/**
 * Parse a shape element - decide if it should be text or shape
 */
function parseShapeElement(
  spEl: Element,
  themeColors: Record<string, string>
): TextElement | ShapeElement | null {
  // Get shape properties (p:spPr)
  const spPrEl = findChild(spEl, 'spPr')

  // Get transformation (a:xfrm)
  const xfrmEl = spPrEl ? findChild(spPrEl, 'xfrm') : null

  // Check if this is a placeholder
  const nvSpPrEl = findChild(spEl, 'nvSpPr')
  const nvPrEl = nvSpPrEl ? findChild(nvSpPrEl, 'nvPr') : null
  const phEl = nvPrEl ? findChild(nvPrEl, 'ph') : null
  const placeholderType = phEl ? getAttr(phEl, 'type') || 'body' : null

  // Get position and size
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

  // For placeholders without explicit transform, use defaults
  if (width === 0 && height === 0 && placeholderType) {
    const defaults = PLACEHOLDER_DEFAULTS[placeholderType] || PLACEHOLDER_DEFAULTS['body']
    x = defaults.x
    y = defaults.y
    width = defaults.width
    height = defaults.height
  }

  // Skip elements with no size (and not a placeholder with defaults)
  if (width === 0 && height === 0) {
    return null
  }

  // Check if this has text content
  const txBodyEl = findChild(spEl, 'txBody')
  const hasTextContent = txBodyEl && hasActualText(txBodyEl)

  // Check the geometry type
  const prstGeomEl = spPrEl ? findChild(spPrEl, 'prstGeom') : null
  const geomType = prstGeomEl ? getAttr(prstGeomEl, 'prst') : null

  // Check if it has a visible fill
  const solidFillEl = spPrEl ? findChild(spPrEl, 'solidFill') : null
  const gradFillEl = spPrEl ? findChild(spPrEl, 'gradFill') : null
  const hasVisibleFill = solidFillEl || gradFillEl

  // Decide: text element vs shape element
  // - If it's a rect with text and no visible fill -> text element
  // - If it's a rect with text and visible fill -> shape with text
  // - If it's not a rect -> shape (possibly with text)
  // - If it has no geometry and has text -> text element

  const isRectOrNoGeom = !geomType || geomType === 'rect'

  if (hasTextContent && isRectOrNoGeom && !hasVisibleFill) {
    // Pure text element
    return parseAsTextElement(spEl, x, y, width, height, rotation, themeColors)
  } else if (geomType && geomType !== 'rect') {
    // It's a shape (might have text)
    return parseShape(spEl, 0, themeColors)
  } else if (hasVisibleFill || !hasTextContent) {
    // Shape with fill, or empty shape
    if (hasTextContent) {
      // Shape with text inside
      return parseShape(spEl, 0, themeColors)
    } else if (hasVisibleFill) {
      return parseShape(spEl, 0, themeColors)
    }
    return null
  } else {
    // Text element
    return parseAsTextElement(spEl, x, y, width, height, rotation, themeColors)
  }
}

/**
 * Check if a txBody element has actual text content
 */
function hasActualText(txBodyEl: Element): boolean {
  const textElements = txBodyEl.getElementsByTagName('a:t')
  for (let i = 0; i < textElements.length; i++) {
    const text = textElements[i].textContent?.trim()
    if (text && text.length > 0) {
      return true
    }
  }
  return false
}

/**
 * Parse element as a text element
 */
function parseAsTextElement(
  spEl: Element,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  themeColors: Record<string, string>
): TextElement | null {
  const txBodyEl = findChild(spEl, 'txBody')
  if (!txBodyEl) return null

  const content = parseTextBody(txBodyEl, themeColors)

  // Ensure we have some text
  const hasText = content.paragraphs.some(p =>
    p.runs.some(r => r.text.trim().length > 0)
  )
  if (!hasText) return null

  return {
    id: generateId(),
    type: 'text',
    position: { x, y },
    size: { width, height },
    rotation: rotation || 0,
    zIndex: 0,
    content,
    style: {
      padding: { top: 5, right: 5, bottom: 5, left: 5 },
      verticalAlign: 'top',
      autoFit: false,
      wordWrap: true,
    },
  }
}

/**
 * Parse group shape and flatten its elements
 */
function parseGroupShape(
  grpSpEl: Element,
  slideIndex: number,
  themeColors: Record<string, string>,
  imageMap: Map<string, string>
): SlideElement[] {
  const elements: SlideElement[] = []

  // Get group transform for offset calculation
  const grpSpPrEl = findChild(grpSpEl, 'grpSpPr')
  let offsetX = 0
  let offsetY = 0
  let scaleX = 1
  let scaleY = 1

  if (grpSpPrEl) {
    const xfrmEl = findChild(grpSpPrEl, 'xfrm')
    if (xfrmEl) {
      const offEl = findChild(xfrmEl, 'off')
      const extEl = findChild(xfrmEl, 'ext')
      const chOffEl = findChild(xfrmEl, 'chOff')
      const chExtEl = findChild(xfrmEl, 'chExt')

      if (offEl && chOffEl) {
        const grpX = getNumericAttr(offEl, 'x', 0)
        const grpY = getNumericAttr(offEl, 'y', 0)
        const chX = getNumericAttr(chOffEl, 'x', 0)
        const chY = getNumericAttr(chOffEl, 'y', 0)
        offsetX = emuToPixels(grpX - chX)
        offsetY = emuToPixels(grpY - chY)
      }

      // Calculate scale if group is resized
      if (extEl && chExtEl) {
        const grpW = getNumericAttr(extEl, 'cx', 1)
        const grpH = getNumericAttr(extEl, 'cy', 1)
        const chW = getNumericAttr(chExtEl, 'cx', 1)
        const chH = getNumericAttr(chExtEl, 'cy', 1)
        if (chW > 0) scaleX = grpW / chW
        if (chH > 0) scaleY = grpH / chH
      }
    }
  }

  // Parse child shapes - direct children only
  const childNodes = grpSpEl.childNodes
  for (let i = 0; i < childNodes.length; i++) {
    const child = childNodes[i] as Element
    if (!child.tagName) continue

    if (child.tagName === 'p:sp') {
      const element = parseShapeElement(child, themeColors)
      if (element) {
        // Apply group transform
        element.position.x = element.position.x * scaleX + offsetX
        element.position.y = element.position.y * scaleY + offsetY
        element.size.width = element.size.width * scaleX
        element.size.height = element.size.height * scaleY
        elements.push(element)
      }
    } else if (child.tagName === 'p:pic') {
      const image = parseImage(child, slideIndex, imageMap)
      if (image) {
        image.position.x = image.position.x * scaleX + offsetX
        image.position.y = image.position.y * scaleY + offsetY
        image.size.width = image.size.width * scaleX
        image.size.height = image.size.height * scaleY
        elements.push(image)
      }
    } else if (child.tagName === 'p:grpSp') {
      // Nested group - recurse
      const nestedElements = parseGroupShape(child, slideIndex, themeColors, imageMap)
      for (const el of nestedElements) {
        el.position.x = el.position.x * scaleX + offsetX
        el.position.y = el.position.y * scaleY + offsetY
        el.size.width = el.size.width * scaleX
        el.size.height = el.size.height * scaleY
        elements.push(el)
      }
    }
  }

  return elements
}

/**
 * Parse slide background
 */
function parseSlideBackground(
  cSldEl: Element,
  themeColors: Record<string, string>
): Background {
  const defaultBackground: Background = {
    type: 'solid',
    color: '#FFFFFF',
  }

  // Look for p:bg element
  const bgEls = cSldEl.getElementsByTagName('p:bg')
  if (bgEls.length === 0) {
    return defaultBackground
  }

  const bgEl = bgEls[0]

  // Check for bgPr (background properties)
  const bgPrEl = findChild(bgEl, 'bgPr')
  if (bgPrEl) {
    // Solid fill
    const solidFillEl = findChild(bgPrEl, 'solidFill')
    if (solidFillEl) {
      const color = parseBackgroundColor(solidFillEl, themeColors)
      if (color) {
        return { type: 'solid', color }
      }
    }

    // Gradient fill
    const gradFillEl = findChild(bgPrEl, 'gradFill')
    if (gradFillEl) {
      const gradient = parseGradientFill(gradFillEl, themeColors)
      if (gradient) {
        return gradient
      }
    }

    // Image fill (blipFill)
    const blipFillEl = findChild(bgPrEl, 'blipFill')
    if (blipFillEl) {
      // For now, return a placeholder color since we can't easily get the image
      return { type: 'solid', color: '#E7E6E6' }
    }
  }

  // Check for bgRef (reference to theme)
  const bgRefEl = findChild(bgEl, 'bgRef')
  if (bgRefEl) {
    const color = parseBackgroundColor(bgRefEl, themeColors)
    if (color) {
      return { type: 'solid', color }
    }
  }

  return defaultBackground
}

/**
 * Parse gradient fill
 */
function parseGradientFill(
  gradFillEl: Element,
  themeColors: Record<string, string>
): Background | null {
  const gsLst = findChild(gradFillEl, 'gsLst')
  if (!gsLst) return null

  const gsEls = findAllChildren(gsLst, 'gs')
  if (gsEls.length < 2) {
    // Just use first color as solid
    if (gsEls.length === 1) {
      const color = parseBackgroundColor(gsEls[0], themeColors)
      if (color) {
        return { type: 'solid', color }
      }
    }
    return null
  }

  const stops: Array<{ position: number; color: string }> = []
  for (const gs of gsEls) {
    const pos = getNumericAttr(gs, 'pos', 0) / 100000 // Convert from 100000ths
    const color = parseBackgroundColor(gs, themeColors)
    if (color) {
      stops.push({ position: pos, color })
    }
  }

  if (stops.length < 2) {
    return stops.length === 1 ? { type: 'solid', color: stops[0].color } : null
  }

  // Get gradient angle
  const linEl = findChild(gradFillEl, 'lin')
  let angle = 0
  if (linEl) {
    angle = getNumericAttr(linEl, 'ang', 0) / 60000
  }

  return {
    type: 'gradient',
    gradient: {
      type: 'linear',
      angle,
      stops,
    },
  }
}

/**
 * Parse background color from element
 */
function parseBackgroundColor(
  el: Element,
  themeColors: Record<string, string>
): string | null {
  // Check for srgbClr
  const srgbClrEl = findChild(el, 'srgbClr')
  if (srgbClrEl) {
    const val = getAttr(srgbClrEl, 'val')
    if (val) {
      return parseColor(val)
    }
  }

  // Check for schemeClr
  const schemeClrEl = findChild(el, 'schemeClr')
  if (schemeClrEl) {
    const val = getAttr(schemeClrEl, 'val')
    if (val) {
      // Map scheme color names
      const colorMap: Record<string, string> = {
        'lt1': 'light1',
        'lt2': 'light2',
        'dk1': 'dark1',
        'dk2': 'dark2',
        'accent1': 'accent1',
        'accent2': 'accent2',
        'accent3': 'accent3',
        'accent4': 'accent4',
        'accent5': 'accent5',
        'accent6': 'accent6',
        'bg1': 'light1',
        'bg2': 'light2',
        'tx1': 'dark1',
        'tx2': 'dark2',
      }
      const key = colorMap[val] || val
      return themeColors[key] || DEFAULT_THEME_COLORS[key as keyof typeof DEFAULT_THEME_COLORS] || null
    }
  }

  return null
}

/**
 * Parse slide master background
 */
export function parseMasterBackground(
  masterXml: string,
  themeColors: Record<string, string>,
  _globalImageMap: Map<string, string>
): Background {
  const parser = new DOMParser()
  const doc = parser.parseFromString(masterXml, 'application/xml')

  const cSldEl = doc.getElementsByTagName('p:cSld')[0]
  if (!cSldEl) {
    return { type: 'solid', color: '#FFFFFF' }
  }

  return parseSlideBackground(cSldEl, themeColors)
}

/**
 * Create an empty slide
 */
function createEmptySlide(slideIndex: number, masterBackground?: Background): Slide {
  return {
    id: generateId(),
    order: slideIndex,
    elements: [],
    background: masterBackground || { type: 'solid', color: '#FFFFFF' },
  }
}
