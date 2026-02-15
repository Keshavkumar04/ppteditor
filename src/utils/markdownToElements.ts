import { TextContent, Paragraph, TextRun, TextStyle, TableCell, TableElement, TextElement, Fill, Stroke } from '@/types/slide'
import { DEFAULT_TEXT_STYLE, DEFAULT_TEXTBOX_STYLE } from '@/types/slide'
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types/editor'
import { generateId } from '@/utils/id'
import type { SlideElement } from '@/types/slide'

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Parse a markdown string and return one or more SlideElements.
 * - Headings, paragraphs, lists → TextElement
 * - Markdown tables → TableElement
 * Mixed content produces multiple elements, stacked vertically.
 */
export function markdownToSlideElements(markdown: string): SlideElement[] {
  const lines = markdown.split('\n')
  const elements: SlideElement[] = []
  let pendingParagraphs: Paragraph[] = []

  const flushText = () => {
    if (pendingParagraphs.length > 0) {
      elements.push(makeTextElement({ paragraphs: pendingParagraphs }))
      pendingParagraphs = []
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Skip empty lines
    if (line.trim() === '') {
      i++
      continue
    }

    // Check for table (line contains | and next line is separator like |---|---|)
    if (isTableStart(lines, i)) {
      flushText()
      const { table, endIndex } = parseMarkdownTable(lines, i)
      if (table) elements.push(table)
      i = endIndex
      continue
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      const fontSize = getHeadingFontSize(level)
      const runs = parseInlineMarkdown(text, { fontSize, fontWeight: 'bold' as const })
      pendingParagraphs.push(createParagraph(runs, 'left'))
      i++
      continue
    }

    // Unordered list item
    const ulMatch = line.match(/^[\s]*[-*+]\s+(.+)$/)
    if (ulMatch) {
      const runs = parseInlineMarkdown(ulMatch[1].trim())
      pendingParagraphs.push(createParagraph(runs, 'left', {
        bulletType: 'bullet',
        indentLevel: 0,
      }))
      i++
      continue
    }

    // Ordered list item
    const olMatch = line.match(/^[\s]*\d+[.)]\s+(.+)$/)
    if (olMatch) {
      const runs = parseInlineMarkdown(olMatch[1].trim())
      pendingParagraphs.push(createParagraph(runs, 'left', {
        bulletType: 'number',
        indentLevel: 0,
      }))
      i++
      continue
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      pendingParagraphs.push(createParagraph(
        [{ text: '───────────────────────', style: { ...DEFAULT_TEXT_STYLE, color: '#9ca3af' } }],
        'center'
      ))
      i++
      continue
    }

    // Regular paragraph
    const runs = parseInlineMarkdown(line.trim())
    if (runs.length > 0) {
      pendingParagraphs.push(createParagraph(runs, 'left'))
    }
    i++
  }

  flushText()

  if (elements.length === 0) {
    return [makeTextElement(plainTextToContent(markdown))]
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

/**
 * Parse markdown into TextContent only (no tables — tables become flattened text).
 */
export function markdownToTextContent(markdown: string): TextContent {
  const lines = markdown.split('\n')
  const paragraphs: Paragraph[] = []

  for (const line of lines) {
    if (line.trim() === '') continue

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      const fontSize = getHeadingFontSize(level)
      const runs = parseInlineMarkdown(text, { fontSize, fontWeight: 'bold' as const })
      paragraphs.push(createParagraph(runs, 'left'))
      continue
    }

    // Unordered list
    const ulMatch = line.match(/^[\s]*[-*+]\s+(.+)$/)
    if (ulMatch) {
      const runs = parseInlineMarkdown(ulMatch[1].trim())
      paragraphs.push(createParagraph(runs, 'left', {
        bulletType: 'bullet',
        indentLevel: 0,
      }))
      continue
    }

    // Ordered list
    const olMatch = line.match(/^[\s]*\d+[.)]\s+(.+)$/)
    if (olMatch) {
      const runs = parseInlineMarkdown(olMatch[1].trim())
      paragraphs.push(createParagraph(runs, 'left', {
        bulletType: 'number',
        indentLevel: 0,
      }))
      continue
    }

    // Table separator lines (skip)
    if (/^\|[\s:|-]+\|$/.test(line.trim())) continue

    // Table rows → flatten to text
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const cells = line.trim().slice(1, -1).split('|').map(c => c.trim())
      const text = cells.join('  |  ')
      const runs = parseInlineMarkdown(text)
      paragraphs.push(createParagraph(runs, 'left'))
      continue
    }

    // Regular paragraph
    const runs = parseInlineMarkdown(line.trim())
    if (runs.length > 0) {
      paragraphs.push(createParagraph(runs, 'left'))
    }
  }

  if (paragraphs.length === 0) {
    return plainTextToContent(markdown)
  }

  return { paragraphs }
}

// ── Inline markdown parsing ─────────────────────────────────────────────────

interface RunData {
  text: string
  style: TextStyle
}

/**
 * Parse inline markdown (bold, italic, code, strikethrough) into styled runs.
 */
function parseInlineMarkdown(text: string, styleOverrides?: Partial<TextStyle>): RunData[] {
  const baseStyle: TextStyle = { ...DEFAULT_TEXT_STYLE, ...styleOverrides }
  const runs: RunData[] = []

  // Regex to match inline formatting:
  // **bold** or __bold__, *italic* or _italic_, `code`, ~~strikethrough~~, ***bolditalic***
  const inlineRegex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|`(.+?)`|~~(.+?)~~)/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = inlineRegex.exec(text)) !== null) {
    // Add text before this match as plain
    if (match.index > lastIndex) {
      const plainText = text.slice(lastIndex, match.index)
      if (plainText) {
        runs.push({ text: plainText, style: { ...baseStyle } })
      }
    }

    if (match[2]) {
      // ***bold italic***
      runs.push({ text: match[2], style: { ...baseStyle, fontWeight: 'bold', fontStyle: 'italic' } })
    } else if (match[3]) {
      // **bold**
      runs.push({ text: match[3], style: { ...baseStyle, fontWeight: 'bold' } })
    } else if (match[4]) {
      // __bold__
      runs.push({ text: match[4], style: { ...baseStyle, fontWeight: 'bold' } })
    } else if (match[5]) {
      // *italic*
      runs.push({ text: match[5], style: { ...baseStyle, fontStyle: 'italic' } })
    } else if (match[6]) {
      // _italic_
      runs.push({ text: match[6], style: { ...baseStyle, fontStyle: 'italic' } })
    } else if (match[7]) {
      // `code`
      runs.push({ text: match[7], style: { ...baseStyle, fontFamily: 'Courier New' } })
    } else if (match[8]) {
      // ~~strikethrough~~
      runs.push({ text: match[8], style: { ...baseStyle, textDecoration: 'line-through' } })
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    if (remaining) {
      runs.push({ text: remaining, style: { ...baseStyle } })
    }
  }

  // If no formatting was found, return single run
  if (runs.length === 0) {
    runs.push({ text, style: { ...baseStyle } })
  }

  return runs
}

// ── Table parsing ───────────────────────────────────────────────────────────

const DEFAULT_CELL_BORDER: Stroke = { color: '#d1d5db', width: 1, style: 'solid' }
const HEADER_FILL: Fill = { type: 'solid', color: '#f1f5f9' }

type CellAlignment = 'left' | 'center' | 'right'

function isTableStart(lines: string[], index: number): boolean {
  const line = lines[index]?.trim()
  if (!line || !line.startsWith('|') || !line.endsWith('|')) return false

  // Check if next line is a separator row like |---|:---:|---:|
  const nextLine = lines[index + 1]?.trim()
  if (!nextLine) return false

  return /^\|[\s:|-]+\|$/.test(nextLine)
}

function parseMarkdownTable(lines: string[], startIndex: number): { table: TableElement | null; endIndex: number } {
  const tableLines: string[] = []
  let i = startIndex

  // Collect all consecutive table lines
  while (i < lines.length) {
    const line = lines[i].trim()
    if (line.startsWith('|') && line.endsWith('|')) {
      tableLines.push(line)
      i++
    } else if (line === '') {
      i++
      break
    } else {
      break
    }
  }

  if (tableLines.length < 2) return { table: null, endIndex: i }

  // Parse header row
  const headerCells = parsePipeLine(tableLines[0])

  // Parse separator row to get alignments
  const separatorCells = parsePipeLine(tableLines[1])
  const alignments: CellAlignment[] = separatorCells.map(sep => {
    const trimmed = sep.trim()
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) return 'center'
    if (trimmed.endsWith(':')) return 'right'
    return 'left'
  })

  // Parse data rows
  const dataRows: string[][] = []
  for (let r = 2; r < tableLines.length; r++) {
    dataRows.push(parsePipeLine(tableLines[r]))
  }

  const numCols = headerCells.length
  const numRows = 1 + dataRows.length // header + data

  // Build cells
  const cells: TableCell[][] = []

  // Header row
  const headerRow: TableCell[] = headerCells.map((cellText, c) => {
    const align = alignments[c] || 'left'
    const runs = parseInlineMarkdown(cellText.trim(), { fontWeight: 'bold' as const, fontSize: 14 })
    return makeTableCell(runs, align, true)
  })
  cells.push(headerRow)

  // Data rows
  for (const row of dataRows) {
    const dataRow: TableCell[] = []
    for (let c = 0; c < numCols; c++) {
      const cellText = row[c]?.trim() || ''
      const align = alignments[c] || 'left'
      const runs = parseInlineMarkdown(cellText, { fontSize: 14 })
      dataRow.push(makeTableCell(runs, align, false))
    }
    cells.push(dataRow)
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
      headerRowFill: HEADER_FILL,
    },
  }

  return { table: tableElement, endIndex: i }
}

function parsePipeLine(line: string): string[] {
  // Remove leading/trailing pipes and split
  return line.trim().slice(1, -1).split('|').map(s => s.trim())
}

function makeTableCell(runs: RunData[], alignment: CellAlignment, isHeader: boolean): TableCell {
  const textRuns: TextRun[] = runs.map(r => ({
    id: generateId(),
    text: r.text,
    style: r.style,
  }))

  return {
    id: generateId(),
    content: {
      paragraphs: [{
        id: generateId(),
        runs: textRuns,
        alignment,
      }],
    },
    padding: { top: 4, right: 8, bottom: 4, left: 8 },
    verticalAlign: 'middle',
    fill: isHeader ? HEADER_FILL : { type: 'solid', color: '#FFFFFF' },
    borders: {
      top: { ...DEFAULT_CELL_BORDER },
      right: { ...DEFAULT_CELL_BORDER },
      bottom: { ...DEFAULT_CELL_BORDER },
      left: { ...DEFAULT_CELL_BORDER },
    },
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
