import { PresentationTheme, ColorScheme, FontScheme } from '@/types'
import { generateId } from '@/utils'

// Default color scheme
const defaultColorScheme: ColorScheme = {
  dark1: '#000000',
  light1: '#FFFFFF',
  dark2: '#44546A',
  light2: '#E7E6E6',
  accent1: '#4472C4',
  accent2: '#ED7D31',
  accent3: '#A5A5A5',
  accent4: '#FFC000',
  accent5: '#5B9BD5',
  accent6: '#70AD47',
  hyperlink: '#0563C1',
  followedHyperlink: '#954F72',
  background1: '#FFFFFF',
  text1: '#000000',
  background2: '#E7E6E6',
  text2: '#44546A',
}

// Dark theme color scheme
const darkColorScheme: ColorScheme = {
  dark1: '#FFFFFF',
  light1: '#1E1E1E',
  dark2: '#E0E0E0',
  light2: '#2D2D2D',
  accent1: '#5B9BD5',
  accent2: '#ED7D31',
  accent3: '#A5A5A5',
  accent4: '#FFC000',
  accent5: '#4472C4',
  accent6: '#70AD47',
  hyperlink: '#58A6FF',
  followedHyperlink: '#B392F0',
  background1: '#1E1E1E',
  text1: '#FFFFFF',
  background2: '#2D2D2D',
  text2: '#E0E0E0',
}

// Corporate color scheme
const corporateColorScheme: ColorScheme = {
  dark1: '#1C3A5E',
  light1: '#FFFFFF',
  dark2: '#1C3A5E',
  light2: '#F5F5F5',
  accent1: '#1C3A5E',
  accent2: '#4A7C59',
  accent3: '#BFB8A5',
  accent4: '#D4A84B',
  accent5: '#7C9FB0',
  accent6: '#6B4E71',
  hyperlink: '#1C3A5E',
  followedHyperlink: '#6B4E71',
  background1: '#FFFFFF',
  text1: '#1C3A5E',
  background2: '#F5F5F5',
  text2: '#1C3A5E',
}

// Creative color scheme
const creativeColorScheme: ColorScheme = {
  dark1: '#2D2D2D',
  light1: '#FFFEF9',
  dark2: '#4A4A4A',
  light2: '#FFF8E7',
  accent1: '#FF6B6B',
  accent2: '#4ECDC4',
  accent3: '#45B7D1',
  accent4: '#96CEB4',
  accent5: '#FFEAA7',
  accent6: '#DDA0DD',
  hyperlink: '#FF6B6B',
  followedHyperlink: '#4ECDC4',
  background1: '#FFFEF9',
  text1: '#2D2D2D',
  background2: '#FFF8E7',
  text2: '#4A4A4A',
}

// Minimal color scheme
const minimalColorScheme: ColorScheme = {
  dark1: '#222222',
  light1: '#FAFAFA',
  dark2: '#555555',
  light2: '#EEEEEE',
  accent1: '#222222',
  accent2: '#666666',
  accent3: '#999999',
  accent4: '#CCCCCC',
  accent5: '#444444',
  accent6: '#888888',
  hyperlink: '#222222',
  followedHyperlink: '#666666',
  background1: '#FAFAFA',
  text1: '#222222',
  background2: '#EEEEEE',
  text2: '#555555',
}

// Font schemes
const defaultFontScheme: FontScheme = {
  majorFont: { latin: 'Calibri Light' },
  minorFont: { latin: 'Calibri' },
}

const corporateFontScheme: FontScheme = {
  majorFont: { latin: 'Georgia' },
  minorFont: { latin: 'Arial' },
}

const creativeFontScheme: FontScheme = {
  majorFont: { latin: 'Playfair Display' },
  minorFont: { latin: 'Open Sans' },
}

const minimalFontScheme: FontScheme = {
  majorFont: { latin: 'Helvetica' },
  minorFont: { latin: 'Helvetica' },
}

// Built-in themes
export const BUILT_IN_THEMES: PresentationTheme[] = [
  {
    id: 'default',
    name: 'Default',
    colorScheme: defaultColorScheme,
    fontScheme: defaultFontScheme,
    defaultBackground: { type: 'solid', color: '#FFFFFF' },
  },
  {
    id: 'dark',
    name: 'Dark',
    colorScheme: darkColorScheme,
    fontScheme: defaultFontScheme,
    defaultBackground: { type: 'solid', color: '#1E1E1E' },
  },
  {
    id: 'corporate',
    name: 'Corporate',
    colorScheme: corporateColorScheme,
    fontScheme: corporateFontScheme,
    defaultBackground: { type: 'solid', color: '#FFFFFF' },
  },
  {
    id: 'creative',
    name: 'Creative',
    colorScheme: creativeColorScheme,
    fontScheme: creativeFontScheme,
    defaultBackground: { type: 'solid', color: '#FFFEF9' },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    colorScheme: minimalColorScheme,
    fontScheme: minimalFontScheme,
    defaultBackground: { type: 'solid', color: '#FAFAFA' },
  },
]

/**
 * Create a new theme with default values
 */
export function createNewTheme(name: string = 'New Theme'): PresentationTheme {
  return {
    id: generateId(),
    name,
    colorScheme: { ...defaultColorScheme },
    fontScheme: { ...defaultFontScheme },
    defaultBackground: { type: 'solid', color: '#FFFFFF' },
  }
}
