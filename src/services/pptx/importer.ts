/**
 * PPTX Importer
 * Main entry point for importing PowerPoint files
 */

import JSZip from 'jszip'
import { Presentation, Slide, ColorScheme, FontScheme, Background, DEFAULT_THEME } from '@/types'
import { generateId } from '@/utils'
import { parseSlide, parseMasterBackground } from './parser/slideParser'
import { parseTheme, ThemeBgFillStyle } from './parser/themeParser'
import { extractImages, parseSlideRelationships, buildSlideImageMap } from './parser/imageParser'
import { setFontScheme, setScaleFactor } from './parser/textParser'
import { DEFAULT_THEME_COLORS, emuToPixels } from './parser/utils'

/** Placeholder position/size resolved from layout or master */
export type PlaceholderTransform = { x: number; y: number; width: number; height: number }
export type LayoutPlaceholders = Map<string, PlaceholderTransform>

export interface ImportResult {
  success: boolean
  presentation?: Presentation
  error?: string
}

export interface ImportProgress {
  stage: 'loading' | 'parsing-theme' | 'extracting-images' | 'parsing-slides' | 'complete'
  current: number
  total: number
  message: string
}

/**
 * Import a PPTX file and convert it to our Presentation format
 */
export async function importPptx(
  file: File,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  try {
    // Validate file type (support both PPTX and PPTM)
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.pptx') && !fileName.endsWith('.pptm')) {
      return {
        success: false,
        error: 'Invalid file type. Please select a .pptx or .pptm file.',
      }
    }

    // Report loading progress
    onProgress?.({
      stage: 'loading',
      current: 0,
      total: 100,
      message: 'Loading file...',
    })

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Load ZIP
    const zip = await JSZip.loadAsync(arrayBuffer)

    // Parse presentation.xml to get slide order and metadata
    const presentationXmlContent = await zip.file('ppt/presentation.xml')?.async('string')
    if (!presentationXmlContent) {
      return {
        success: false,
        error: 'Invalid PPTX file: missing presentation.xml',
      }
    }

    const { slideIds, presentationName, scaleFactor, slideWidth, slideHeight } = parsePresentationXml(presentationXmlContent)
    console.log('[Import] slideIds:', slideIds, 'slideWidth:', slideWidth, 'slideHeight:', slideHeight, 'scaleFactor:', scaleFactor)

    // Report theme parsing progress
    onProgress?.({
      stage: 'parsing-theme',
      current: 10,
      total: 100,
      message: 'Parsing themes...',
    })

    // Parse ALL themes and build a theme map
    const themeMap = new Map<string, { colors: Record<string, string>; colorScheme: ColorScheme; fontScheme: FontScheme; bgFillStyles: ThemeBgFillStyle[] }>()
    const themeFiles = Object.keys(zip.files).filter(f => f.match(/ppt\/theme\/theme\d+\.xml$/))

    for (const themeFile of themeFiles) {
      try {
        const themeXml = await zip.file(themeFile)?.async('string')
        if (themeXml) {
          const parsedTheme = parseTheme(themeXml)
          themeMap.set(themeFile, parsedTheme)
          console.log(`[Import] Theme ${themeFile} bgFillStyles:`, parsedTheme.bgFillStyles.length, JSON.stringify(parsedTheme.bgFillStyles))
        }
      } catch (error) {
        console.warn(`Failed to parse ${themeFile}:`, error)
      }
    }

    // Use first theme as default
    const defaultTheme = themeMap.get('ppt/theme/theme1.xml') || {
      colors: { ...DEFAULT_THEME_COLORS },
      colorScheme: DEFAULT_THEME.colorScheme,
      fontScheme: DEFAULT_THEME.fontScheme,
      bgFillStyles: [] as ThemeBgFillStyle[],
    }
    let colorScheme = defaultTheme.colorScheme
    let fontScheme = defaultTheme.fontScheme

    // Set font scheme and scale factor for text parsing
    setFontScheme(fontScheme)
    setScaleFactor(scaleFactor)

    // Report image extraction progress
    onProgress?.({
      stage: 'extracting-images',
      current: 20,
      total: 100,
      message: 'Extracting images...',
    })

    // Extract all images
    const globalImageMap = await extractImages(zip)

    // Build layout → master → theme mapping (with placeholder transforms)
    interface LayoutInfo {
      masterFile: string
      themeFile: string
      themeColors: Record<string, string>
      background: Background
      placeholders: LayoutPlaceholders
      masterXml?: string
      masterImageMap?: Map<string, string>
    }
    const layoutToMasterTheme = new Map<string, LayoutInfo>()

    // Cache master placeholders to avoid re-parsing
    const masterPlaceholderCache = new Map<string, LayoutPlaceholders>()

    // Parse all slide layouts and their master references
    const layoutFiles = Object.keys(zip.files).filter(f => f.match(/ppt\/slideLayouts\/slideLayout\d+\.xml$/))
    for (const layoutFile of layoutFiles) {
      try {
        const layoutRelsFile = layoutFile.replace('slideLayouts/', 'slideLayouts/_rels/') + '.rels'
        const layoutRels = await zip.file(layoutRelsFile)?.async('string')
        if (layoutRels) {
          // Find master reference
          const masterMatch = layoutRels.match(/Target="\.\.\/slideMasters\/([^"]+)"/)
          if (masterMatch) {
            const masterFile = `ppt/slideMasters/${masterMatch[1]}`

            // Find theme for this master
            const masterRelsFile = masterFile.replace('slideMasters/', 'slideMasters/_rels/') + '.rels'
            const masterRels = await zip.file(masterRelsFile)?.async('string')
            let themeFile = 'ppt/theme/theme1.xml'
            if (masterRels) {
              const themeMatch = masterRels.match(/Target="\.\.\/theme\/([^"]+)"/)
              if (themeMatch) {
                themeFile = `ppt/theme/${themeMatch[1]}`
              }
            }

            const theme = themeMap.get(themeFile) || defaultTheme

            // Parse master background with correct theme colors and bgFillStyles
            let background: Background = { type: 'solid', color: '#FFFFFF' }
            const masterXml = await zip.file(masterFile)?.async('string')
            if (masterXml) {
              background = parseMasterBackground(masterXml, theme.colors, globalImageMap, theme.bgFillStyles)
              console.log(`[Import] Master ${masterFile} bg:`, JSON.stringify(background), 'theme dk1:', theme.colors.dark1, 'lt1:', theme.colors.light1)
            }

            // Build master image map from master rels
            let masterImageMap: Map<string, string> = new Map()
            if (masterRels) {
              const masterRelMap = parseSlideRelationships(masterRels)
              masterImageMap = buildSlideImageMap(masterRelMap, globalImageMap)
            }

            // Parse master placeholders (cached)
            let masterPlaceholders: LayoutPlaceholders
            if (masterPlaceholderCache.has(masterFile)) {
              masterPlaceholders = masterPlaceholderCache.get(masterFile)!
            } else {
              masterPlaceholders = masterXml ? parseXmlForPlaceholders(masterXml) : new Map()
              masterPlaceholderCache.set(masterFile, masterPlaceholders)
            }

            // Parse layout placeholders
            const layoutXml = await zip.file(layoutFile)?.async('string')
            const layoutPlaceholders: LayoutPlaceholders = layoutXml ? parseXmlForPlaceholders(layoutXml) : new Map()

            // Merge: layout overrides master (layout has higher priority)
            const mergedPlaceholders: LayoutPlaceholders = new Map(masterPlaceholders)
            for (const [key, val] of layoutPlaceholders) {
              mergedPlaceholders.set(key, val)
            }

            // Also parse layout background as fallback
            if (background.type === 'solid' && background.color === '#FFFFFF' && layoutXml) {
              const layoutParser = new DOMParser()
              const layoutDoc = layoutParser.parseFromString(layoutXml, 'application/xml')
              const layoutCsld = layoutDoc.getElementsByTagName('p:cSld')[0]
              if (layoutCsld) {
                const layoutBg = layoutCsld.getElementsByTagName('p:bg')[0]
                if (layoutBg) {
                  background = parseMasterBackground(layoutXml, theme.colors, globalImageMap, theme.bgFillStyles)
                }
              }
            }

            const layoutName = layoutFile.match(/slideLayout(\d+)\.xml/)?.[1] || '1'
            layoutToMasterTheme.set(layoutName, {
              masterFile,
              themeFile,
              themeColors: theme.colors,
              background,
              placeholders: mergedPlaceholders,
              masterXml: masterXml || undefined,
              masterImageMap,
            })
          }
        }
      } catch (error) {
        console.warn(`Failed to parse layout relationships for ${layoutFile}:`, error)
      }
    }

    // Report slide parsing progress
    onProgress?.({
      stage: 'parsing-slides',
      current: 30,
      total: 100,
      message: 'Parsing slides...',
    })

    // Parse each slide
    const slides: Slide[] = []
    const totalSlides = slideIds.length

    for (let i = 0; i < slideIds.length; i++) {
      const slideNum = slideIds[i]

      // Report progress for each slide
      const progress = 30 + Math.round((i / totalSlides) * 60)
      onProgress?.({
        stage: 'parsing-slides',
        current: progress,
        total: 100,
        message: `Parsing slide ${i + 1} of ${totalSlides}...`,
      })

      try {
        // Get slide XML
        const slideXml = await zip.file(`ppt/slides/slide${slideNum}.xml`)?.async('string')
        if (!slideXml) {
          console.warn(`Slide ${slideNum} not found`)
          continue
        }

        // Get slide relationships to find which layout it uses
        let slideRelsXml = ''
        let slideThemeColors = defaultTheme.colors
        let slideMasterBackground: Background = { type: 'solid', color: '#FFFFFF' }
        let slideLayoutPlaceholders: LayoutPlaceholders = new Map()
        let layoutFile = ''
        let slideMasterXml: string | undefined
        let slideMasterImageMap: Map<string, string> | undefined

        try {
          slideRelsXml = await zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`)?.async('string') || ''

          // Find layout reference
          const layoutMatch = slideRelsXml.match(/Target="\.\.\/slideLayouts\/slideLayout(\d+)\.xml"/)
          if (layoutMatch) {
            layoutFile = `ppt/slideLayouts/slideLayout${layoutMatch[1]}.xml`
            const layoutInfo = layoutToMasterTheme.get(layoutMatch[1])
            if (layoutInfo) {
              slideThemeColors = layoutInfo.themeColors
              slideMasterBackground = layoutInfo.background
              slideLayoutPlaceholders = layoutInfo.placeholders
              slideMasterXml = layoutInfo.masterXml
              slideMasterImageMap = layoutInfo.masterImageMap
            }
          }
        } catch {
          // Relationships file might not exist
        }

        // Also get images from the layout's relationships for layout image elements
        let layoutImageMap: Map<string, string> = new Map()
        if (layoutFile) {
          try {
            const layoutRelsFile = layoutFile.replace('slideLayouts/', 'slideLayouts/_rels/') + '.rels'
            const layoutRelsXml = await zip.file(layoutRelsFile)?.async('string')
            if (layoutRelsXml) {
              const layoutRelMap = parseSlideRelationships(layoutRelsXml)
              layoutImageMap = buildSlideImageMap(layoutRelMap, globalImageMap)
            }
          } catch { /* ignore */ }
        }

        // Parse slide with correct theme colors, master background, layout and master elements
        const slide = parseSlide(slideXml, slideRelsXml, i, slideThemeColors, globalImageMap, slideMasterBackground, scaleFactor, slideLayoutPlaceholders, layoutImageMap, layoutFile ? await zip.file(layoutFile)?.async('string') || '' : '', slideMasterXml, slideMasterImageMap)
        console.log(`[Import] Slide ${i + 1}: ${slide.elements.length} elements, bg: ${slide.background.type}`)
        slides.push(slide)
      } catch (error) {
        console.warn(`Failed to parse slide ${slideNum}:`, error)
        // Continue with remaining slides
      }
    }

    // Ensure at least one slide
    if (slides.length === 0) {
      slides.push({
        id: generateId(),
        order: 0,
        elements: [],
        background: { type: 'solid', color: '#FFFFFF' },
      })
    }

    // Report complete
    onProgress?.({
      stage: 'complete',
      current: 100,
      total: 100,
      message: 'Import complete!',
    })

    // Build presentation
    const presentation: Presentation = {
      id: generateId(),
      name: presentationName || file.name.replace('.pptx', ''),
      createdAt: new Date(),
      updatedAt: new Date(),
      slides,
      theme: {
        id: generateId(),
        name: 'Imported Theme',
        colorScheme,
        fontScheme,
        defaultBackground: {
          type: 'solid',
          color: colorScheme.background1,
        },
      },
      metadata: {
        title: presentationName || file.name.replace('.pptx', ''),
        author: '',
      },
    }

    return {
      success: true,
      presentation,
    }
  } catch (error) {
    console.error('PPTX import error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import presentation',
    }
  }
}

// Our target canvas size
const TARGET_WIDTH = 960
const TARGET_HEIGHT = 540
const EMU_PER_PIXEL = 9525

/**
 * Parse a layout or master XML to extract placeholder transforms.
 * Returns a map keyed by "type:<phType>" and "idx:<phIdx>" for flexible lookup.
 */
function parseXmlForPlaceholders(xml: string): LayoutPlaceholders {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const placeholders: LayoutPlaceholders = new Map()

  const spEls = doc.getElementsByTagName('p:sp')
  for (let i = 0; i < spEls.length; i++) {
    const sp = spEls[i]

    // Find placeholder element
    const phEls = sp.getElementsByTagName('p:ph')
    if (phEls.length === 0) continue
    const ph = phEls[0]

    // Get transform
    const xfrmEls = sp.getElementsByTagName('a:xfrm')
    if (xfrmEls.length === 0) continue
    const xfrm = xfrmEls[0]

    const offEls = xfrm.getElementsByTagName('a:off')
    const extEls = xfrm.getElementsByTagName('a:ext')
    if (offEls.length === 0 || extEls.length === 0) continue

    const x = emuToPixels(parseInt(offEls[0].getAttribute('x') || '0', 10))
    const y = emuToPixels(parseInt(offEls[0].getAttribute('y') || '0', 10))
    const width = emuToPixels(parseInt(extEls[0].getAttribute('cx') || '0', 10))
    const height = emuToPixels(parseInt(extEls[0].getAttribute('cy') || '0', 10))

    if (width === 0 && height === 0) continue

    const phType = ph.getAttribute('type') || 'body'
    const phIdx = ph.getAttribute('idx') || ''

    placeholders.set(`type:${phType}`, { x, y, width, height })
    if (phIdx) {
      placeholders.set(`idx:${phIdx}`, { x, y, width, height })
    }
  }

  return placeholders
}

/**
 * Parse presentation.xml to get slide order, name, and dimensions
 */
function parsePresentationXml(xmlContent: string): {
  slideIds: number[]
  presentationName: string | null
  slideWidth: number
  slideHeight: number
  scaleFactor: number
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlContent, 'application/xml')

  // Get slide IDs from sldIdLst
  const slideIds: number[] = []
  const sldIdElements = doc.getElementsByTagName('p:sldId')

  for (let i = 0; i < sldIdElements.length; i++) {
    const sldIdEl = sldIdElements[i]
    const rIdAttr = sldIdEl.getAttribute('r:id')
    if (rIdAttr) {
      // Extract slide number from relationship ID (e.g., "rId2" -> look up in rels)
      // For now, assume slides are numbered sequentially
      slideIds.push(i + 1)
    }
  }

  // If no slides found, default to slide 1
  if (slideIds.length === 0) {
    slideIds.push(1)
  }

  // Parse slide size from p:sldSz
  let slideWidth = TARGET_WIDTH
  let slideHeight = TARGET_HEIGHT
  const sldSzEl = doc.getElementsByTagName('p:sldSz')[0]
  if (sldSzEl) {
    const cx = sldSzEl.getAttribute('cx')
    const cy = sldSzEl.getAttribute('cy')
    if (cx) slideWidth = Math.round(parseInt(cx, 10) / EMU_PER_PIXEL)
    if (cy) slideHeight = Math.round(parseInt(cy, 10) / EMU_PER_PIXEL)
  }

  // Calculate scale factor to fit our target canvas
  const scaleX = TARGET_WIDTH / slideWidth
  const scaleY = TARGET_HEIGHT / slideHeight
  const scaleFactor = Math.min(scaleX, scaleY)

  // Try to get presentation name from core properties
  // (This would require parsing docProps/core.xml)
  const presentationName = null

  return { slideIds, presentationName, slideWidth, slideHeight, scaleFactor }
}

/**
 * Check if a file is a valid PPTX or PPTM
 */
export function isPptxFile(file: File): boolean {
  const name = file.name.toLowerCase()
  return name.endsWith('.pptx') ||
    name.endsWith('.pptm') ||
    file.type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    file.type === 'application/vnd.ms-powerpoint.presentation.macroEnabled.12'
}

/**
 * Get file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
