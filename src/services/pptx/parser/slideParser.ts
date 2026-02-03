/**
 * Slide Parser
 * Parses slide XML and extracts all elements
 */

import { Slide, SlideElement, TextElement, ShapeElement, ImageElement, TableElement, TableCell, CellBorders, Stroke, Background } from '@/types'
import { generateId } from '@/utils'
import {
  findChild,
  findAllChildren,
  getAttr,
  getNumericAttr,
  emuToPixels,
  parseColor,
  DEFAULT_THEME_COLORS,
  THEME_COLOR_MAP,
} from './utils'
import { parseShape } from './shapeParser'
import { parseImage, buildSlideImageMap, parseSlideRelationships } from './imageParser'
import { parseTextBody } from './textParser'
import type { LayoutPlaceholders } from '../importer'
import type { ThemeBgFillStyle } from './themeParser'

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
  scaleFactor: number = 1,
  layoutPlaceholders?: LayoutPlaceholders,
  layoutImageMap?: Map<string, string>,
  layoutXml?: string,
  masterXml?: string,
  masterImageMap?: Map<string, string>,
): Slide {
  const parser = new DOMParser()
  const doc = parser.parseFromString(slideXml, 'application/xml')

  // Parse slide relationships to get image mappings
  const relMap = parseSlideRelationships(slideRelsXml)
  const imageMap = buildSlideImageMap(relMap, globalImageMap)

  // Get common slide data (p:cSld)
  let cSldEl = doc.getElementsByTagName('p:cSld')[0]
  if (!cSldEl) {
    cSldEl = doc.getElementsByTagName('cSld')[0] as Element
  }
  if (!cSldEl) {
    return createEmptySlide(slideIndex, masterBackground)
  }

  // Parse background - use master background as fallback
  let background = parseSlideBackground(cSldEl, themeColors)
  if (background.type === 'solid' && background.color === '#FFFFFF' && masterBackground) {
    background = masterBackground
  }

  // Get shape tree (p:spTree)
  let spTreeEl = cSldEl.getElementsByTagName('p:spTree')[0]
  if (!spTreeEl) {
    spTreeEl = cSldEl.getElementsByTagName('spTree')[0] as Element
  }
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

  // Helper to scale element dimensions.
  // Uses edge-based calculation and nudges elements that would overflow
  // the canvas back in, so footer text at the very bottom isn't clipped.
  const TARGET_H = 540
  const scaleElement = (el: SlideElement): SlideElement => {
    const x1 = Math.round(el.position.x * scaleFactor)
    const y1 = Math.round(el.position.y * scaleFactor)
    const x2 = Math.round((el.position.x + el.size.width) * scaleFactor)
    const y2 = Math.round((el.position.y + el.size.height) * scaleFactor)
    el.position.x = x1
    el.size.width = x2 - x1
    let h = y2 - y1

    // If the element overflows the bottom by a small amount, shift it up
    if (y1 + h > TARGET_H && y1 + h <= TARGET_H + 15) {
      el.position.y = TARGET_H - h
    } else {
      el.position.y = y1
    }
    el.size.height = h
    return el
  }

  // Unwrap mc:AlternateContent elements - extract graphicFrames from Choice/Fallback
  const altContentEls = spTreeEl.getElementsByTagName('mc:AlternateContent')
  for (let i = 0; i < altContentEls.length; i++) {
    const ac = altContentEls[i]
    // Only process direct children of spTree
    if (ac.parentElement !== spTreeEl) continue

    // Try mc:Choice first, then mc:Fallback
    const choiceEl = ac.getElementsByTagName('mc:Choice')[0]
    const fallbackEl = ac.getElementsByTagName('mc:Fallback')[0]
    const sourceEl = choiceEl || fallbackEl
    if (!sourceEl) continue

    // Extract graphicFrames from inside
    const gfEls = sourceEl.getElementsByTagName('p:graphicFrame')
    for (let j = 0; j < gfEls.length; j++) {
      const tableElements = parseGraphicFrame(gfEls[j], themeColors)
      for (const el of tableElements) {
        el.zIndex = zIndex++
        elements.push(scaleElement(el))
      }
    }

    // Extract any shapes from inside
    const spEls = sourceEl.getElementsByTagName('p:sp')
    for (let j = 0; j < spEls.length; j++) {
      const element = parseShapeElement(spEls[j], themeColors, layoutPlaceholders)
      if (element) {
        element.zIndex = zIndex++
        elements.push(scaleElement(element))
      }
    }
  }

  // Build set of slide placeholder IDs that have actual content
  // (so layout doesn't duplicate content the slide provides)
  const slideFilledPlaceholders = new Set<string>()
  const allSlideShapeEls = spTreeEl.getElementsByTagName('p:sp')
  for (let i = 0; i < allSlideShapeEls.length; i++) {
    const sp = allSlideShapeEls[i]
    const phEls = sp.getElementsByTagName('p:ph')
    if (phEls.length === 0) continue
    // Check if slide shape has actual text content
    const txBody = sp.getElementsByTagName('p:txBody')[0]
    if (txBody && hasActualText(txBody)) {
      const phIdx = phEls[0].getAttribute('idx')
      const phType = phEls[0].getAttribute('type')
      if (phIdx) slideFilledPlaceholders.add(`idx:${phIdx}`)
      if (phType) slideFilledPlaceholders.add(`type:${phType}`)
    }
  }

  // First: parse master slide elements (shapes, images, connectors) as bottom layer
  // These include elements like footer lines, logos, and decorative shapes from the slide master
  if (masterXml && masterImageMap) {
    // Also collect layout-filled placeholders to avoid duplicating them from the master
    const layoutFilledPlaceholders = new Set<string>(slideFilledPlaceholders)
    if (layoutXml) {
      const layoutParser = new DOMParser()
      const layoutDoc = layoutParser.parseFromString(layoutXml, 'application/xml')
      const layoutSpEls = layoutDoc.getElementsByTagName('p:sp')
      for (let i = 0; i < layoutSpEls.length; i++) {
        const sp = layoutSpEls[i]
        const phEls = sp.getElementsByTagName('p:ph')
        if (phEls.length === 0) continue
        const txBody = sp.getElementsByTagName('p:txBody')[0]
        if (txBody && hasActualText(txBody)) {
          const phIdx = phEls[0].getAttribute('idx')
          const phType = phEls[0].getAttribute('type')
          if (phIdx) layoutFilledPlaceholders.add(`idx:${phIdx}`)
          if (phType) layoutFilledPlaceholders.add(`type:${phType}`)
        }
        // Also skip layout placeholders that have visible fills (they override master)
        const spPr = sp.getElementsByTagName('p:spPr')[0]
        if (spPr) {
          const hasXfrm = spPr.getElementsByTagName('a:xfrm').length > 0
          const hasFill = spPr.getElementsByTagName('a:solidFill').length > 0 ||
            spPr.getElementsByTagName('a:gradFill').length > 0
          if (hasXfrm && hasFill) {
            const phIdx = phEls[0].getAttribute('idx')
            const phType = phEls[0].getAttribute('type')
            if (phIdx) layoutFilledPlaceholders.add(`idx:${phIdx}`)
            if (phType) layoutFilledPlaceholders.add(`type:${phType}`)
          }
        }
      }
    }

    const masterElements = parseLayoutElements(masterXml, themeColors, masterImageMap, layoutFilledPlaceholders)
    for (const el of masterElements) {
      el.zIndex = zIndex++
      elements.push(scaleElement(el))
    }
  }

  // Next: parse layout elements (images, shapes, text) as middle layer
  if (layoutXml && layoutImageMap) {
    const layoutElements = parseLayoutElements(layoutXml, themeColors, layoutImageMap, slideFilledPlaceholders)
    for (const el of layoutElements) {
      el.zIndex = zIndex++
      elements.push(scaleElement(el))
    }
  }

  // Parse slide elements in document order to preserve z-ordering
  for (let i = 0; i < spTreeEl.childNodes.length; i++) {
    const child = spTreeEl.childNodes[i] as Element
    if (!child.tagName) continue

    if (child.tagName === 'p:sp') {
      if (isInsideGroup(child, spTreeEl)) continue
      const element = parseShapeElement(child, themeColors, layoutPlaceholders)
      if (element) {
        element.zIndex = zIndex++
        elements.push(scaleElement(element))
      }
    } else if (child.tagName === 'p:pic') {
      if (isInsideGroup(child, spTreeEl)) continue
      const image = parseImage(child, slideIndex, imageMap)
      if (image) {
        image.zIndex = zIndex++
        elements.push(scaleElement(image))
      }
    } else if (child.tagName === 'p:cxnSp') {
      if (isInsideGroup(child, spTreeEl)) continue
      const connector = parseConnectorShape(child, themeColors)
      if (connector) {
        connector.zIndex = zIndex++
        elements.push(scaleElement(connector))
      }
    } else if (child.tagName === 'p:graphicFrame') {
      if (isInsideGroup(child, spTreeEl)) continue
      const tableElements = parseGraphicFrame(child, themeColors)
      for (const el of tableElements) {
        el.zIndex = zIndex++
        elements.push(scaleElement(el))
      }
    } else if (child.tagName === 'p:grpSp') {
      const groupElements = parseGroupShape(child, slideIndex, themeColors, imageMap, layoutPlaceholders)
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
 * Parse layout XML to extract non-placeholder visual elements (images, decorated shapes).
 * These are rendered as background elements on each slide that uses this layout.
 */
function parseLayoutElements(
  layoutXml: string,
  themeColors: Record<string, string>,
  layoutImageMap: Map<string, string>,
  slideShapeIds?: Set<string>,
): SlideElement[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(layoutXml, 'application/xml')
  const elements: SlideElement[] = []

  const cSldEl = doc.getElementsByTagName('p:cSld')[0]
  if (!cSldEl) return elements

  const spTreeEl = cSldEl.getElementsByTagName('p:spTree')[0]
  if (!spTreeEl) return elements

  // Iterate through spTree children in document order to preserve z-ordering
  for (let i = 0; i < spTreeEl.childNodes.length; i++) {
    const child = spTreeEl.childNodes[i] as Element
    if (!child.tagName) continue

    if (child.tagName === 'p:pic') {
      // Image element
      const image = parseImage(child, -1, layoutImageMap)
      if (image) elements.push(image)

    } else if (child.tagName === 'p:sp') {
      // Shape element
      const sp = child
      const spPr = sp.getElementsByTagName('p:spPr')[0]

      // Check if this is a placeholder
      const phEls = sp.getElementsByTagName('p:ph')
      const isPlaceholder = phEls.length > 0

      // For placeholder shapes: check if the slide overrides this placeholder
      if (isPlaceholder && slideShapeIds) {
        const phIdx = phEls[0].getAttribute('idx')
        const phType = phEls[0].getAttribute('type')
        if (phIdx && slideShapeIds.has(`idx:${phIdx}`)) continue
        if (phType && slideShapeIds.has(`type:${phType}`)) continue
      }

      // Check for visible content
      const hasSolidFill = spPr ? spPr.getElementsByTagName('a:solidFill').length > 0 : false
      const hasGradFill = spPr ? spPr.getElementsByTagName('a:gradFill').length > 0 : false
      const hasBlipFill = spPr ? spPr.getElementsByTagName('a:blipFill').length > 0 : false
      const lnEl = spPr ? spPr.getElementsByTagName('a:ln')[0] : null
      const hasLine = lnEl && !lnEl.getElementsByTagName('a:noFill')[0]
      const hasFill = hasSolidFill || hasGradFill || hasBlipFill
      const hasVisibleContent = hasFill || hasLine

      // Check for text content
      const txBody = sp.getElementsByTagName('p:txBody')[0]
      const hasText = txBody ? hasActualText(txBody) : false

      // Check for xfrm
      const hasXfrm = spPr ? spPr.getElementsByTagName('a:xfrm').length > 0 : false

      // Include if it has visible content AND position
      if (hasXfrm && (hasVisibleContent || hasText)) {
        if (hasBlipFill) {
          // Image fill on shape - parse as image, detect clip shape
          const xfrmEl = spPr!.getElementsByTagName('a:xfrm')[0]
          const offEl = xfrmEl.getElementsByTagName('a:off')[0]
          const extEl = xfrmEl.getElementsByTagName('a:ext')[0]
          if (offEl && extEl) {
            const x = emuToPixels(getNumericAttr(offEl, 'x', 0))
            const y = emuToPixels(getNumericAttr(offEl, 'y', 0))
            const w = emuToPixels(getNumericAttr(extEl, 'cx', 0))
            const h = emuToPixels(getNumericAttr(extEl, 'cy', 0))
            const rot = getNumericAttr(xfrmEl, 'rot', 0) / 60000

            // Check geometry for clip shape (ellipse = circular image)
            const prstGeomEl = spPr!.getElementsByTagName('a:prstGeom')[0]
            const geomType = prstGeomEl ? getAttr(prstGeomEl, 'prst') : 'rect'
            const clipShape = (geomType === 'ellipse') ? 'ellipse' as const : undefined

            const blipEl = spPr!.getElementsByTagName('a:blip')[0]
            if (blipEl) {
              const embedId = blipEl.getAttribute('r:embed')
              if (embedId) {
                const imgSrc = layoutImageMap.get(embedId)
                if (imgSrc) {
                  const imgEl: ImageElement = {
                    id: generateId(),
                    type: 'image',
                    position: { x, y },
                    size: { width: w, height: h },
                    rotation: rot || 0,
                    zIndex: 0,
                    src: imgSrc,
                    originalSize: { width: w, height: h },
                    clipShape,
                  }
                  elements.push(imgEl)
                  continue
                }
              }
            }
          }
        }

        if ((hasFill || hasLine) && !hasBlipFill) {
          const shape = parseShape(sp, 0, themeColors, undefined)
          if (shape) elements.push(shape)
        } else if (hasText) {
          const xfrmEl = spPr!.getElementsByTagName('a:xfrm')[0]
          const offEl = xfrmEl.getElementsByTagName('a:off')[0]
          const extEl = xfrmEl.getElementsByTagName('a:ext')[0]
          if (offEl && extEl) {
            const x = emuToPixels(getNumericAttr(offEl, 'x', 0))
            const y = emuToPixels(getNumericAttr(offEl, 'y', 0))
            const w = emuToPixels(getNumericAttr(extEl, 'cx', 0))
            const h = emuToPixels(getNumericAttr(extEl, 'cy', 0))
            const rot = getNumericAttr(xfrmEl, 'rot', 0) / 60000
            const textEl = parseAsTextElement(sp, x, y, w, h, rot, themeColors)
            if (textEl) elements.push(textEl)
          }
        }
      } else if (!isPlaceholder && hasVisibleContent && !hasXfrm) {
        const shape = parseShape(sp, 0, themeColors, undefined)
        if (shape) elements.push(shape)
      }

    } else if (child.tagName === 'p:graphicFrame') {
      // Table or other graphic frame
      const tableElements = parseGraphicFrame(child, themeColors)
      for (const el of tableElements) {
        elements.push(el)
      }

    } else if (child.tagName === 'p:cxnSp') {
      // Connector shape
      const connector = parseConnectorShape(child, themeColors)
      if (connector) elements.push(connector)

    } else if (child.tagName === 'p:grpSp') {
      // Group shape - flatten and extract all child elements
      const groupElements = parseGroupShape(child, -1, themeColors, layoutImageMap)
      for (const el of groupElements) {
        elements.push(el)
      }
    }
  }

  return elements
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
 * Default placeholder positions (in pixels, based on 1280x720 source - will be scaled)
 */
const PLACEHOLDER_DEFAULTS: Record<string, { x: number; y: number; width: number; height: number }> = {
  'title': { x: 67, y: 27, width: 1147, height: 107 },
  'ctrTitle': { x: 133, y: 240, width: 1013, height: 133 },
  'subTitle': { x: 133, y: 400, width: 1013, height: 80 },
  'body': { x: 67, y: 160, width: 1147, height: 467 },
  'dt': { x: 67, y: 667, width: 267, height: 40 },
  'ftr': { x: 400, y: 667, width: 480, height: 40 },
  'sldNum': { x: 947, y: 667, width: 267, height: 40 },
}

/**
 * Parse a shape element - decide if it should be text or shape
 */
function parseShapeElement(
  spEl: Element,
  themeColors: Record<string, string>,
  layoutPlaceholders?: LayoutPlaceholders,
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
  const placeholderIdx = phEl ? getAttr(phEl, 'idx') : null

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

  // For elements without explicit transform, try layout placeholders then defaults
  if (width === 0 && height === 0) {
    let resolved = false

    // Try layout placeholders by type
    if (placeholderType && layoutPlaceholders) {
      const byType = layoutPlaceholders.get(`type:${placeholderType}`)
      if (byType) {
        x = byType.x; y = byType.y; width = byType.width; height = byType.height
        resolved = true
      }
    }

    // Try layout placeholders by index
    if (!resolved && placeholderIdx && layoutPlaceholders) {
      const byIdx = layoutPlaceholders.get(`idx:${placeholderIdx}`)
      if (byIdx) {
        x = byIdx.x; y = byIdx.y; width = byIdx.width; height = byIdx.height
        resolved = true
      }
    }

    // Fall back to hard-coded defaults for known placeholder types
    if (!resolved && placeholderType) {
      const defaults = PLACEHOLDER_DEFAULTS[placeholderType] || PLACEHOLDER_DEFAULTS['body']
      x = defaults.x
      y = defaults.y
      width = defaults.width
      height = defaults.height
      resolved = true
    }

    // Skip elements that still have no size
    if (!resolved) {
      return null
    }
  }

  // Check if this has text content (including field elements like slide numbers)
  const txBodyEl = findChild(spEl, 'txBody')
  const hasTextContent = txBodyEl && hasActualText(txBodyEl)

  // Check the geometry type
  const prstGeomEl = spPrEl ? findChild(spPrEl, 'prstGeom') : null
  const geomType = prstGeomEl ? getAttr(prstGeomEl, 'prst') : null

  // Check if it has a visible fill (check both shape props and style)
  const solidFillEl = spPrEl ? findChild(spPrEl, 'solidFill') : null
  const gradFillEl = spPrEl ? findChild(spPrEl, 'gradFill') : null
  // Also check for line/outline which makes the shape visible
  const lnEl = spPrEl ? findChild(spPrEl, 'ln') : null
  const hasLine = lnEl && !findChild(lnEl, 'noFill')
  const hasVisibleFill = solidFillEl || gradFillEl

  const isRectOrNoGeom = !geomType || geomType === 'rect'
  const fallback = { x, y, width, height }

  // Priority 1: Text content in rectangular/no-geometry shape → text element
  if (hasTextContent && isRectOrNoGeom && !hasVisibleFill) {
    return parseAsTextElement(spEl, x, y, width, height, rotation, themeColors)
  }

  // Priority 2: Non-rect geometry (lines, arrows, etc.) → shape
  if (geomType && geomType !== 'rect') {
    return parseShape(spEl, 0, themeColors, fallback)
  }

  // Priority 3: Has visible fill or outline → shape (with possible text overlay)
  if (hasVisibleFill || hasLine) {
    return parseShape(spEl, 0, themeColors, fallback)
  }

  // Priority 4: Has text content → text element
  if (hasTextContent) {
    return parseAsTextElement(spEl, x, y, width, height, rotation, themeColors)
  }

  // Priority 5: Has a txBody at all (even if empty-looking) → try parsing as text
  // This catches placeholder shapes with inherited text styling
  if (txBodyEl) {
    const result = parseAsTextElement(spEl, x, y, width, height, rotation, themeColors)
    if (result) return result
  }

  // Skip truly empty/invisible shapes
  return null
}

/**
 * Check if a txBody element has actual text content
 */
function hasActualText(txBodyEl: Element): boolean {
  // Check regular text runs
  const textElements = txBodyEl.getElementsByTagName('a:t')
  for (let i = 0; i < textElements.length; i++) {
    const text = textElements[i].textContent?.trim()
    if (text && text.length > 0) {
      return true
    }
  }

  // Check field elements (slide numbers, dates, etc.)
  const fieldElements = txBodyEl.getElementsByTagName('a:fld')
  if (fieldElements.length > 0) {
    for (let i = 0; i < fieldElements.length; i++) {
      const fldText = fieldElements[i].getElementsByTagName('a:t')
      for (let j = 0; j < fldText.length; j++) {
        const text = fldText[j].textContent?.trim()
        if (text && text.length > 0) return true
      }
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
  imageMap: Map<string, string>,
  layoutPlaceholders?: LayoutPlaceholders,
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

  const childNodes = grpSpEl.childNodes
  for (let i = 0; i < childNodes.length; i++) {
    const child = childNodes[i] as Element
    if (!child.tagName) continue

    if (child.tagName === 'p:sp') {
      const element = parseShapeElement(child, themeColors, layoutPlaceholders)
      if (element) {
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
      const nestedElements = parseGroupShape(child, slideIndex, themeColors, imageMap, layoutPlaceholders)
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
 * Parse a connector shape (p:cxnSp) - lines and connectors
 */
function parseConnectorShape(
  cxnSpEl: Element,
  themeColors: Record<string, string>,
): ShapeElement | null {
  const spPrEl = findChild(cxnSpEl, 'spPr')
  if (!spPrEl) return null

  const xfrmEl = findChild(spPrEl, 'xfrm')
  if (!xfrmEl) return null

  const offEl = findChild(xfrmEl, 'off')
  const extEl = findChild(xfrmEl, 'ext')
  if (!offEl || !extEl) return null

  const x = emuToPixels(getNumericAttr(offEl, 'x', 0))
  const y = emuToPixels(getNumericAttr(offEl, 'y', 0))
  const width = emuToPixels(getNumericAttr(extEl, 'cx', 0))
  const height = emuToPixels(getNumericAttr(extEl, 'cy', 0))

  // Connectors can have zero width or height (horizontal/vertical lines)
  if (width === 0 && height === 0) return null

  const rot = getNumericAttr(xfrmEl, 'rot', 0)
  const rotation = rot / 60000

  // Parse line color and width
  const lnEl = findChild(spPrEl, 'ln')
  let strokeColor = '#000000'
  let strokeWidth = 1
  let strokeStyle: 'solid' | 'dashed' | 'dotted' = 'solid'

  if (lnEl) {
    const w = getNumericAttr(lnEl, 'w', 12700)
    strokeWidth = Math.max(1, emuToPixels(w))

    const solidFillEl = findChild(lnEl, 'solidFill')
    if (solidFillEl) {
      const srgbClrEl = findChild(solidFillEl, 'srgbClr')
      if (srgbClrEl) {
        const val = getAttr(srgbClrEl, 'val')
        if (val) strokeColor = parseColor(val)
      } else {
        const schemeClrEl = findChild(solidFillEl, 'schemeClr')
        if (schemeClrEl) {
          const val = getAttr(schemeClrEl, 'val')
          if (val) {
            const key = THEME_COLOR_MAP[val] || val
            strokeColor = themeColors[key] || DEFAULT_THEME_COLORS[key] || '#000000'
          }
        }
      }
    }

    const prstDashEl = findChild(lnEl, 'prstDash')
    if (prstDashEl) {
      const val = getAttr(prstDashEl, 'val')
      if (val === 'dash' || val === 'lgDash' || val === 'sysDash') strokeStyle = 'dashed'
      else if (val === 'dot' || val === 'sysDot') strokeStyle = 'dotted'
    }
  }

  // For lines with zero height, ensure minimum height of 1
  const finalWidth = Math.max(width, 1)
  const finalHeight = Math.max(height, 1)

  return {
    id: generateId(),
    type: 'shape',
    shapeType: 'line',
    position: { x, y },
    size: { width: finalWidth, height: finalHeight },
    rotation: rotation || 0,
    zIndex: 0,
    fill: { type: 'none' },
    stroke: {
      color: strokeColor,
      width: strokeWidth,
      style: strokeStyle,
    },
  }
}

/**
 * Parse a graphic frame (p:graphicFrame) - extracts tables as TableElement
 */
function parseGraphicFrame(
  gfEl: Element,
  themeColors: Record<string, string>,
): SlideElement[] {
  const elements: SlideElement[] = []

  // Get frame position/size from xfrm
  const xfrmEl = gfEl.getElementsByTagName('p:xfrm')[0] || gfEl.getElementsByTagName('a:xfrm')[0]
  if (!xfrmEl) return elements

  const offEl = findChild(xfrmEl, 'off')
  const extEl = findChild(xfrmEl, 'ext')
  if (!offEl || !extEl) return elements

  const frameX = emuToPixels(getNumericAttr(offEl, 'x', 0))
  const frameY = emuToPixels(getNumericAttr(offEl, 'y', 0))
  const frameWidth = emuToPixels(getNumericAttr(extEl, 'cx', 0))
  const frameHeight = emuToPixels(getNumericAttr(extEl, 'cy', 0))

  if (frameWidth === 0 && frameHeight === 0) return elements

  // Find table element
  const tblEl = gfEl.getElementsByTagName('a:tbl')[0]
  if (!tblEl) return elements

  // Parse table grid (column widths)
  const tblGridEl = tblEl.getElementsByTagName('a:tblGrid')[0]
  const colWidths: number[] = []
  if (tblGridEl) {
    const gridColEls = tblGridEl.getElementsByTagName('a:gridCol')
    for (let i = 0; i < gridColEls.length; i++) {
      const w = getNumericAttr(gridColEls[i], 'w', 0)
      colWidths.push(emuToPixels(w))
    }
  }

  // Collect direct a:tr children (avoid nested tables)
  const directTrEls: Element[] = []
  for (let i = 0; i < tblEl.childNodes.length; i++) {
    const child = tblEl.childNodes[i] as Element
    if (child.tagName === 'a:tr') directTrEls.push(child)
  }

  const numRows = directTrEls.length
  if (numRows === 0) return elements

  // If no grid info, distribute evenly using first row cell count
  if (colWidths.length === 0) {
    const firstRow = directTrEls[0]
    let tcCount = 0
    for (let c = 0; c < firstRow.childNodes.length; c++) {
      if ((firstRow.childNodes[c] as Element).tagName === 'a:tc') tcCount++
    }
    const colWidth = frameWidth / Math.max(tcCount, 1)
    for (let i = 0; i < tcCount; i++) {
      colWidths.push(colWidth)
    }
  }

  const numCols = colWidths.length
  const rowHeights: number[] = []
  const cells: TableCell[][] = []

  for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
    const tr = directTrEls[rowIdx]
    const rowHeight = emuToPixels(getNumericAttr(tr, 'h', 0)) || Math.round(frameHeight / numRows)
    rowHeights.push(rowHeight)

    // Collect direct a:tc children
    const tcEls: Element[] = []
    for (let c = 0; c < tr.childNodes.length; c++) {
      const child = tr.childNodes[c] as Element
      if (child.tagName === 'a:tc') tcEls.push(child)
    }

    const row: TableCell[] = []
    for (let colIdx = 0; colIdx < tcEls.length; colIdx++) {
      const tc = tcEls[colIdx]

      // Parse cell text
      const txBodyEl = tc.getElementsByTagName('a:txBody')[0]
      const content = txBodyEl
        ? parseTextBody(txBodyEl, themeColors)
        : { paragraphs: [{ id: generateId(), runs: [{ id: generateId(), text: '', style: { fontFamily: 'Calibri', fontSize: 14, fontWeight: 'normal' as const, fontStyle: 'normal' as const, textDecoration: 'none' as const, color: '#000000' } }], alignment: 'left' as const }] }

      // Parse cell properties
      const tcPrEl = tc.getElementsByTagName('a:tcPr')[0]

      // Parse cell fill
      let cellFill: TableCell['fill'] = undefined
      if (tcPrEl) {
        const solidFillEl = findChild(tcPrEl, 'solidFill')
        if (solidFillEl) {
          const color = parseFillColor(solidFillEl, themeColors)
          if (color) cellFill = { type: 'solid', color }
        }
      }

      // Parse cell borders - for imported PPTX tables, missing borders mean no borders
      const noBorder: Stroke = { color: 'transparent', width: 0, style: 'none' }
      const defaultNoBorders: CellBorders = { top: noBorder, right: noBorder, bottom: noBorder, left: noBorder }
      const borders = tcPrEl ? (parseCellBorders(tcPrEl, themeColors) || defaultNoBorders) : defaultNoBorders

      // Parse vertical align
      let verticalAlign: 'top' | 'middle' | 'bottom' = 'middle'
      if (tcPrEl) {
        const anchor = getAttr(tcPrEl, 'anchor')
        if (anchor === 't') verticalAlign = 'top'
        else if (anchor === 'b') verticalAlign = 'bottom'
        else if (anchor === 'ctr') verticalAlign = 'middle'
      }

      // Parse merge info
      const gridSpan = getNumericAttr(tc, 'gridSpan', 1)
      const rowSpanAttr = getNumericAttr(tc, 'rowSpan', 1)
      const hMerge = tc.getAttribute('hMerge')
      const vMerge = tc.getAttribute('vMerge')

      const cell: TableCell = {
        id: generateId(),
        content,
        fill: cellFill,
        borders,
        padding: { top: 3, right: 5, bottom: 3, left: 5 },
        verticalAlign,
        colSpan: gridSpan > 1 ? gridSpan : undefined,
        rowSpan: rowSpanAttr > 1 ? rowSpanAttr : undefined,
      }

      // Mark merged cells (hMerge/vMerge) with empty content
      if (hMerge === '1' || hMerge === 'true' || vMerge === '1' || vMerge === 'true') {
        cell.content = { paragraphs: [{ id: generateId(), runs: [{ id: generateId(), text: '', style: { fontFamily: 'Calibri', fontSize: 14, fontWeight: 'normal' as const, fontStyle: 'normal' as const, textDecoration: 'none' as const, color: '#000000' } }], alignment: 'left' as const }] }
      }

      row.push(cell)
    }

    // Pad row to match expected column count
    while (row.length < numCols) {
      row.push({
        id: generateId(),
        content: { paragraphs: [{ id: generateId(), runs: [{ id: generateId(), text: '', style: { fontFamily: 'Calibri', fontSize: 14, fontWeight: 'normal' as const, fontStyle: 'normal' as const, textDecoration: 'none' as const, color: '#000000' } }], alignment: 'left' as const }] },
        padding: { top: 3, right: 5, bottom: 3, left: 5 },
        verticalAlign: 'middle',
      })
    }

    cells.push(row)
  }

  const tableEl: TableElement = {
    id: generateId(),
    type: 'table',
    position: { x: frameX, y: frameY },
    size: { width: frameWidth, height: frameHeight },
    rotation: 0,
    zIndex: 0,
    rows: numRows,
    columns: numCols,
    cells,
    columnWidths: colWidths,
    rowHeights,
    style: {
      borderCollapse: true,
    },
  }

  elements.push(tableEl)
  return elements
}

/**
 * Parse a fill color from a solidFill element
 */
function parseFillColor(solidFillEl: Element, themeColors: Record<string, string>): string | undefined {
  const srgbEl = findChild(solidFillEl, 'srgbClr')
  if (srgbEl) {
    const val = getAttr(srgbEl, 'val')
    if (val) return parseColor(val)
  }
  const schemeEl = findChild(solidFillEl, 'schemeClr')
  if (schemeEl) {
    const val = getAttr(schemeEl, 'val')
    if (val) {
      const key = THEME_COLOR_MAP[val] || val
      return themeColors[key] || DEFAULT_THEME_COLORS[key]
    }
  }
  return undefined
}

/**
 * Parse cell borders from a:tcPr element
 * Looks for a:lnL (left), a:lnR (right), a:lnT (top), a:lnB (bottom)
 */
function parseCellBorders(tcPrEl: Element, themeColors: Record<string, string>): CellBorders | undefined {
  const noBorder: Stroke = { color: 'transparent', width: 0, style: 'none' }
  const left = parseBorderLine(tcPrEl, 'lnL', themeColors)
  const right = parseBorderLine(tcPrEl, 'lnR', themeColors)
  const top = parseBorderLine(tcPrEl, 'lnT', themeColors)
  const bottom = parseBorderLine(tcPrEl, 'lnB', themeColors)

  if (!left && !right && !top && !bottom) return undefined
  // Fill in missing borders with explicit no-border to prevent default gray rendering
  return {
    left: left || noBorder,
    right: right || noBorder,
    top: top || noBorder,
    bottom: bottom || noBorder,
  }
}

/**
 * Parse a single border line element (a:lnL, a:lnR, a:lnT, a:lnB)
 */
function parseBorderLine(tcPrEl: Element, tag: string, themeColors: Record<string, string>): Stroke | undefined {
  const lnEl = findChild(tcPrEl, tag)
  if (!lnEl) return undefined

  // Check for no fill (invisible border)
  const noFillEl = findChild(lnEl, 'noFill')
  if (noFillEl) return undefined

  // Width in EMU (default 12700 = ~1pt)
  const wAttr = getNumericAttr(lnEl, 'w', 12700)
  const width = Math.max(1, Math.round(wAttr / 12700))

  // Color
  let color = '#000000'
  const solidFillEl = findChild(lnEl, 'solidFill')
  if (solidFillEl) {
    const parsed = parseFillColor(solidFillEl, themeColors)
    if (parsed) color = parsed
  }

  // Dash style
  const prstDashEl = findChild(lnEl, 'prstDash')
  let style: 'solid' | 'dashed' | 'dotted' = 'solid'
  if (prstDashEl) {
    const val = getAttr(prstDashEl, 'val')
    if (val === 'dash' || val === 'lgDash' || val === 'sysDash') style = 'dashed'
    else if (val === 'dot' || val === 'sysDot') style = 'dotted'
  }

  return { color, width, style }
}

/**
 * Parse slide background
 */
function parseSlideBackground(
  cSldEl: Element,
  themeColors: Record<string, string>,
  bgFillStyles?: ThemeBgFillStyle[],
): Background {
  const defaultBackground: Background = {
    type: 'solid',
    color: '#FFFFFF',
  }

  const bgEls = cSldEl.getElementsByTagName('p:bg')
  if (bgEls.length === 0) {
    return defaultBackground
  }

  const bgEl = bgEls[0]

  // Check for bgPr (background properties) - explicit fill defined
  const bgPrEl = findChild(bgEl, 'bgPr')
  if (bgPrEl) {
    const solidFillEl = findChild(bgPrEl, 'solidFill')
    if (solidFillEl) {
      const color = parseBackgroundColor(solidFillEl, themeColors)
      if (color) {
        return { type: 'solid', color }
      }
    }

    const gradFillEl = findChild(bgPrEl, 'gradFill')
    if (gradFillEl) {
      const gradient = parseGradientFill(gradFillEl, themeColors)
      if (gradient) {
        return gradient
      }
    }

    const blipFillEl = findChild(bgPrEl, 'blipFill')
    if (blipFillEl) {
      return { type: 'solid', color: '#E7E6E6' }
    }
  }

  // Check for bgRef (reference to theme fill style)
  const bgRefEl = findChild(bgEl, 'bgRef')
  if (bgRefEl) {
    const idx = parseInt(getAttr(bgRefEl, 'idx') || '0')

    // bgRef idx >= 1001 references bgFillStyleLst (1001=index 0, 1002=index 1, etc.)
    if (idx >= 1001 && bgFillStyles && bgFillStyles.length > 0) {
      const styleIndex = idx - 1001
      const fillStyle = bgFillStyles[styleIndex]

      if (fillStyle) {
        // Get the override color from schemeClr in bgRef (this substitutes into the fill style)
        const schemeClrEl = findChild(bgRefEl, 'schemeClr')
        const overrideScheme = schemeClrEl ? getAttr(schemeClrEl, 'val') : null

        if (fillStyle.type === 'solid') {
          // Use the fill style's own color, or the override scheme color
          if (fillStyle.solidColor) {
            return { type: 'solid', color: fillStyle.solidColor }
          }
          // Use the schemeClr from bgRef as the color
          if (overrideScheme) {
            const color = resolveSchemeColor(overrideScheme, themeColors)
            if (color) return { type: 'solid', color }
          }
          // Use the fill style's schemeClr
          if (fillStyle.schemeClr) {
            const color = resolveSchemeColor(fillStyle.schemeClr, themeColors)
            if (color) return { type: 'solid', color }
          }
        } else if (fillStyle.type === 'gradient' && fillStyle.gradient) {
          // Resolve gradient stops using theme colors
          const stops: Array<{ position: number; color: string }> = []
          for (const stop of fillStyle.gradient.stops) {
            let color = stop.color
            if (!color && stop.schemeClr) {
              color = resolveSchemeColor(stop.schemeClr, themeColors) || '#808080'
            }
            if (!color && overrideScheme) {
              color = resolveSchemeColor(overrideScheme, themeColors) || '#808080'
            }
            if (color) {
              stops.push({ position: stop.position, color })
            }
          }
          if (stops.length >= 2) {
            return {
              type: 'gradient',
              gradient: {
                type: 'linear',
                angle: fillStyle.gradient.angle,
                stops,
              },
            }
          }
          // Fall back to first stop color as solid
          if (stops.length === 1) {
            return { type: 'solid', color: stops[0].color }
          }
        }
      }
    }

    // Fallback: try direct color from bgRef
    const color = parseBackgroundColor(bgRefEl, themeColors)
    if (color) {
      return { type: 'solid', color }
    }
  }

  return defaultBackground
}

/** Resolve a scheme color name to an actual hex color */
function resolveSchemeColor(schemeVal: string, themeColors: Record<string, string>): string | null {
  const colorMap: Record<string, string> = {
    'lt1': 'light1', 'lt2': 'light2',
    'dk1': 'dark1', 'dk2': 'dark2',
    'bg1': 'light1', 'bg2': 'light2',
    'tx1': 'dark1', 'tx2': 'dark2',
    'accent1': 'accent1', 'accent2': 'accent2',
    'accent3': 'accent3', 'accent4': 'accent4',
    'accent5': 'accent5', 'accent6': 'accent6',
    'hlink': 'hyperlink', 'folHlink': 'followedHyperlink',
  }
  const key = colorMap[schemeVal] || schemeVal
  return themeColors[key] || DEFAULT_THEME_COLORS[key as keyof typeof DEFAULT_THEME_COLORS] || null
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
    const pos = getNumericAttr(gs, 'pos', 0) / 100000
    const color = parseBackgroundColor(gs, themeColors)
    if (color) {
      stops.push({ position: pos, color })
    }
  }

  if (stops.length < 2) {
    return stops.length === 1 ? { type: 'solid', color: stops[0].color } : null
  }

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
  const srgbClrEl = findChild(el, 'srgbClr')
  if (srgbClrEl) {
    const val = getAttr(srgbClrEl, 'val')
    if (val) {
      return parseColor(val)
    }
  }

  const schemeClrEl = findChild(el, 'schemeClr')
  if (schemeClrEl) {
    const val = getAttr(schemeClrEl, 'val')
    if (val) {
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
  _globalImageMap: Map<string, string>,
  bgFillStyles?: ThemeBgFillStyle[],
): Background {
  const parser = new DOMParser()
  const doc = parser.parseFromString(masterXml, 'application/xml')

  const cSldEl = doc.getElementsByTagName('p:cSld')[0]
  if (!cSldEl) {
    return { type: 'solid', color: '#FFFFFF' }
  }

  return parseSlideBackground(cSldEl, themeColors, bgFillStyles)
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
