import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { usePresentation, useEditor, useSelection } from '@/context'
import { TextElement, ShapeElement, ImageElement, TableElement, TextContent, TableCell, Fill } from '@/types'
import { HexColorPicker } from 'react-colorful'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Type,
  Image as ImageIcon,
  CheckSquare,
  Grid3X3,
} from 'lucide-react'
import { applyFormatToSelection, toggleFormat, TextFormat } from '@/utils/textFormatting'

export function PropertiesPanel() {
  const { presentation, updateElement, updateSlideBackground } = usePresentation()
  const { editorState } = useEditor()
  const { getSelectedElements } = useSelection()

  const currentSlide = presentation?.slides.find(
    s => s.id === editorState.currentSlideId
  )

  const selectedElements = getSelectedElements()

  // If nothing selected, show slide properties
  if (selectedElements.length === 0) {
    return (
      <ScrollArea className="h-full">
        <div className="p-4">
          <h3 className="text-sm font-semibold mb-4">Slide Properties</h3>

          {currentSlide && (
            <>
              {/* Background color */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Background</label>
                <ColorPickerField
                  color={currentSlide.background.color || '#FFFFFF'}
                  onChange={(color) => {
                    updateSlideBackground(currentSlide.id, {
                      type: 'solid',
                      color,
                    })
                  }}
                />
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    )
  }

  // Single element selected
  if (selectedElements.length === 1) {
    const element = selectedElements[0]

    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <h3 className="text-sm font-semibold">
            {element.type.charAt(0).toUpperCase() + element.type.slice(1)} Properties
          </h3>

          {/* Position & Size */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase">Position & Size</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs">X</label>
                <input
                  type="number"
                  value={Math.round(element.position.x)}
                  onChange={(e) => {
                    updateElement(currentSlide!.id, element.id, {
                      position: { ...element.position, x: Number(e.target.value) },
                    })
                  }}
                  className="w-full h-8 px-2 text-sm border rounded"
                />
              </div>
              <div>
                <label className="text-xs">Y</label>
                <input
                  type="number"
                  value={Math.round(element.position.y)}
                  onChange={(e) => {
                    updateElement(currentSlide!.id, element.id, {
                      position: { ...element.position, y: Number(e.target.value) },
                    })
                  }}
                  className="w-full h-8 px-2 text-sm border rounded"
                />
              </div>
              <div>
                <label className="text-xs">Width</label>
                <input
                  type="number"
                  value={Math.round(element.size.width)}
                  onChange={(e) => {
                    updateElement(currentSlide!.id, element.id, {
                      size: { ...element.size, width: Number(e.target.value) },
                    })
                  }}
                  className="w-full h-8 px-2 text-sm border rounded"
                />
              </div>
              <div>
                <label className="text-xs">Height</label>
                <input
                  type="number"
                  value={Math.round(element.size.height)}
                  onChange={(e) => {
                    updateElement(currentSlide!.id, element.id, {
                      size: { ...element.size, height: Number(e.target.value) },
                    })
                  }}
                  className="w-full h-8 px-2 text-sm border rounded"
                />
              </div>
            </div>
          </div>

          {/* Rotation */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase">Rotation</label>
            <input
              type="number"
              value={element.rotation || 0}
              onChange={(e) => {
                updateElement(currentSlide!.id, element.id, {
                  rotation: Number(e.target.value),
                })
              }}
              className="w-full h-8 px-2 text-sm border rounded"
              min={-360}
              max={360}
            />
          </div>

          <Separator />

          {/* Text-specific properties */}
          {element.type === 'text' && (
            <TextProperties
              element={element as TextElement}
              slideId={currentSlide!.id}
            />
          )}

          {/* Shape-specific properties */}
          {element.type === 'shape' && (
            <ShapeProperties
              element={element as ShapeElement}
              slideId={currentSlide!.id}
            />
          )}

          {/* Image-specific properties */}
          {element.type === 'image' && (
            <ImageProperties
              element={element as ImageElement}
              slideId={currentSlide!.id}
            />
          )}

          {/* Table-specific properties */}
          {element.type === 'table' && (
            <TableProperties
              element={element as TableElement}
              slideId={currentSlide!.id}
            />
          )}
        </div>
      </ScrollArea>
    )
  }

  // Multiple elements selected
  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <h3 className="text-sm font-semibold mb-4">
          {selectedElements.length} Elements Selected
        </h3>
        <p className="text-sm text-muted-foreground">
          Select a single element to edit its properties.
        </p>
      </div>
    </ScrollArea>
  )
}

// Text-specific properties
function TextProperties({ element, slideId }: { element: TextElement; slideId: string }) {
  const { updateElement } = usePresentation()
  const { textEditingState } = useEditor()

  // Check if we're currently editing this text element with a selection
  const isEditingWithSelection = textEditingState.elementId === element.id && textEditingState.selection

  // Get style to display - either from selection or from first run
  const firstRun = element.content.paragraphs[0]?.runs[0]
  const displayStyle = isEditingWithSelection && textEditingState.selectionStyle
    ? { ...firstRun?.style, ...textEditingState.selectionStyle }
    : firstRun?.style

  const alignment = element.content.paragraphs[0]?.alignment || 'left'

  // Apply format - either to selection or to all text
  const applyFormat = (property: keyof TextFormat['property'] extends never ? string : TextFormat['property'], value: string | number) => {
    if (isEditingWithSelection && textEditingState.selection) {
      // Apply to selection only
      const newContent = applyFormatToSelection(
        element.content,
        textEditingState.selection,
        { property: property as TextFormat['property'], value }
      )
      updateElement(slideId, element.id, { content: newContent })
    } else {
      // Apply to all runs (original behavior)
      const newContent: TextContent = {
        ...element.content,
        paragraphs: element.content.paragraphs.map(p => ({
          ...p,
          runs: p.runs.map(r => ({
            ...r,
            style: { ...r.style, [property]: value },
          })),
        })),
      }
      updateElement(slideId, element.id, { content: newContent })
    }
  }

  // Toggle format (bold/italic/underline)
  const handleToggleFormat = (property: 'fontWeight' | 'fontStyle' | 'textDecoration') => {
    if (isEditingWithSelection && textEditingState.selection) {
      const newContent = toggleFormat(element.content, textEditingState.selection, property)
      updateElement(slideId, element.id, { content: newContent })
    } else {
      // Toggle all runs
      let newValue: string
      switch (property) {
        case 'fontWeight':
          newValue = displayStyle?.fontWeight === 'bold' ? 'normal' : 'bold'
          break
        case 'fontStyle':
          newValue = displayStyle?.fontStyle === 'italic' ? 'normal' : 'italic'
          break
        case 'textDecoration':
          newValue = displayStyle?.textDecoration === 'underline' ? 'none' : 'underline'
          break
      }
      applyFormat(property, newValue)
    }
  }

  const updateAlignment = (newAlignment: 'left' | 'center' | 'right' | 'justify') => {
    const newContent = {
      ...element.content,
      paragraphs: element.content.paragraphs.map(p => ({
        ...p,
        alignment: newAlignment,
      })),
    }
    updateElement(slideId, element.id, { content: newContent })
  }

  // Check if a format is active (for button states)
  const isBold = displayStyle?.fontWeight === 'bold' || (typeof displayStyle?.fontWeight === 'number' && displayStyle.fontWeight >= 600)
  const isItalic = displayStyle?.fontStyle === 'italic'
  const isUnderline = displayStyle?.textDecoration === 'underline'

  return (
    <div className="space-y-4">
      <label className="text-xs text-muted-foreground uppercase">
        Text Formatting
        {isEditingWithSelection && (
          <span className="ml-2 text-primary">(Selection)</span>
        )}
      </label>

      {/* Font Family */}
      <div className="space-y-1">
        <label className="text-xs">Font</label>
        <select
          value={displayStyle?.fontFamily || 'Calibri'}
          onChange={(e) => applyFormat('fontFamily', e.target.value)}
          className="w-full h-8 px-2 text-sm border rounded"
        >
          <option value="Calibri">Calibri</option>
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
          <option value="Helvetica">Helvetica</option>
        </select>
      </div>

      {/* Font Size */}
      <div className="space-y-1">
        <label className="text-xs">Size</label>
        <input
          type="number"
          value={displayStyle?.fontSize || 18}
          onChange={(e) => applyFormat('fontSize', Number(e.target.value))}
          className="w-full h-8 px-2 text-sm border rounded"
          min={8}
          max={200}
        />
      </div>

      {/* Bold/Italic/Underline */}
      <div className="flex gap-1">
        <Button
          variant={isBold ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => handleToggleFormat('fontWeight')}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={isItalic ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => handleToggleFormat('fontStyle')}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={isUnderline ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => handleToggleFormat('textDecoration')}
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      {/* Alignment */}
      <div className="flex gap-1">
        <Button
          variant={alignment === 'left' ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => updateAlignment('left')}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={alignment === 'center' ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => updateAlignment('center')}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant={alignment === 'right' ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => updateAlignment('right')}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant={alignment === 'justify' ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => updateAlignment('justify')}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>
      </div>

      {/* Text Color */}
      <div className="space-y-1">
        <label className="text-xs">Text Color</label>
        <ColorPickerField
          color={displayStyle?.color || '#000000'}
          onChange={(color) => applyFormat('color', color)}
        />
      </div>
    </div>
  )
}

// Shape-specific properties
function ShapeProperties({ element, slideId }: { element: ShapeElement; slideId: string }) {
  const { updateElement } = usePresentation()

  return (
    <div className="space-y-4">
      <label className="text-xs text-muted-foreground uppercase">Shape Formatting</label>

      {/* Fill Color */}
      <div className="space-y-1">
        <label className="text-xs">Fill Color</label>
        <ColorPickerField
          color={element.fill?.color || '#4472C4'}
          onChange={(color) => {
            updateElement(slideId, element.id, {
              fill: { ...element.fill, type: 'solid', color },
            })
          }}
        />
      </div>

      {/* Stroke Color */}
      <div className="space-y-1">
        <label className="text-xs">Stroke Color</label>
        <ColorPickerField
          color={element.stroke?.color || '#2F528F'}
          onChange={(color) => {
            updateElement(slideId, element.id, {
              stroke: {
                color,
                width: element.stroke?.width || 1,
                style: element.stroke?.style || 'solid',
              },
            })
          }}
        />
      </div>

      {/* Stroke Width */}
      <div className="space-y-1">
        <label className="text-xs">Stroke Width</label>
        <input
          type="number"
          value={element.stroke?.width || 1}
          onChange={(e) => {
            updateElement(slideId, element.id, {
              stroke: { ...element.stroke!, width: Number(e.target.value) },
            })
          }}
          className="w-full h-8 px-2 text-sm border rounded"
          min={0}
          max={20}
        />
      </div>
    </div>
  )
}

// Image-specific properties
function ImageProperties({ element, slideId }: { element: ImageElement; slideId: string }) {
  const { updateElement } = usePresentation()

  return (
    <div className="space-y-4">
      <label className="text-xs text-muted-foreground uppercase">Image Properties</label>

      {/* Opacity */}
      <div className="space-y-1">
        <label className="text-xs">Opacity</label>
        <input
          type="range"
          min={0}
          max={100}
          value={(element.opacity ?? 1) * 100}
          onChange={(e) => {
            updateElement(slideId, element.id, {
              opacity: Number(e.target.value) / 100,
            })
          }}
          className="w-full"
        />
        <span className="text-xs text-muted-foreground">
          {Math.round((element.opacity ?? 1) * 100)}%
        </span>
      </div>
    </div>
  )
}

// Table-specific properties
function TableProperties({ element, slideId }: { element: TableElement; slideId: string }) {
  const { updateElement } = usePresentation()

  // Apply table style preset
  const applyTableStyle = (styleName: string) => {
    const newCells = element.cells.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        let fill: Fill | undefined = cell.fill
        let borders = cell.borders
        let clearFill = false

        switch (styleName) {
          case 'header-row':
            if (rowIndex === 0) {
              fill = { type: 'solid', color: '#4472C4' }
            }
            break
          case 'alternating':
            if (rowIndex % 2 === 0) {
              fill = { type: 'solid', color: '#D6DCE4' }
            } else {
              fill = { type: 'solid', color: '#FFFFFF' }
            }
            break
          case 'first-column':
            if (colIndex === 0) {
              fill = { type: 'solid', color: '#4472C4' }
            }
            break
          case 'grid':
            borders = {
              top: { color: '#000000', width: 1, style: 'solid' },
              right: { color: '#000000', width: 1, style: 'solid' },
              bottom: { color: '#000000', width: 1, style: 'solid' },
              left: { color: '#000000', width: 1, style: 'solid' },
            }
            break
          case 'no-borders':
            borders = undefined
            break
          case 'clear':
            clearFill = true
            borders = undefined
            break
        }

        return { ...cell, fill: clearFill ? undefined : fill, borders }
      })
    )

    updateElement(slideId, element.id, { cells: newCells })
  }

  // Update all cells in a row/column to a specific content type
  const setCellContentType = (contentType: 'text' | 'image' | 'checkbox', scope: 'all' | 'row' | 'column', index?: number) => {
    const newCells = element.cells.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        let shouldUpdate = false
        if (scope === 'all') shouldUpdate = true
        else if (scope === 'row' && rowIndex === index) shouldUpdate = true
        else if (scope === 'column' && colIndex === index) shouldUpdate = true

        if (shouldUpdate) {
          return { ...cell, contentType, checked: contentType === 'checkbox' ? false : cell.checked }
        }
        return cell
      })
    )

    updateElement(slideId, element.id, { cells: newCells })
  }

  // Add row/column
  const addRow = () => {
    const newRow: TableCell[] = element.cells[0].map((_, colIndex) => ({
      id: `cell_${Date.now()}_${colIndex}`,
      content: { paragraphs: [{ id: `p_${Date.now()}_${colIndex}`, runs: [{ id: `r_${Date.now()}_${colIndex}`, text: '', style: { fontFamily: 'Calibri', fontSize: 14, fontWeight: 'normal' as const, fontStyle: 'normal' as const, textDecoration: 'none' as const, color: '#000000' } }], alignment: 'left' as const }] },
    }))
    const newCells = [...element.cells, newRow]
    const newRowHeights = [...element.rowHeights, element.rowHeights[0] || 30]
    updateElement(slideId, element.id, {
      cells: newCells,
      rows: element.rows + 1,
      rowHeights: newRowHeights,
    })
  }

  const addColumn = () => {
    const newCells = element.cells.map((row, rowIndex) => [
      ...row,
      {
        id: `cell_${Date.now()}_${rowIndex}`,
        content: { paragraphs: [{ id: `p_${Date.now()}_${rowIndex}`, runs: [{ id: `r_${Date.now()}_${rowIndex}`, text: '', style: { fontFamily: 'Calibri', fontSize: 14, fontWeight: 'normal' as const, fontStyle: 'normal' as const, textDecoration: 'none' as const, color: '#000000' } }], alignment: 'left' as const }] },
      },
    ])
    const newColumnWidths = [...element.columnWidths, element.columnWidths[0] || 100]
    updateElement(slideId, element.id, {
      cells: newCells,
      columns: element.columns + 1,
      columnWidths: newColumnWidths,
    })
  }

  return (
    <div className="space-y-4">
      <label className="text-xs text-muted-foreground uppercase">Table Design</label>

      {/* Table dimensions */}
      <div className="grid grid-cols-2 gap-2">
        <div className="text-sm text-muted-foreground">
          {element.rows} rows x {element.columns} columns
        </div>
      </div>

      {/* Add row/column */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addRow} className="flex-1">
          + Row
        </Button>
        <Button variant="outline" size="sm" onClick={addColumn} className="flex-1">
          + Column
        </Button>
      </div>

      <Separator />

      {/* Table style presets */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Quick Styles</label>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => applyTableStyle('header-row')}>
            Header Row
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyTableStyle('alternating')}>
            Alternating
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyTableStyle('first-column')}>
            First Column
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyTableStyle('grid')}>
            <Grid3X3 className="h-4 w-4 mr-1" />
            Grid
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyTableStyle('no-borders')}>
            No Borders
          </Button>
          <Button variant="outline" size="sm" onClick={() => applyTableStyle('clear')}>
            Clear Style
          </Button>
        </div>
      </div>

      <Separator />

      {/* Cell content type */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Set Cell Types</label>
        <div className="space-y-2">
          <Select onValueChange={(value) => setCellContentType(value as 'text' | 'image' | 'checkbox', 'all')}>
            <SelectTrigger>
              <SelectValue placeholder="Set all cells to..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Text
                </div>
              </SelectItem>
              <SelectItem value="image">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Image
                </div>
              </SelectItem>
              <SelectItem value="checkbox">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Checkbox
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Per-column type setting */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Column types:</label>
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: element.columns }).map((_, colIndex) => (
              <Popover key={colIndex}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-8 h-8 p-0">
                    {colIndex + 1}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-32 p-2" align="start">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setCellContentType('text', 'column', colIndex)}
                    >
                      <Type className="h-4 w-4 mr-2" />
                      Text
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setCellContentType('image', 'column', colIndex)}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Image
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setCellContentType('checkbox', 'column', colIndex)}
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Checkbox
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </div>

        {/* Per-row type setting */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Row types:</label>
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: element.rows }).map((_, rowIndex) => (
              <Popover key={rowIndex}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-8 h-8 p-0">
                    {rowIndex + 1}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-32 p-2" align="start">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setCellContentType('text', 'row', rowIndex)}
                    >
                      <Type className="h-4 w-4 mr-2" />
                      Text
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setCellContentType('image', 'row', rowIndex)}
                    >
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Image
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => setCellContentType('checkbox', 'row', rowIndex)}
                    >
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Checkbox
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      <TableTextFormatting element={element} slideId={slideId} />
    </div>
  )
}

// Table text formatting sub-component
function TableTextFormatting({ element, slideId }: { element: TableElement; slideId: string }) {
  const { updateElement } = usePresentation()

  // Get current text style from first text cell
  const getFirstTextStyle = () => {
    for (const row of element.cells) {
      for (const cell of row) {
        if (!cell.contentType || cell.contentType === 'text') {
          return cell.content.paragraphs[0]?.runs[0]?.style
        }
      }
    }
    return null
  }

  const currentStyle = getFirstTextStyle() || {
    fontFamily: 'Calibri',
    fontSize: 14,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#000000',
  }

  // Apply text formatting to all text cells
  const applyTextFormat = (property: string, value: string | number) => {
    const newCells = element.cells.map(row =>
      row.map(cell => {
        if (!cell.contentType || cell.contentType === 'text') {
          return {
            ...cell,
            content: {
              ...cell.content,
              paragraphs: cell.content.paragraphs.map(p => ({
                ...p,
                runs: p.runs.map(r => ({
                  ...r,
                  style: { ...r.style, [property]: value },
                })),
              })),
            },
          }
        }
        return cell
      })
    )
    updateElement(slideId, element.id, { cells: newCells })
  }

  // Apply alignment to all text cells
  const applyAlignment = (alignment: 'left' | 'center' | 'right' | 'justify') => {
    const newCells = element.cells.map(row =>
      row.map(cell => {
        if (!cell.contentType || cell.contentType === 'text') {
          return {
            ...cell,
            content: {
              ...cell.content,
              paragraphs: cell.content.paragraphs.map(p => ({
                ...p,
                alignment,
              })),
            },
          }
        }
        return cell
      })
    )
    updateElement(slideId, element.id, { cells: newCells })
  }

  const currentAlignment = element.cells[0]?.[0]?.content.paragraphs[0]?.alignment || 'left'
  const isBold = currentStyle.fontWeight === 'bold'
  const isItalic = currentStyle.fontStyle === 'italic'
  const isUnderline = currentStyle.textDecoration === 'underline'

  return (
    <div className="space-y-4">
      <label className="text-xs text-muted-foreground uppercase">Text Formatting</label>

      {/* Font Family */}
      <div className="space-y-1">
        <label className="text-xs">Font</label>
        <select
          value={currentStyle.fontFamily}
          onChange={(e) => applyTextFormat('fontFamily', e.target.value)}
          className="w-full h-8 px-2 text-sm border rounded"
        >
          <option value="Calibri">Calibri</option>
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
          <option value="Helvetica">Helvetica</option>
        </select>
      </div>

      {/* Font Size */}
      <div className="space-y-1">
        <label className="text-xs">Size</label>
        <input
          type="number"
          value={currentStyle.fontSize}
          onChange={(e) => applyTextFormat('fontSize', Number(e.target.value))}
          className="w-full h-8 px-2 text-sm border rounded"
          min={8}
          max={72}
        />
      </div>

      {/* Bold/Italic/Underline */}
      <div className="flex gap-1">
        <Button
          variant={isBold ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => applyTextFormat('fontWeight', isBold ? 'normal' : 'bold')}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={isItalic ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => applyTextFormat('fontStyle', isItalic ? 'normal' : 'italic')}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={isUnderline ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => applyTextFormat('textDecoration', isUnderline ? 'none' : 'underline')}
        >
          <Underline className="h-4 w-4" />
        </Button>
      </div>

      {/* Alignment */}
      <div className="flex gap-1">
        <Button
          variant={currentAlignment === 'left' ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => applyAlignment('left')}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={currentAlignment === 'center' ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => applyAlignment('center')}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant={currentAlignment === 'right' ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => applyAlignment('right')}
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        <Button
          variant={currentAlignment === 'justify' ? 'secondary' : 'outline'}
          size="icon-sm"
          onClick={() => applyAlignment('justify')}
        >
          <AlignJustify className="h-4 w-4" />
        </Button>
      </div>

      {/* Text Color */}
      <div className="space-y-1">
        <label className="text-xs">Text Color</label>
        <ColorPickerField
          color={currentStyle.color || '#000000'}
          onChange={(color) => applyTextFormat('color', color)}
        />
      </div>
    </div>
  )
}

// Color picker field component
function ColorPickerField({
  color,
  onChange,
}: {
  color: string
  onChange: (color: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="w-full h-8 rounded border flex items-center gap-2 px-2"
        >
          <div
            className="w-5 h-5 rounded border"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm">{color}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <HexColorPicker color={color} onChange={onChange} />
        <input
          type="text"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          className="w-full mt-2 h-8 px-2 text-sm border rounded"
        />
      </PopoverContent>
    </Popover>
  )
}
