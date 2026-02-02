import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface TableGridPickerProps {
  maxRows?: number
  maxCols?: number
  onSelect: (rows: number, cols: number) => void
}

export function TableGridPicker({
  maxRows = 8,
  maxCols = 10,
  onSelect,
}: TableGridPickerProps) {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)

  const handleMouseEnter = useCallback((row: number, col: number) => {
    setHoveredCell({ row, col })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredCell(null)
  }, [])

  const handleClick = useCallback(() => {
    if (hoveredCell) {
      onSelect(hoveredCell.row, hoveredCell.col)
    }
  }, [hoveredCell, onSelect])

  const isHighlighted = (row: number, col: number) => {
    if (!hoveredCell) return false
    return row <= hoveredCell.row && col <= hoveredCell.col
  }

  return (
    <div className="p-2">
      <div className="text-sm text-center mb-2 text-muted-foreground h-5">
        {hoveredCell ? `${hoveredCell.col} x ${hoveredCell.row} Table` : 'Insert Table'}
      </div>
      <div
        className="grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${maxCols}, 1fr)`,
        }}
        onMouseLeave={handleMouseLeave}
      >
        {Array.from({ length: maxRows }).map((_, rowIndex) =>
          Array.from({ length: maxCols }).map((_, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              className={cn(
                'w-5 h-5 border border-border rounded-sm transition-colors',
                isHighlighted(rowIndex + 1, colIndex + 1)
                  ? 'bg-primary/20 border-primary'
                  : 'bg-background hover:bg-muted'
              )}
              onMouseEnter={() => handleMouseEnter(rowIndex + 1, colIndex + 1)}
              onClick={handleClick}
              aria-label={`Insert ${colIndex + 1} by ${rowIndex + 1} table`}
            />
          ))
        )}
      </div>
    </div>
  )
}
