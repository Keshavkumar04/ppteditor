import React, { useState, useCallback, useRef, useEffect } from 'react'
import { SlideElement, ResizeHandle } from '@/types'
import { useSelection, usePresentation } from '@/context'

interface ElementWrapperProps {
  element: SlideElement
  slideId: string
  isSelected: boolean
  isEditing?: boolean
  children: React.ReactNode
  onDoubleClick?: () => void
}

const HANDLE_SIZE = 8

const resizeHandles: { id: ResizeHandle; cursor: string }[] = [
  { id: 'top-left', cursor: 'nw-resize' },
  { id: 'top', cursor: 'n-resize' },
  { id: 'top-right', cursor: 'ne-resize' },
  { id: 'right', cursor: 'e-resize' },
  { id: 'bottom-right', cursor: 'se-resize' },
  { id: 'bottom', cursor: 's-resize' },
  { id: 'bottom-left', cursor: 'sw-resize' },
  { id: 'left', cursor: 'w-resize' },
]

export function ElementWrapper({
  element,
  slideId,
  isSelected,
  isEditing = false,
  children,
  onDoubleClick,
}: ElementWrapperProps) {
  const { selectElement, startDrag, endDrag, startResize, endResize } = useSelection()
  const { updateElement } = usePresentation()
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; elementX: number; elementY: number } | null>(null)
  const resizeStartRef = useRef<{
    mouseX: number
    mouseY: number
    elementX: number
    elementY: number
    width: number
    height: number
  } | null>(null)

  const { position, size } = element

  // Handle selection click
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selectElement(element.id, e.shiftKey)
  }, [element.id, selectElement])

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Don't start drag when editing (allows text selection)
    if (element.locked || isEditing) return
    e.stopPropagation()
    e.preventDefault()

    if (!isSelected) {
      selectElement(element.id)
    }

    setIsDragging(true)
    startDrag()
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      elementX: position.x,
      elementY: position.y,
    }
  }, [element.id, element.locked, isEditing, isSelected, position, selectElement, startDrag])

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, handle: ResizeHandle) => {
    if (element.locked) return
    e.stopPropagation()
    e.preventDefault()

    setIsResizing(true)
    setActiveHandle(handle)
    startResize(handle)
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      elementX: position.x,
      elementY: position.y,
      width: size.width,
      height: size.height,
    }
  }, [element.locked, position, size, startResize])

  // Handle mouse move (drag/resize) with RAF throttling for performance
  useEffect(() => {
    if (!isDragging && !isResizing) return

    let rafId: number | null = null
    let lastMouseEvent: MouseEvent | null = null

    const processMouseMove = () => {
      if (!lastMouseEvent) return

      const e = lastMouseEvent

      if (isDragging && dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.x
        const dy = e.clientY - dragStartRef.current.y

        // Note: In a real implementation, you'd need to account for zoom level
        updateElement(slideId, element.id, {
          position: {
            x: Math.max(0, dragStartRef.current.elementX + dx),
            y: Math.max(0, dragStartRef.current.elementY + dy),
          },
        })
      }

      if (isResizing && resizeStartRef.current && activeHandle) {
        const dx = e.clientX - resizeStartRef.current.mouseX
        const dy = e.clientY - resizeStartRef.current.mouseY
        const start = resizeStartRef.current

        let newX = start.elementX
        let newY = start.elementY
        let newWidth = start.width
        let newHeight = start.height

        // Apply resize based on handle
        if (activeHandle.includes('left')) {
          newX = start.elementX + dx
          newWidth = start.width - dx
        }
        if (activeHandle.includes('right')) {
          newWidth = start.width + dx
        }
        if (activeHandle.includes('top')) {
          newY = start.elementY + dy
          newHeight = start.height - dy
        }
        if (activeHandle.includes('bottom')) {
          newHeight = start.height + dy
        }

        // Ensure minimum size
        const minSize = 20
        if (newWidth >= minSize && newHeight >= minSize) {
          updateElement(slideId, element.id, {
            position: { x: Math.max(0, newX), y: Math.max(0, newY) },
            size: { width: newWidth, height: newHeight },
          })
        }
      }

      rafId = null
    }

    const handleMouseMove = (e: MouseEvent) => {
      lastMouseEvent = e

      // Throttle updates using requestAnimationFrame
      if (rafId === null) {
        rafId = requestAnimationFrame(processMouseMove)
      }
    }

    const handleMouseUp = () => {
      // Cancel any pending RAF
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }

      setIsDragging(false)
      setIsResizing(false)
      setActiveHandle(null)
      endDrag()
      endResize()
      dragStartRef.current = null
      resizeStartRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing, activeHandle, slideId, element.id, updateElement, endDrag, endResize])

  // Get handle position
  const getHandlePosition = (handle: ResizeHandle): { x: number; y: number } => {
    const halfHandle = HANDLE_SIZE / 2
    switch (handle) {
      case 'top-left':
        return { x: -halfHandle, y: -halfHandle }
      case 'top':
        return { x: size.width / 2 - halfHandle, y: -halfHandle }
      case 'top-right':
        return { x: size.width - halfHandle, y: -halfHandle }
      case 'right':
        return { x: size.width - halfHandle, y: size.height / 2 - halfHandle }
      case 'bottom-right':
        return { x: size.width - halfHandle, y: size.height - halfHandle }
      case 'bottom':
        return { x: size.width / 2 - halfHandle, y: size.height - halfHandle }
      case 'bottom-left':
        return { x: -halfHandle, y: size.height - halfHandle }
      case 'left':
        return { x: -halfHandle, y: size.height / 2 - halfHandle }
      default:
        return { x: 0, y: 0 }
    }
  }

  return (
    <g
      transform={`translate(${position.x}, ${position.y})${element.rotation ? ` rotate(${element.rotation}, ${size.width / 2}, ${size.height / 2})` : ''}`}
      onClick={handleClick}
      onDoubleClick={onDoubleClick}
      onMouseDown={handleDragStart}
      style={{
        cursor: isDragging ? 'grabbing' : (isSelected ? 'grab' : 'pointer'),
        opacity: element.opacity ?? 1,
      }}
    >
      {/* Element content */}
      {children}

      {/* Selection outline */}
      {isSelected && (
        <>
          <rect
            x={-1}
            y={-1}
            width={size.width + 2}
            height={size.height + 2}
            fill="none"
            stroke="#4472C4"
            strokeWidth="2"
            strokeDasharray={element.locked ? "4 4" : undefined}
            pointerEvents="none"
          />

          {/* Resize handles */}
          {!element.locked && resizeHandles.map(({ id, cursor }) => {
            const pos = getHandlePosition(id)
            return (
              <rect
                key={id}
                x={pos.x}
                y={pos.y}
                width={HANDLE_SIZE}
                height={HANDLE_SIZE}
                fill="white"
                stroke="#4472C4"
                strokeWidth="1"
                style={{ cursor }}
                onMouseDown={(e) => handleResizeStart(e, id)}
              />
            )
          })}
        </>
      )}
    </g>
  )
}
