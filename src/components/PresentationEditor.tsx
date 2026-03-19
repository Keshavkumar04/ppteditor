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
import type { Presentation } from '@/types/presentation'
import type { TextElement, SlideElement, Slide } from '@/types/slide'
import { DEFAULT_BACKGROUND } from '@/types/slide'
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
export interface PresentationEditInstruction {
  type: 'rewrite_slide' | 'delete_slide' | 'add_slide' | 'replace_all'
  slideIndex?: number
  find?: string
  content?: string
}

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

  // ─── AI Editing Methods ──────────────────────────────────────────────────
  /** Get the current presentation data. */
  getPresentation: () => Presentation | null
  /** Get the total number of slides. */
  getSlideCount: () => number
  /** Delete a slide by 1-based index. */
  deleteSlide: (slideIndex: number) => void
  /** Add a new slide after the given 1-based index (0 = at the beginning) and populate it with markdown content. */
  addSlideWithMarkdown: (afterSlideIndex: number, markdown: string) => void
  /** Clear all text and shape elements from a slide (preserves images). */
  clearSlideTextContent: (slideIndex: number) => void
  /** Replace all text content on a slide with new markdown content. */
  replaceSlideContent: (slideIndex: number, markdown: string) => void
  /** Replace a word/phrase in all text elements across all slides. */
  replaceTextInAllSlides: (find: string, replace: string) => void
  /** Apply multiple edit instructions atomically in a single state update.
   *  This avoids race conditions when applying multiple operations. */
  batchApplyEdits: (edits: PresentationEditInstruction[]) => void
}

/**
 * Bridge component that lives inside all providers so it can access contexts.
 * Exposes imperative methods via the forwarded ref.
 */
const EditorBridge = forwardRef<PresentationEditorHandle, { onExport?: PresentationEditorProps['onExport']; showHeader?: boolean }>(
  function EditorBridge({ onExport, showHeader }, ref) {
    const {
      presentation,
      addElement, updateElement, deleteElements,
      addSlide: ctxAddSlide, deleteSlide: ctxDeleteSlide, updateSlide,
      loadPresentation,
    } = usePresentation()
    const { editorState, textEditingState, setCurrentSlide } = useEditor()

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

      // ─── AI Editing Methods ────────────────────────────────────────────────

      getPresentation() {
        return presentation
      },

      getSlideCount() {
        return presentation?.slides.length ?? 0
      },

      deleteSlide(slideIndex: number) {
        if (!presentation) return
        const slide = presentation.slides[slideIndex - 1]
        if (!slide) return
        ctxDeleteSlide(slide.id)
      },

      addSlideWithMarkdown(afterSlideIndex: number, markdown: string) {
        if (!presentation) return

        // Determine which slide to insert after
        const afterSlideId = afterSlideIndex > 0
          ? presentation.slides[afterSlideIndex - 1]?.id
          : undefined

        // Parse markdown into elements first
        const elements = markdownToSlideElements(markdown)

        // Create the new slide with elements in one atomic operation
        const newSlide = ctxAddSlide(afterSlideId, elements)

        // Navigate to the new slide
        setCurrentSlide(newSlide.id)
        lastEditedTextIdRef.current = null
      },

      clearSlideTextContent(slideIndex: number) {
        if (!presentation) return
        const slide = presentation.slides[slideIndex - 1]
        if (!slide) return

        // Find all text and shape elements (preserve images, tables, groups)
        const textElementIds = slide.elements
          .filter((el: SlideElement) => el.type === 'text' || el.type === 'shape')
          .map((el: SlideElement) => el.id)

        if (textElementIds.length > 0) {
          deleteElements(slide.id, textElementIds)
        }
      },

      replaceSlideContent(slideIndex: number, markdown: string) {
        if (!presentation) return
        const slide = presentation.slides[slideIndex - 1]
        if (!slide) return

        // Keep non-text elements (images, tables, groups)
        const keepElements = slide.elements
          .filter((el: SlideElement) => el.type !== 'text' && el.type !== 'shape')

        // Parse markdown into new elements
        const newElements = markdownToSlideElements(markdown)

        // Assign zIndex values after existing elements
        let maxZ = keepElements.length > 0
          ? Math.max(...keepElements.map((el: SlideElement) => el.zIndex))
          : 0
        const indexedNewElements = newElements.map((el: SlideElement) => ({ ...el, zIndex: ++maxZ }))

        // Single atomic update: replace all elements at once
        updateSlide(slide.id, { elements: [...keepElements, ...indexedNewElements] })

        setCurrentSlide(slide.id)
        lastEditedTextIdRef.current = null
      },

      replaceTextInAllSlides(find: string, replace: string) {
        if (!presentation) return

        for (const slide of presentation.slides) {
          for (const element of slide.elements) {
            // Handle text elements
            if (element.type === 'text') {
              const textEl = element as TextElement
              let changed = false
              const newParagraphs = textEl.content.paragraphs.map(para => ({
                ...para,
                runs: para.runs.map(run => {
                  if (run.text && run.text.includes(find)) {
                    changed = true
                    return { ...run, text: run.text.split(find).join(replace) }
                  }
                  return run
                }),
              }))
              if (changed) {
                updateElement(slide.id, element.id, {
                  content: { ...textEl.content, paragraphs: newParagraphs },
                } as Partial<SlideElement>)
              }
            }

            // Handle shape elements with text
            if (element.type === 'shape' && (element as any).text) {
              const shapeEl = element as any
              let changed = false
              const newParagraphs = shapeEl.text.paragraphs.map((para: any) => ({
                ...para,
                runs: para.runs.map((run: any) => {
                  if (run.text && run.text.includes(find)) {
                    changed = true
                    return { ...run, text: run.text.split(find).join(replace) }
                  }
                  return run
                }),
              }))
              if (changed) {
                updateElement(slide.id, element.id, {
                  text: { ...shapeEl.text, paragraphs: newParagraphs },
                } as Partial<SlideElement>)
              }
            }
          }
        }
      },

      batchApplyEdits(edits: PresentationEditInstruction[]) {
        if (!presentation) return

        // Deep clone the presentation so we can mutate it freely
        const pres: Presentation = JSON.parse(JSON.stringify(presentation))

        // Process deletes first (in reverse order to keep indices stable)
        const deleteEdits = edits
          .filter(e => e.type === 'delete_slide' && e.slideIndex !== undefined)
          .sort((a, b) => (b.slideIndex ?? 0) - (a.slideIndex ?? 0))

        for (const edit of deleteEdits) {
          const idx = (edit.slideIndex ?? 0) - 1
          if (idx >= 0 && idx < pres.slides.length) {
            pres.slides.splice(idx, 1)
          }
        }

        // Process rewrites (update slide content in place)
        const rewriteEdits = edits.filter(e => e.type === 'rewrite_slide')
        for (const edit of rewriteEdits) {
          const idx = (edit.slideIndex ?? 0) - 1
          const slide = pres.slides[idx]
          if (!slide || !edit.content) continue

          // Keep non-text elements (images, tables, groups)
          const keepElements = slide.elements.filter(
            (el: SlideElement) => el.type !== 'text' && el.type !== 'shape'
          )
          const newElements = markdownToSlideElements(edit.content)
          let maxZ = keepElements.length > 0
            ? Math.max(...keepElements.map((el: SlideElement) => el.zIndex))
            : 0
          const indexed = newElements.map((el: SlideElement) => ({ ...el, zIndex: ++maxZ }))
          slide.elements = [...keepElements, ...indexed]
        }

        // Process replace_all (text find/replace across all slides)
        const replaceAllEdits = edits.filter(e => e.type === 'replace_all')
        for (const edit of replaceAllEdits) {
          if (!edit.find || !edit.content) continue
          for (const slide of pres.slides) {
            for (const element of slide.elements) {
              if (element.type === 'text') {
                const textEl = element as TextElement
                for (const para of textEl.content.paragraphs) {
                  for (const run of para.runs) {
                    if (run.text && run.text.includes(edit.find!)) {
                      run.text = run.text.split(edit.find!).join(edit.content)
                    }
                  }
                }
              }
            }
          }
        }

        // Process add_slide edits (in order, adjusting indices as we insert)
        const addEdits = edits.filter(e => e.type === 'add_slide')
        // Sort by slideIndex ascending so earlier inserts shift later ones correctly
        addEdits.sort((a, b) => (a.slideIndex ?? 0) - (b.slideIndex ?? 0))
        let insertionOffset = 0
        for (const edit of addEdits) {
          const afterIdx = (edit.slideIndex ?? 0) + insertionOffset
          const insertAt = Math.min(afterIdx, pres.slides.length)

          const newSlide: Slide = {
            id: generateId(),
            order: insertAt,
            elements: edit.content ? markdownToSlideElements(edit.content) : [],
            background: { ...DEFAULT_BACKGROUND },
          }

          pres.slides.splice(insertAt, 0, newSlide)
          insertionOffset++
        }

        // Reorder all slides
        pres.slides.forEach((slide: Slide, i: number) => { slide.order = i })
        pres.updatedAt = new Date()

        // Single atomic state update
        loadPresentation(pres)

        // Navigate to the last added slide if any were added
        if (addEdits.length > 0) {
          const lastAdded = pres.slides[pres.slides.length - 1]
          if (lastAdded) setCurrentSlide(lastAdded.id)
        }

        lastEditedTextIdRef.current = null
      },
    }), [presentation, editorState.currentSlideId, textEditingState.elementId,
         addElement, updateElement, deleteElements,
         ctxAddSlide, ctxDeleteSlide, updateSlide, setCurrentSlide, loadPresentation])

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
