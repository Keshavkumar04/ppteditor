import React, { createContext, useContext, useState, useCallback } from 'react'
import {
  EditorState,
  EditorTool,
  PanelVisibility,
  DEFAULT_EDITOR_STATE,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  TextStyle,
} from '@/types'
import { clamp } from '@/utils/geometry'
import { TextSelection } from '@/utils/textFormatting'

// Text editing state
interface TextEditingState {
  elementId: string | null
  selection: TextSelection | null
  selectionStyle: Partial<TextStyle> | null
}

interface EditorContextValue {
  // State
  editorState: EditorState
  textEditingState: TextEditingState

  // Zoom operations
  setZoom: (zoom: number) => void
  zoomIn: () => void
  zoomOut: () => void
  zoomToFit: () => void
  zoomTo100: () => void

  // Navigation
  setCurrentSlide: (slideId: string | null) => void

  // Tool operations
  setActiveTool: (tool: EditorTool) => void

  // View options
  toggleGrid: () => void
  toggleGuides: () => void
  toggleSnapToGrid: () => void
  toggleSnapToGuides: () => void
  setViewMode: (mode: 'edit' | 'preview' | 'slideshow') => void

  // Panel operations
  toggleLeftSidebar: () => void
  toggleRightSidebar: () => void
  setLeftSidebarVisible: (visible: boolean) => void
  setRightSidebarVisible: (visible: boolean) => void

  // Text editing operations
  setTextEditing: (elementId: string | null) => void
  setTextSelection: (selection: TextSelection | null, style: Partial<TextStyle> | null) => void
}

const EditorContext = createContext<EditorContextValue | null>(null)

export interface EditorProviderProps {
  children: React.ReactNode
  panels?: Partial<PanelVisibility>
  initialZoom?: number
}

const DEFAULT_TEXT_EDITING_STATE: TextEditingState = {
  elementId: null,
  selection: null,
  selectionStyle: null,
}

export function EditorProvider({ children, panels, initialZoom }: EditorProviderProps) {
  const [editorState, setEditorState] = useState<EditorState>(() => {
    const state = { ...DEFAULT_EDITOR_STATE }
    if (panels) {
      state.panelVisibility = { ...DEFAULT_EDITOR_STATE.panelVisibility, ...panels }
    }
    if (initialZoom !== undefined) {
      state.zoom = clamp(initialZoom, MIN_ZOOM, MAX_ZOOM)
    }
    return state
  })
  const [textEditingState, setTextEditingState] = useState<TextEditingState>(DEFAULT_TEXT_EDITING_STATE)

  // Zoom operations
  const setZoom = useCallback((zoom: number) => {
    setEditorState(prev => ({
      ...prev,
      zoom: clamp(zoom, MIN_ZOOM, MAX_ZOOM),
    }))
  }, [])

  const zoomIn = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      zoom: clamp(prev.zoom + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM),
    }))
  }, [])

  const zoomOut = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      zoom: clamp(prev.zoom - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM),
    }))
  }, [])

  const zoomToFit = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      zoom: 0.75,
    }))
  }, [])

  const zoomTo100 = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      zoom: 1,
    }))
  }, [])

  // Navigation
  const setCurrentSlide = useCallback((slideId: string | null) => {
    setEditorState(prev => ({
      ...prev,
      currentSlideId: slideId,
    }))
  }, [])

  // Tool operations
  const setActiveTool = useCallback((tool: EditorTool) => {
    setEditorState(prev => ({
      ...prev,
      activeTool: tool,
    }))
  }, [])

  // View options
  const toggleGrid = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      gridEnabled: !prev.gridEnabled,
    }))
  }, [])

  const toggleGuides = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      guidesEnabled: !prev.guidesEnabled,
    }))
  }, [])

  const toggleSnapToGrid = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      snapToGrid: !prev.snapToGrid,
    }))
  }, [])

  const toggleSnapToGuides = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      snapToGuides: !prev.snapToGuides,
    }))
  }, [])

  const setViewMode = useCallback((mode: 'edit' | 'preview' | 'slideshow') => {
    setEditorState(prev => ({
      ...prev,
      viewMode: mode,
    }))
  }, [])

  // Panel operations
  const toggleLeftSidebar = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      panelVisibility: {
        ...prev.panelVisibility,
        leftSidebar: !prev.panelVisibility.leftSidebar,
      },
    }))
  }, [])

  const toggleRightSidebar = useCallback(() => {
    setEditorState(prev => ({
      ...prev,
      panelVisibility: {
        ...prev.panelVisibility,
        rightSidebar: !prev.panelVisibility.rightSidebar,
      },
    }))
  }, [])

  const setLeftSidebarVisible = useCallback((visible: boolean) => {
    setEditorState(prev => ({
      ...prev,
      panelVisibility: {
        ...prev.panelVisibility,
        leftSidebar: visible,
      },
    }))
  }, [])

  const setRightSidebarVisible = useCallback((visible: boolean) => {
    setEditorState(prev => ({
      ...prev,
      panelVisibility: {
        ...prev.panelVisibility,
        rightSidebar: visible,
      },
    }))
  }, [])

  // Text editing operations
  const setTextEditing = useCallback((elementId: string | null) => {
    setTextEditingState(prev => ({
      ...prev,
      elementId,
      selection: elementId ? prev.selection : null,
      selectionStyle: elementId ? prev.selectionStyle : null,
    }))
  }, [])

  const setTextSelection = useCallback((selection: TextSelection | null, style: Partial<TextStyle> | null) => {
    setTextEditingState(prev => ({
      ...prev,
      selection,
      selectionStyle: style,
    }))
  }, [])

  const value: EditorContextValue = {
    editorState,
    textEditingState,
    setZoom,
    zoomIn,
    zoomOut,
    zoomToFit,
    zoomTo100,
    setCurrentSlide,
    setActiveTool,
    toggleGrid,
    toggleGuides,
    toggleSnapToGrid,
    toggleSnapToGuides,
    setViewMode,
    toggleLeftSidebar,
    toggleRightSidebar,
    setLeftSidebarVisible,
    setRightSidebarVisible,
    setTextEditing,
    setTextSelection,
  }

  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  )
}

export function useEditor() {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider')
  }
  return context
}
