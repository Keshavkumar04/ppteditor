import { ShapeElement } from '@/types'

interface ShapeProps {
  element: ShapeElement
}

export function Shape({ element }: ShapeProps) {
  const { size, shapeType, fill, stroke } = element

  const getFillStyle = () => {
    if (!fill || fill.type === 'none') return 'transparent'
    if (fill.type === 'solid') return fill.color || '#4472C4'
    // TODO: Handle gradient fills
    return '#4472C4'
  }

  const getStrokeStyle = () => {
    if (!stroke || stroke.style === 'none') return 'transparent'
    return stroke.color || '#2F528F'
  }

  const strokeWidth = stroke?.style !== 'none' ? (stroke?.width || 1) : 0
  const strokeDasharray = stroke?.style === 'dashed' ? '8,4' : stroke?.style === 'dotted' ? '2,2' : undefined

  // Render based on shape type
  const renderShape = () => {
    switch (shapeType) {
      case 'rectangle':
        return (
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={size.width - strokeWidth}
            height={size.height - strokeWidth}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'roundedRectangle':
        const radius = Math.min(size.width, size.height) * 0.1
        return (
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={size.width - strokeWidth}
            height={size.height - strokeWidth}
            rx={radius}
            ry={radius}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'ellipse':
        return (
          <ellipse
            cx={size.width / 2}
            cy={size.height / 2}
            rx={(size.width - strokeWidth) / 2}
            ry={(size.height - strokeWidth) / 2}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'triangle':
        const trianglePoints = `${size.width / 2},${strokeWidth} ${size.width - strokeWidth},${size.height - strokeWidth} ${strokeWidth},${size.height - strokeWidth}`
        return (
          <polygon
            points={trianglePoints}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'diamond':
        const diamondPoints = `${size.width / 2},${strokeWidth} ${size.width - strokeWidth},${size.height / 2} ${size.width / 2},${size.height - strokeWidth} ${strokeWidth},${size.height / 2}`
        return (
          <polygon
            points={diamondPoints}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'line':
        return (
          <line
            x1={0}
            y1={size.height / 2}
            x2={size.width}
            y2={size.height / 2}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth || 2}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'arrow':
      case 'arrowRight':
        const arrowPath = `M ${strokeWidth} ${size.height * 0.3}
                          L ${size.width * 0.6} ${size.height * 0.3}
                          L ${size.width * 0.6} ${strokeWidth}
                          L ${size.width - strokeWidth} ${size.height / 2}
                          L ${size.width * 0.6} ${size.height - strokeWidth}
                          L ${size.width * 0.6} ${size.height * 0.7}
                          L ${strokeWidth} ${size.height * 0.7} Z`
        return (
          <path
            d={arrowPath}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'star5':
        const star5Points = generateStarPoints(size.width / 2, size.height / 2, 5, (Math.min(size.width, size.height) - strokeWidth) / 2, (Math.min(size.width, size.height) - strokeWidth) / 4)
        return (
          <polygon
            points={star5Points}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'plus':
        const plusPath = `M ${size.width * 0.35} ${strokeWidth}
                         L ${size.width * 0.65} ${strokeWidth}
                         L ${size.width * 0.65} ${size.height * 0.35}
                         L ${size.width - strokeWidth} ${size.height * 0.35}
                         L ${size.width - strokeWidth} ${size.height * 0.65}
                         L ${size.width * 0.65} ${size.height * 0.65}
                         L ${size.width * 0.65} ${size.height - strokeWidth}
                         L ${size.width * 0.35} ${size.height - strokeWidth}
                         L ${size.width * 0.35} ${size.height * 0.65}
                         L ${strokeWidth} ${size.height * 0.65}
                         L ${strokeWidth} ${size.height * 0.35}
                         L ${size.width * 0.35} ${size.height * 0.35} Z`
        return (
          <path
            d={plusPath}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'rightTriangle':
        const rightTriPoints = `${strokeWidth},${strokeWidth} ${strokeWidth},${size.height - strokeWidth} ${size.width - strokeWidth},${size.height - strokeWidth}`
        return (
          <polygon
            points={rightTriPoints}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'pentagon':
        const pentagonPoints = generateRegularPolygonPoints(size.width / 2, size.height / 2, 5, (Math.min(size.width, size.height) - strokeWidth) / 2)
        return (
          <polygon
            points={pentagonPoints}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'hexagon':
        const hexagonPoints = generateRegularPolygonPoints(size.width / 2, size.height / 2, 6, (Math.min(size.width, size.height) - strokeWidth) / 2)
        return (
          <polygon
            points={hexagonPoints}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'octagon':
        const octagonPoints = generateRegularPolygonPoints(size.width / 2, size.height / 2, 8, (Math.min(size.width, size.height) - strokeWidth) / 2)
        return (
          <polygon
            points={octagonPoints}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'star6':
        const star6Points = generateStarPoints(size.width / 2, size.height / 2, 6, (Math.min(size.width, size.height) - strokeWidth) / 2, (Math.min(size.width, size.height) - strokeWidth) / 4)
        return (
          <polygon
            points={star6Points}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'arrowLeft':
        const arrowLeftPath = `M ${size.width - strokeWidth} ${size.height * 0.3}
                              L ${size.width * 0.4} ${size.height * 0.3}
                              L ${size.width * 0.4} ${strokeWidth}
                              L ${strokeWidth} ${size.height / 2}
                              L ${size.width * 0.4} ${size.height - strokeWidth}
                              L ${size.width * 0.4} ${size.height * 0.7}
                              L ${size.width - strokeWidth} ${size.height * 0.7} Z`
        return (
          <path
            d={arrowLeftPath}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'arrowUp':
        const arrowUpPath = `M ${size.width * 0.3} ${size.height - strokeWidth}
                            L ${size.width * 0.3} ${size.height * 0.4}
                            L ${strokeWidth} ${size.height * 0.4}
                            L ${size.width / 2} ${strokeWidth}
                            L ${size.width - strokeWidth} ${size.height * 0.4}
                            L ${size.width * 0.7} ${size.height * 0.4}
                            L ${size.width * 0.7} ${size.height - strokeWidth} Z`
        return (
          <path
            d={arrowUpPath}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'arrowDown':
        const arrowDownPath = `M ${size.width * 0.3} ${strokeWidth}
                              L ${size.width * 0.3} ${size.height * 0.6}
                              L ${strokeWidth} ${size.height * 0.6}
                              L ${size.width / 2} ${size.height - strokeWidth}
                              L ${size.width - strokeWidth} ${size.height * 0.6}
                              L ${size.width * 0.7} ${size.height * 0.6}
                              L ${size.width * 0.7} ${strokeWidth} Z`
        return (
          <path
            d={arrowDownPath}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'heart':
        const heartPath = `M ${size.width / 2} ${size.height * 0.25}
                          C ${size.width * 0.2} ${strokeWidth}, ${strokeWidth} ${size.height * 0.3}, ${size.width / 2} ${size.height - strokeWidth}
                          C ${size.width - strokeWidth} ${size.height * 0.3}, ${size.width * 0.8} ${strokeWidth}, ${size.width / 2} ${size.height * 0.25}`
        return (
          <path
            d={heartPath}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'cloud':
        const cloudPath = `M ${size.width * 0.25} ${size.height * 0.6}
                          A ${size.width * 0.15} ${size.height * 0.2} 0 1 1 ${size.width * 0.4} ${size.height * 0.4}
                          A ${size.width * 0.15} ${size.height * 0.2} 0 1 1 ${size.width * 0.65} ${size.height * 0.35}
                          A ${size.width * 0.18} ${size.height * 0.25} 0 1 1 ${size.width * 0.85} ${size.height * 0.55}
                          A ${size.width * 0.1} ${size.height * 0.15} 0 1 1 ${size.width * 0.75} ${size.height * 0.7}
                          L ${size.width * 0.25} ${size.height * 0.7}
                          A ${size.width * 0.12} ${size.height * 0.15} 0 1 1 ${size.width * 0.25} ${size.height * 0.6} Z`
        return (
          <path
            d={cloudPath}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'callout':
        const calloutPath = `M ${strokeWidth} ${strokeWidth}
                            L ${size.width - strokeWidth} ${strokeWidth}
                            L ${size.width - strokeWidth} ${size.height * 0.7}
                            L ${size.width * 0.4} ${size.height * 0.7}
                            L ${size.width * 0.2} ${size.height - strokeWidth}
                            L ${size.width * 0.3} ${size.height * 0.7}
                            L ${strokeWidth} ${size.height * 0.7} Z`
        return (
          <path
            d={calloutPath}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'lightning':
        const lightningPath = `M ${size.width * 0.55} ${strokeWidth}
                              L ${size.width * 0.2} ${size.height * 0.5}
                              L ${size.width * 0.45} ${size.height * 0.5}
                              L ${size.width * 0.35} ${size.height - strokeWidth}
                              L ${size.width * 0.8} ${size.height * 0.4}
                              L ${size.width * 0.55} ${size.height * 0.4}
                              Z`
        return (
          <path
            d={lightningPath}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      case 'minus':
        return (
          <rect
            x={strokeWidth}
            y={size.height * 0.4}
            width={size.width - strokeWidth * 2}
            height={size.height * 0.2}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )

      default:
        // Default to rectangle for unsupported shapes
        return (
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={size.width - strokeWidth}
            height={size.height - strokeWidth}
            fill={getFillStyle()}
            stroke={getStrokeStyle()}
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        )
    }
  }

  return <>{renderShape()}</>
}

// Helper function to generate regular polygon points
function generateRegularPolygonPoints(
  cx: number,
  cy: number,
  sides: number,
  radius: number
): string {
  const result: string[] = []
  const angleStep = (2 * Math.PI) / sides

  for (let i = 0; i < sides; i++) {
    const angle = i * angleStep - Math.PI / 2 // Start from top
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    result.push(`${x},${y}`)
  }

  return result.join(' ')
}

// Helper function to generate star points
function generateStarPoints(
  cx: number,
  cy: number,
  points: number,
  outerRadius: number,
  innerRadius: number
): string {
  const result: string[] = []
  const step = Math.PI / points

  for (let i = 0; i < 2 * points; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const angle = i * step - Math.PI / 2
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    result.push(`${x},${y}`)
  }

  return result.join(' ')
}
