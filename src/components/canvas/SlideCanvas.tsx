import { useRef, useCallback, useEffect, useState } from 'react'
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types'
import { usePresentation, useEditor, useSelection } from '@/context'
import { ElementRenderer } from '@/components/elements/ElementRenderer'

export function SlideCanvas() {
  const { presentation } = usePresentation()
  const { editorState, setCurrentSlide } = useEditor()
  const { deselectAll, selection } = useSelection()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 450 })

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

  // Measure the wrapper (which has fixed size from flex layout)
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    const update = () => {
      const { offsetWidth: w, offsetHeight: h } = el
      setSize(prev => (prev.w !== w || prev.h !== h) ? { w, h } : prev)
    }

    update()

    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  // Handle canvas click (deselect)
  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      deselectAll()
    }
  }, [deselectAll])

  if (!currentSlide) {
    return (
      <div ref={wrapperRef} className="h-full w-full flex items-center justify-center text-muted-foreground">
        No slide selected
      </div>
    )
  }

  // Fit slide to container at zoom=1.0
  const pad = 40
  const fitScale = Math.min(
    (size.w - pad) / SLIDE_WIDTH,
    (size.h - pad) / SLIDE_HEIGHT
  )
  const scale = Math.max(0.1, fitScale * editorState.zoom)
  const sw = Math.round(SLIDE_WIDTH * scale)
  const sh = Math.round(SLIDE_HEIGHT * scale)

  // Get background fill
  const getBackgroundFill = (): string => {
    const bg = currentSlide.background
    if (bg.type === 'solid') return bg.color || '#FFFFFF'
    return '#FFFFFF'
  }

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

  // Position slide centered in the wrapper
  const left = Math.max(0, Math.round((size.w - sw) / 2))
  const top = Math.max(0, Math.round((size.h - sh) / 2))

  return (
    <div
      ref={wrapperRef}
      className="h-full w-full overflow-hidden relative bg-neutral-200"
      style={{ minHeight: 0 }}
    >
      {/* Scrollable area only when zoomed in past container */}
      <div
        className="absolute inset-0 overflow-auto"
        onClick={handleCanvasClick}
      >
        <div
          style={{
            position: 'absolute',
            left,
            top,
            width: sw,
            height: sh,
          }}
        >
          <svg
            width={sw}
            height={sh}
            viewBox={`0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}`}
            className="slide-canvas bg-white"
            style={{
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
              display: 'block',
            }}
          >
            <defs>
              {renderGradientDef()}
            </defs>

            <rect
              x="0"
              y="0"
              width={SLIDE_WIDTH}
              height={SLIDE_HEIGHT}
              fill={getBackgroundFillUrl()}
            />

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

            {editorState.gridEnabled && <GridOverlay />}

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
    </div>
  )
}

function GridOverlay() {
  const gridSize = 20
  const lines = []

  for (let x = gridSize; x < SLIDE_WIDTH; x += gridSize) {
    lines.push(
      <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={SLIDE_HEIGHT} stroke="#ddd" strokeWidth="0.5" />
    )
  }

  for (let y = gridSize; y < SLIDE_HEIGHT; y += gridSize) {
    lines.push(
      <line key={`h-${y}`} x1={0} y1={y} x2={SLIDE_WIDTH} y2={y} stroke="#ddd" strokeWidth="0.5" />
    )
  }

  return <g className="grid-overlay">{lines}</g>
}
