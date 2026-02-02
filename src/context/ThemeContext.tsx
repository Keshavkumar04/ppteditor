import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { PresentationTheme } from '@/types'
import { BUILT_IN_THEMES, createNewTheme } from '@/data/builtInThemes'

interface ThemeContextValue {
  // Built-in themes
  builtInThemes: PresentationTheme[]

  // Custom themes (user-created)
  customThemes: PresentationTheme[]

  // All themes combined
  allThemes: PresentationTheme[]

  // Theme operations
  saveTheme: (theme: PresentationTheme) => void
  deleteTheme: (themeId: string) => void
  getTheme: (themeId: string) => PresentationTheme | undefined
  createTheme: (name?: string) => PresentationTheme
  duplicateTheme: (themeId: string, newName?: string) => PresentationTheme | undefined
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export interface ThemeProviderProps {
  children: React.ReactNode
  customThemes?: PresentationTheme[]
  onThemeChange?: (themes: PresentationTheme[]) => void
}

export function ThemeProvider({ children, customThemes: customThemesProp, onThemeChange }: ThemeProviderProps) {
  const [customThemes, setCustomThemes] = useState<PresentationTheme[]>(customThemesProp ?? [])

  // Sync from external prop when it changes
  useEffect(() => {
    if (customThemesProp !== undefined) {
      setCustomThemes(customThemesProp)
    }
  }, [customThemesProp])

  // Combine built-in and custom themes
  const allThemes = [...BUILT_IN_THEMES, ...customThemes]

  // Save or update a theme
  const saveTheme = useCallback((theme: PresentationTheme) => {
    setCustomThemes(prev => {
      // Check if this is an update to an existing custom theme
      const existingIndex = prev.findIndex(t => t.id === theme.id)

      let updated: PresentationTheme[]
      if (existingIndex >= 0) {
        // Update existing theme
        updated = [...prev]
        updated[existingIndex] = theme
      } else if (BUILT_IN_THEMES.some(t => t.id === theme.id)) {
        // If trying to save a built-in theme, create a copy with new ID
        updated = [...prev, { ...theme, id: `custom_${Date.now()}` }]
      } else {
        updated = [...prev, theme]
      }

      onThemeChange?.(updated)
      return updated
    })
  }, [onThemeChange])

  // Delete a custom theme
  const deleteTheme = useCallback((themeId: string) => {
    // Can't delete built-in themes
    if (BUILT_IN_THEMES.some(t => t.id === themeId)) {
      console.warn('Cannot delete built-in theme')
      return
    }

    setCustomThemes(prev => {
      const updated = prev.filter(t => t.id !== themeId)
      onThemeChange?.(updated)
      return updated
    })
  }, [onThemeChange])

  // Get a theme by ID
  const getTheme = useCallback((themeId: string): PresentationTheme | undefined => {
    return allThemes.find(t => t.id === themeId)
  }, [allThemes])

  // Create a new theme
  const createTheme = useCallback((name?: string): PresentationTheme => {
    return createNewTheme(name)
  }, [])

  // Duplicate an existing theme
  const duplicateTheme = useCallback((themeId: string, newName?: string): PresentationTheme | undefined => {
    const sourceTheme = getTheme(themeId)
    if (!sourceTheme) return undefined

    const duplicated: PresentationTheme = {
      ...sourceTheme,
      id: `custom_${Date.now()}`,
      name: newName || `${sourceTheme.name} (Copy)`,
      colorScheme: { ...sourceTheme.colorScheme },
      fontScheme: {
        majorFont: { ...sourceTheme.fontScheme.majorFont },
        minorFont: { ...sourceTheme.fontScheme.minorFont },
      },
      defaultBackground: { ...sourceTheme.defaultBackground },
    }

    return duplicated
  }, [getTheme])

  const value: ThemeContextValue = {
    builtInThemes: BUILT_IN_THEMES,
    customThemes,
    allThemes,
    saveTheme,
    deleteTheme,
    getTheme,
    createTheme,
    duplicateTheme,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemes() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useThemes must be used within a ThemeProvider')
  }
  return context
}
