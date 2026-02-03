import { SlideElement, TextElement, SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types'
import { generateId } from '@/utils'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useState } from 'react'

export interface SlideLayout {
  id: string
  name: string
  preview: React.ReactNode
  createElements: () => SlideElement[]
}

function createTextElement(
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  style: {
    fontSize?: number
    fontWeight?: string
    color?: string
    alignment?: 'left' | 'center' | 'right'
  } = {},
): TextElement {
  return {
    id: generateId(),
    type: 'text',
    position: { x, y },
    size: { width, height },
    rotation: 0,
    zIndex: 0,
    style: {
      padding: { top: 4, right: 8, bottom: 4, left: 8 },
      verticalAlign: 'middle',
      autoFit: false,
      wordWrap: true,
    },
    content: {
      paragraphs: [{
        id: generateId(),
        runs: [{
          id: generateId(),
          text,
          style: {
            fontFamily: 'Calibri',
            fontSize: style.fontSize || 18,
            fontWeight: (style.fontWeight || 'normal') as 'normal' | 'bold',
            fontStyle: 'normal',
            textDecoration: 'none',
            color: style.color || '#000000',
          },
        }],
        alignment: style.alignment || 'left',
      }],
    },
  }
}

const BUILT_IN_LAYOUTS: SlideLayout[] = [
  {
    id: 'blank',
    name: 'Blank',
    preview: (
      <div className="w-full h-full bg-white rounded-sm" />
    ),
    createElements: () => [],
  },
  {
    id: 'title',
    name: 'Title Slide',
    preview: (
      <div className="w-full h-full bg-white rounded-sm flex flex-col items-center justify-center p-2">
        <div className="w-3/4 h-1.5 bg-gray-800 rounded-sm mb-1" />
        <div className="w-1/2 h-1 bg-gray-400 rounded-sm" />
      </div>
    ),
    createElements: () => [
      createTextElement('Click to add title', SLIDE_WIDTH * 0.1, SLIDE_HEIGHT * 0.3, SLIDE_WIDTH * 0.8, 60, {
        fontSize: 36,
        fontWeight: 'bold',
        alignment: 'center',
        color: '#333333',
      }),
      createTextElement('Click to add subtitle', SLIDE_WIDTH * 0.15, SLIDE_HEIGHT * 0.5, SLIDE_WIDTH * 0.7, 40, {
        fontSize: 20,
        alignment: 'center',
        color: '#666666',
      }),
    ],
  },
  {
    id: 'title-content',
    name: 'Title and Content',
    preview: (
      <div className="w-full h-full bg-white rounded-sm flex flex-col p-1.5">
        <div className="w-3/4 h-1.5 bg-gray-800 rounded-sm mb-1" />
        <div className="flex-1 border border-dashed border-gray-300 rounded-sm" />
      </div>
    ),
    createElements: () => [
      createTextElement('Click to add title', SLIDE_WIDTH * 0.05, 20, SLIDE_WIDTH * 0.9, 50, {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333333',
      }),
      createTextElement('Click to add text', SLIDE_WIDTH * 0.05, 90, SLIDE_WIDTH * 0.9, SLIDE_HEIGHT - 120, {
        fontSize: 18,
        color: '#444444',
      }),
    ],
  },
  {
    id: 'two-content',
    name: 'Two Content',
    preview: (
      <div className="w-full h-full bg-white rounded-sm flex flex-col p-1.5">
        <div className="w-3/4 h-1.5 bg-gray-800 rounded-sm mb-1" />
        <div className="flex-1 flex gap-0.5">
          <div className="flex-1 border border-dashed border-gray-300 rounded-sm" />
          <div className="flex-1 border border-dashed border-gray-300 rounded-sm" />
        </div>
      </div>
    ),
    createElements: () => [
      createTextElement('Click to add title', SLIDE_WIDTH * 0.05, 20, SLIDE_WIDTH * 0.9, 50, {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333333',
      }),
      createTextElement('Click to add text', SLIDE_WIDTH * 0.05, 90, SLIDE_WIDTH * 0.43, SLIDE_HEIGHT - 120, {
        fontSize: 16,
        color: '#444444',
      }),
      createTextElement('Click to add text', SLIDE_WIDTH * 0.52, 90, SLIDE_WIDTH * 0.43, SLIDE_HEIGHT - 120, {
        fontSize: 16,
        color: '#444444',
      }),
    ],
  },
  {
    id: 'section-header',
    name: 'Section Header',
    preview: (
      <div className="w-full h-full bg-white rounded-sm flex flex-col items-start justify-end p-2">
        <div className="w-3/4 h-1.5 bg-gray-800 rounded-sm mb-0.5" />
        <div className="w-full h-px bg-gray-300" />
        <div className="w-1/2 h-1 bg-gray-400 rounded-sm mt-0.5" />
      </div>
    ),
    createElements: () => [
      createTextElement('Section Title', SLIDE_WIDTH * 0.05, SLIDE_HEIGHT * 0.55, SLIDE_WIDTH * 0.8, 50, {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#333333',
      }),
      createTextElement('Section description', SLIDE_WIDTH * 0.05, SLIDE_HEIGHT * 0.68, SLIDE_WIDTH * 0.6, 30, {
        fontSize: 16,
        color: '#888888',
      }),
    ],
  },
  {
    id: 'title-only',
    name: 'Title Only',
    preview: (
      <div className="w-full h-full bg-white rounded-sm flex flex-col p-1.5">
        <div className="w-3/4 h-1.5 bg-gray-800 rounded-sm" />
      </div>
    ),
    createElements: () => [
      createTextElement('Click to add title', SLIDE_WIDTH * 0.05, 20, SLIDE_WIDTH * 0.9, 50, {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333333',
      }),
    ],
  },
]

interface SlideLayoutPickerProps {
  onSelectLayout: (elements: SlideElement[]) => void
}

export function SlideLayoutPicker({ onSelectLayout }: SlideLayoutPickerProps) {
  const [open, setOpen] = useState(false)

  const handleSelect = (layout: SlideLayout) => {
    onSelectLayout(layout.createElements())
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Add Slide"
          className="h-6 w-6"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start" side="right">
        <div className="text-xs font-medium text-muted-foreground mb-2">Choose a layout</div>
        <div className="grid grid-cols-3 gap-1.5">
          {BUILT_IN_LAYOUTS.map(layout => (
            <button
              key={layout.id}
              onClick={() => handleSelect(layout)}
              className="flex flex-col items-center gap-1 p-1 rounded hover:bg-muted transition-colors group"
              title={layout.name}
            >
              <div className="w-full aspect-video border border-gray-200 rounded-sm overflow-hidden group-hover:border-primary transition-colors">
                {layout.preview}
              </div>
              <span className="text-[9px] text-muted-foreground leading-tight truncate w-full text-center">
                {layout.name}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
