import React, { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Slide, SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Copy, Trash2, EyeOff, Eye, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useComments, useReadOnly } from '@/context'

interface SlideThumbnailProps {
  slide: Slide
  index: number
  isActive: boolean
  onSelect: () => void
  onDuplicate: () => void
  onDelete: () => void
  onToggleHidden?: () => void
}

export const SlideThumbnail = memo(function SlideThumbnail({
  slide,
  index,
  isActive,
  onSelect,
  onDuplicate,
  onDelete,
  onToggleHidden,
}: SlideThumbnailProps) {
  const { slideCommentCounts, onSlideCommentBadgeClick } = useComments()
  const commentCount = slideCommentCounts[slide.id] ?? 0
  const readOnly = useReadOnly()

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Calculate thumbnail dimensions (maintaining aspect ratio)
  const thumbnailWidth = 120
  const thumbnailHeight = thumbnailWidth * (SLIDE_HEIGHT / SLIDE_WIDTH)

  // Get background style
  const getBackgroundStyle = (): React.CSSProperties => {
    if (slide.background.type === 'solid') {
      return { backgroundColor: slide.background.color || '#FFFFFF' }
    }
    if (slide.background.type === 'image' && slide.background.imageUrl) {
      return {
        backgroundImage: `url(${slide.background.imageUrl})`,
        backgroundSize: slide.background.imageFit || 'cover',
        backgroundPosition: 'center',
      }
    }
    return { backgroundColor: '#FFFFFF' }
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={setNodeRef}
          style={style}
          {...(readOnly ? {} : attributes)}
          {...(readOnly ? {} : listeners)}
          onClick={onSelect}
          className={cn(
            'relative cursor-pointer group',
            isDragging && 'opacity-50 z-50'
          )}
        >
          {/* Slide number */}
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-xs text-muted-foreground w-5 text-right">
            {index + 1}
          </div>

          {/* Thumbnail container */}
          <div
            className={cn(
              'relative rounded border-2 overflow-hidden shadow-sm transition-all',
              isActive ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-primary/50',
              slide.hidden && 'opacity-50'
            )}
            style={{
              width: thumbnailWidth,
              height: thumbnailHeight,
            }}
          >
            {/* Slide preview */}
            <div
              className="absolute inset-0"
              style={getBackgroundStyle()}
            >
              {/* Render slide elements as mini preview */}
              <svg
                width={thumbnailWidth}
                height={thumbnailHeight}
                viewBox={`0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}`}
                className="absolute inset-0"
              >
                {slide.elements
                  .sort((a, b) => a.zIndex - b.zIndex)
                  .map(element => (
                    <ThumbnailElement key={element.id} element={element} />
                  ))}
              </svg>
            </div>

            {/* Hidden indicator */}
            {slide.hidden && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <EyeOff className="h-6 w-6 text-white" />
              </div>
            )}
          </div>

          {/* Comment count badge */}
          {commentCount > 0 && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onSlideCommentBadgeClick?.(slide.id)
              }}
              title={`${commentCount} comment${commentCount === 1 ? '' : 's'}`}
              className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 px-1.5 h-5 rounded-full bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-[10px] font-semibold shadow border border-yellow-600/40 z-10"
            >
              <MessageSquare className="h-3 w-3" />
              {commentCount}
            </button>
          )}
        </div>
      </ContextMenuTrigger>

      {!readOnly && (
        <ContextMenuContent>
          <ContextMenuItem onClick={onDuplicate}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate Slide
          </ContextMenuItem>
          {onToggleHidden && (
            <ContextMenuItem onClick={onToggleHidden}>
              {slide.hidden ? (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Show Slide
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide Slide
                </>
              )}
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Slide
          </ContextMenuItem>
        </ContextMenuContent>
      )}
    </ContextMenu>
  )
})

// Simple element rendering for thumbnails - memoized
const ThumbnailElement = memo(function ThumbnailElement({ element }: { element: any }) {
  const { position, size } = element

  switch (element.type) {
    case 'text':
      return (
        <rect
          x={position.x}
          y={position.y}
          width={size.width}
          height={size.height}
          fill="transparent"
          stroke="#ccc"
          strokeWidth="1"
          strokeDasharray="4"
        />
      )
    case 'shape':
      return (
        <rect
          x={position.x}
          y={position.y}
          width={size.width}
          height={size.height}
          fill={element.fill?.color || '#4472C4'}
          stroke={element.stroke?.color || '#2F528F'}
          strokeWidth={element.stroke?.width || 1}
          rx={element.shapeType === 'roundedRectangle' ? 10 : 0}
        />
      )
    case 'image':
      return (
        <image
          x={position.x}
          y={position.y}
          width={size.width}
          height={size.height}
          href={element.src}
          preserveAspectRatio="xMidYMid slice"
        />
      )
    default:
      return null
  }
})
