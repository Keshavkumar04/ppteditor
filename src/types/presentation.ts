import { Slide } from './slide'

export interface Presentation {
  id: string
  name: string
  createdAt: Date
  updatedAt: Date
  slides: Slide[]
  theme: PresentationTheme
  metadata: PresentationMetadata
}

export interface PresentationMetadata {
  author?: string
  title?: string
  subject?: string
  company?: string
  revision?: number
}

export interface PresentationTheme {
  id: string
  name: string
  colorScheme: ColorScheme
  fontScheme: FontScheme
  defaultBackground: Background
}

export interface ColorScheme {
  // Primary text/object colors (Office standard)
  dark1: string
  light1: string
  dark2: string
  light2: string
  // Accent colors
  accent1: string
  accent2: string
  accent3: string
  accent4: string
  accent5: string
  accent6: string
  // Links
  hyperlink: string
  followedHyperlink: string
  // Semantic aliases (for convenience)
  background1: string
  text1: string
  background2: string
  text2: string
}

export interface FontScheme {
  majorFont: FontDefinition
  minorFont: FontDefinition
}

export interface FontDefinition {
  latin: string
  eastAsian?: string
  complexScript?: string
}

export interface Background {
  type: 'solid' | 'gradient' | 'image' | 'pattern'
  color?: string
  gradient?: GradientFill
  imageUrl?: string
  imageFit?: 'cover' | 'contain' | 'stretch' | 'tile'
}

export interface GradientFill {
  type: 'linear' | 'radial'
  angle?: number
  stops: GradientStop[]
}

export interface GradientStop {
  position: number
  color: string
}

// Default theme for new presentations
export const DEFAULT_THEME: PresentationTheme = {
  id: 'default',
  name: 'Default',
  colorScheme: {
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
  },
  fontScheme: {
    majorFont: { latin: 'Calibri Light' },
    minorFont: { latin: 'Calibri' },
  },
  defaultBackground: {
    type: 'solid',
    color: '#FFFFFF',
  },
}

// Default metadata
export const DEFAULT_METADATA: PresentationMetadata = {
  author: '',
  title: 'Untitled Presentation',
  subject: '',
  company: '',
  revision: 1,
}
