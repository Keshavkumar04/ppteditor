import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { Presentation } from '@/types'
import { generateId } from '@/utils'

interface HistoryEntry {
  id: string
  timestamp: Date
  action: string
  state: Presentation
}

interface HistoryContextValue {
  canUndo: boolean
  canRedo: boolean
  undoStackLength: number
  redoStackLength: number
  undo: () => Presentation | null
  redo: () => Presentation | null
  pushState: (action: string, state: Presentation) => void
  clearHistory: () => void
  getCurrentState: () => Presentation | null
}

const HistoryContext = createContext<HistoryContextValue | null>(null)

interface HistoryProviderProps {
  children: React.ReactNode
  maxStackSize?: number
}

export function HistoryProvider({ children, maxStackSize = 50 }: HistoryProviderProps) {
  const [undoStack, setUndoStack] = useState<HistoryEntry[]>([])
  const [redoStack, setRedoStack] = useState<HistoryEntry[]>([])
  const currentStateRef = useRef<Presentation | null>(null)

  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  const pushState = useCallback((action: string, state: Presentation) => {
    const entry: HistoryEntry = {
      id: generateId(),
      timestamp: new Date(),
      action,
      state: JSON.parse(JSON.stringify(state)), // Deep clone
    }

    // If there's a current state, push it to undo stack
    if (currentStateRef.current) {
      setUndoStack(prev => {
        const newStack = [...prev, {
          id: generateId(),
          timestamp: new Date(),
          action,
          state: JSON.parse(JSON.stringify(currentStateRef.current)),
        }]
        // Limit stack size
        if (newStack.length > maxStackSize) {
          return newStack.slice(-maxStackSize)
        }
        return newStack
      })
    }

    // Clear redo stack when new action is performed
    setRedoStack([])

    // Update current state reference
    currentStateRef.current = entry.state
  }, [maxStackSize])

  const undo = useCallback((): Presentation | null => {
    if (undoStack.length === 0) return null

    const lastEntry = undoStack[undoStack.length - 1]

    // Push current state to redo stack
    if (currentStateRef.current) {
      setRedoStack(prev => [...prev, {
        id: generateId(),
        timestamp: new Date(),
        action: 'redo',
        state: JSON.parse(JSON.stringify(currentStateRef.current)),
      }])
    }

    // Pop from undo stack
    setUndoStack(prev => prev.slice(0, -1))

    // Update current state
    currentStateRef.current = lastEntry.state

    return lastEntry.state
  }, [undoStack])

  const redo = useCallback((): Presentation | null => {
    if (redoStack.length === 0) return null

    const lastEntry = redoStack[redoStack.length - 1]

    // Push current state to undo stack
    if (currentStateRef.current) {
      setUndoStack(prev => [...prev, {
        id: generateId(),
        timestamp: new Date(),
        action: 'undo',
        state: JSON.parse(JSON.stringify(currentStateRef.current)),
      }])
    }

    // Pop from redo stack
    setRedoStack(prev => prev.slice(0, -1))

    // Update current state
    currentStateRef.current = lastEntry.state

    return lastEntry.state
  }, [redoStack])

  const clearHistory = useCallback(() => {
    setUndoStack([])
    setRedoStack([])
  }, [])

  const getCurrentState = useCallback((): Presentation | null => {
    return currentStateRef.current
  }, [])

  const value: HistoryContextValue = {
    canUndo,
    canRedo,
    undoStackLength: undoStack.length,
    redoStackLength: redoStack.length,
    undo,
    redo,
    pushState,
    clearHistory,
    getCurrentState,
  }

  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  const context = useContext(HistoryContext)
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider')
  }
  return context
}
