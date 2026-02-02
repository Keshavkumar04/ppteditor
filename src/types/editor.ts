import { Presentation } from './presentation'
import { SlideElement } from './slide'

export interface EditorState {
  zoom: number
  currentSlideId: string | null
  viewMode: 'edit' | 'preview' | 'slideshow'
  activeTool: EditorTool
  gridEnabled: boolean
  guidesEnabled: boolean
  snapToGrid: boolean
  snapToGuides: boolean
  panelVisibility: PanelVisibility
}

export type EditorTool =
  | 'select'
  | 'text'
  | 'shape'
  | 'image'
  | 'table'
  | 'pan'
  | 'zoom'

export interface PanelVisibility {
  leftSidebar: boolean
  rightSidebar: boolean
  toolbar: boolean
  statusBar: boolean
}

export interface SelectionState {
  selectedElementIds: string[]
  selectionBounds: SelectionBounds | null
  isMultiSelect: boolean
  isDragging: boolean
  isResizing: boolean
  resizeHandle: ResizeHandle | null
  isRotating: boolean
}

export interface SelectionBounds {
  x: number
  y: number
  width: number
  height: number
}

export type ResizeHandle =
  | 'top-left'
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'
  | 'rotate'

export interface HistoryState {
  undoStack: HistoryEntry[]
  redoStack: HistoryEntry[]
  maxStackSize: number
}

export interface HistoryEntry {
  id: string
  timestamp: Date
  action: string
  previousState: Partial<Presentation>
  nextState: Partial<Presentation>
}

export interface ClipboardState {
  elements: SlideElement[]
  sourceSlideId: string
}

// Default editor state
export const DEFAULT_EDITOR_STATE: EditorState = {
  zoom: 1,
  currentSlideId: null,
  viewMode: 'edit',
  activeTool: 'select',
  gridEnabled: false,
  guidesEnabled: true,
  snapToGrid: true,
  snapToGuides: true,
  panelVisibility: {
    leftSidebar: true,
    rightSidebar: true,
    toolbar: true,
    statusBar: true,
  },
}

export const DEFAULT_SELECTION_STATE: SelectionState = {
  selectedElementIds: [],
  selectionBounds: null,
  isMultiSelect: false,
  isDragging: false,
  isResizing: false,
  resizeHandle: null,
  isRotating: false,
}

// Slide dimensions (16:9 aspect ratio)
export const SLIDE_WIDTH = 960
export const SLIDE_HEIGHT = 540

// Zoom constraints
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4.0
export const ZOOM_STEP = 0.1
