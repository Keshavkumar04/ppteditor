import { useState, useCallback, useMemo } from 'react'
import { TableElement, TextContent, TableCell } from '@/types'
import { TableCellComponent } from './TableCell'
import { usePresentation } from '@/context'

interface TableProps {
  element: TableElement
  slideId: string
  isSelected: boolean
}

export function Table({ element, slideId, isSelected: _isSelected }: TableProps) {
  const { updateElement } = usePresentation()
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)

  // Calculate cell dimensions based on element size and column/row proportions
  const cellDimensions = useMemo(() => {
    const totalWidth = element.size.width
    const totalHeight = element.size.height

    // Use stored widths/heights or distribute evenly
    const columnWidths = element.columnWidths.length === element.columns
      ? element.columnWidths.map(w => (w / element.columnWidths.reduce((a, b) => a + b, 0)) * totalWidth)
      : Array(element.columns).fill(totalWidth / element.columns)

    const rowHeights = element.rowHeights.length === element.rows
      ? element.rowHeights.map(h => (h / element.rowHeights.reduce((a, b) => a + b, 0)) * totalHeight)
      : Array(element.rows).fill(totalHeight / element.rows)

    return { columnWidths, rowHeights }
  }, [element])

  const handleSelectCell = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col })
    setEditingCell(null)
  }, [])

  const handleStartEdit = useCallback((row: number, col: number) => {
    setSelectedCell({ row, col })
    setEditingCell({ row, col })
  }, [])

  const handleEndEdit = useCallback(() => {
    setEditingCell(null)
  }, [])

  const handleCellChange = useCallback((row: number, col: number, content: TextContent) => {
    // Update the cell content
    const newCells = element.cells.map((cellRow, rIdx) =>
      cellRow.map((cell, cIdx) => {
        if (rIdx === row && cIdx === col) {
          return { ...cell, content }
        }
        return cell
      })
    )

    updateElement(slideId, element.id, {
      cells: newCells,
    })
  }, [element, slideId, updateElement])

  const handleCellUpdate = useCallback((row: number, col: number, updates: Partial<TableCell>) => {
    // Update cell properties (image, checkbox, etc.)
    const newCells = element.cells.map((cellRow, rIdx) =>
      cellRow.map((cell, cIdx) => {
        if (rIdx === row && cIdx === col) {
          return { ...cell, ...updates }
        }
        return cell
      })
    )

    updateElement(slideId, element.id, {
      cells: newCells,
    })
  }, [element, slideId, updateElement])

  const handleNavigate = useCallback((direction: 'next' | 'prev') => {
    if (!selectedCell) return

    let newRow = selectedCell.row
    let newCol = selectedCell.col

    if (direction === 'next') {
      newCol++
      if (newCol >= element.columns) {
        newCol = 0
        newRow++
        if (newRow >= element.rows) {
          newRow = 0
        }
      }
    } else {
      newCol--
      if (newCol < 0) {
        newCol = element.columns - 1
        newRow--
        if (newRow < 0) {
          newRow = element.rows - 1
        }
      }
    }

    setSelectedCell({ row: newRow, col: newCol })
    setEditingCell({ row: newRow, col: newCol })
  }, [selectedCell, element.rows, element.columns])

  // Stop propagation to prevent element selection while editing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (editingCell) {
      e.stopPropagation()
    }
  }, [editingCell])

  return (
    <foreignObject
      x={0}
      y={0}
      width={element.size.width}
      height={element.size.height}
      style={{ overflow: 'hidden' }}
    >
      <div
        // @ts-expect-error xmlns is valid for foreignObject content
        xmlns="http://www.w3.org/1999/xhtml"
        style={{
          width: '100%',
          height: '100%',
        }}
        onMouseDown={handleMouseDown}
      >
        <table
          style={{
            width: '100%',
            height: '100%',
            borderCollapse: element.style.borderCollapse ? 'collapse' : 'separate',
            tableLayout: 'fixed',
          }}
        >
          <tbody>
            {element.cells.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, colIndex) => (
                  <TableCellComponent
                    key={cell.id}
                    cell={cell}
                    rowIndex={rowIndex}
                    colIndex={colIndex}
                    width={cellDimensions.columnWidths[colIndex]}
                    height={cellDimensions.rowHeights[rowIndex]}
                    isSelected={selectedCell?.row === rowIndex && selectedCell?.col === colIndex}
                    isEditing={editingCell?.row === rowIndex && editingCell?.col === colIndex}
                    onSelect={handleSelectCell}
                    onStartEdit={handleStartEdit}
                    onEndEdit={handleEndEdit}
                    onChange={handleCellChange}
                    onCellUpdate={handleCellUpdate}
                    onNavigate={handleNavigate}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </foreignObject>
  )
}
