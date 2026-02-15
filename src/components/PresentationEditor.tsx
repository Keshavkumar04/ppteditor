import { forwardRef, useImperativeHandle } from 'react'
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
import type { TextElement } from '@/types/slide'
import { cn } from '@/lib/utils'
import { generateId } from '@/utils'
import { DEFAULT_TEXT_STYLE, DEFAULT_TEXTBOX_STYLE } from '@/types/slide'
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types/editor'

/**
 * Imperative handle exposed via ref on PresentationEditor.
 * Allows programmatic manipulation from outside the component.
 */
export interface PresentationEditorHandle {
  /** Insert a text box with the given content on the current slide */
  insertTextBox: (text: string) => void
}

/**
 * Bridge component that lives inside all providers so it can access contexts.
 * Exposes imperative methods via the forwarded ref.
 */
const EditorBridge = forwardRef<PresentationEditorHandle, { onExport?: PresentationEditorProps['onExport']; showHeader?: boolean }>(
  function EditorBridge({ onExport, showHeader }, ref) {
    const { presentation, addElement } = usePresentation()
    const { editorState } = useEditor()

    useImperativeHandle(ref, () => ({
      insertTextBox(text: string) {
        if (!presentation) return

        // Use the current slide, or fall back to the first slide
        const currentSlideId = editorState.currentSlideId ?? presentation.slides[0]?.id
        if (!currentSlideId) return

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
    }), [presentation, editorState.currentSlideId, addElement])

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
