import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import {
  Presentation,
  PresentationMetadata,
  PresentationTheme,
  Slide,
  SlideElement,
  DEFAULT_THEME,
  DEFAULT_METADATA,
  DEFAULT_BACKGROUND,
  Background,
} from '@/types'
import { generateId } from '@/utils'
import { useHistory } from './HistoryContext'

interface PresentationContextValue {
  // State
  presentation: Presentation | null
  isLoading: boolean
  isDirty: boolean
  error: Error | null
  lastSaved: Date | null

  // Presentation operations
  createNewPresentation: (name?: string) => void
  loadPresentation: (data: Presentation) => void
  updatePresentationMeta: (meta: Partial<PresentationMetadata>) => void
  setTheme: (theme: PresentationTheme) => void
  setPresentationName: (name: string) => void

  // Slide operations
  addSlide: (afterSlideId?: string, layoutElements?: SlideElement[]) => Slide
  deleteSlide: (slideId: string) => void
  duplicateSlide: (slideId: string) => Slide | null
  reorderSlides: (fromIndex: number, toIndex: number) => void
  updateSlide: (slideId: string, updates: Partial<Slide>) => void
  updateSlideBackground: (slideId: string, background: Background) => void

  // Element operations
  addElement: (slideId: string, element: SlideElement) => void
  updateElement: (slideId: string, elementId: string, updates: Partial<SlideElement>) => void
  deleteElements: (slideId: string, elementIds: string[]) => void
  duplicateElements: (slideId: string, elementIds: string[]) => SlideElement[]
  bringToFront: (slideId: string, elementId: string) => void
  sendToBack: (slideId: string, elementId: string) => void
  bringForward: (slideId: string, elementId: string) => void
  sendBackward: (slideId: string, elementId: string) => void

  // Save operation
  requestSave: () => void
}

const PresentationContext = createContext<PresentationContextValue | null>(null)

export interface PresentationProviderProps {
  children: React.ReactNode
  data?: Presentation | null
  initialData?: Presentation | null
  onChange?: (data: Presentation) => void
  onSave?: (data: Presentation) => void
  onDirtyChange?: (isDirty: boolean) => void
}

function createEmptySlide(order: number): Slide {
  return {
    id: generateId(),
    order,
    elements: [],
    background: { ...DEFAULT_BACKGROUND },
  }
}

export function PresentationProvider({
  children,
  data,
  initialData,
  onChange,
  onSave,
  onDirtyChange,
}: PresentationProviderProps) {
  const isControlled = data !== undefined

  const [internalPresentation, setInternalPresentation] = useState<Presentation | null>(
    initialData ?? null
  )
  const [isLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const { pushState } = useHistory()

  // The active presentation: controlled uses props, uncontrolled uses internal state
  const presentation = isControlled ? (data ?? null) : internalPresentation

  // Sync controlled data into history when it changes externally
  const prevDataRef = useRef<Presentation | null | undefined>(data)
  useEffect(() => {
    if (isControlled && data && data !== prevDataRef.current) {
      pushState('External update', data)
      prevDataRef.current = data
    }
  }, [isControlled, data, pushState])

  // Notify consumer when dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // Apply a mutation: updates state and notifies consumer
  const applyMutation = useCallback((newPresentation: Presentation) => {
    if (isControlled) {
      // Controlled: notify parent, they update `data` prop
      onChange?.(newPresentation)
    } else {
      // Uncontrolled: update internal state and notify
      setInternalPresentation(newPresentation)
      onChange?.(newPresentation)
    }
  }, [isControlled, onChange])

  // Helper to update presentation and track history
  const updatePresentation = useCallback((
    updater: (prev: Presentation) => Presentation,
    action: string
  ) => {
    const current = isControlled ? (data ?? null) : internalPresentation
    if (!current) return

    const newState = updater(current)
    newState.updatedAt = new Date()
    pushState(action, newState)
    setIsDirty(true)
    applyMutation(newState)
  }, [isControlled, data, internalPresentation, pushState, applyMutation])

  // Save: calls the consumer's onSave callback
  const requestSave = useCallback(() => {
    const current = isControlled ? (data ?? null) : internalPresentation
    if (!current) return
    onSave?.(current)
    setLastSaved(new Date())
    setIsDirty(false)
  }, [isControlled, data, internalPresentation, onSave])

  // Presentation operations
  const createNewPresentation = useCallback((name: string = 'Untitled Presentation') => {
    const newPresentation: Presentation = {
      id: generateId(),
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
      slides: [createEmptySlide(0)],
      theme: { ...DEFAULT_THEME },
      metadata: { ...DEFAULT_METADATA, title: name },
    }
    pushState('Create presentation', newPresentation)
    setIsDirty(false)
    setError(null)
    applyMutation(newPresentation)
  }, [pushState, applyMutation])

  const loadPresentation = useCallback((loaded: Presentation) => {
    pushState('Load presentation', loaded)
    setIsDirty(false)
    setError(null)
    applyMutation(loaded)
  }, [pushState, applyMutation])

  const updatePresentationMeta = useCallback((meta: Partial<PresentationMetadata>) => {
    updatePresentation(prev => ({
      ...prev,
      metadata: { ...prev.metadata, ...meta },
    }), 'Update metadata')
  }, [updatePresentation])

  const setTheme = useCallback((theme: PresentationTheme, applyToSlides: boolean = true) => {
    updatePresentation(prev => {
      const updated = { ...prev, theme }
      if (applyToSlides && theme.defaultBackground) {
        updated.slides = prev.slides.map(slide => ({
          ...slide,
          background: { ...theme.defaultBackground },
        }))
      }
      return updated
    }, 'Change theme')
  }, [updatePresentation])

  const setPresentationName = useCallback((name: string) => {
    updatePresentation(prev => ({ ...prev, name }), 'Rename presentation')
  }, [updatePresentation])

  // Slide operations
  const addSlide = useCallback((afterSlideId?: string, layoutElements?: SlideElement[]): Slide => {
    const newSlide = createEmptySlide(0)
    if (layoutElements && layoutElements.length > 0) {
      newSlide.elements = layoutElements
    }
    const current = isControlled ? (data ?? null) : internalPresentation
    if (!current) return newSlide

    let insertIndex = current.slides.length
    if (afterSlideId) {
      const afterIndex = current.slides.findIndex(s => s.id === afterSlideId)
      if (afterIndex !== -1) insertIndex = afterIndex + 1
    }

    const newSlides = [...current.slides]
    newSlide.order = insertIndex
    newSlides.splice(insertIndex, 0, newSlide)

    for (let i = insertIndex + 1; i < newSlides.length; i++) {
      newSlides[i] = { ...newSlides[i], order: i }
    }

    const newState = { ...current, slides: newSlides, updatedAt: new Date() }
    pushState('Add slide', newState)
    setIsDirty(true)
    applyMutation(newState)

    return newSlide
  }, [isControlled, data, internalPresentation, pushState, applyMutation])

  const deleteSlide = useCallback((slideId: string) => {
    updatePresentation(prev => {
      const newSlides = prev.slides.filter(s => s.id !== slideId)
      if (newSlides.length === 0) {
        newSlides.push(createEmptySlide(0))
      }
      newSlides.forEach((slide, index) => { slide.order = index })
      return { ...prev, slides: newSlides }
    }, 'Delete slide')
  }, [updatePresentation])

  const duplicateSlide = useCallback((slideId: string): Slide | null => {
    const current = isControlled ? (data ?? null) : internalPresentation
    if (!current) return null

    const slideIndex = current.slides.findIndex(s => s.id === slideId)
    if (slideIndex === -1) return null

    const originalSlide = current.slides[slideIndex]
    const newSlide: Slide = {
      ...JSON.parse(JSON.stringify(originalSlide)),
      id: generateId(),
      order: slideIndex + 1,
    }
    newSlide.elements = newSlide.elements.map((el: SlideElement) => ({
      ...el,
      id: generateId(),
    }))

    const newSlides = [...current.slides]
    newSlides.splice(slideIndex + 1, 0, newSlide)
    for (let i = slideIndex + 2; i < newSlides.length; i++) {
      newSlides[i] = { ...newSlides[i], order: i }
    }

    const newState = { ...current, slides: newSlides, updatedAt: new Date() }
    pushState('Duplicate slide', newState)
    setIsDirty(true)
    applyMutation(newState)

    return newSlide
  }, [isControlled, data, internalPresentation, pushState, applyMutation])

  const reorderSlides = useCallback((fromIndex: number, toIndex: number) => {
    updatePresentation(prev => {
      const newSlides = [...prev.slides]
      const [movedSlide] = newSlides.splice(fromIndex, 1)
      newSlides.splice(toIndex, 0, movedSlide)
      newSlides.forEach((slide, index) => { slide.order = index })
      return { ...prev, slides: newSlides }
    }, 'Reorder slides')
  }, [updatePresentation])

  const updateSlide = useCallback((slideId: string, updates: Partial<Slide>) => {
    updatePresentation(prev => ({
      ...prev,
      slides: prev.slides.map(slide =>
        slide.id === slideId ? { ...slide, ...updates } : slide
      ),
    }), 'Update slide')
  }, [updatePresentation])

  const updateSlideBackground = useCallback((slideId: string, background: Background) => {
    updateSlide(slideId, { background })
  }, [updateSlide])

  // Element operations
  const addElement = useCallback((slideId: string, element: SlideElement) => {
    updatePresentation(prev => ({
      ...prev,
      slides: prev.slides.map(slide => {
        if (slide.id !== slideId) return slide
        const maxZIndex = Math.max(0, ...slide.elements.map(el => el.zIndex))
        return {
          ...slide,
          elements: [...slide.elements, { ...element, zIndex: maxZIndex + 1 }],
        }
      }),
    }), 'Add element')
  }, [updatePresentation])

  const updateElement = useCallback((
    slideId: string,
    elementId: string,
    updates: Partial<SlideElement>
  ) => {
    updatePresentation(prev => ({
      ...prev,
      slides: prev.slides.map(slide => {
        if (slide.id !== slideId) return slide
        return {
          ...slide,
          elements: slide.elements.map(el =>
            el.id === elementId ? { ...el, ...updates } as SlideElement : el
          ),
        }
      }),
    }), 'Update element')
  }, [updatePresentation])

  const deleteElements = useCallback((slideId: string, elementIds: string[]) => {
    updatePresentation(prev => ({
      ...prev,
      slides: prev.slides.map(slide => {
        if (slide.id !== slideId) return slide
        return {
          ...slide,
          elements: slide.elements.filter(el => !elementIds.includes(el.id)),
        }
      }),
    }), 'Delete elements')
  }, [updatePresentation])

  const duplicateElements = useCallback((slideId: string, elementIds: string[]): SlideElement[] => {
    const current = isControlled ? (data ?? null) : internalPresentation
    if (!current) return []

    const duplicated: SlideElement[] = []
    const newSlides = current.slides.map(slide => {
      if (slide.id !== slideId) return slide

      const elementsToDuplicate = slide.elements.filter(el => elementIds.includes(el.id))
      const maxZIndex = Math.max(0, ...slide.elements.map(el => el.zIndex))

      const newElements = elementsToDuplicate.map((el, index) => {
        const newEl = {
          ...JSON.parse(JSON.stringify(el)),
          id: generateId(),
          position: { x: el.position.x + 20, y: el.position.y + 20 },
          zIndex: maxZIndex + index + 1,
        }
        duplicated.push(newEl)
        return newEl
      })

      return { ...slide, elements: [...slide.elements, ...newElements] }
    })

    const newState = { ...current, slides: newSlides, updatedAt: new Date() }
    pushState('Duplicate elements', newState)
    setIsDirty(true)
    applyMutation(newState)

    return duplicated
  }, [isControlled, data, internalPresentation, pushState, applyMutation])

  const bringToFront = useCallback((slideId: string, elementId: string) => {
    updatePresentation(prev => ({
      ...prev,
      slides: prev.slides.map(slide => {
        if (slide.id !== slideId) return slide
        const maxZIndex = Math.max(...slide.elements.map(el => el.zIndex))
        return {
          ...slide,
          elements: slide.elements.map(el =>
            el.id === elementId ? { ...el, zIndex: maxZIndex + 1 } : el
          ),
        }
      }),
    }), 'Bring to front')
  }, [updatePresentation])

  const sendToBack = useCallback((slideId: string, elementId: string) => {
    updatePresentation(prev => ({
      ...prev,
      slides: prev.slides.map(slide => {
        if (slide.id !== slideId) return slide
        const minZIndex = Math.min(...slide.elements.map(el => el.zIndex))
        return {
          ...slide,
          elements: slide.elements.map(el =>
            el.id === elementId ? { ...el, zIndex: minZIndex - 1 } : el
          ),
        }
      }),
    }), 'Send to back')
  }, [updatePresentation])

  const bringForward = useCallback((slideId: string, elementId: string) => {
    updatePresentation(prev => ({
      ...prev,
      slides: prev.slides.map(slide => {
        if (slide.id !== slideId) return slide
        const element = slide.elements.find(el => el.id === elementId)
        if (!element) return slide
        const nextHigher = slide.elements
          .filter(el => el.zIndex > element.zIndex)
          .sort((a, b) => a.zIndex - b.zIndex)[0]
        if (!nextHigher) return slide
        return {
          ...slide,
          elements: slide.elements.map(el => {
            if (el.id === elementId) return { ...el, zIndex: nextHigher.zIndex }
            if (el.id === nextHigher.id) return { ...el, zIndex: element.zIndex }
            return el
          }),
        }
      }),
    }), 'Bring forward')
  }, [updatePresentation])

  const sendBackward = useCallback((slideId: string, elementId: string) => {
    updatePresentation(prev => ({
      ...prev,
      slides: prev.slides.map(slide => {
        if (slide.id !== slideId) return slide
        const element = slide.elements.find(el => el.id === elementId)
        if (!element) return slide
        const nextLower = slide.elements
          .filter(el => el.zIndex < element.zIndex)
          .sort((a, b) => b.zIndex - a.zIndex)[0]
        if (!nextLower) return slide
        return {
          ...slide,
          elements: slide.elements.map(el => {
            if (el.id === elementId) return { ...el, zIndex: nextLower.zIndex }
            if (el.id === nextLower.id) return { ...el, zIndex: element.zIndex }
            return el
          }),
        }
      }),
    }), 'Send backward')
  }, [updatePresentation])

  const value: PresentationContextValue = {
    presentation,
    isLoading,
    isDirty,
    error,
    lastSaved,
    createNewPresentation,
    loadPresentation,
    updatePresentationMeta,
    setTheme,
    setPresentationName,
    addSlide,
    deleteSlide,
    duplicateSlide,
    reorderSlides,
    updateSlide,
    updateSlideBackground,
    addElement,
    updateElement,
    deleteElements,
    duplicateElements,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    requestSave,
  }

  return (
    <PresentationContext.Provider value={value}>
      {children}
    </PresentationContext.Provider>
  )
}

export function usePresentation() {
  const context = useContext(PresentationContext)
  if (!context) {
    throw new Error('usePresentation must be used within a PresentationProvider')
  }
  return context
}
