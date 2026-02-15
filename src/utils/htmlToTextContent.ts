import { TextContent, Paragraph, TextRun, TextStyle, TableCell, TableElement, TextElement, Fill, Stroke } from '@/types/slide'
import { DEFAULT_TEXT_STYLE, DEFAULT_TEXTBOX_STYLE } from '@/types/slide'
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types/editor'
import { generateId } from '@/utils/id'
import type { SlideElement } from '@/types/slide'

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse an HTML string into the PPT TextContent model (paragraphs + styled runs).
 * Tables in the HTML are ignored — use htmlToSlideElements for full support.
 */
export function htmlToTextContent(html: string): TextContent {
  if (typeof DOMParser === 'undefined') {
    return plainTextToContent(html)
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const body = doc.body
  if (!body || !body.childNodes.length) {
    return plainTextToContent(html)
  }

  const paragraphs = parseBlockChildren(body)

  if (paragraphs.length === 0) {
    const text = body.textContent || html
    return plainTextToContent(text)
  }

  return { paragraphs }
}

/**
 * Parse an HTML string and return one or more SlideElements.
 * - Regular text / headings / lists → TextElement
 * - <table> → TableElement
 * Mixed HTML with tables and text produces multiple elements, stacked vertically.
 */
export function htmlToSlideElements(html: string): SlideElement[] {
  if (typeof DOMParser === 'undefined') {
    return [makeTextElement(plainTextToContent(html))]
  }

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const body = doc.body
  if (!body || !body.childNodes.length) {
    return [makeTextElement(plainTextToContent(html))]
  }

  const elements: SlideElement[] = []
  let pendingParagraphs: Paragraph[] = []

  // Flush accumulated paragraphs into a TextElement
  const flushText = () => {
    if (pendingParagraphs.length > 0) {
      elements.push(makeTextElement({ paragraphs: pendingParagraphs }))
      pendingParagraphs = []
    }
  }

  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i]

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) {
        pendingParagraphs.push(createParagraph(
          [{ text, style: { ...DEFAULT_TEXT_STYLE } }],
          'left'
        ))
      }
      continue
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    if (tag === 'table') {
      // Flush any pending text before the table
      flushText()
      const tableEl = parseTable(el)
      if (tableEl) elements.push(tableEl)
    } else {
      // Accumulate paragraphs from non-table block elements
      const paras = parseBlockElement(el)
      pendingParagraphs.push(...paras)
    }
  }

  flushText()

  if (elements.length === 0) {
    const text = body.textContent || html
    return [makeTextElement(plainTextToContent(text))]
  }

  // Position elements vertically, stacked from center
  const totalHeight = elements.reduce((h, el) => h + el.size.height, 0)
  const gap = 20
  const totalWithGaps = totalHeight + gap * (elements.length - 1)
  let yOffset = Math.max(20, Math.round((SLIDE_HEIGHT - totalWithGaps) / 2))

  for (const el of elements) {
    el.position.y = yOffset
    yOffset += el.size.height + gap
  }

  return elements
}

// ── Block-level parsing ─────────────────────────────────────────────────────

function parseBlockChildren(parent: Node): Paragraph[] {
  const paragraphs: Paragraph[] = []

  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i]

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim()
      if (text) {
        paragraphs.push(createParagraph(
          [{ text, style: { ...DEFAULT_TEXT_STYLE } }],
          'left'
        ))
      }
      continue
    }

    if (node.nodeType !== Node.ELEMENT_NODE) continue

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    // Skip tables in text-only mode
    if (tag === 'table') continue

    paragraphs.push(...parseBlockElement(el))
  }

  return paragraphs
}

function parseBlockElement(el: HTMLElement): Paragraph[] {
  const tag = el.tagName.toLowerCase()
  const paragraphs: Paragraph[] = []

  if (tag === 'ul' || tag === 'ol') {
    const isOrdered = tag === 'ol'
    const items = el.querySelectorAll(':scope > li')
    items.forEach((li) => {
      const runs = extractRuns(li)
      if (runs.length > 0) {
        paragraphs.push(createParagraph(runs, 'left', {
          bulletType: isOrdered ? 'number' : 'bullet',
          indentLevel: 0,
        }))
      }
    })
  } else if (/^h[1-6]$/.test(tag)) {
    const level = parseInt(tag[1])
    const fontSize = getHeadingFontSize(level)
    const align = getAlignment(el)
    const runs = extractRuns(el, { fontSize, fontWeight: 'bold' as const })
    if (runs.length > 0) {
      paragraphs.push(createParagraph(runs, align))
    }
  } else if (tag === 'br') {
    paragraphs.push(createParagraph(
      [{ text: '', style: { ...DEFAULT_TEXT_STYLE } }],
      'left'
    ))
  } else {
    // p, div, blockquote, span, etc.
    const align = getAlignment(el)
    const runs = extractRuns(el)
    if (runs.length > 0) {
      paragraphs.push(createParagraph(runs, align))
    }
  }

  return paragraphs
}

// ── Alignment helper ────────────────────────────────────────────────────────

type ParagraphAlignment = 'left' | 'center' | 'right' | 'justify'

/** Extract text alignment from an HTML element's style or align attribute */
function getAlignment(el: HTMLElement): ParagraphAlignment {
  // Check inline style first: style="text-align: center"
  const styleAlign = el.style?.textAlign
  if (styleAlign) {
    const normalized = styleAlign.toLowerCase().trim()
    if (normalized === 'center' || normalized === 'right' || normalized === 'justify') {
      return normalized
    }
    if (normalized === 'left' || normalized === 'start') return 'left'
    if (normalized === 'end') return 'right'
  }

  // Check align attribute: align="center"
  const attrAlign = el.getAttribute('align')
  if (attrAlign) {
    const normalized = attrAlign.toLowerCase().trim()
    if (normalized === 'center' || normalized === 'right' || normalized === 'justify') {
      return normalized
    }
  }

  return 'left'
}

// ── Table parsing ───────────────────────────────────────────────────────────

const DEFAULT_CELL_BORDER: Stroke = { color: '#d1d5db', width: 1, style: 'solid' }
const HEADER_FILL: Fill = { type: 'solid', color: '#f1f5f9' }
const TABLE_CELL_STYLE: TextStyle = {
  fontFamily: 'Calibri',
  fontSize: 14,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: '#000000',
}

function parseTable(tableEl: HTMLElement): TableElement | null {
  // Collect all rows (from thead, tbody, tfoot, or direct tr children)
  const allRows: HTMLTableRowElement[] = []
  const trs = tableEl.querySelectorAll('tr')
  trs.forEach(tr => allRows.push(tr as HTMLTableRowElement))

  if (allRows.length === 0) return null

  // Determine grid dimensions
  const numRows = allRows.length
  let numCols = 0
  allRows.forEach(tr => {
    let count = 0
    for (let i = 0; i < tr.cells.length; i++) {
      count += tr.cells[i].colSpan || 1
    }
    if (count > numCols) numCols = count
  })

  if (numCols === 0) return null

  // Detect if first row is a header (uses <th> elements)
  const firstRowHasTh = allRows[0]?.querySelector('th') !== null

  // Build cells grid
  const cells: TableCell[][] = []
  for (let r = 0; r < numRows; r++) {
    const row: TableCell[] = []
    const tr = allRows[r]
    const htmlCells = tr ? tr.querySelectorAll(':scope > td, :scope > th') : []

    for (let c = 0; c < numCols; c++) {
      const htmlCell = htmlCells[c] as HTMLElement | undefined

      if (htmlCell) {
        const isHeader = htmlCell.tagName.toLowerCase() === 'th' || (r === 0 && firstRowHasTh)
        const cellRuns = extractRuns(htmlCell, isHeader ? { fontWeight: 'bold' as const } : undefined)
        const cellAlign = getAlignment(htmlCell)

        const content: TextContent = cellRuns.length > 0
          ? { paragraphs: [createParagraph(cellRuns, cellAlign)] }
          : { paragraphs: [createParagraph([{ text: '', style: TABLE_CELL_STYLE }], cellAlign)] }

        row.push({
          id: generateId(),
          content,
          padding: { top: 4, right: 8, bottom: 4, left: 8 },
          verticalAlign: 'middle',
          fill: isHeader ? HEADER_FILL : { type: 'solid', color: '#FFFFFF' },
          borders: {
            top: { ...DEFAULT_CELL_BORDER },
            right: { ...DEFAULT_CELL_BORDER },
            bottom: { ...DEFAULT_CELL_BORDER },
            left: { ...DEFAULT_CELL_BORDER },
          },
        })
      } else {
        // Empty cell padding for colspan overflow
        row.push(makeEmptyCell())
      }
    }

    cells.push(row)
  }

  // Size calculations
  const cellWidth = Math.min(150, Math.floor((SLIDE_WIDTH - 100) / numCols))
  const cellHeight = 36
  const tableWidth = cellWidth * numCols
  const tableHeight = cellHeight * numRows

  const tableElement: TableElement = {
    id: generateId(),
    type: 'table',
    position: {
      x: Math.round((SLIDE_WIDTH - tableWidth) / 2),
      y: Math.round((SLIDE_HEIGHT - tableHeight) / 2),
    },
    size: { width: tableWidth, height: tableHeight },
    zIndex: 0,
    rows: numRows,
    columns: numCols,
    cells,
    columnWidths: Array(numCols).fill(cellWidth),
    rowHeights: Array(numRows).fill(cellHeight),
    style: {
      borderCollapse: true,
      defaultCellFill: { type: 'solid', color: '#FFFFFF' },
      headerRowFill: firstRowHasTh ? HEADER_FILL : undefined,
    },
  }

  return tableElement
}

function makeEmptyCell(): TableCell {
  return {
    id: generateId(),
    content: {
      paragraphs: [{
        id: generateId(),
        runs: [{
          id: generateId(),
          text: '',
          style: TABLE_CELL_STYLE,
        }],
        alignment: 'left',
      }],
    },
    padding: { top: 4, right: 8, bottom: 4, left: 8 },
    verticalAlign: 'middle',
    borders: {
      top: { ...DEFAULT_CELL_BORDER },
      right: { ...DEFAULT_CELL_BORDER },
      bottom: { ...DEFAULT_CELL_BORDER },
      left: { ...DEFAULT_CELL_BORDER },
    },
  }
}

// ── Inline / run extraction ─────────────────────────────────────────────────

function getHeadingFontSize(level: number): number {
  switch (level) {
    case 1: return 36
    case 2: return 28
    case 3: return 24
    case 4: return 20
    case 5: return 18
    case 6: return 16
    default: return 18
  }
}

interface RunData {
  text: string
  style: TextStyle
}

/**
 * Recursively extract styled TextRuns from an element.
 */
function extractRuns(el: Node, parentStyleOverrides?: Partial<TextStyle>): RunData[] {
  const runs: RunData[] = []
  const baseStyle: TextStyle = { ...DEFAULT_TEXT_STYLE, ...parentStyleOverrides }

  for (let i = 0; i < el.childNodes.length; i++) {
    const child = el.childNodes[i]

    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || ''
      if (text) {
        runs.push({ text, style: { ...baseStyle } })
      }
      continue
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue

    const childEl = child as HTMLElement
    const tag = childEl.tagName.toLowerCase()

    const styleOverrides: Partial<TextStyle> = { ...parentStyleOverrides }

    if (tag === 'strong' || tag === 'b') {
      styleOverrides.fontWeight = 'bold'
    }
    if (tag === 'em' || tag === 'i') {
      styleOverrides.fontStyle = 'italic'
    }
    if (tag === 'u') {
      styleOverrides.textDecoration = 'underline'
    }
    if (tag === 's' || tag === 'del' || tag === 'strike') {
      styleOverrides.textDecoration = 'line-through'
    }
    if (tag === 'code') {
      styleOverrides.fontFamily = 'Courier New'
    }

    const childRuns = extractRuns(childEl, styleOverrides)
    runs.push(...childRuns)
  }

  return runs
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function createParagraph(
  runData: RunData[],
  alignment: Paragraph['alignment'],
  extra?: Partial<Pick<Paragraph, 'bulletType' | 'bulletChar' | 'indentLevel'>>
): Paragraph {
  const runs: TextRun[] = runData.map(r => ({
    id: generateId(),
    text: r.text,
    style: r.style,
  }))

  return {
    id: generateId(),
    runs,
    alignment,
    ...extra,
  }
}

function makeTextElement(content: TextContent): TextElement {
  return {
    id: generateId(),
    type: 'text',
    position: {
      x: Math.round((SLIDE_WIDTH - 400) / 2),
      y: Math.round((SLIDE_HEIGHT - 200) / 2),
    },
    size: { width: 400, height: 200 },
    zIndex: 0,
    content,
    style: DEFAULT_TEXTBOX_STYLE,
  }
}

function plainTextToContent(text: string): TextContent {
  const lines = text.split('\n').filter(l => l.trim() !== '')
  if (lines.length === 0) {
    lines.push(text || ' ')
  }

  return {
    paragraphs: lines.map(line => createParagraph(
      [{ text: line, style: { ...DEFAULT_TEXT_STYLE } }],
      'left'
    )),
  }
}
