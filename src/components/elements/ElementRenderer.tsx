import { useState, useCallback, memo } from 'react'
import { SlideElement, TextElement, ShapeElement, ImageElement, TableElement } from '@/types'
import { ElementWrapper } from './ElementWrapper'
import { TextBox } from './TextBox'
import { Shape } from './Shape'
import { Table } from './Table'

interface ElementRendererProps {
  element: SlideElement
  slideId: string
  isSelected: boolean
}

export const ElementRenderer = memo(function ElementRenderer({ element, slideId, isSelected }: ElementRendererProps) {
  const [isEditing, setIsEditing] = useState(false)

  const handleDoubleClick = useCallback(() => {
    if (element.type === 'text' || element.type === 'table') {
      setIsEditing(true)
    }
  }, [element.type])

  const handleStopEditing = useCallback(() => {
    setIsEditing(false)
  }, [])

  const renderElement = () => {
    switch (element.type) {
      case 'text':
        return (
          <TextBox
            element={element as TextElement}
            slideId={slideId}
            isSelected={isSelected}
            isEditing={isEditing}
            onStartEditing={() => setIsEditing(true)}
            onStopEditing={handleStopEditing}
          />
        )

      case 'shape':
        return <Shape element={element as ShapeElement} />

      case 'image':
        return <ImageElementRenderer element={element as ImageElement} />

      case 'table':
        return <Table element={element as TableElement} slideId={slideId} isSelected={isSelected} />

      default:
        return null
    }
  }

  return (
    <ElementWrapper
      element={element}
      slideId={slideId}
      isSelected={isSelected}
      isEditing={isEditing}
      onDoubleClick={handleDoubleClick}
    >
      {renderElement()}
    </ElementWrapper>
  )
})

// Simple image renderer - memoized
const ImageElementRenderer = memo(function ImageElementRenderer({ element }: { element: ImageElement }) {
  const { size, src, stroke } = element

  return (
    <>
      {/* Image */}
      <image
        href={src}
        x={0}
        y={0}
        width={size.width}
        height={size.height}
        preserveAspectRatio="xMidYMid slice"
      />

      {/* Border */}
      {stroke?.style !== 'none' && (
        <rect
          x={0}
          y={0}
          width={size.width}
          height={size.height}
          fill="none"
          stroke={stroke?.color || 'transparent'}
          strokeWidth={stroke?.width || 0}
        />
      )}
    </>
  )
})

