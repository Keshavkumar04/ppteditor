import { useState, useEffect, useCallback } from 'react'
import { Header } from './Header'
import { SlidePanel } from '@/components/slides/SlidePanel'
import { SlideCanvas } from '@/components/canvas/SlideCanvas'
import { MainToolbar } from '@/components/toolbar/MainToolbar'
import { PropertiesPanel } from '@/components/properties/PropertiesPanel'
import { ImportDialog } from '@/components/dialogs/ImportDialog'
import { ThemePickerDialog } from '@/components/dialogs/ThemePickerDialog'
import { ThemeEditorDialog } from '@/components/dialogs/ThemeEditorDialog'
import { useEditor, usePresentation, useSelection, useHistory } from '@/context'
import { exportPptx, downloadPptx } from '@/services/pptx'
import { cn } from '@/lib/utils'
import { PresentationTheme } from '@/types'

interface EditorLayoutProps {
  onExport?: (blob: Blob, filename: string) => void
  showHeader?: boolean
}

export function EditorLayout({ onExport, showHeader }: EditorLayoutProps) {
  const { editorState } = useEditor()
  const {
    presentation,
    createNewPresentation,
    requestSave,
  } = usePresentation()
  const { copy, cut, paste, deleteSelected, selectAll } = useSelection()
  const { undo, redo, canUndo, canRedo } = useHistory()
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const [themeEditorOpen, setThemeEditorOpen] = useState(false)
  const [editingTheme, setEditingTheme] = useState<PresentationTheme | null>(null)

  const { leftSidebar, rightSidebar } = editorState.panelVisibility

  // Initialize with a new presentation if none exists
  useEffect(() => {
    if (!presentation) {
      createNewPresentation()
    }
  }, [presentation, createNewPresentation])

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
      e.preventDefault()
      paste()
    } else if (isMod && e.key === 'a') {
      e.preventDefault()
      selectAll()
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !isInputFocused) {
      e.preventDefault()
      deleteSelected()
    }
  }, [copy, cut, paste, selectAll, deleteSelected, undo, redo, canUndo, canRedo, requestSave])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleImport = () => {
    setImportDialogOpen(true)
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

  const headerVisible = showHeader !== false

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Header */}
      {headerVisible && (
        <Header
          className="h-12 flex-shrink-0"
          onImport={handleImport}
          onExport={handleExport}
          onTheme={handleTheme}
        />
      )}

      {/* Main Toolbar */}
      <MainToolbar className="h-10 flex-shrink-0 border-b" />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Slide Panel */}
        {leftSidebar && (
          <div className="w-52 flex-shrink-0 border-r bg-muted/30 overflow-hidden">
            <SlidePanel />
          </div>
        )}

        {/* Canvas Area */}
        <div className="flex-1 overflow-hidden bg-neutral-200">
          <SlideCanvas />
        </div>

        {/* Right Sidebar - Properties Panel */}
        {rightSidebar && (
          <div className="w-64 flex-shrink-0 border-l bg-background overflow-hidden">
            <PropertiesPanel />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar className="h-6 flex-shrink-0 border-t" />

      {/* Import Dialog */}
      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} />

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
    if (diff < 60000) return 'Saved just now'
    if (diff < 3600000) return `Saved ${Math.floor(diff / 60000)}m ago`
    return `Saved at ${date.toLocaleTimeString()}`
  }

  return (
    <div className={cn('flex items-center justify-between px-4 text-xs text-muted-foreground bg-muted/30', className)}>
      <div className="flex items-center gap-4">
        {/* Slide count */}
        <span>
          Slide {currentSlideIndex + 1} of {totalSlides}
        </span>

        {/* Selection info */}
        {selection.selectedElementIds.length > 0 && (
          <span>
            {selection.selectedElementIds.length} element{selection.selectedElementIds.length > 1 ? 's' : ''} selected
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Save status */}
        <span className={isDirty ? 'text-yellow-600' : 'text-green-600'}>
          {isDirty ? 'Unsaved changes' : formatLastSaved(lastSaved) || 'Saved'}
        </span>

        {/* Zoom control */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(editorState.zoom - 0.1)}
            className="hover:text-foreground"
            disabled={editorState.zoom <= 0.1}
          >
            -
          </button>
          <span className="w-12 text-center">{Math.round(editorState.zoom * 100)}%</span>
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
