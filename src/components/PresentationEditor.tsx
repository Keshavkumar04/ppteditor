import {
  HistoryProvider,
  PresentationProvider,
  EditorProvider,
  SelectionProvider,
  ThemeProvider,
} from '@/context'
import { EditorLayout } from '@/components/layout'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { PresentationEditorProps } from '@/types/props'
import { cn } from '@/lib/utils'

export function PresentationEditor(props: PresentationEditorProps) {
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
                  <EditorLayout
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
