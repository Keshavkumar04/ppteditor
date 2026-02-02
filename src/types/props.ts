import type { Presentation, PresentationTheme } from './presentation'

export interface PresentationEditorProps {
  // Data - controlled mode
  data?: Presentation | null
  // Data - uncontrolled mode
  initialData?: Presentation | null

  // Callbacks
  onChange?: (data: Presentation) => void
  onSave?: (data: Presentation) => void
  onDirtyChange?: (isDirty: boolean) => void
  onExport?: (blob: Blob, filename: string) => void
  onImport?: (data: Presentation) => void

  // Customization
  panels?: {
    header?: boolean
    leftSidebar?: boolean
    rightSidebar?: boolean
    toolbar?: boolean
    statusBar?: boolean
  }
  customThemes?: PresentationTheme[]
  onThemeChange?: (themes: PresentationTheme[]) => void
  initialZoom?: number
  maxHistorySize?: number
  readOnly?: boolean

  // Container
  className?: string
  style?: React.CSSProperties
}
