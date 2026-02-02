/**
 * PPTX Exporter
 * Export presentations to PowerPoint format using pptxgenjs
 */

import PptxGenJS from 'pptxgenjs'
import {
  Presentation,
  Slide,
  SlideElement,
  TextElement,
  ShapeElement,
  ImageElement,
  ShapeType,
} from '@/types'

export interface ExportResult {
  success: boolean
  blob?: Blob
  error?: string
}

export interface ExportProgress {
  stage: 'preparing' | 'slides' | 'finalizing' | 'complete'
  current: number
  total: number
  message: string
}

/**
 * Export a presentation to PPTX format
 */
export async function exportPptx(
  presentation: Presentation,
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  try {
    onProgress?.({
      stage: 'preparing',
      current: 0,
      total: 100,
      message: 'Preparing export...',
    })

    // Create new presentation
    const pptx = new PptxGenJS()

    // Set presentation properties
    pptx.author = presentation.metadata.author || ''
    pptx.title = presentation.metadata.title || presentation.name
    pptx.subject = presentation.metadata.subject || ''
    pptx.company = presentation.metadata.company || ''

    // Set slide size (16:9 ratio)
    pptx.defineLayout({ name: 'CUSTOM', width: 10, height: 5.625 })
    pptx.layout = 'CUSTOM'

    // Set theme colors if available
    if (presentation.theme?.colorScheme) {
      // pptxgenjs doesn't have direct theme color support
      // Colors are applied per-element
    }

    // Process each slide
    const totalSlides = presentation.slides.length
    for (let i = 0; i < totalSlides; i++) {
      const slide = presentation.slides[i]

      onProgress?.({
        stage: 'slides',
        current: Math.round((i / totalSlides) * 80) + 10,
        total: 100,
        message: `Processing slide ${i + 1} of ${totalSlides}...`,
      })

      await processSlide(pptx, slide)
    }

    onProgress?.({
      stage: 'finalizing',
      current: 90,
      total: 100,
      message: 'Generating file...',
    })

    // Generate the file
    const blob = await pptx.write({ outputType: 'blob' }) as Blob

    onProgress?.({
      stage: 'complete',
      current: 100,
      total: 100,
      message: 'Export complete!',
    })

    return {
      success: true,
      blob,
    }
  } catch (error) {
    console.error('PPTX export error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export presentation',
    }
  }
}

/**
 * Process a single slide
 */
async function processSlide(pptx: PptxGenJS, slide: Slide): Promise<void> {
  const pptxSlide = pptx.addSlide()

  // Set slide background
  if (slide.background) {
    if (slide.background.type === 'solid' && slide.background.color) {
      pptxSlide.background = { color: slide.background.color.replace('#', '') }
    } else if (slide.background.type === 'gradient' && slide.background.gradient) {
      // pptxgenjs supports gradient backgrounds
      const stops = slide.background.gradient.stops
      if (stops.length >= 2) {
        pptxSlide.background = {
          color: stops[0].color.replace('#', ''),
          // Note: pptxgenjs has limited gradient support
        }
      }
    }
  }

  // Sort elements by zIndex
  const sortedElements = [...slide.elements].sort((a, b) => a.zIndex - b.zIndex)

  // Process each element
  for (const element of sortedElements) {
    await processElement(pptxSlide, element)
  }
}

/**
 * Process a single element
 */
async function processElement(
  pptxSlide: PptxGenJS.Slide,
  element: SlideElement
): Promise<void> {
  switch (element.type) {
    case 'text':
      processTextElement(pptxSlide, element)
      break
    case 'shape':
      processShapeElement(pptxSlide, element)
      break
    case 'image':
      await processImageElement(pptxSlide, element)
      break
    // Tables and groups can be added later
  }
}

/**
 * Process a text element
 */
function processTextElement(pptxSlide: PptxGenJS.Slide, element: TextElement): void {
  const { position, size, content, rotation } = element

  // Convert position from pixels to inches (assuming 96 DPI)
  // pptxgenjs uses inches, our canvas is 960x540 pixels = 10x5.625 inches
  const x = (position.x / 960) * 10
  const y = (position.y / 540) * 5.625
  const w = (size.width / 960) * 10
  const h = (size.height / 540) * 5.625

  // Build text runs
  const textRuns: PptxGenJS.TextProps[] = []

  for (const paragraph of content.paragraphs) {
    for (const run of paragraph.runs) {
      const textProps: PptxGenJS.TextProps = {
        text: run.text,
        options: {
          fontFace: run.style.fontFamily || 'Calibri',
          fontSize: run.style.fontSize || 18,
          color: run.style.color?.replace('#', '') || '000000',
          bold: run.style.fontWeight === 'bold',
          italic: run.style.fontStyle === 'italic',
          underline: run.style.textDecoration === 'underline'
            ? { style: 'sng' as const }
            : undefined,
          strike: run.style.textDecoration === 'line-through',
          align: paragraph.alignment || 'left',
        },
      }
      textRuns.push(textProps)
    }
    // Add line break between paragraphs
    if (paragraph !== content.paragraphs[content.paragraphs.length - 1]) {
      textRuns.push({ text: '\n', options: {} })
    }
  }

  // Add text box
  if (textRuns.length > 0) {
    pptxSlide.addText(textRuns, {
      x,
      y,
      w,
      h,
      rotate: rotation || 0,
      valign: element.style?.verticalAlign || 'top',
      margin: element.style?.padding
        ? [
          element.style.padding.top / 10,
          element.style.padding.right / 10,
          element.style.padding.bottom / 10,
          element.style.padding.left / 10,
        ]
        : undefined,
    })
  }
}

/**
 * Process a shape element
 */
function processShapeElement(pptxSlide: PptxGenJS.Slide, element: ShapeElement): void {
  const { position, size, shapeType, fill, stroke, rotation } = element

  // Convert position from pixels to inches
  const x = (position.x / 960) * 10
  const y = (position.y / 540) * 5.625
  const w = (size.width / 960) * 10
  const h = (size.height / 540) * 5.625

  // Map our shape types to pptxgenjs shape types
  const pptxShapeType = mapShapeType(shapeType)

  // Build shape options
  const shapeOptions: PptxGenJS.ShapeProps = {
    x,
    y,
    w,
    h,
    rotate: rotation || 0,
  }

  // Fill
  if (fill) {
    if (fill.type === 'none') {
      shapeOptions.fill = { type: 'none' }
    } else if (fill.type === 'solid' && fill.color) {
      shapeOptions.fill = { color: fill.color.replace('#', '') }
    }
    // Gradient fills require more complex handling
  }

  // Stroke/Line
  if (stroke) {
    shapeOptions.line = {
      color: stroke.color?.replace('#', '') || '000000',
      width: stroke.width || 1,
      dashType: stroke.style === 'dashed' ? 'dash' : stroke.style === 'dotted' ? 'sysDot' : 'solid',
    }
  }

  // Add shape
  if (shapeType === 'line') {
    pptxSlide.addShape('line' as PptxGenJS.ShapeType, {
      ...shapeOptions,
      line: {
        color: stroke?.color?.replace('#', '') || '000000',
        width: stroke?.width || 1,
      },
    })
  } else {
    pptxSlide.addShape(pptxShapeType as PptxGenJS.ShapeType, shapeOptions)
  }

  // Add text to shape if present
  if (element.text && element.text.paragraphs.length > 0) {
    const textRuns: PptxGenJS.TextProps[] = []
    for (const paragraph of element.text.paragraphs) {
      for (const run of paragraph.runs) {
        textRuns.push({
          text: run.text,
          options: {
            fontFace: run.style.fontFamily || 'Calibri',
            fontSize: run.style.fontSize || 18,
            color: run.style.color?.replace('#', '') || '000000',
            bold: run.style.fontWeight === 'bold',
            italic: run.style.fontStyle === 'italic',
          },
        })
      }
    }

    if (textRuns.length > 0) {
      pptxSlide.addText(textRuns, {
        x,
        y,
        w,
        h,
        rotate: rotation || 0,
        valign: 'middle',
        align: 'center',
      })
    }
  }
}

/**
 * Process an image element
 */
async function processImageElement(
  pptxSlide: PptxGenJS.Slide,
  element: ImageElement
): Promise<void> {
  const { position, size, src, rotation } = element

  // Convert position from pixels to inches
  const x = (position.x / 960) * 10
  const y = (position.y / 540) * 5.625
  const w = (size.width / 960) * 10
  const h = (size.height / 540) * 5.625

  try {
    // Handle different image source types
    if (src.startsWith('data:')) {
      // Base64 data URL
      pptxSlide.addImage({
        data: src,
        x,
        y,
        w,
        h,
        rotate: rotation || 0,
      })
    } else if (src.startsWith('http://') || src.startsWith('https://')) {
      // External URL - pptxgenjs can handle these
      pptxSlide.addImage({
        path: src,
        x,
        y,
        w,
        h,
        rotate: rotation || 0,
      })
    }
  } catch (error) {
    console.warn('Failed to add image:', error)
    // Add placeholder rectangle instead
    pptxSlide.addShape('rect', {
      x,
      y,
      w,
      h,
      fill: { color: 'CCCCCC' },
    })
  }
}

/**
 * Map our shape types to pptxgenjs shape types
 */
function mapShapeType(shapeType: ShapeType): string {
  const shapeMap: Record<ShapeType, string> = {
    rectangle: 'rect',
    roundedRectangle: 'roundRect',
    ellipse: 'ellipse',
    triangle: 'triangle',
    rightTriangle: 'rtTriangle',
    diamond: 'diamond',
    pentagon: 'pentagon',
    hexagon: 'hexagon',
    octagon: 'octagon',
    star5: 'star5',
    star6: 'star6',
    arrow: 'rightArrow',
    arrowRight: 'rightArrow',
    arrowLeft: 'leftArrow',
    arrowUp: 'upArrow',
    arrowDown: 'downArrow',
    line: 'line',
    plus: 'mathPlus',
    minus: 'mathMinus',
    cloud: 'cloud',
    heart: 'heart',
    callout: 'wedgeRectCallout',
    lightning: 'lightningBolt',
    custom: 'rect',
  }

  return shapeMap[shapeType] || 'rect'
}

/**
 * Download the exported PPTX file
 */
export function downloadPptx(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.pptx') ? filename : `${filename}.pptx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Quick export and download
 */
export async function exportAndDownload(
  presentation: Presentation,
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  const result = await exportPptx(presentation, onProgress)

  if (result.success && result.blob) {
    downloadPptx(result.blob, presentation.name)
  }

  return result
}
