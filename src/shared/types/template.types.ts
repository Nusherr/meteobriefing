export type LayoutType = 'SINGLE' | 'ROW_2' | 'ROW_3' | 'COLUMN_2' | 'GRID_2x2' | 'GRID_3x2' | 'CUSTOM'

export interface LayoutPosition {
  x: number
  y: number
  w: number
  h: number
}

export type StepSelector =
  | { type: 'fixed'; stepIndex: number }
  | { type: 'label'; label: string }
  | { type: 'relative'; offset: number }

export interface ChartReference {
  productId: string
  productName: string
  productType: string
  category: string
  type: string
  area: string
  stepSelector: StepSelector
  imageUrl: string
}

export interface ChartSlot {
  id: string
  slotIndex: number
  chartRef: ChartReference
  titleOverride?: string
  titleVisible: boolean
}

export interface SlideDefinition {
  id: string
  order: number
  layout: LayoutType
  title?: string
  chartSlots: ChartSlot[]
}

export interface PptxOptions {
  slideSize: 'LAYOUT_WIDE' | 'LAYOUT_16x9' | 'LAYOUT_4x3'
  titleFontSize: number
  titleFontFace: string
  titleColor: string
  backgroundColor: string
  showSlideNumbers: boolean
  showDateStamp: boolean
  headerText?: string
  footerText?: string
}

export interface SavedSearchBlock {
  id: string
  productType: string
  lockedProductId?: string
  lockedProductName?: string
}

// ── Briefing Style (cover slide + chart slide styling) ──

export type BriefingStyleMode = 'builtin' | 'custom'

/** Built-in cover slide settings */
export interface CoverSlideStyle {
  enabled: boolean
  title: string
  titleColor: string
  titleFontSize: number
  showDate: boolean
  dateFormat: 'dd/mm/yyyy'
  dateColor: string
  dateFontSize: number
  backgroundColor: string
  backgroundImagePath?: string
}

/** Built-in chart slide header bar + tricolore */
export interface ChartSlideStyle {
  headerBarColor: string
  titleColor: string
  titleFontSize: number
  tricoloreEnabled: boolean
  tricoloreHeight: number
  logoLeftPath?: string
  logoRightPath?: string
}

/** Custom PPTX template settings (advanced mode) */
export interface CustomPptxTemplate {
  coverTemplatePath?: string
  chartTemplatePath?: string
  placeholderValues: Record<string, string>
  placeholderColors: Record<string, string>
}

export interface BriefingStyle {
  mode: BriefingStyleMode
  cover: CoverSlideStyle
  chartSlide: ChartSlideStyle
  custom: CustomPptxTemplate
}

export const DEFAULT_BRIEFING_STYLE: BriefingStyle = {
  mode: 'builtin',
  cover: {
    enabled: true,
    title: '',
    titleColor: 'FFFFFF',
    titleFontSize: 44,
    showDate: true,
    dateFormat: 'dd/mm/yyyy',
    dateColor: 'FFFFFF',
    dateFontSize: 24,
    backgroundColor: '1E293B',
    backgroundImagePath: undefined
  },
  chartSlide: {
    headerBarColor: '003366',
    titleColor: 'FFFFFF',
    titleFontSize: 20,
    tricoloreEnabled: true,
    tricoloreHeight: 0.08,
    logoLeftPath: undefined,
    logoRightPath: undefined
  },
  custom: {
    coverTemplatePath: undefined,
    chartTemplatePath: undefined,
    placeholderValues: {},
    placeholderColors: {}
  }
}

export interface BriefingTemplate {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  slides: SlideDefinition[]
  pptxOptions: PptxOptions
  briefingStyle?: BriefingStyle
  searchBlocks?: SavedSearchBlock[]
}

export interface TemplateSummary {
  id: string
  name: string
  description?: string
  slideCount: number
  updatedAt: string
}

export const DEFAULT_PPTX_OPTIONS: PptxOptions = {
  slideSize: 'LAYOUT_WIDE',
  titleFontSize: 14,
  titleFontFace: 'Arial',
  titleColor: '333333',
  backgroundColor: 'FFFFFF',
  showSlideNumbers: true,
  showDateStamp: true,
  headerText: 'METEO BRIEFING'
}
