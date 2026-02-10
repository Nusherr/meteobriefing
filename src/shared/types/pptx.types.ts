import type { BriefingTemplate } from './template.types'

export interface ResolvedChart {
  slotId: string
  slideId: string
  imagePath: string
  title: string
}

export interface BriefingDefinition {
  template: BriefingTemplate
  resolvedCharts: ResolvedChart[]
  outputPath: string
}

export interface GenerationProgress {
  phase: 'downloading' | 'composing' | 'writing'
  current: number
  total: number
  message: string
}
