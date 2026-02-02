import { useRef, useCallback, useEffect } from 'react'
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types'
import { usePresentation, useEditor, useSelection } from '@/context'
import { ElementRenderer } from '@/components/elements/ElementRenderer'

export function SlideCanvas() {
  const { presentation } = usePresentation()
  const { editorState, setCurrentSlide } = useEditor()
  const { deselectAll, selection } = useSelection()
  const containerRef = useRef<HTMLDivElement>(null)

  // Get current slide
  const currentSlide = presentation?.slides.find(
    s => s.id === editorState.currentSlideId
  )

  // Set first slide as current if none selected
  useEffect(() => {
    if (presentation && !editorState.currentSlideId && presentation.slides.length > 0) {
      setCurrentSlide(presentation.slides[0].id)
    }
  }, [presentation, editorState.currentSlideId, setCurrentSlide])


  // Handle canvas click (deselect)
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    // Only deselect if clicking directly on the canvas background
    if (e.target === e.currentTarget) {
      deselectAll()
    }
  }, [deselectAll])

  if (!currentSlide) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        No slide selected
      </div>
    )
  }

  // Calculate zoom and positioning
  const zoom = editorState.zoom
  const scaledWidth = SLIDE_WIDTH * zoom
  const scaledHeight = SLIDE_HEIGHT * zoom

  // Get background style
  const getBackgroundFill = (): string => {
    const bg = currentSlide.background
    if (bg.type === 'solid') {
      return bg.color || '#FFFFFF'
    }
    // For gradient, we'll use a gradient def
    return '#FFFFFF'
  }

  // Generate gradient def if needed
  const renderGradientDef = () => {
    const bg = currentSlide.background
    if (bg.type !== 'gradient' || !bg.gradient) return null

    const gradientId = `bg-gradient-${currentSlide.id}`
    const { gradient } = bg

    if (gradient.type === 'linear') {
      const angle = gradient.angle || 0
      const rad = (angle * Math.PI) / 180
      const x1 = 50 - Math.cos(rad) * 50
      const y1 = 50 + Math.sin(rad) * 50
      const x2 = 50 + Math.cos(rad) * 50
      const y2 = 50 - Math.sin(rad) * 50

      return (
        <linearGradient id={gradientId} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}>
          {gradient.stops.map((stop, i) => (
            <stop key={i} offset={`${stop.position * 100}%`} stopColor={stop.color} />
          ))}
        </linearGradient>
      )
    } else {
      return (
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          {gradient.stops.map((stop, i) => (
            <stop key={i} offset={`${stop.position * 100}%`} stopColor={stop.color} />
          ))}
        </radialGradient>
      )
    }
  }

  const getBackgroundFillUrl = (): string => {
    const bg = currentSlide.background
    if (bg.type === 'gradient' && bg.gradient) {
      return `url(#bg-gradient-${currentSlide.id})`
    }
    return getBackgroundFill()
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto flex items-center justify-center p-8"
      onClick={handleCanvasClick}
    >
      <div
        className="relative"
        style={{
          width: scaledWidth,
          height: scaledHeight,
          minWidth: scaledWidth,
          minHeight: scaledHeight,
        }}
      >
        {/* SVG Canvas */}
        <svg
          width={scaledWidth}
          height={scaledHeight}
          viewBox={`0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}`}
          className="slide-canvas bg-white"
          style={{
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          }}
        >
          {/* Gradient definitions */}
          <defs>
            {renderGradientDef()}
          </defs>

          {/* Background */}
          <rect
            x="0"
            y="0"
            width={SLIDE_WIDTH}
            height={SLIDE_HEIGHT}
            fill={getBackgroundFillUrl()}
          />

          {/* Background image if applicable */}
          {currentSlide.background.type === 'image' && currentSlide.background.imageUrl && (
            <image
              href={currentSlide.background.imageUrl}
              x="0"
              y="0"
              width={SLIDE_WIDTH}
              height={SLIDE_HEIGHT}
              preserveAspectRatio="xMidYMid slice"
            />
          )}

          {/* Grid overlay (optional) */}
          {editorState.gridEnabled && <GridOverlay />}

          {/* Elements sorted by zIndex */}
          {currentSlide.elements
            .sort((a, b) => a.zIndex - b.zIndex)
            .map(element => (
              <ElementRenderer
                key={element.id}
                element={element}
                slideId={currentSlide.id}
                isSelected={selection.selectedElementIds.includes(element.id)}
              />
            ))}
        </svg>
      </div>
    </div>
  )
}

function GridOverlay() {
  const gridSize = 20
  const lines = []

  // Vertical lines
  for (let x = gridSize; x < SLIDE_WIDTH; x += gridSize) {
    lines.push(
      <line
        key={`v-${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={SLIDE_HEIGHT}
        stroke="#ddd"
        strokeWidth="0.5"
      />
    )
  }

  // Horizontal lines
  for (let y = gridSize; y < SLIDE_HEIGHT; y += gridSize) {
    lines.push(
      <line
        key={`h-${y}`}
        x1={0}
        y1={y}
        x2={SLIDE_WIDTH}
        y2={y}
        stroke="#ddd"
        strokeWidth="0.5"
      />
    )
  }

  return <g className="grid-overlay">{lines}</g>
}
