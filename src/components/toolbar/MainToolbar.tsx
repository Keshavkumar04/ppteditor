import { useState } from 'react'
import {
  Type,
  Square,
  Circle,
  Image,
  Table,
  Minus,
  Plus,
  ZoomIn,
  ZoomOut,
  Grid,
  MousePointer,
  Triangle,
  Star,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import {
  useEditor,
  usePresentation,
  useSelection,
} from '@/context'
import {
  TextElement,
  ShapeElement,
  TableElement,
  TableCell,
  ShapeType,
  DEFAULT_TEXT_STYLE,
  DEFAULT_TEXTBOX_STYLE,
  DEFAULT_FILL,
  DEFAULT_STROKE,
} from '@/types'
import { generateId } from '@/utils'
import { cn } from '@/lib/utils'
import { TableGridPicker } from '@/components/elements/Table'

interface MainToolbarProps {
  className?: string
}

export function MainToolbar({ className }: MainToolbarProps) {
  const { editorState, setActiveTool, zoomIn, zoomOut, zoomTo100, toggleGrid } = useEditor()
  const { presentation, addElement } = usePresentation()
  const { selectElements } = useSelection()
  const [tablePopoverOpen, setTablePopoverOpen] = useState(false)

  const currentSlide = presentation?.slides.find(
    s => s.id === editorState.currentSlideId
  )

  // Insert text box
  const handleInsertText = () => {
    if (!currentSlide) return

    const textElement: TextElement = {
      id: generateId(),
      type: 'text',
      position: { x: 100, y: 100 },
      size: { width: 300, height: 100 },
      zIndex: 0,
      content: {
        paragraphs: [{
          id: generateId(),
          runs: [{
            id: generateId(),
            text: 'Click to edit text',
            style: DEFAULT_TEXT_STYLE,
          }],
          alignment: 'left',
        }],
      },
      style: DEFAULT_TEXTBOX_STYLE,
    }

    addElement(currentSlide.id, textElement)
    selectElements([textElement.id])
  }

  // Insert shape
  const handleInsertShape = (shapeType: ShapeType) => {
    if (!currentSlide) return

    const shapeElement: ShapeElement = {
      id: generateId(),
      type: 'shape',
      position: { x: 200, y: 150 },
      size: { width: 150, height: 100 },
      zIndex: 0,
      shapeType,
      fill: { ...DEFAULT_FILL },
      stroke: { ...DEFAULT_STROKE },
    }

    addElement(currentSlide.id, shapeElement)
    selectElements([shapeElement.id])
  }

  // Insert image (placeholder - would open file picker)
  const handleInsertImage = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file || !currentSlide) return

      // Read file as data URL
      const reader = new FileReader()
      reader.onload = () => {
        const imageElement = {
          id: generateId(),
          type: 'image' as const,
          position: { x: 150, y: 100 },
          size: { width: 300, height: 200 },
          zIndex: 0,
          src: reader.result as string,
          alt: file.name,
        }

        addElement(currentSlide.id, imageElement)
        selectElements([imageElement.id])
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // Insert table
  const handleInsertTable = (rows: number, cols: number) => {
    if (!currentSlide) return

    // Create default cell structure
    const createCell = (): TableCell => ({
      id: generateId(),
      content: {
        paragraphs: [{
          id: generateId(),
          runs: [{
            id: generateId(),
            text: '',
            style: {
              fontFamily: 'Calibri',
              fontSize: 14,
              fontWeight: 'normal',
              fontStyle: 'normal',
              textDecoration: 'none',
              color: '#000000',
            },
          }],
          alignment: 'left',
        }],
      },
      padding: { top: 4, right: 8, bottom: 4, left: 8 },
      verticalAlign: 'middle',
      borders: {
        top: { color: '#d1d5db', width: 1, style: 'solid' },
        right: { color: '#d1d5db', width: 1, style: 'solid' },
        bottom: { color: '#d1d5db', width: 1, style: 'solid' },
        left: { color: '#d1d5db', width: 1, style: 'solid' },
      },
    })

    // Create cells array
    const cells: TableCell[][] = []
    for (let r = 0; r < rows; r++) {
      const row: TableCell[] = []
      for (let c = 0; c < cols; c++) {
        row.push(createCell())
      }
      cells.push(row)
    }

    // Calculate default dimensions
    const cellWidth = 100
    const cellHeight = 40
    const tableWidth = cols * cellWidth
    const tableHeight = rows * cellHeight

    const tableElement: TableElement = {
      id: generateId(),
      type: 'table',
      position: { x: (960 - tableWidth) / 2, y: (540 - tableHeight) / 2 },
      size: { width: tableWidth, height: tableHeight },
      zIndex: 0,
      rows,
      columns: cols,
      cells,
      columnWidths: Array(cols).fill(cellWidth),
      rowHeights: Array(rows).fill(cellHeight),
      style: {
        borderCollapse: true,
        defaultCellFill: { type: 'solid', color: '#FFFFFF' },
      },
    }

    addElement(currentSlide.id, tableElement)
    selectElements([tableElement.id])
    setTablePopoverOpen(false)
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex items-center gap-1 px-4 bg-muted/30', className)}>
        {/* Selection Tool */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editorState.activeTool === 'select' ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => setActiveTool('select')}
            >
              <MousePointer className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Select (V)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Insert Text */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleInsertText}
              disabled={!currentSlide}
            >
              <Type className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Insert Text Box</TooltipContent>
        </Tooltip>

        {/* Insert Shape Dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" disabled={!currentSlide}>
                  <Square className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Insert Shape</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => handleInsertShape('rectangle')}>
              <Square className="h-4 w-4 mr-2" />
              Rectangle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleInsertShape('roundedRectangle')}>
              <Square className="h-4 w-4 mr-2 rounded" />
              Rounded Rectangle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleInsertShape('ellipse')}>
              <Circle className="h-4 w-4 mr-2" />
              Ellipse
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleInsertShape('triangle')}>
              <Triangle className="h-4 w-4 mr-2" />
              Triangle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleInsertShape('diamond')}>
              <Square className="h-4 w-4 mr-2 rotate-45" />
              Diamond
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleInsertShape('arrow')}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Arrow
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleInsertShape('star5')}>
              <Star className="h-4 w-4 mr-2" />
              Star
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleInsertShape('plus')}>
              <Plus className="h-4 w-4 mr-2" />
              Plus
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleInsertShape('line')}>
              <Minus className="h-4 w-4 mr-2" />
              Line
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Insert Image */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleInsertImage}
              disabled={!currentSlide}
            >
              <Image className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Insert Image</TooltipContent>
        </Tooltip>

        {/* Insert Table */}
        <Popover open={tablePopoverOpen} onOpenChange={setTablePopoverOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!currentSlide}
                >
                  <Table className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Insert Table</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-0" align="start">
            <TableGridPicker onSelect={handleInsertTable} />
          </PopoverContent>
        </Popover>

        <div className="flex-1" />

        {/* View Options */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={editorState.gridEnabled ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={toggleGrid}
            >
              <Grid className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Grid</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Zoom Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={zoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <button
          onClick={zoomTo100}
          className="text-sm text-muted-foreground hover:text-foreground w-14 text-center"
        >
          {Math.round(editorState.zoom * 100)}%
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={zoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
