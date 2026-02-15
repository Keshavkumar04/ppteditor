import { forwardRef, useImperativeHandle, useRef, useEffect } from 'react'
import {
  HistoryProvider,
  PresentationProvider,
  EditorProvider,
  SelectionProvider,
  ThemeProvider,
  usePresentation,
  useEditor,
} from '@/context'
import { EditorLayout } from '@/components/layout'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { PresentationEditorProps } from '@/types/props'
import type { TextElement, SlideElement } from '@/types/slide'
import { cn } from '@/lib/utils'
import { generateId } from '@/utils'
import { DEFAULT_TEXT_STYLE, DEFAULT_TEXTBOX_STYLE } from '@/types/slide'
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types/editor'
import { htmlToTextContent, htmlToSlideElements } from '@/utils/htmlToTextContent'
import { markdownToSlideElements } from '@/utils/markdownToElements'

/**
 * Imperative handle exposed via ref on PresentationEditor.
 * Allows programmatic manipulation from outside the component.
 */
export interface PresentationEditorHandle {
  /** Insert a text box with plain text content on the current slide.
   *  If a text box is actively being edited, appends to it instead. */
  insertTextBox: (text: string) => void
  /** Insert a text box with HTML content (parsed into styled paragraphs/runs).
   *  If a text box is actively being edited, appends to it instead. */
  insertHtmlTextBox: (html: string) => void
  /** Insert HTML content as proper slide elements (text → TextElement, table → TableElement).
   *  Text portions are appended to the active text box if one is being edited.
   *  Tables always create new elements. */
  insertHtmlContent: (html: string) => void
  /** Insert markdown content directly (no need for marked/external HTML conversion).
   *  Parses headings, bold, italic, code, tables, lists natively.
   *  Text portions are appended to the active/last-edited text box.
   *  Tables always create new elements. */
  insertMarkdownContent: (markdown: string) => void
}

/**
 * Bridge component that lives inside all providers so it can access contexts.
 * Exposes imperative methods via the forwarded ref.
 */
const EditorBridge = forwardRef<PresentationEditorHandle, { onExport?: PresentationEditorProps['onExport']; showHeader?: boolean }>(
  function EditorBridge({ onExport, showHeader }, ref) {
    const { presentation, addElement, updateElement } = usePresentation()
    const { editorState, textEditingState } = useEditor()

    // Track the last text element that was edited — persists across tab switches / blur
    const lastEditedTextIdRef = useRef<string | null>(null)

    useEffect(() => {
      if (textEditingState.elementId) {
        lastEditedTextIdRef.current = textEditingState.elementId
      }
    }, [textEditingState.elementId])

    // Helper: get the text element to append to.
    // Uses active editing state first, falls back to last-edited element.
    const getTargetTextElement = (): { slideId: string; element: TextElement } | null => {
      if (!presentation) return null

      const slideId = editorState.currentSlideId ?? presentation.slides[0]?.id
      if (!slideId) return null

      const slide = presentation.slides.find(s => s.id === slideId)
      if (!slide) return null

      // Try active editing element first, then fall back to last-edited
      const targetId = textEditingState.elementId || lastEditedTextIdRef.current
      if (!targetId) return null

      const element = slide.elements.find(
        el => el.id === targetId && el.type === 'text'
      ) as TextElement | undefined

      if (!element) return null
      return { slideId, element }
    }

    useImperativeHandle(ref, () => ({
      insertTextBox(text: string) {
        if (!presentation) return

        const currentSlideId = editorState.currentSlideId ?? presentation.slides[0]?.id
        if (!currentSlideId) return

        // If editing a text box, append to it
        const active = getTargetTextElement()
        if (active) {
          const newParagraph = {
            id: generateId(),
            runs: [{ id: generateId(), text, style: DEFAULT_TEXT_STYLE }],
            alignment: 'left' as const,
          }
          const updatedContent = {
            ...active.element.content,
            paragraphs: [...active.element.content.paragraphs, newParagraph],
          }
          updateElement(active.slideId, active.element.id, { content: updatedContent } as Partial<SlideElement>)
          return
        }

        const textElement: TextElement = {
          id: generateId(),
          type: 'text',
          position: {
            x: Math.round((SLIDE_WIDTH - 400) / 2),
            y: Math.round((SLIDE_HEIGHT - 120) / 2),
          },
          size: { width: 400, height: 120 },
          zIndex: 0,
          content: {
            paragraphs: [{
              id: generateId(),
              runs: [{
                id: generateId(),
                text,
                style: DEFAULT_TEXT_STYLE,
              }],
              alignment: 'left',
            }],
          },
          style: DEFAULT_TEXTBOX_STYLE,
        }

        addElement(currentSlideId, textElement)
      },

      insertHtmlTextBox(html: string) {
        if (!presentation) return

        const currentSlideId = editorState.currentSlideId ?? presentation.slides[0]?.id
        if (!currentSlideId) return

        const content = htmlToTextContent(html)

        // If editing a text box, append paragraphs to it
        const active = getTargetTextElement()
        if (active) {
          const updatedContent = {
            ...active.element.content,
            paragraphs: [...active.element.content.paragraphs, ...content.paragraphs],
          }
          updateElement(active.slideId, active.element.id, { content: updatedContent } as Partial<SlideElement>)
          return
        }

        const textElement: TextElement = {
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

        addElement(currentSlideId, textElement)
      },

      insertHtmlContent(html: string) {
        if (!presentation) return

        const currentSlideId = editorState.currentSlideId ?? presentation.slides[0]?.id
        if (!currentSlideId) return

        const elements = htmlToSlideElements(html)
        const active = getTargetTextElement()

        for (const element of elements) {
          if (active && element.type === 'text') {
            // Append text paragraphs to the active text box
            const textEl = element as TextElement
            const updatedContent = {
              ...active.element.content,
              paragraphs: [...active.element.content.paragraphs, ...textEl.content.paragraphs],
            }
            updateElement(active.slideId, active.element.id, { content: updatedContent } as Partial<SlideElement>)
            // Update the active reference so subsequent text elements also append
            active.element = {
              ...active.element,
              content: updatedContent,
            }
          } else {
            // Tables or no active text box → create new element
            addElement(currentSlideId, element)
          }
        }
      },
      insertMarkdownContent(markdown: string) {
        if (!presentation) return

        const currentSlideId = editorState.currentSlideId ?? presentation.slides[0]?.id
        if (!currentSlideId) return

        const elements = markdownToSlideElements(markdown)
        const active = getTargetTextElement()

        for (const element of elements) {
          if (active && element.type === 'text') {
            // Append text paragraphs to the active/last-edited text box
            const textEl = element as TextElement
            const updatedContent = {
              ...active.element.content,
              paragraphs: [...active.element.content.paragraphs, ...textEl.content.paragraphs],
            }
            updateElement(active.slideId, active.element.id, { content: updatedContent } as Partial<SlideElement>)
            active.element = {
              ...active.element,
              content: updatedContent,
            }
          } else {
            // Tables or no active text box → create new element
            addElement(currentSlideId, element)
          }
        }
      },
    }), [presentation, editorState.currentSlideId, textEditingState.elementId, addElement, updateElement])

    return (
      <EditorLayout
        onExport={onExport}
        showHeader={showHeader}
      />
    )
  }
)

export const PresentationEditor = forwardRef<PresentationEditorHandle, PresentationEditorProps>(
  function PresentationEditor(props, ref) {
    const {
      data,
      initialData,
      onChange,
      onSave,
      onDirtyChange,
      onExport,
      panels,
      customThemes,
      onThemeChange,
      initialZoom,
      maxHistorySize = 50,
      className,
      style,
    } = props

    // Map panel props to PanelVisibility shape
    const panelVisibility = panels ? {
      leftSidebar: panels.leftSidebar,
      rightSidebar: panels.rightSidebar,
      toolbar: panels.toolbar,
      statusBar: panels.statusBar,
    } : undefined

    return (
      <div className={cn('ppt-editor-root h-full', className)} style={style}>
        <TooltipProvider>
          <ThemeProvider customThemes={customThemes} onThemeChange={onThemeChange}>
            <HistoryProvider maxStackSize={maxHistorySize}>
              <PresentationProvider
                data={data}
                initialData={initialData}
                onChange={onChange}
                onSave={onSave}
                onDirtyChange={onDirtyChange}
              >
                <EditorProvider panels={panelVisibility} initialZoom={initialZoom}>
                  <SelectionProvider>
                    <EditorBridge
                      ref={ref}
                      onExport={onExport}
                      showHeader={panels?.header}
                    />
                  </SelectionProvider>
                </EditorProvider>
              </PresentationProvider>
            </HistoryProvider>
          </ThemeProvider>
        </TooltipProvider>
      </div>
    )
  }
)
