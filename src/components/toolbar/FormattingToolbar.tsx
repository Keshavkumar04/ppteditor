import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  // ChevronDown,
  Minus,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { HexColorPicker } from 'react-colorful'
import { usePresentation, useEditor, useSelection } from '@/context'
import { TextElement, TextContent } from '@/types'
import { applyFormatToSelection, toggleFormat, TextFormat } from '@/utils/textFormatting'
import { cn } from '@/lib/utils'

// const FONT_FAMILIES = [
//   'Calibri',
//   'Calibri Light',
//   'Arial',
//   'Arial Black',
//   'Times New Roman',
//   'Georgia',
//   'Verdana',
//   'Helvetica',
//   'Tahoma',
//   'Trebuchet MS',
//   'Courier New',
//   'Impact',
// ]

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 72, 96]

interface FormattingToolbarProps {
  className?: string
}

export function FormattingToolbar({ className }: FormattingToolbarProps) {
  const { presentation, updateElement } = usePresentation()
  const { editorState, textEditingState } = useEditor()
  const { getSelectedElements } = useSelection()

  const selectedElements = getSelectedElements()
  const currentSlide = presentation?.slides.find(
    s => s.id === editorState.currentSlideId
  )

  // Only show for text elements
  const textElement = selectedElements.length === 1 && selectedElements[0].type === 'text'
    ? selectedElements[0] as TextElement
    : null

  if (!textElement || !currentSlide) return null

  const slideId = currentSlide.id
  const isEditingWithSelection = textEditingState.elementId === textElement.id && textEditingState.selection

  // Get the style to display
  const firstRun = textElement.content.paragraphs[0]?.runs[0]
  const displayStyle = isEditingWithSelection && textEditingState.selectionStyle
    ? { ...firstRun?.style, ...textEditingState.selectionStyle }
    : firstRun?.style

  const alignment = textElement.content.paragraphs[0]?.alignment || 'left'

  // Format state
  const isBold = displayStyle?.fontWeight === 'bold' || (typeof displayStyle?.fontWeight === 'number' && displayStyle.fontWeight >= 600)
  const isItalic = displayStyle?.fontStyle === 'italic'
  const isUnderline = displayStyle?.textDecoration === 'underline'
  // const currentFontFamily = displayStyle?.fontFamily || 'Calibri'
  const currentFontSize = displayStyle?.fontSize || 18
  const currentColor = displayStyle?.color || '#000000'

  // Apply format
  const applyFormat = (property: string, value: string | number) => {
    if (isEditingWithSelection && textEditingState.selection) {
      const newContent = applyFormatToSelection(
        textElement.content,
        textEditingState.selection,
        { property: property as TextFormat['property'], value }
      )
      updateElement(slideId, textElement.id, { content: newContent })
    } else {
      const newContent: TextContent = {
        ...textElement.content,
        paragraphs: textElement.content.paragraphs.map(p => ({
          ...p,
          runs: p.runs.map(r => ({
            ...r,
            style: { ...r.style, [property]: value },
          })),
        })),
      }
      updateElement(slideId, textElement.id, { content: newContent })
    }
  }

  // Toggle bold/italic/underline
  const handleToggleFormat = (property: 'fontWeight' | 'fontStyle' | 'textDecoration') => {
    if (isEditingWithSelection && textEditingState.selection) {
      const newContent = toggleFormat(textElement.content, textEditingState.selection, property)
      updateElement(slideId, textElement.id, { content: newContent })
    } else {
      let newValue: string
      switch (property) {
        case 'fontWeight':
          newValue = isBold ? 'normal' : 'bold'
          break
        case 'fontStyle':
          newValue = isItalic ? 'normal' : 'italic'
          break
        case 'textDecoration':
          newValue = isUnderline ? 'none' : 'underline'
          break
      }
      applyFormat(property, newValue)
    }
  }

  // Update alignment
  const updateAlignment = (newAlignment: 'left' | 'center' | 'right' | 'justify') => {
    const newContent = {
      ...textElement.content,
      paragraphs: textElement.content.paragraphs.map(p => ({
        ...p,
        alignment: newAlignment,
      })),
    }
    updateElement(slideId, textElement.id, { content: newContent })
  }

  // Font size increment/decrement
  const changeFontSize = (delta: number) => {
    const currentIdx = FONT_SIZES.findIndex(s => s >= currentFontSize)
    let newSize: number
    if (delta > 0) {
      newSize = currentIdx < FONT_SIZES.length - 1 ? FONT_SIZES[currentIdx + 1] : currentFontSize + 2
    } else {
      newSize = currentIdx > 0 ? FONT_SIZES[currentIdx - 1] : Math.max(6, currentFontSize - 2)
    }
    applyFormat('fontSize', newSize)
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex items-center gap-1 px-2 bg-muted/20 border-b', className)}>
        {/* Font Family - commented out for now, may re-enable later */}
        {/* <Popover>
          <PopoverTrigger asChild>
            <button className="h-7 px-2 text-xs border rounded bg-background hover:bg-muted flex items-center gap-1 min-w-[100px] max-w-[140px]">
              <span className="truncate">{currentFontFamily}</span>
              <ChevronDown className="h-3 w-3 flex-shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1 max-h-64 overflow-auto" align="start">
            {FONT_FAMILIES.map(font => (
              <button
                key={font}
                onClick={() => applyFormat('fontFamily', font)}
                className={cn(
                  'w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted',
                  currentFontFamily === font && 'bg-muted font-medium'
                )}
                style={{ fontFamily: font }}
              >
                {font}
              </button>
            ))}
          </PopoverContent>
        </Popover> */}

        {/* Font Size */}
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-6"
                onClick={() => changeFontSize(-1)}
              >
                <Minus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Decrease Font Size</TooltipContent>
          </Tooltip>

          <Popover>
            <PopoverTrigger asChild>
              <button className="h-7 w-10 text-xs border rounded bg-background hover:bg-muted text-center">
                {Math.round(currentFontSize)}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-20 p-1 max-h-48 overflow-auto" align="start">
              {FONT_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => applyFormat('fontSize', size)}
                  className={cn(
                    'w-full text-center px-2 py-1 text-sm rounded hover:bg-muted',
                    currentFontSize === size && 'bg-muted font-medium'
                  )}
                >
                  {size}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-6"
                onClick={() => changeFontSize(1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Increase Font Size</TooltipContent>
          </Tooltip>
        </div>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Bold / Italic / Underline */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isBold ? 'secondary' : 'ghost'}
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => handleToggleFormat('fontWeight')}
            >
              <Bold className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bold (Ctrl+B)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isItalic ? 'secondary' : 'ghost'}
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => handleToggleFormat('fontStyle')}
            >
              <Italic className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Italic (Ctrl+I)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isUnderline ? 'secondary' : 'ghost'}
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => handleToggleFormat('textDecoration')}
            >
              <Underline className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Underline (Ctrl+U)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Text Color */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted">
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-bold leading-none" style={{ color: currentColor }}>A</span>
                    <div className="w-4 h-1 rounded-sm mt-0.5" style={{ backgroundColor: currentColor }} />
                  </div>
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Font Color</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-auto p-3" align="start">
            <HexColorPicker color={currentColor} onChange={(color) => applyFormat('color', color)} />
            <input
              type="text"
              value={currentColor}
              onChange={(e) => applyFormat('color', e.target.value)}
              className="w-full mt-2 h-7 px-2 text-xs border rounded"
            />
          </PopoverContent>
        </Popover>

        <Separator orientation="vertical" className="h-5 mx-0.5" />

        {/* Alignment */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={alignment === 'left' ? 'secondary' : 'ghost'}
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => updateAlignment('left')}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Align Left</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={alignment === 'center' ? 'secondary' : 'ghost'}
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => updateAlignment('center')}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Align Center</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={alignment === 'right' ? 'secondary' : 'ghost'}
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => updateAlignment('right')}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Align Right</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={alignment === 'justify' ? 'secondary' : 'ghost'}
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => updateAlignment('justify')}
            >
              <AlignJustify className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Justify</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
