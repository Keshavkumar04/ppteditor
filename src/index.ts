// Styles - bundled as style.css
import './styles/globals.css'
import './styles/editor.css'

// Main component
export { PresentationEditor } from './components/PresentationEditor'

// Ref handle type (for useRef<PresentationEditorHandle>)
export type { PresentationEditorHandle } from './components/PresentationEditor'

// Props type
export type { PresentationEditorProps } from './types/props'

// Data types
export type {
  Presentation,
  PresentationMetadata,
  PresentationTheme,
  ColorScheme,
  FontScheme,
  FontDefinition,
  Background,
  GradientFill,
  GradientStop,
} from './types/presentation'

export type {
  Slide,
  SlideTransition,
  SlideElement,
  ElementType,
  Position,
  Size,
  BaseElement,
  TextElement,
  TextContent,
  Paragraph,
  TextRun,
  TextStyle,
  TextShadow,
  TextBoxStyle,
  Padding,
  ShapeElement,
  ShapeType,
  Fill,
  Stroke,
  Shadow,
  ImageElement,
  ImageCrop,
  ImageFilters,
  TableElement,
  TableCell,
  CellBorders,
  TableStyle,
  GroupElement,
} from './types/slide'

export type {
  EditorState,
  EditorTool,
  PanelVisibility,
  SelectionState,
  SelectionBounds,
  ResizeHandle,
  HistoryState,
  HistoryEntry,
  ClipboardState,
} from './types/editor'

// Constants
export {
  DEFAULT_THEME,
  DEFAULT_METADATA,
} from './types/presentation'

export {
  DEFAULT_TEXT_STYLE,
  DEFAULT_TEXTBOX_STYLE,
  DEFAULT_FILL,
  DEFAULT_STROKE,
  DEFAULT_BACKGROUND,
} from './types/slide'

export {
  SLIDE_WIDTH,
  SLIDE_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  DEFAULT_EDITOR_STATE,
  DEFAULT_SELECTION_STATE,
} from './types/editor'

// Services
export { exportPptx, downloadPptx, exportAndDownload } from './services/pptx/exporter'
export type { ExportResult, ExportProgress } from './services/pptx/exporter'
export { importPptx, isPptxFile, formatFileSize } from './services/pptx/importer'
export type { ImportResult, ImportProgress } from './services/pptx/importer'

// Theme data
export { BUILT_IN_THEMES, createNewTheme } from './data/builtInThemes'

// Utilities
export { generateId } from './utils/id'
