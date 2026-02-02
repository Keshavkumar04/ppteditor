import React, { useRef, useEffect, useCallback } from 'react'
import { TextContent, TextBoxStyle, TextStyle } from '@/types'
import {
  TextSelection,
  getSelectionStyle,
} from '@/utils/textFormatting'
import { generateId } from '@/utils'

interface RichTextEditorProps {
  content: TextContent
  style: TextBoxStyle
  onChange: (content: TextContent) => void
  onSelectionChange?: (selection: TextSelection | null, style: Partial<TextStyle> | null) => void
  onBlur: () => void
  onKeyDown?: (e: React.KeyboardEvent) => void
}

export function RichTextEditor({
  content,
  style,
  onChange,
  onSelectionChange,
  onBlur,
  onKeyDown,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isComposingRef = useRef(false)
  const contentRef = useRef(content)

  // Keep content ref updated
  contentRef.current = content

  // Initialize editor with content HTML
  useEffect(() => {
    if (editorRef.current) {
      const html = contentToHtml(content)
      editorRef.current.innerHTML = html
      editorRef.current.focus()

      // Place cursor at end
      const range = document.createRange()
      const sel = window.getSelection()
      range.selectNodeContents(editorRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, []) // Only run once on mount

  // Handle selection changes
  const handleSelectionChange = useCallback(() => {
    if (!editorRef.current || !onSelectionChange) return

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || !editorRef.current.contains(sel.anchorNode)) {
      return
    }

    // Get selection info
    const selection = getTextSelection(editorRef.current)
    if (selection) {
      const selectionStyle = getSelectionStyle(contentRef.current, selection)
      onSelectionChange(selection, selectionStyle)
    } else {
      onSelectionChange(null, null)
    }
  }, [onSelectionChange])

  // Set up selection change listener
  useEffect(() => {
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange)
    }
  }, [handleSelectionChange])

  // Parse content from DOM and save
  const saveContent = useCallback(() => {
    if (!editorRef.current || isComposingRef.current) return

    const newContent = htmlToContent(editorRef.current, contentRef.current)
    onChange(newContent)
  }, [onChange])

  // Handle blur - save content
  const handleBlur = useCallback((_e: React.FocusEvent) => {
    saveContent()
    onBlur()
  }, [saveContent, onBlur])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault()
          document.execCommand('bold', false)
          break
        case 'i':
          e.preventDefault()
          document.execCommand('italic', false)
          break
        case 'u':
          e.preventDefault()
          document.execCommand('underline', false)
          break
      }
    }

    if (e.key === 'Escape') {
      onKeyDown?.(e)
    }

    e.stopPropagation()
  }, [onKeyDown])

  // Handle composition (IME input)
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  const handleCompositionEnd = useCallback(() => {
    isComposingRef.current = false
  }, [])

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      data-rich-text-editor="true"
      style={{
        width: '100%',
        height: '100%',
        padding: `${style.padding.top}px ${style.padding.right}px ${style.padding.bottom}px ${style.padding.left}px`,
        outline: 'none',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: style.verticalAlign === 'middle' ? 'center' : style.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
        backgroundColor: style.fill?.type === 'solid' ? style.fill.color : 'transparent',
        wordWrap: style.wordWrap ? 'break-word' : 'normal',
        cursor: 'text',
        whiteSpace: 'pre-wrap',
      }}
    />
  )
}

/**
 * Convert TextContent to HTML string
 */
function contentToHtml(content: TextContent): string {
  return content.paragraphs.map((paragraph, pIndex) => {
    const runsHtml = paragraph.runs.map((run, rIndex) => {
      const styles: string[] = []
      if (run.style.fontFamily) styles.push(`font-family: ${run.style.fontFamily}`)
      if (run.style.fontSize) styles.push(`font-size: ${run.style.fontSize}px`)
      if (run.style.fontWeight && run.style.fontWeight !== 'normal') styles.push(`font-weight: ${run.style.fontWeight}`)
      if (run.style.fontStyle && run.style.fontStyle !== 'normal') styles.push(`font-style: ${run.style.fontStyle}`)
      if (run.style.textDecoration && run.style.textDecoration !== 'none') styles.push(`text-decoration: ${run.style.textDecoration}`)
      if (run.style.color) styles.push(`color: ${run.style.color}`)
      if (run.style.backgroundColor) styles.push(`background-color: ${run.style.backgroundColor}`)

      const text = run.text || '\u200B'
      // Convert newlines to <br> tags for proper display
      const htmlText = escapeHtml(text).replace(/\n/g, '<br>')
      return `<span data-run-index="${rIndex}" style="${styles.join('; ')}">${htmlText}</span>`
    }).join('')

    const pStyles: string[] = []
    pStyles.push('margin: 0')
    if (paragraph.alignment) pStyles.push(`text-align: ${paragraph.alignment}`)
    if (paragraph.lineSpacing) pStyles.push(`line-height: ${paragraph.lineSpacing}%`)
    if (paragraph.spaceBefore) pStyles.push(`margin-top: ${paragraph.spaceBefore}px`)
    if (paragraph.spaceAfter) pStyles.push(`margin-bottom: ${paragraph.spaceAfter}px`)

    return `<p data-paragraph-index="${pIndex}" style="${pStyles.join('; ')}">${runsHtml || '\u200B'}</p>`
  }).join('')
}

/**
 * Convert HTML DOM back to TextContent
 * Handles various HTML structures from contentEditable:
 * - <p> elements for paragraphs
 * - <div> elements (sometimes used instead of <p>)
 * - <br> for line breaks
 * - <b>, <strong> for bold
 * - <i>, <em> for italic
 * - <u> for underline
 * - <span> with inline styles
 */
function htmlToContent(editor: HTMLElement, originalContent: TextContent): TextContent {
  const paragraphs: TextContent['paragraphs'] = []
  const defaultStyle = originalContent.paragraphs[0]?.runs[0]?.style || getDefaultTextStyle()

  // Get block-level children (p, div) or treat as single block
  const blocks = getBlockElements(editor)

  if (blocks.length === 0) {
    // No block elements - parse inline content directly
    const runs = parseInlineContent(editor, defaultStyle)
    paragraphs.push({
      id: originalContent.paragraphs[0]?.id || generateId(),
      runs: runs.length > 0 ? runs : [{ id: generateId(), text: '', style: defaultStyle }],
      alignment: originalContent.paragraphs[0]?.alignment || 'left',
    })
  } else {
    blocks.forEach((block, pIndex) => {
      const originalParagraph = originalContent.paragraphs[pIndex]
      const runs = parseInlineContent(block, defaultStyle)

      // Get alignment from computed style
      const computedStyle = window.getComputedStyle(block)
      let alignment = computedStyle.textAlign as 'left' | 'center' | 'right' | 'justify'
      if (!['left', 'center', 'right', 'justify'].includes(alignment)) {
        alignment = originalParagraph?.alignment || 'left'
      }

      paragraphs.push({
        id: originalParagraph?.id || generateId(),
        runs: runs.length > 0 ? runs : [{ id: generateId(), text: '', style: defaultStyle }],
        alignment,
        lineSpacing: originalParagraph?.lineSpacing,
        spaceBefore: originalParagraph?.spaceBefore,
        spaceAfter: originalParagraph?.spaceAfter,
      })
    })
  }

  // Ensure at least one paragraph
  if (paragraphs.length === 0) {
    paragraphs.push({
      id: generateId(),
      runs: [{ id: generateId(), text: '', style: defaultStyle }],
      alignment: 'left',
    })
  }

  return { paragraphs }
}

/**
 * Get block-level elements from editor
 */
function getBlockElements(editor: HTMLElement): HTMLElement[] {
  const blocks: HTMLElement[] = []

  // Check for p or div elements
  const children = Array.from(editor.childNodes)

  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      const tagName = el.tagName.toLowerCase()
      if (tagName === 'p' || tagName === 'div') {
        blocks.push(el)
      }
    } else if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) {
      // Wrap loose text in a virtual block
      const wrapper = document.createElement('div')
      wrapper.textContent = child.textContent
      blocks.push(wrapper)
    }
  }

  return blocks
}

/**
 * Parse inline content into runs, handling formatting tags
 */
function parseInlineContent(element: HTMLElement, defaultStyle: TextStyle): Array<{ id: string; text: string; style: TextStyle }> {
  const runs: Array<{ id: string; text: string; style: TextStyle }> = []

  function walkNode(node: Node, inheritedStyle: TextStyle) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\u200B/g, '') || ''
      if (text) {
        runs.push({
          id: generateId(),
          text,
          style: { ...inheritedStyle },
        })
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tagName = el.tagName.toLowerCase()

      // Clone style and apply tag-based formatting
      const style = { ...inheritedStyle }

      // Check for formatting tags
      if (tagName === 'b' || tagName === 'strong') {
        style.fontWeight = 'bold'
      }
      if (tagName === 'i' || tagName === 'em') {
        style.fontStyle = 'italic'
      }
      if (tagName === 'u') {
        style.textDecoration = 'underline'
      }
      if (tagName === 'strike' || tagName === 's') {
        style.textDecoration = 'line-through'
      }

      // Check for span with inline styles
      if (tagName === 'span') {
        const computed = window.getComputedStyle(el)
        // Font weight can be numeric (400, 700) or keyword (normal, bold)
        const fontWeight = parseInt(computed.fontWeight) || (computed.fontWeight === 'bold' ? 700 : 400)
        if (fontWeight >= 700) {
          style.fontWeight = 'bold'
        }
        if (computed.fontStyle === 'italic') {
          style.fontStyle = 'italic'
        }
        if (computed.textDecorationLine?.includes('underline')) {
          style.textDecoration = 'underline'
        }
        // Get font family and size
        const fontFamily = computed.fontFamily.replace(/['"]/g, '').split(',')[0].trim()
        if (fontFamily) style.fontFamily = fontFamily
        const fontSize = parseInt(computed.fontSize)
        if (fontSize) style.fontSize = fontSize
        const color = rgbToHex(computed.color)
        if (color && color !== '#000000') style.color = color
      }

      // Handle <br> as a line break within the same paragraph
      if (tagName === 'br') {
        runs.push({
          id: generateId(),
          text: '\n',
          style: { ...inheritedStyle },
        })
        return
      }

      // Recurse into children
      for (const child of Array.from(el.childNodes)) {
        walkNode(child, style)
      }
    }
  }

  walkNode(element, defaultStyle)

  // Merge adjacent runs with identical styles
  const mergedRuns: Array<{ id: string; text: string; style: TextStyle }> = []
  for (const run of runs) {
    const last = mergedRuns[mergedRuns.length - 1]
    if (last && stylesEqual(last.style, run.style)) {
      last.text += run.text
    } else {
      mergedRuns.push(run)
    }
  }

  return mergedRuns
}

function stylesEqual(a: TextStyle, b: TextStyle): boolean {
  return (
    a.fontFamily === b.fontFamily &&
    a.fontSize === b.fontSize &&
    a.fontWeight === b.fontWeight &&
    a.fontStyle === b.fontStyle &&
    a.textDecoration === b.textDecoration &&
    a.color === b.color
  )
}

/**
 * Get text selection info from DOM
 */
function getTextSelection(editor: HTMLElement): TextSelection | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null

  const range = sel.getRangeAt(0)

  // Find paragraph and run indices
  const startInfo = findNodePosition(editor, range.startContainer, range.startOffset)
  const endInfo = findNodePosition(editor, range.endContainer, range.endOffset)

  if (!startInfo || !endInfo) return null

  return {
    paragraphIndex: startInfo.paragraphIndex,
    runIndex: startInfo.runIndex,
    startOffset: startInfo.offset,
    endParagraphIndex: endInfo.paragraphIndex,
    endRunIndex: endInfo.runIndex,
    endOffset: endInfo.offset,
  }
}

function findNodePosition(editor: HTMLElement, node: Node, offset: number): { paragraphIndex: number; runIndex: number; offset: number } | null {
  // Walk up to find containing paragraph and span
  let current: Node | null = node
  let paragraphEl: HTMLElement | null = null
  let spanEl: HTMLElement | null = null

  while (current && current !== editor) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const el = current as HTMLElement
      if (el.tagName === 'P') paragraphEl = el
      if (el.tagName === 'SPAN') spanEl = el
    }
    current = current.parentNode
  }

  if (!paragraphEl) {
    return { paragraphIndex: 0, runIndex: 0, offset }
  }

  const paragraphIndex = parseInt(paragraphEl.dataset.paragraphIndex || '0', 10)
  const runIndex = spanEl ? parseInt(spanEl.dataset.runIndex || '0', 10) : 0

  return { paragraphIndex, runIndex, offset }
}

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)
  if (!match) return rgb

  const r = parseInt(match[1], 10)
  const g = parseInt(match[2], 10)
  const b = parseInt(match[3], 10)

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`
}
