import React, { createContext, useContext, useState, useCallback } from 'react'
import {
  SelectionState,
  DEFAULT_SELECTION_STATE,
  ResizeHandle,
  SlideElement,
} from '@/types'
import { usePresentation } from './PresentationContext'
import { useEditor } from './EditorContext'

interface ClipboardData {
  elements: SlideElement[]
  sourceSlideId: string
}

interface SelectionContextValue {
  // State
  selection: SelectionState
  clipboard: ClipboardData | null

  // Selection operations
  selectElement: (elementId: string, addToSelection?: boolean) => void
  selectElements: (elementIds: string[]) => void
  deselectAll: () => void
  selectAll: () => void
  isSelected: (elementId: string) => boolean

  // Drag operations
  startDrag: () => void
  endDrag: () => void

  // Resize operations
  startResize: (handle: ResizeHandle) => void
  endResize: () => void

  // Rotation operations
  startRotate: () => void
  endRotate: () => void

  // Clipboard operations
  copy: () => void
  cut: () => void
  paste: () => void
  hasClipboard: boolean

  // Delete
  deleteSelected: () => void

  // Get selected elements
  getSelectedElements: () => SlideElement[]
}

const SelectionContext = createContext<SelectionContextValue | null>(null)

interface SelectionProviderProps {
  children: React.ReactNode
}

export function SelectionProvider({ children }: SelectionProviderProps) {
  const [selection, setSelection] = useState<SelectionState>(DEFAULT_SELECTION_STATE)
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null)

  const { presentation, deleteElements, duplicateElements } = usePresentation()
  const { editorState } = useEditor()

  // Get current slide
  const getCurrentSlide = useCallback(() => {
    if (!presentation || !editorState.currentSlideId) return null
    return presentation.slides.find(s => s.id === editorState.currentSlideId) || null
  }, [presentation, editorState.currentSlideId])

  // Selection operations
  const selectElement = useCallback((elementId: string, addToSelection: boolean = false) => {
    setSelection(prev => {
      if (addToSelection) {
        // Toggle selection if already selected
        if (prev.selectedElementIds.includes(elementId)) {
          const newIds = prev.selectedElementIds.filter(id => id !== elementId)
          return {
            ...prev,
            selectedElementIds: newIds,
            isMultiSelect: newIds.length > 1,
          }
        }
        return {
          ...prev,
          selectedElementIds: [...prev.selectedElementIds, elementId],
          isMultiSelect: true,
        }
      }
      return {
        ...prev,
        selectedElementIds: [elementId],
        isMultiSelect: false,
      }
    })
  }, [])

  const selectElements = useCallback((elementIds: string[]) => {
    setSelection(prev => ({
      ...prev,
      selectedElementIds: elementIds,
      isMultiSelect: elementIds.length > 1,
    }))
  }, [])

  const deselectAll = useCallback(() => {
    setSelection(prev => ({
      ...prev,
      selectedElementIds: [],
      selectionBounds: null,
      isMultiSelect: false,
    }))
  }, [])

  const selectAll = useCallback(() => {
    const slide = getCurrentSlide()
    if (!slide) return

    const allIds = slide.elements.map(el => el.id)
    setSelection(prev => ({
      ...prev,
      selectedElementIds: allIds,
      isMultiSelect: allIds.length > 1,
    }))
  }, [getCurrentSlide])

  const isSelected = useCallback((elementId: string): boolean => {
    return selection.selectedElementIds.includes(elementId)
  }, [selection.selectedElementIds])

  // Drag operations
  const startDrag = useCallback(() => {
    setSelection(prev => ({ ...prev, isDragging: true }))
  }, [])

  const endDrag = useCallback(() => {
    setSelection(prev => ({ ...prev, isDragging: false }))
  }, [])

  // Resize operations
  const startResize = useCallback((handle: ResizeHandle) => {
    setSelection(prev => ({
      ...prev,
      isResizing: true,
      resizeHandle: handle,
    }))
  }, [])

  const endResize = useCallback(() => {
    setSelection(prev => ({
      ...prev,
      isResizing: false,
      resizeHandle: null,
    }))
  }, [])

  // Rotation operations
  const startRotate = useCallback(() => {
    setSelection(prev => ({ ...prev, isRotating: true }))
  }, [])

  const endRotate = useCallback(() => {
    setSelection(prev => ({ ...prev, isRotating: false }))
  }, [])

  // Clipboard operations
  const copy = useCallback(() => {
    const slide = getCurrentSlide()
    if (!slide || selection.selectedElementIds.length === 0) return

    const elementsToCopy = slide.elements.filter(el =>
      selection.selectedElementIds.includes(el.id)
    )

    setClipboard({
      elements: JSON.parse(JSON.stringify(elementsToCopy)),
      sourceSlideId: slide.id,
    })
  }, [getCurrentSlide, selection.selectedElementIds])

  const cut = useCallback(() => {
    copy()
    deleteSelected()
  }, []) // We'll define deleteSelected below

  const paste = useCallback(() => {
    if (!clipboard || !editorState.currentSlideId) return

    const newElements = duplicateElements(
      editorState.currentSlideId,
      clipboard.elements.map(el => el.id)
    )

    // Select the pasted elements
    if (newElements.length > 0) {
      selectElements(newElements.map(el => el.id))
    }
  }, [clipboard, editorState.currentSlideId, duplicateElements, selectElements])

  // Delete
  const deleteSelected = useCallback(() => {
    if (!editorState.currentSlideId || selection.selectedElementIds.length === 0) return

    deleteElements(editorState.currentSlideId, selection.selectedElementIds)
    deselectAll()
  }, [editorState.currentSlideId, selection.selectedElementIds, deleteElements, deselectAll])

  // Get selected elements
  const getSelectedElements = useCallback((): SlideElement[] => {
    const slide = getCurrentSlide()
    if (!slide) return []

    return slide.elements.filter(el => selection.selectedElementIds.includes(el.id))
  }, [getCurrentSlide, selection.selectedElementIds])

  const value: SelectionContextValue = {
    selection,
    clipboard,
    selectElement,
    selectElements,
    deselectAll,
    selectAll,
    isSelected,
    startDrag,
    endDrag,
    startResize,
    endResize,
    startRotate,
    endRotate,
    copy,
    cut,
    paste,
    hasClipboard: clipboard !== null && clipboard.elements.length > 0,
    deleteSelected,
    getSelectedElements,
  }

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  )
}

export function useSelection() {
  const context = useContext(SelectionContext)
  if (!context) {
    throw new Error('useSelection must be used within a SelectionProvider')
  }
  return context
}
