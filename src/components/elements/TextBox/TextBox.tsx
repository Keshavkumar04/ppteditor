import React, { useRef, useCallback, useEffect } from 'react'
import { TextElement, TextContent } from '@/types'
import { usePresentation, useEditor } from '@/context'
import { RichTextEditor } from './RichTextEditor'
import { TextSelection } from '@/utils/textFormatting'
import { TextStyle } from '@/types'

interface TextBoxProps {
  element: TextElement
  slideId: string
  isSelected: boolean
  isEditing: boolean
  onStartEditing: () => void
  onStopEditing: () => void
}

export function TextBox({
  element,
  slideId,
  isEditing,
  onStopEditing,
}: TextBoxProps) {
  const { updateElement } = usePresentation()
  const { setTextEditing, setTextSelection } = useEditor()
  const textRef = useRef<SVGForeignObjectElement>(null)

  const { size, content, style } = element

  // Set text editing state when entering/exiting edit mode
  useEffect(() => {
    if (isEditing) {
      setTextEditing(element.id)
    }
    return () => {
      if (isEditing) {
        setTextEditing(null)
      }
    }
  }, [isEditing, element.id, setTextEditing])

  // Handle content changes from the rich text editor
  const handleContentChange = useCallback((newContent: TextContent) => {
    updateElement(slideId, element.id, { content: newContent })
  }, [slideId, element.id, updateElement])

  // Handle selection changes
  const handleSelectionChange = useCallback((selection: TextSelection | null, selectionStyle: Partial<TextStyle> | null) => {
    setTextSelection(selection, selectionStyle)
  }, [setTextSelection])

  // Handle blur to exit edit mode
  const handleBlur = useCallback(() => {
    onStopEditing()
  }, [onStopEditing])

  // Handle key events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onStopEditing()
    }
  }, [onStopEditing])

  // Auto-resize text box height when content overflows
  const handleContentHeightChange = useCallback((contentHeight: number) => {
    if (contentHeight > size.height) {
      updateElement(slideId, element.id, {
        size: { ...size, height: contentHeight },
      })
    }
  }, [slideId, element.id, size, updateElement])

  if (isEditing) {
    return (
      <foreignObject
        ref={textRef}
        x={0}
        y={0}
        width={size.width}
        height={size.height}
      >
        <RichTextEditor
          content={content}
          style={style}
          onChange={handleContentChange}
          onSelectionChange={handleSelectionChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onContentHeightChange={handleContentHeightChange}
        />
      </foreignObject>
    )
  }

  // Non-editing render
  return (
    <>
      {/* Background fill */}
      {style.fill?.type === 'solid' && (
        <rect
          x={0}
          y={0}
          width={size.width}
          height={size.height}
          fill={style.fill.color}
        />
      )}

      {/* Stroke/border */}
      {style.stroke?.style !== 'none' && (
        <rect
          x={0}
          y={0}
          width={size.width}
          height={size.height}
          fill="none"
          stroke={style.stroke?.color || 'transparent'}
          strokeWidth={style.stroke?.width || 0}
        />
      )}

      {/* Text content */}
      <foreignObject
        x={0}
        y={0}
        width={size.width}
        height={size.height}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            padding: `${style.padding.top}px ${style.padding.right}px ${style.padding.bottom}px ${style.padding.left}px`,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: style.verticalAlign === 'middle' ? 'center' : style.verticalAlign === 'bottom' ? 'flex-end' : 'flex-start',
            overflow: 'hidden',
            pointerEvents: 'none',
            wordWrap: style.wordWrap ? 'break-word' : 'normal',
          }}
        >
          {content.paragraphs.map((paragraph, pIndex) => {
            // Check if paragraph is empty or only contains whitespace/newlines
            const isEmpty = paragraph.runs.every(run => !run.text || run.text.trim() === '' || run.text === '\n')

            return (
              <p
                key={paragraph.id || pIndex}
                style={{
                  margin: 0,
                  marginBottom: paragraph.spaceAfter || 0,
                  marginTop: paragraph.spaceBefore || 0,
                  textAlign: paragraph.alignment,
                  lineHeight: paragraph.lineSpacing ? `${paragraph.lineSpacing}%` : 'normal',
                  whiteSpace: 'pre-wrap',
                  minHeight: isEmpty ? '1em' : undefined,
                }}
              >
                {isEmpty ? (
                  // Render non-breaking space for empty paragraphs to preserve height
                  <span style={{
                    fontFamily: paragraph.runs[0]?.style.fontFamily,
                    fontSize: paragraph.runs[0]?.style.fontSize,
                  }}>
                    {'\u00A0'}
                  </span>
                ) : (
                  paragraph.runs.map((run, rIndex) => (
                    <span
                      key={run.id || rIndex}
                      style={{
                        fontFamily: run.style.fontFamily,
                        fontSize: run.style.fontSize,
                        fontWeight: run.style.fontWeight,
                        fontStyle: run.style.fontStyle,
                        textDecoration: run.style.textDecoration,
                        color: run.style.color,
                        backgroundColor: run.style.backgroundColor,
                        letterSpacing: run.style.letterSpacing,
                      }}
                    >
                      {run.text}
                    </span>
                  ))
                )}
              </p>
            )
          })}
        </div>
      </foreignObject>
    </>
  )
}
