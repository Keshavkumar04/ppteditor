import { useRef, useState, useCallback, useEffect } from 'react'
import { TableCell as TableCellType, TextContent } from '@/types'
import { generateId } from '@/utils'
import { cn } from '@/lib/utils'
import { Image as ImageIcon, Check } from 'lucide-react'

interface TableCellProps {
  cell: TableCellType
  rowIndex: number
  colIndex: number
  width: number
  height: number
  isSelected: boolean
  isEditing: boolean
  onSelect: (rowIndex: number, colIndex: number) => void
  onStartEdit: (rowIndex: number, colIndex: number) => void
  onEndEdit: () => void
  onChange: (rowIndex: number, colIndex: number, content: TextContent) => void
  onCellUpdate: (rowIndex: number, colIndex: number, updates: Partial<TableCellType>) => void
  onNavigate: (direction: 'next' | 'prev') => void
}

export function TableCellComponent({
  cell,
  rowIndex,
  colIndex,
  width,
  height,
  isSelected,
  isEditing,
  onSelect,
  onStartEdit,
  onEndEdit,
  onChange,
  onCellUpdate,
  onNavigate,
}: TableCellProps) {
  const cellRef = useRef<HTMLTableCellElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [localContent, setLocalContent] = useState('')

  const contentType = cell.contentType || 'text'

  // Sync local content with cell content
  useEffect(() => {
    const text = cell.content.paragraphs
      .map(p => p.runs.map(r => r.text).join(''))
      .join('\n')
    setLocalContent(text)
  }, [cell.content])

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      onCellUpdate(rowIndex, colIndex, {
        contentType: 'image',
        imageUrl,
        imageFit: 'contain',
      })
    }
    reader.readAsDataURL(file)
  }, [rowIndex, colIndex, onCellUpdate])

  // Handle checkbox toggle
  const handleCheckboxToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onCellUpdate(rowIndex, colIndex, {
      checked: !cell.checked,
    })
  }, [rowIndex, colIndex, cell.checked, onCellUpdate])

  // Focus the content div when editing starts
  useEffect(() => {
    if (isEditing && contentRef.current) {
      contentRef.current.focus()
      // Select all text
      const range = document.createRange()
      range.selectNodeContents(contentRef.current)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }, [isEditing])

  const handleClick = useCallback(() => {
    onSelect(rowIndex, colIndex)
  }, [rowIndex, colIndex, onSelect])

  const handleDoubleClick = useCallback(() => {
    onStartEdit(rowIndex, colIndex)
  }, [rowIndex, colIndex, onStartEdit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      onNavigate(e.shiftKey ? 'prev' : 'next')
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onEndEdit()
    } else if (e.key === 'Escape') {
      onEndEdit()
    }
  }, [onNavigate, onEndEdit])

  const handleInput = useCallback(() => {
    if (!contentRef.current) return

    const newText = contentRef.current.textContent || ''

    // Create updated content structure
    const newContent: TextContent = {
      paragraphs: [{
        id: cell.content.paragraphs[0]?.id || generateId(),
        runs: [{
          id: cell.content.paragraphs[0]?.runs[0]?.id || generateId(),
          text: newText,
          style: cell.content.paragraphs[0]?.runs[0]?.style || {
            fontFamily: 'Calibri',
            fontSize: 14,
            fontWeight: 'normal',
            fontStyle: 'normal',
            textDecoration: 'none',
            color: '#000000',
          },
        }],
        alignment: cell.content.paragraphs[0]?.alignment || 'left',
      }],
    }

    onChange(rowIndex, colIndex, newContent)
  }, [cell, rowIndex, colIndex, onChange])

  const handleBlur = useCallback(() => {
    if (isEditing) {
      onEndEdit()
    }
  }, [isEditing, onEndEdit])

  // Get text style from first run
  const firstRun = cell.content.paragraphs[0]?.runs[0]
  const textStyle = firstRun?.style || {
    fontFamily: 'Calibri',
    fontSize: 14,
    color: '#000000',
  }

  // Get cell background color
  const bgColor = cell.fill?.type === 'solid' ? cell.fill.color : 'transparent'

  // Get border styles
  const getBorderStyle = (border?: { color: string; width: number; style: string }) => {
    if (!border) return '1px solid #d1d5db'
    if (border.style === 'none' || border.width === 0 || border.color === 'transparent') return 'none'
    return `${border.width}px ${border.style} ${border.color}`
  }

  // Render cell content based on content type
  const renderContent = () => {
    switch (contentType) {
      case 'image':
        return (
          <div className="w-full h-full flex items-center justify-center relative">
            {cell.imageUrl ? (
              <img
                src={cell.imageUrl}
                alt=""
                className="max-w-full max-h-full"
                style={{
                  objectFit: cell.imageFit === 'stretch' ? 'fill' : (cell.imageFit || 'contain'),
                }}
              />
            ) : (
              <div
                className="flex flex-col items-center justify-center text-muted-foreground cursor-pointer hover:bg-muted/50 w-full h-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-6 w-6" />
                <span className="text-xs mt-1">Add Image</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>
        )

      case 'checkbox':
        return (
          <div
            className="w-full h-full flex items-center justify-center cursor-pointer"
            onClick={handleCheckboxToggle}
          >
            <div
              className={cn(
                'w-5 h-5 border-2 rounded flex items-center justify-center transition-colors',
                cell.checked
                  ? 'bg-primary border-primary text-white'
                  : 'border-gray-400 hover:border-primary'
              )}
            >
              {cell.checked && <Check className="h-4 w-4" />}
            </div>
          </div>
        )

      case 'text':
      default:
        return (
          <div
            ref={contentRef}
            contentEditable={isEditing}
            suppressContentEditableWarning
            className={cn(
              'outline-none w-full h-full',
              isEditing && 'bg-white'
            )}
            style={{
              fontFamily: textStyle.fontFamily,
              fontSize: `${textStyle.fontSize}px`,
              fontWeight: textStyle.fontWeight,
              fontStyle: textStyle.fontStyle,
              textDecoration: textStyle.textDecoration,
              color: textStyle.color,
              textAlign: cell.content.paragraphs[0]?.alignment || 'left',
            }}
            onKeyDown={isEditing ? handleKeyDown : undefined}
            onInput={isEditing ? handleInput : undefined}
            onBlur={handleBlur}
          >
            {localContent}
          </div>
        )
    }
  }

  return (
    <td
      ref={cellRef}
      className={cn(
        'relative',
        isSelected && 'ring-2 ring-primary ring-inset',
        !isEditing && contentType === 'text' && 'cursor-pointer'
      )}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        minWidth: `${width}px`,
        minHeight: `${height}px`,
        maxWidth: `${width}px`,
        maxHeight: `${height}px`,
        backgroundColor: bgColor,
        borderTop: getBorderStyle(cell.borders?.top),
        borderRight: getBorderStyle(cell.borders?.right),
        borderBottom: getBorderStyle(cell.borders?.bottom),
        borderLeft: getBorderStyle(cell.borders?.left),
        padding: cell.padding
          ? `${cell.padding.top}px ${cell.padding.right}px ${cell.padding.bottom}px ${cell.padding.left}px`
          : '4px 8px',
        verticalAlign: cell.verticalAlign || 'middle',
        overflow: 'hidden',
      }}
      onClick={handleClick}
      onDoubleClick={contentType === 'text' ? handleDoubleClick : undefined}
      rowSpan={cell.rowSpan}
      colSpan={cell.colSpan}
    >
      {renderContent()}
    </td>
  )
}
