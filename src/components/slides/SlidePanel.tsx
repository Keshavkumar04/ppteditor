import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { SlideThumbnail } from './SlideThumbnail'
import { usePresentation, useEditor, useSelection } from '@/context'

export function SlidePanel() {
  const {
    presentation,
    addSlide,
    deleteSlide,
    duplicateSlide,
    reorderSlides,
    updateSlide,
  } = usePresentation()
  const { editorState, setCurrentSlide } = useEditor()
  const { deselectAll } = useSelection()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  if (!presentation) return null

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = presentation.slides.findIndex(s => s.id === active.id)
      const newIndex = presentation.slides.findIndex(s => s.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        reorderSlides(oldIndex, newIndex)
      }
    }
  }

  const handleSelectSlide = (slideId: string) => {
    setCurrentSlide(slideId)
    deselectAll()
  }

  const handleAddSlide = () => {
    const newSlide = addSlide(editorState.currentSlideId || undefined)
    setCurrentSlide(newSlide.id)
  }

  const handleDuplicateSlide = (slideId: string) => {
    const newSlide = duplicateSlide(slideId)
    if (newSlide) {
      setCurrentSlide(newSlide.id)
    }
  }

  const handleDeleteSlide = (slideId: string) => {
    // If deleting the current slide, select the previous or next
    if (editorState.currentSlideId === slideId) {
      const currentIndex = presentation.slides.findIndex(s => s.id === slideId)
      const nextSlide = presentation.slides[currentIndex + 1] || presentation.slides[currentIndex - 1]
      if (nextSlide) {
        setCurrentSlide(nextSlide.id)
      }
    }
    deleteSlide(slideId)
  }

  const handleToggleHidden = (slideId: string) => {
    const slide = presentation.slides.find(s => s.id === slideId)
    if (slide) {
      updateSlide(slideId, { hidden: !slide.hidden })
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-medium">Slides</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleAddSlide}
          title="Add Slide"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Slide List */}
      <ScrollArea className="flex-1">
        <div className="p-4 pl-8">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={presentation.slides.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {presentation.slides.map((slide, index) => (
                  <SlideThumbnail
                    key={slide.id}
                    slide={slide}
                    index={index}
                    isActive={editorState.currentSlideId === slide.id}
                    onSelect={() => handleSelectSlide(slide.id)}
                    onDuplicate={() => handleDuplicateSlide(slide.id)}
                    onDelete={() => handleDeleteSlide(slide.id)}
                    onToggleHidden={() => handleToggleHidden(slide.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </ScrollArea>
    </div>
  )
}
