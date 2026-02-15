import { ForwardRefExoticComponent } from 'react';
import { RefAttributes } from 'react';

export declare interface Background {
    type: 'solid' | 'gradient' | 'image' | 'pattern';
    color?: string;
    gradient?: GradientFill;
    imageUrl?: string;
    imageFit?: 'cover' | 'contain' | 'stretch' | 'tile';
}

export declare interface BaseElement {
    id: string;
    type: ElementType;
    position: Position;
    size: Size;
    rotation?: number;
    opacity?: number;
    locked?: boolean;
    zIndex: number;
    name?: string;
}

export declare const BUILT_IN_THEMES: PresentationTheme[];

export declare interface CellBorders {
    top?: Stroke;
    right?: Stroke;
    bottom?: Stroke;
    left?: Stroke;
}

export declare interface ClipboardState {
    elements: SlideElement[];
    sourceSlideId: string;
}

export declare interface ColorScheme {
    dark1: string;
    light1: string;
    dark2: string;
    light2: string;
    accent1: string;
    accent2: string;
    accent3: string;
    accent4: string;
    accent5: string;
    accent6: string;
    hyperlink: string;
    followedHyperlink: string;
    background1: string;
    text1: string;
    background2: string;
    text2: string;
}

/**
 * Create a new theme with default values
 */
export declare function createNewTheme(name?: string): PresentationTheme;

export declare const DEFAULT_BACKGROUND: Background;

export declare const DEFAULT_EDITOR_STATE: EditorState;

export declare const DEFAULT_FILL: Fill;

export declare const DEFAULT_METADATA: PresentationMetadata;

export declare const DEFAULT_SELECTION_STATE: SelectionState;

export declare const DEFAULT_STROKE: Stroke;

export declare const DEFAULT_TEXT_STYLE: TextStyle;

export declare const DEFAULT_TEXTBOX_STYLE: TextBoxStyle;

export declare const DEFAULT_THEME: PresentationTheme;

/**
 * Download the exported PPTX file
 */
export declare function downloadPptx(blob: Blob, filename: string): void;

export declare interface EditorState {
    zoom: number;
    currentSlideId: string | null;
    viewMode: 'edit' | 'preview' | 'slideshow';
    activeTool: EditorTool;
    gridEnabled: boolean;
    guidesEnabled: boolean;
    snapToGrid: boolean;
    snapToGuides: boolean;
    panelVisibility: PanelVisibility;
}

export declare type EditorTool = 'select' | 'text' | 'shape' | 'image' | 'table' | 'pan' | 'zoom';

export declare type ElementType = 'text' | 'shape' | 'image' | 'table' | 'group';

/**
 * Quick export and download
 */
export declare function exportAndDownload(presentation: Presentation, onProgress?: (progress: ExportProgress) => void): Promise<ExportResult>;

/**
 * Export a presentation to PPTX format
 */
export declare function exportPptx(presentation: Presentation, onProgress?: (progress: ExportProgress) => void): Promise<ExportResult>;

export declare interface ExportProgress {
    stage: 'preparing' | 'slides' | 'finalizing' | 'complete';
    current: number;
    total: number;
    message: string;
}

export declare interface ExportResult {
    success: boolean;
    blob?: Blob;
    error?: string;
}

export declare interface Fill {
    type: 'none' | 'solid' | 'gradient' | 'pattern' | 'image';
    color?: string;
    gradient?: GradientFill;
    imageUrl?: string;
    patternType?: string;
}

export declare interface FontDefinition {
    latin: string;
    eastAsian?: string;
    complexScript?: string;
}

export declare interface FontScheme {
    majorFont: FontDefinition;
    minorFont: FontDefinition;
}

/**
 * Get file size in human-readable format
 */
export declare function formatFileSize(bytes: number): string;

/**
 * Generate a unique ID for elements, slides, etc.
 */
export declare function generateId(): string;

export declare interface GradientFill {
    type: 'linear' | 'radial';
    angle?: number;
    stops: GradientStop[];
}

export declare interface GradientStop {
    position: number;
    color: string;
}

export declare interface GroupElement extends BaseElement {
    type: 'group';
    children: SlideElement[];
}

export declare interface HistoryEntry {
    id: string;
    timestamp: Date;
    action: string;
    previousState: Partial<Presentation>;
    nextState: Partial<Presentation>;
}

export declare interface HistoryState {
    undoStack: HistoryEntry[];
    redoStack: HistoryEntry[];
    maxStackSize: number;
}

export declare interface ImageCrop {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export declare interface ImageElement extends BaseElement {
    type: 'image';
    src: string;
    alt?: string;
    originalSize?: Size;
    crop?: ImageCrop;
    filters?: ImageFilters;
    stroke?: Stroke;
    shadow?: Shadow;
    clipShape?: 'ellipse' | 'rectangle';
}

export declare interface ImageFilters {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    blur?: number;
    grayscale?: number;
    sepia?: number;
    opacity?: number;
}

/**
 * Import a PPTX file and convert it to our Presentation format
 */
export declare function importPptx(file: File, onProgress?: (progress: ImportProgress) => void): Promise<ImportResult>;

export declare interface ImportProgress {
    stage: 'loading' | 'parsing-theme' | 'extracting-images' | 'parsing-slides' | 'complete';
    current: number;
    total: number;
    message: string;
}

export declare interface ImportResult {
    success: boolean;
    presentation?: Presentation;
    error?: string;
}

/**
 * Check if a file is a valid PPTX or PPTM
 */
export declare function isPptxFile(file: File): boolean;

export declare const MAX_ZOOM = 4;

export declare const MIN_ZOOM = 0.1;

export declare interface Padding {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export declare interface PanelVisibility {
    leftSidebar: boolean;
    rightSidebar: boolean;
    toolbar: boolean;
    statusBar: boolean;
}

export declare interface Paragraph {
    id: string;
    runs: TextRun[];
    alignment: 'left' | 'center' | 'right' | 'justify';
    lineSpacing?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    bulletType?: 'none' | 'bullet' | 'number';
    bulletChar?: string;
    indentLevel?: number;
}

export declare interface Position {
    x: number;
    y: number;
}

export declare interface Presentation {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    slides: Slide[];
    theme: PresentationTheme;
    metadata: PresentationMetadata;
}

export declare const PresentationEditor: ForwardRefExoticComponent<PresentationEditorProps & RefAttributes<PresentationEditorHandle>>;

/**
 * Imperative handle exposed via ref on PresentationEditor.
 * Allows programmatic manipulation from outside the component.
 */
export declare interface PresentationEditorHandle {
    /** Insert a text box with plain text content on the current slide.
     *  If a text box is actively being edited, appends to it instead. */
    insertTextBox: (text: string) => void;
    /** Insert a text box with HTML content (parsed into styled paragraphs/runs).
     *  If a text box is actively being edited, appends to it instead. */
    insertHtmlTextBox: (html: string) => void;
    /** Insert HTML content as proper slide elements (text → TextElement, table → TableElement).
     *  Text portions are appended to the active text box if one is being edited.
     *  Tables always create new elements. */
    insertHtmlContent: (html: string) => void;
}

export declare interface PresentationEditorProps {
    data?: Presentation | null;
    initialData?: Presentation | null;
    onChange?: (data: Presentation) => void;
    onSave?: (data: Presentation) => void;
    onDirtyChange?: (isDirty: boolean) => void;
    onExport?: (blob: Blob, filename: string) => void;
    onImport?: (data: Presentation) => void;
    panels?: {
        header?: boolean;
        leftSidebar?: boolean;
        rightSidebar?: boolean;
        toolbar?: boolean;
        statusBar?: boolean;
    };
    customThemes?: PresentationTheme[];
    onThemeChange?: (themes: PresentationTheme[]) => void;
    initialZoom?: number;
    maxHistorySize?: number;
    readOnly?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

export declare interface PresentationMetadata {
    author?: string;
    title?: string;
    subject?: string;
    company?: string;
    revision?: number;
}

export declare interface PresentationTheme {
    id: string;
    name: string;
    colorScheme: ColorScheme;
    fontScheme: FontScheme;
    defaultBackground: Background;
}

export declare type ResizeHandle = 'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left' | 'rotate';

export declare interface SelectionBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

export declare interface SelectionState {
    selectedElementIds: string[];
    selectionBounds: SelectionBounds | null;
    isMultiSelect: boolean;
    isDragging: boolean;
    isResizing: boolean;
    resizeHandle: ResizeHandle | null;
    isRotating: boolean;
}

export declare interface Shadow {
    offsetX: number;
    offsetY: number;
    blur: number;
    spread?: number;
    color: string;
    opacity?: number;
}

export declare interface ShapeElement extends BaseElement {
    type: 'shape';
    shapeType: ShapeType;
    fill?: Fill;
    stroke?: Stroke;
    shadow?: Shadow;
    text?: TextContent;
}

export declare type ShapeType = 'rectangle' | 'roundedRectangle' | 'ellipse' | 'triangle' | 'rightTriangle' | 'diamond' | 'pentagon' | 'hexagon' | 'octagon' | 'star5' | 'star6' | 'arrow' | 'arrowLeft' | 'arrowRight' | 'arrowUp' | 'arrowDown' | 'line' | 'callout' | 'cloud' | 'heart' | 'lightning' | 'plus' | 'minus' | 'custom';

export declare interface Size {
    width: number;
    height: number;
}

export declare interface Slide {
    id: string;
    order: number;
    elements: SlideElement[];
    background: Background;
    layoutId?: string;
    masterSlideId?: string;
    notes?: string;
    transition?: SlideTransition;
    hidden?: boolean;
}

export declare const SLIDE_HEIGHT = 540;

export declare const SLIDE_WIDTH = 960;

export declare type SlideElement = TextElement | ShapeElement | ImageElement | TableElement | GroupElement;

export declare interface SlideTransition {
    type: 'none' | 'fade' | 'push' | 'wipe' | 'split' | 'reveal';
    duration: number;
    direction?: 'left' | 'right' | 'up' | 'down';
}

export declare interface Stroke {
    color: string;
    width: number;
    style: 'solid' | 'dashed' | 'dotted' | 'none';
    dashArray?: number[];
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
}

export declare interface TableCell {
    id: string;
    content: TextContent;
    rowSpan?: number;
    colSpan?: number;
    fill?: Fill;
    borders?: CellBorders;
    padding?: Padding;
    verticalAlign?: 'top' | 'middle' | 'bottom';
    contentType?: 'text' | 'image' | 'checkbox';
    imageUrl?: string;
    imageFit?: 'cover' | 'contain' | 'stretch';
    checked?: boolean;
}

export declare interface TableElement extends BaseElement {
    type: 'table';
    rows: number;
    columns: number;
    cells: TableCell[][];
    columnWidths: number[];
    rowHeights: number[];
    style: TableStyle;
}

export declare interface TableStyle {
    borderCollapse: boolean;
    defaultCellFill?: Fill;
    headerRowFill?: Fill;
    alternateRowFill?: Fill;
    firstColumnFill?: Fill;
    lastColumnFill?: Fill;
}

export declare interface TextBoxStyle {
    padding: Padding;
    verticalAlign: 'top' | 'middle' | 'bottom';
    autoFit: boolean;
    wordWrap: boolean;
    fill?: Fill;
    stroke?: Stroke;
}

export declare interface TextContent {
    paragraphs: Paragraph[];
}

export declare interface TextElement extends BaseElement {
    type: 'text';
    content: TextContent;
    style: TextBoxStyle;
}

export declare interface TextRun {
    id: string;
    text: string;
    style: TextStyle;
}

export declare interface TextShadow {
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
}

export declare interface TextStyle {
    fontFamily: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold' | number;
    fontStyle: 'normal' | 'italic';
    textDecoration?: 'none' | 'underline' | 'line-through';
    color: string;
    backgroundColor?: string;
    letterSpacing?: number;
    textShadow?: TextShadow;
}

export declare const ZOOM_STEP = 0.1;

export { }
