/**
 * Text Formatting Utilities
 * Handles run splitting, merging, and format application for rich text editing
 */

import { TextContent, Paragraph, TextRun, TextStyle } from '@/types'
import { generateId } from './index'

export interface TextSelection {
  paragraphIndex: number
  runIndex: number
  startOffset: number
  endParagraphIndex: number
  endRunIndex: number
  endOffset: number
}

export type TextFormatProperty = keyof Pick<TextStyle, 'fontFamily' | 'fontSize' | 'fontWeight' | 'fontStyle' | 'textDecoration' | 'color' | 'backgroundColor'>

export interface TextFormat {
  property: TextFormatProperty
  value: string | number
}

/**
 * Compare two text styles to check if they are equal
 */
export function stylesEqual(a: TextStyle, b: TextStyle): boolean {
  return (
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.fontWeight === b.fontWeight &&
    a.fontStyle === b.fontStyle &&
    a.textDecoration === b.textDecoration &&
    a.color === b.color &&
    a.backgroundColor === b.backgroundColor
  )
}

/**
 * Merge adjacent runs with identical styles within a paragraph
 */
export function mergeAdjacentRuns(paragraph: Paragraph): Paragraph {
  if (paragraph.runs.length <= 1) return paragraph

  const mergedRuns: TextRun[] = []
  let currentRun = { ...paragraph.runs[0] }

  for (let i = 1; i < paragraph.runs.length; i++) {
    const nextRun = paragraph.runs[i]

    if (stylesEqual(currentRun.style, nextRun.style)) {
      // Merge with current run
      currentRun = {
        ...currentRun,
        text: currentRun.text + nextRun.text,
      }
    } else {
      // Push current run and start new one
      mergedRuns.push(currentRun)
      currentRun = { ...nextRun }
    }
  }

  // Push the last run
  mergedRuns.push(currentRun)

  // Remove empty runs
  const nonEmptyRuns = mergedRuns.filter(r => r.text.length > 0)

  // Ensure at least one run
  if (nonEmptyRuns.length === 0) {
    nonEmptyRuns.push({
      id: generateId(),
      text: '',
      style: paragraph.runs[0]?.style || getDefaultStyle(),
    })
  }

  return {
    ...paragraph,
    runs: nonEmptyRuns,
  }
}

/**
 * Get default text style
 */
export function getDefaultStyle(): TextStyle {
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
 * Split a run at a given offset
 * Returns [beforeRun, afterRun] or [run, null] if offset is at the end
 */
export function splitRunAtOffset(run: TextRun, offset: number): [TextRun, TextRun | null] {
  if (offset <= 0) {
    return [{ ...run, id: generateId(), text: '' }, { ...run }]
  }
  if (offset >= run.text.length) {
    return [{ ...run }, null]
  }

  const beforeText = run.text.slice(0, offset)
  const afterText = run.text.slice(offset)

  return [
    { ...run, text: beforeText },
    { ...run, id: generateId(), text: afterText },
  ]
}

/**
 * Apply a format to a selection within text content
 */
export function applyFormatToSelection(
  content: TextContent,
  selection: TextSelection,
  format: TextFormat
): TextContent {
  const newParagraphs = [...content.paragraphs]

  // Handle single paragraph selection
  if (selection.paragraphIndex === selection.endParagraphIndex) {
    const paragraph = newParagraphs[selection.paragraphIndex]
    const newParagraph = applyFormatToParagraphRange(
      paragraph,
      selection.runIndex,
      selection.startOffset,
      selection.endRunIndex,
      selection.endOffset,
      format
    )
    newParagraphs[selection.paragraphIndex] = mergeAdjacentRuns(newParagraph)
  } else {
    // Multi-paragraph selection
    for (let pIdx = selection.paragraphIndex; pIdx <= selection.endParagraphIndex; pIdx++) {
      const paragraph = newParagraphs[pIdx]

      if (pIdx === selection.paragraphIndex) {
        // First paragraph: from selection start to end of paragraph
        const lastRunIndex = paragraph.runs.length - 1
        const lastRunLength = paragraph.runs[lastRunIndex]?.text.length || 0
        const newParagraph = applyFormatToParagraphRange(
          paragraph,
          selection.runIndex,
          selection.startOffset,
          lastRunIndex,
          lastRunLength,
          format
        )
        newParagraphs[pIdx] = mergeAdjacentRuns(newParagraph)
      } else if (pIdx === selection.endParagraphIndex) {
        // Last paragraph: from start to selection end
        const newParagraph = applyFormatToParagraphRange(
          paragraph,
          0,
          0,
          selection.endRunIndex,
          selection.endOffset,
          format
        )
        newParagraphs[pIdx] = mergeAdjacentRuns(newParagraph)
      } else {
        // Middle paragraph: format entire paragraph
        const lastRunIndex = paragraph.runs.length - 1
        const lastRunLength = paragraph.runs[lastRunIndex]?.text.length || 0
        const newParagraph = applyFormatToParagraphRange(
          paragraph,
          0,
          0,
          lastRunIndex,
          lastRunLength,
          format
        )
        newParagraphs[pIdx] = mergeAdjacentRuns(newParagraph)
      }
    }
  }

  return { paragraphs: newParagraphs }
}

/**
 * Apply a format to a range within a single paragraph
 */
function applyFormatToParagraphRange(
  paragraph: Paragraph,
  startRunIndex: number,
  startOffset: number,
  endRunIndex: number,
  endOffset: number,
  format: TextFormat
): Paragraph {
  const newRuns: TextRun[] = []

  for (let rIdx = 0; rIdx < paragraph.runs.length; rIdx++) {
    const run = paragraph.runs[rIdx]

    if (rIdx < startRunIndex || rIdx > endRunIndex) {
      // Run is outside selection, keep as is
      newRuns.push({ ...run })
    } else if (rIdx === startRunIndex && rIdx === endRunIndex) {
      // Selection is within a single run
      const [before, rest] = splitRunAtOffset(run, startOffset)
      if (rest) {
        const [middle, after] = splitRunAtOffset(rest, endOffset - startOffset)

        if (before.text) newRuns.push(before)
        if (middle.text) {
          newRuns.push({
            ...middle,
            style: { ...middle.style, [format.property]: format.value },
          })
        }
        if (after?.text) newRuns.push(after)
      } else {
        // Offset is at end of run
        if (before.text) newRuns.push(before)
      }
    } else if (rIdx === startRunIndex) {
      // Start run: split at startOffset
      const [before, after] = splitRunAtOffset(run, startOffset)

      if (before.text) newRuns.push(before)
      if (after) {
        newRuns.push({
          ...after,
          style: { ...after.style, [format.property]: format.value },
        })
      }
    } else if (rIdx === endRunIndex) {
      // End run: split at endOffset
      const [before, after] = splitRunAtOffset(run, endOffset)

      newRuns.push({
        ...before,
        style: { ...before.style, [format.property]: format.value },
      })
      if (after?.text) newRuns.push(after)
    } else {
      // Middle run: apply format to entire run
      newRuns.push({
        ...run,
        style: { ...run.style, [format.property]: format.value },
      })
    }
  }

  return {
    ...paragraph,
    runs: newRuns,
  }
}

/**
 * Toggle a boolean-style format (bold, italic, underline, strikethrough)
 */
export function toggleFormat(
  content: TextContent,
  selection: TextSelection,
  property: 'fontWeight' | 'fontStyle' | 'textDecoration'
): TextContent {
  // Check if selection already has the format
  const hasFormat = selectionHasFormat(content, selection, property)

  let value: string | number
  switch (property) {
    case 'fontWeight':
      value = hasFormat ? 'normal' : 'bold'
      break
    case 'fontStyle':
      value = hasFormat ? 'normal' : 'italic'
      break
    case 'textDecoration':
      value = hasFormat ? 'none' : 'underline'
      break
  }

  return applyFormatToSelection(content, selection, { property, value })
}

/**
 * Check if the selection has a specific format applied
 */
export function selectionHasFormat(
  content: TextContent,
  selection: TextSelection,
  property: 'fontWeight' | 'fontStyle' | 'textDecoration'
): boolean {
  // Get all runs in the selection
  const runs = getRunsInSelection(content, selection)

  if (runs.length === 0) return false

  // Check if ALL runs have the format
  return runs.every(run => {
    switch (property) {
      case 'fontWeight':
        return run.style.fontWeight === 'bold' || (typeof run.style.fontWeight === 'number' && run.style.fontWeight >= 600)
      case 'fontStyle':
        return run.style.fontStyle === 'italic'
      case 'textDecoration':
        return run.style.textDecoration === 'underline' || run.style.textDecoration === 'line-through'
      default:
        return false
    }
  })
}

/**
 * Get all runs that are part of the selection
 */
function getRunsInSelection(content: TextContent, selection: TextSelection): TextRun[] {
  const runs: TextRun[] = []

  for (let pIdx = selection.paragraphIndex; pIdx <= selection.endParagraphIndex; pIdx++) {
    const paragraph = content.paragraphs[pIdx]
    if (!paragraph) continue

    const startRun = pIdx === selection.paragraphIndex ? selection.runIndex : 0
    const endRun = pIdx === selection.endParagraphIndex ? selection.endRunIndex : paragraph.runs.length - 1

    for (let rIdx = startRun; rIdx <= endRun; rIdx++) {
      const run = paragraph.runs[rIdx]
      if (run) runs.push(run)
    }
  }

  return runs
}

/**
 * Get the common style across selected runs (or null if mixed)
 */
export function getSelectionStyle(
  content: TextContent,
  selection: TextSelection
): Partial<TextStyle> | null {
  const runs = getRunsInSelection(content, selection)

  if (runs.length === 0) return null
  if (runs.length === 1) return runs[0].style

  // Check each property for consistency
  const result: Partial<TextStyle> = {}
  const firstStyle = runs[0].style

  const properties: (keyof TextStyle)[] = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration', 'color']

  for (const prop of properties) {
    const allSame = runs.every(r => r.style[prop] === firstStyle[prop])
    if (allSame) {
      (result as Record<string, unknown>)[prop] = firstStyle[prop]
    }
  }

  return result
}

/**
 * Convert DOM selection to our TextSelection format
 */
export function domSelectionToTextSelection(
  contentDiv: HTMLElement,
  content: TextContent
): TextSelection | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)

  // Find the paragraph and run indices for start and end
  const start = findPositionInContent(contentDiv, range.startContainer, range.startOffset, content)
  const end = findPositionInContent(contentDiv, range.endContainer, range.endOffset, content)

  if (!start || !end) return null

  return {
    paragraphIndex: start.paragraphIndex,
    runIndex: start.runIndex,
    startOffset: start.offset,
    endParagraphIndex: end.paragraphIndex,
    endRunIndex: end.runIndex,
    endOffset: end.offset,
  }
}

/**
 * Find the paragraph/run/offset for a DOM position
 */
function findPositionInContent(
  contentDiv: HTMLElement,
  node: Node,
  offset: number,
  _content: TextContent
): { paragraphIndex: number; runIndex: number; offset: number } | null {
  // Walk up to find the paragraph and run elements
  let current: Node | null = node

  // If node is a text node, get its parent
  if (node.nodeType === Node.TEXT_NODE) {
    current = node.parentElement
  }

  // Find the span (run) element
  let runElement: HTMLElement | null = null
  let paragraphElement: HTMLElement | null = null

  while (current && current !== contentDiv) {
    const el = current as HTMLElement
    if (el.dataset?.runIndex !== undefined) {
      runElement = el
    }
    if (el.dataset?.paragraphIndex !== undefined) {
      paragraphElement = el
    }
    current = current.parentNode
  }

  if (paragraphElement === null) {
    // If we couldn't find paragraph markers, assume single paragraph
    return { paragraphIndex: 0, runIndex: 0, offset }
  }

  const paragraphIndex = parseInt(paragraphElement.dataset.paragraphIndex || '0', 10)
  const runIndex = runElement ? parseInt(runElement.dataset.runIndex || '0', 10) : 0

  return { paragraphIndex, runIndex, offset }
}
