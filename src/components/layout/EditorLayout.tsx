import { useState, useEffect, useCallback, useRef } from 'react'
import { PanelRightOpen, PanelRightClose } from 'lucide-react'
import { SlidePanel } from '@/components/slides/SlidePanel'
import { SlideCanvas } from '@/components/canvas/SlideCanvas'
import { MainToolbar } from '@/components/toolbar/MainToolbar'
import { FormattingToolbar } from '@/components/toolbar/FormattingToolbar'
import { PropertiesPanel } from '@/components/properties/PropertiesPanel'
import { ThemePickerDialog } from '@/components/dialogs/ThemePickerDialog'
import { ThemeEditorDialog } from '@/components/dialogs/ThemeEditorDialog'
import { useEditor, usePresentation, useSelection, useHistory } from '@/context'
import { exportPptx, downloadPptx } from '@/services/pptx'
import { importPptx, isPptxFile } from '@/services/pptx'
import { cn } from '@/lib/utils'
import { PresentationTheme, TextElement, DEFAULT_TEXT_STYLE, DEFAULT_TEXTBOX_STYLE, SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types'
import { generateId } from '@/utils'
import { htmlToSlideElements } from '@/utils/htmlToTextContent'

interface EditorLayoutProps {
  onExport?: (blob: Blob, filename: string) => void
  showHeader?: boolean
}

export function EditorLayout({ onExport }: EditorLayoutProps) {
  const { editorState } = useEditor()
  const {
    presentation,
    createNewPresentation,
    loadPresentation,
    requestSave,
    addElement,
  } = usePresentation()
  const { copy, cut, paste, deleteSelected, selectAll, hasClipboard } = useSelection()
  const { undo, redo, canUndo, canRedo } = useHistory()
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const [themeEditorOpen, setThemeEditorOpen] = useState(false)
  const [editingTheme, setEditingTheme] = useState<PresentationTheme | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rightPanelOpen, setRightPanelOpen] = useState(false)

  const { leftSidebar } = editorState.panelVisibility

  // Initialize with a new presentation if none exists
  useEffect(() => {
    if (!presentation) {
      createNewPresentation()
    }
  }, [presentation, createNewPresentation])

  // Listen for native paste events to handle system clipboard → new text box
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement
      const isInputFocused = target.tagName === 'INPUT' ||
                            target.tagName === 'TEXTAREA' ||
                            target.isContentEditable

      // If user is typing in an input or editing text inside a textbox, let browser handle it
      if (isInputFocused) return

      // If internal clipboard has copied elements, skip (handled by keydown)
      if (hasClipboard) return

      const slideId = editorState.currentSlideId ?? presentation?.slides[0]?.id
      if (!slideId) return

      // Try to get HTML content first, fall back to plain text
      const htmlData = e.clipboardData?.getData('text/html')
      const textData = e.clipboardData?.getData('text/plain')

      if (htmlData?.trim()) {
        const elements = htmlToSlideElements(htmlData)
        for (const element of elements) {
          addElement(slideId, element)
        }
        e.preventDefault()
      } else if (textData?.trim()) {
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
                text: textData,
                style: DEFAULT_TEXT_STYLE,
              }],
              alignment: 'left',
            }],
          },
          style: DEFAULT_TEXTBOX_STYLE,
        }
        addElement(slideId, textElement)
        e.preventDefault()
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [editorState.currentSlideId, presentation?.slides, addElement, hasClipboard])

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMod = e.ctrlKey || e.metaKey
    const target = e.target as HTMLElement
    const isInputFocused = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.isContentEditable

    // Ctrl+S should always work for save
    if (isMod && e.key === 's') {
      e.preventDefault()
      requestSave()
      return
    }

    // Don't handle other shortcuts when typing in inputs
    if (isInputFocused && !['Delete', 'Backspace'].includes(e.key)) {
      return
    }

    if (isMod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      if (canUndo) undo()
    } else if ((isMod && e.key === 'z' && e.shiftKey) || (isMod && e.key === 'y')) {
      e.preventDefault()
      if (canRedo) redo()
    } else if (isMod && e.key === 'c') {
      e.preventDefault()
      copy()
    } else if (isMod && e.key === 'x') {
      e.preventDefault()
      cut()
    } else if (isMod && e.key === 'v') {
      if (hasClipboard) {
        // Internal clipboard has copied elements — paste them
        e.preventDefault()
        paste()
      }
      // Otherwise: don't preventDefault — let the native paste event fire
      // which is handled by the paste event listener above
    } else if (isMod && e.key === 'a') {
      e.preventDefault()
      selectAll()
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused) {
      e.preventDefault()
      deleteSelected()
    }
  }, [copy, cut, paste, hasClipboard, selectAll, deleteSelected, undo, redo, canUndo, canRedo, requestSave])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Direct file picker for import (no modal)
  const handleImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!isPptxFile(file)) {
      alert('Please select a valid .pptx file')
      return
    }

    const result = await importPptx(file)

    if (result.success && result.presentation) {
      loadPresentation(result.presentation)
    } else {
      alert(`Import failed: ${result.error || 'Unknown error'}`)
    }

    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleTheme = () => {
    setThemePickerOpen(true)
  }

  const handleEditTheme = (theme: PresentationTheme) => {
    setEditingTheme(theme)
    setThemePickerOpen(false)
    setThemeEditorOpen(true)
  }

  const handleThemeEditorClose = (open: boolean) => {
    setThemeEditorOpen(open)
    if (!open) {
      setEditingTheme(null)
    }
  }

  const handleThemeSaved = () => {
    setThemePickerOpen(true)
  }

  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    if (!presentation || isExporting) return

    setIsExporting(true)
    try {
      const result = await exportPptx(presentation)
      if (result.success && result.blob) {
        if (onExport) {
          onExport(result.blob, `${presentation.name}.pptx`)
        } else {
          downloadPptx(result.blob, presentation.name)
        }
      } else if (!result.success) {
        alert(`Export failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Export error:', error)
      alert('Failed to export presentation')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pptx,.pptm"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Main Toolbar (includes File, Edit, Theme, Undo/Redo + insert tools) */}
      <MainToolbar
        className="h-8 flex-shrink-0 border-b"
        onImport={handleImport}
        onExport={handleExport}
        onTheme={handleTheme}
      />

      {/* Formatting Toolbar (shows when text element selected) */}
      <FormattingToolbar className="h-8 flex-shrink-0" />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Slide Panel */}
        {leftSidebar && (
          <div className="w-40 flex-shrink-0 border-r bg-muted/30 overflow-hidden">
            <SlidePanel />
          </div>
        )}

        {/* Canvas Area */}
        <div className="flex-1 overflow-hidden relative">
          <SlideCanvas />
          {/* Toggle right panel button */}
          <button
            onClick={() => setRightPanelOpen(prev => !prev)}
            className="absolute top-2 right-2 z-10 p-1 rounded bg-background/80 border shadow-sm hover:bg-background transition-colors"
            title={rightPanelOpen ? 'Hide Properties' : 'Show Properties'}
          >
            {rightPanelOpen ? (
              <PanelRightClose className="h-4 w-4 text-muted-foreground" />
            ) : (
              <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Right Sidebar - Properties Panel (collapsible) */}
        <div className={cn(
          'flex-shrink-0 border-l bg-background overflow-hidden transition-all duration-200',
          rightPanelOpen ? 'w-56' : 'w-0 border-l-0'
        )}>
          {rightPanelOpen && <PropertiesPanel />}
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar className="h-5 flex-shrink-0 border-t" />

      {/* Theme Picker Dialog */}
      <ThemePickerDialog
        open={themePickerOpen}
        onOpenChange={setThemePickerOpen}
        onEditTheme={handleEditTheme}
      />

      {/* Theme Editor Dialog */}
      <ThemeEditorDialog
        open={themeEditorOpen}
        onOpenChange={handleThemeEditorClose}
        theme={editingTheme}
        onSave={handleThemeSaved}
      />
    </div>
  )
}

interface StatusBarProps {
  className?: string
}

function StatusBar({ className }: StatusBarProps) {
  const { editorState, setZoom } = useEditor()
  const { presentation, isDirty, lastSaved } = usePresentation()
  const { selection } = useSelection()

  const currentSlideIndex = presentation?.slides.findIndex(
    s => s.id === editorState.currentSlideId
  ) ?? -1

  const totalSlides = presentation?.slides.length ?? 0

  const formatLastSaved = (date: Date | null) => {
    if (!date) return null
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    if (diff < 60000) return 'Saved'
    if (diff < 3600000) return `Saved ${Math.floor(diff / 60000)}m ago`
    return `Saved at ${date.toLocaleTimeString()}`
  }

  return (
    <div className={cn('flex items-center justify-between px-3 text-[10px] text-muted-foreground bg-muted/30', className)}>
      <div className="flex items-center gap-3">
        <span>
          Slide {currentSlideIndex + 1} of {totalSlides}
        </span>
        {selection.selectedElementIds.length > 0 && (
          <span>
            {selection.selectedElementIds.length} element{selection.selectedElementIds.length > 1 ? 's' : ''} selected
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className={isDirty ? 'text-yellow-600' : 'text-green-600'}>
          {isDirty ? 'Unsaved' : formatLastSaved(lastSaved) || 'Saved'}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(editorState.zoom - 0.1)}
            className="hover:text-foreground"
            disabled={editorState.zoom <= 0.1}
          >
            -
          </button>
          <span className="w-10 text-center">{Math.round(editorState.zoom * 100)}%</span>
          <button
            onClick={() => setZoom(editorState.zoom + 0.1)}
            className="hover:text-foreground"
            disabled={editorState.zoom >= 4}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
