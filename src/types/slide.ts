import { Background, GradientFill } from './presentation'

export interface Slide {
  id: string
  order: number
  elements: SlideElement[]
  background: Background
  layoutId?: string
  masterSlideId?: string
  notes?: string
  transition?: SlideTransition
  hidden?: boolean
}

export interface SlideTransition {
  type: 'none' | 'fade' | 'push' | 'wipe' | 'split' | 'reveal'
  duration: number
  direction?: 'left' | 'right' | 'up' | 'down'
}

// Element types
export type SlideElement =
  | TextElement
  | ShapeElement
  | ImageElement
  | TableElement
  | GroupElement

export type ElementType = 'text' | 'shape' | 'image' | 'table' | 'group'

export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface BaseElement {
  id: string
  type: ElementType
  position: Position
  size: Size
  rotation?: number
  opacity?: number
  locked?: boolean
  zIndex: number
  name?: string
}

// Text Element
export interface TextElement extends BaseElement {
  type: 'text'
  content: TextContent
  style: TextBoxStyle
}

export interface TextContent {
  paragraphs: Paragraph[]
}

export interface Paragraph {
  id: string
  runs: TextRun[]
  alignment: 'left' | 'center' | 'right' | 'justify'
  lineSpacing?: number
  spaceBefore?: number
  spaceAfter?: number
  bulletType?: 'none' | 'bullet' | 'number'
  bulletChar?: string
  indentLevel?: number
}

export interface TextRun {
  id: string
  text: string
  style: TextStyle
}

export interface TextStyle {
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold' | number
  fontStyle: 'normal' | 'italic'
  textDecoration?: 'none' | 'underline' | 'line-through'
  color: string
  backgroundColor?: string
  letterSpacing?: number
  textShadow?: TextShadow
}

export interface TextShadow {
  offsetX: number
  offsetY: number
  blur: number
  color: string
}

export interface TextBoxStyle {
  padding: Padding
  verticalAlign: 'top' | 'middle' | 'bottom'
  autoFit: boolean
  wordWrap: boolean
  fill?: Fill
  stroke?: Stroke
}

export interface Padding {
  top: number
  right: number
  bottom: number
  left: number
}

// Shape Element
export interface ShapeElement extends BaseElement {
  type: 'shape'
  shapeType: ShapeType
  fill?: Fill
  stroke?: Stroke
  shadow?: Shadow
  text?: TextContent
}

export type ShapeType =
  | 'rectangle'
  | 'roundedRectangle'
  | 'ellipse'
  | 'triangle'
  | 'rightTriangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'star5'
  | 'star6'
  | 'arrow'
  | 'arrowLeft'
  | 'arrowRight'
  | 'arrowUp'
  | 'arrowDown'
  | 'line'
  | 'callout'
  | 'cloud'
  | 'heart'
  | 'lightning'
  | 'plus'
  | 'minus'
  | 'custom'

export interface Fill {
  type: 'none' | 'solid' | 'gradient' | 'pattern' | 'image'
  color?: string
  gradient?: GradientFill
  imageUrl?: string
  patternType?: string
}

export interface Stroke {
  color: string
  width: number
  style: 'solid' | 'dashed' | 'dotted' | 'none'
  dashArray?: number[]
  lineCap?: 'butt' | 'round' | 'square'
  lineJoin?: 'miter' | 'round' | 'bevel'
}

export interface Shadow {
  offsetX: number
  offsetY: number
  blur: number
  spread?: number
  color: string
  opacity?: number
}

// Image Element
export interface ImageElement extends BaseElement {
  type: 'image'
  src: string
  alt?: string
  originalSize?: Size
  crop?: ImageCrop
  filters?: ImageFilters
  stroke?: Stroke
  shadow?: Shadow
}

export interface ImageCrop {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ImageFilters {
  brightness?: number
  contrast?: number
  saturation?: number
  blur?: number
  grayscale?: number
  sepia?: number
  opacity?: number
}

// Table Element
export interface TableElement extends BaseElement {
  type: 'table'
  rows: number
  columns: number
  cells: TableCell[][]
  columnWidths: number[]
  rowHeights: number[]
  style: TableStyle
}

export interface TableCell {
  id: string
  content: TextContent
  rowSpan?: number
  colSpan?: number
  fill?: Fill
  borders?: CellBorders
  padding?: Padding
  verticalAlign?: 'top' | 'middle' | 'bottom'
  // Extended cell content types
  contentType?: 'text' | 'image' | 'checkbox'
  imageUrl?: string
  imageFit?: 'cover' | 'contain' | 'stretch'
  checked?: boolean
}

export interface CellBorders {
  top?: Stroke
  right?: Stroke
  bottom?: Stroke
  left?: Stroke
}

export interface TableStyle {
  borderCollapse: boolean
  defaultCellFill?: Fill
  headerRowFill?: Fill
  alternateRowFill?: Fill
  firstColumnFill?: Fill
  lastColumnFill?: Fill
}

// Group Element
export interface GroupElement extends BaseElement {
  type: 'group'
  children: SlideElement[]
}

// Default values
export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'Calibri',
  fontSize: 18,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  color: '#000000',
}

export const DEFAULT_TEXTBOX_STYLE: TextBoxStyle = {
  padding: { top: 5, right: 10, bottom: 5, left: 10 },
  verticalAlign: 'top',
  autoFit: false,
  wordWrap: true,
}

export const DEFAULT_FILL: Fill = {
  type: 'solid',
  color: '#4472C4',
}

export const DEFAULT_STROKE: Stroke = {
  color: '#2F528F',
  width: 1,
  style: 'solid',
}

export const DEFAULT_BACKGROUND: Background = {
  type: 'solid',
  color: '#FFFFFF',
}
