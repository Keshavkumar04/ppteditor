/**
 * Image Parser
 * Parses image elements from PPTX XML and extracts image data
 */

import { ImageElement } from '@/types'
import { generateId } from '@/utils'
import {
  emuToPixels,
  getAttr,
  getNumericAttr,
  findChild,
} from './utils'
import JSZip from 'jszip'

/**
 * Parse a picture element (p:pic)
 */
export function parseImage(
  picEl: Element,
  _slideIndex: number,
  imageMap: Map<string, string> // Maps relationship IDs to data URLs
): ImageElement | null {
  // Get shape properties (p:spPr)
  const spPrEl = findChild(picEl, 'spPr')
  if (!spPrEl) return null

  // Get transformation (a:xfrm)
  const xfrmEl = findChild(spPrEl, 'xfrm')
  if (!xfrmEl) return null

  // Get position and size
  const offEl = findChild(xfrmEl, 'off')
  const extEl = findChild(xfrmEl, 'ext')
  if (!offEl || !extEl) return null

  const x = emuToPixels(getNumericAttr(offEl, 'x', 0))
  const y = emuToPixels(getNumericAttr(offEl, 'y', 0))
  const width = emuToPixels(getNumericAttr(extEl, 'cx', 0))
  const height = emuToPixels(getNumericAttr(extEl, 'cy', 0))

  // Skip if no size
  if (width === 0 && height === 0) return null

  // Get rotation
  const rot = getNumericAttr(xfrmEl, 'rot', 0)
  const rotation = rot / 60000

  // Get image reference from blipFill
  const blipFillEl = findChild(picEl, 'blipFill')
  if (!blipFillEl) return null

  const blipEl = findChild(blipFillEl, 'blip')
  if (!blipEl) return null

  // Get relationship ID (r:embed or r:link)
  const embedId = getAttr(blipEl, 'r:embed') || getAttr(blipEl, 'embed')
  if (!embedId) return null

  // Get image source from map
  const src = imageMap.get(embedId)
  if (!src) {
    console.warn(`Image not found for relationship ID: ${embedId}`)
    return null
  }

  return {
    id: generateId(),
    type: 'image',
    position: { x, y },
    size: { width, height },
    rotation: rotation || 0,
    zIndex: 0, // Will be set by slide parser
    src,
    alt: '',
    opacity: 1,
  }
}

/**
 * Extract all images from PPTX file
 * Returns a map of media file paths to data URLs
 */
export async function extractImages(zip: JSZip): Promise<Map<string, string>> {
  const imageMap = new Map<string, string>()

  // Get all files in ppt/media/
  const mediaFolder = zip.folder('ppt/media')
  if (!mediaFolder) {
    return imageMap
  }

  const mediaFiles: Array<{ name: string; file: JSZip.JSZipObject }> = []
  mediaFolder.forEach((relativePath, file) => {
    if (!file.dir) {
      mediaFiles.push({ name: relativePath, file })
    }
  })

  // Process each image file
  for (const { name, file } of mediaFiles) {
    try {
      const extension = name.split('.').pop()?.toLowerCase() || ''
      const mimeType = getMimeType(extension)

      if (mimeType) {
        const arrayBuffer = await file.async('arraybuffer')
        const base64 = arrayBufferToBase64(arrayBuffer)
        const dataUrl = `data:${mimeType};base64,${base64}`

        // Store with full path as key
        const fullPath = `ppt/media/${name}`
        imageMap.set(fullPath, dataUrl)
      }
    } catch (error) {
      console.warn(`Failed to extract image: ${name}`, error)
    }
  }

  return imageMap
}

/**
 * Parse slide relationships to map relationship IDs to media paths
 */
export function parseSlideRelationships(relsXml: string): Map<string, string> {
  const relMap = new Map<string, string>()
  const parser = new DOMParser()
  const doc = parser.parseFromString(relsXml, 'application/xml')

  const relationships = doc.getElementsByTagName('Relationship')
  for (let i = 0; i < relationships.length; i++) {
    const rel = relationships[i]
    const id = rel.getAttribute('Id')
    const target = rel.getAttribute('Target')
    const type = rel.getAttribute('Type')

    if (id && target) {
      // Check if it's an image relationship
      if (type?.includes('/image')) {
        // Normalize path (remove ../ and resolve to ppt/media/...)
        let normalizedPath = target
        if (target.startsWith('../')) {
          normalizedPath = 'ppt/' + target.substring(3)
        } else if (!target.startsWith('ppt/')) {
          normalizedPath = 'ppt/slides/' + target
        }
        relMap.set(id, normalizedPath)
      }
    }
  }

  return relMap
}

/**
 * Build image map for a specific slide
 * Maps relationship IDs to data URLs
 */
export function buildSlideImageMap(
  relMap: Map<string, string>,
  globalImageMap: Map<string, string>
): Map<string, string> {
  const slideImageMap = new Map<string, string>()

  for (const [relId, mediaPath] of relMap.entries()) {
    const dataUrl = globalImageMap.get(mediaPath)
    if (dataUrl) {
      slideImageMap.set(relId, dataUrl)
    }
  }

  return slideImageMap
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Get MIME type for image extension
 */
function getMimeType(extension: string): string | null {
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    emf: 'image/emf',
    wmf: 'image/wmf',
  }
  return mimeTypes[extension] || null
}
