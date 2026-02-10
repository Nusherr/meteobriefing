import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  BriefingTemplate,
  TemplateSummary,
  SlideDefinition,
  ChartSlot,
  LayoutType,
  BriefingStyle
} from '@shared/types'
import { DEFAULT_PPTX_OPTIONS, DEFAULT_BRIEFING_STYLE } from '@shared/types'

// ── Types ──────────────────────────────────────────────

/** A chart assigned to a slide, with visual info for the composer */
export interface AssignedChart {
  id: string
  slideId: string
  slotIndex: number
  productId: string
  productName: string
  productType: string
  stepLabel: string
  stepIndex: number
  imageUrl: string
  /** true when the step label was not found during a refresh (product not yet available) */
  stale?: boolean
}

/** Cached product data for a locked search block */
export interface LockedProductData {
  productId: string
  productName: string
  steps: { label: string; index: number; imageUrl: string }[]
}

/** A search block in the left panel */
export interface SearchBlock {
  id: string
  productType: string
  lockedProduct: LockedProductData | null
}

/** A slide in the composer */
export interface ComposerSlide {
  id: string
  order: number
  title: string
  charts: AssignedChart[]
}

// ── Auto-layout helper ─────────────────────────────────

function autoLayout(chartCount: number): LayoutType {
  if (chartCount <= 1) return 'SINGLE'
  if (chartCount === 2) return 'ROW_2'
  if (chartCount === 3) return 'ROW_3'
  if (chartCount === 4) return 'GRID_2x2'
  return 'GRID_3x2' // 5-6
}

// ── Store ──────────────────────────────────────────────

interface TemplateState {
  // Template list
  templateList: TemplateSummary[]
  isLoadingList: boolean

  // Active template (working document)
  activeTemplate: BriefingTemplate | null
  isDirty: boolean

  // Composer state
  slides: ComposerSlide[]
  selectedSlideId: string | null
  searchBlocks: SearchBlock[]

  // Briefing style
  briefingStyle: BriefingStyle

  // Template actions
  fetchTemplateList: () => Promise<void>
  loadTemplate: (id: string) => Promise<void>
  loadLastTemplate: () => Promise<void>
  createNewTemplate: (name: string) => void
  saveActiveTemplate: () => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  setActiveTemplateName: (name: string) => void
  setBriefingStyle: (style: Partial<BriefingStyle>) => void
  updateCoverStyle: (cover: Partial<BriefingStyle['cover']>) => void
  updateChartSlideStyle: (chartSlide: Partial<BriefingStyle['chartSlide']>) => void

  // Slide actions
  addSlide: () => void
  removeSlide: (slideId: string) => void
  setSlideTitle: (slideId: string, title: string) => void
  selectSlide: (slideId: string) => void
  reorderSlides: (fromIndex: number, toIndex: number) => void

  // Chart assignment actions
  assignChartToSlide: (
    slideId: string,
    chart: Omit<AssignedChart, 'id' | 'slideId' | 'slotIndex'>
  ) => void
  removeChartFromSlide: (slideId: string, chartId: string) => void
  moveChart: (chartId: string, fromSlideId: string, toSlideId: string) => void

  // Search block actions
  addSearchBlock: (productType?: string) => void
  removeSearchBlock: (blockId: string) => void
  reorderSearchBlocks: (fromIndex: number, toIndex: number) => void
  setSearchBlockType: (blockId: string, productType: string) => void
  setSearchBlockLock: (blockId: string, lockedProduct: LockedProductData | null) => void

  // Refresh action: re-resolve chart imageUrls from new steps (for next-day updates)
  refreshChartsForProduct: (
    productId: string,
    newSteps: { label: string; index: number; imageUrl: string }[]
  ) => void

  // Lightweight URL-only update: updates imageUrl for matching charts without changing labels or stale state.
  // Used during PPT generation to get fresh download URLs.
  updateChartUrls: (
    productId: string,
    newSteps: { label: string; index: number; imageUrl: string }[]
  ) => void
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  // Initial state
  templateList: [],
  isLoadingList: false,
  activeTemplate: null,
  isDirty: false,
  slides: [],
  selectedSlideId: null,
  searchBlocks: [{ id: uuidv4(), productType: 'CHARTS', lockedProduct: null }],
  briefingStyle: { ...DEFAULT_BRIEFING_STYLE },

  // ── Template list ────────────────────────────────

  fetchTemplateList: async () => {
    set({ isLoadingList: true })
    try {
      const list = await window.electronAPI.template.list()
      set({ templateList: list, isLoadingList: false })
    } catch (err) {
      console.error('Failed to fetch template list:', err)
      set({ isLoadingList: false })
    }
  },

  loadLastTemplate: async () => {
    const lastId = localStorage.getItem('meteobriefing:lastTemplateId')
    if (lastId) {
      await get().loadTemplate(lastId)
    }
  },

  loadTemplate: async (id: string) => {
    try {
      const template = await window.electronAPI.template.load(id)
      if (!template) {
        console.error('Template not found:', id)
        return
      }

      // Convert BriefingTemplate slides to ComposerSlides
      const slides: ComposerSlide[] = template.slides.map((sd: SlideDefinition) => ({
        id: sd.id,
        order: sd.order,
        title: sd.title || '',
        charts: sd.chartSlots.map((slot: ChartSlot) => {
          // Extract step info from the selector
          const sel = slot.chartRef.stepSelector
          let stepLabel = slot.titleOverride || ''
          let stepIndex = 0
          if (sel.type === 'fixed') {
            stepIndex = sel.stepIndex
          } else if (sel.type === 'label') {
            stepLabel = stepLabel || sel.label
            // Legacy 'label' format doesn't store stepIndex — will be 0
            // The auto-refetch will resolve it by matching the label
          }

          return {
            id: slot.id,
            slideId: sd.id,
            slotIndex: slot.slotIndex,
            productId: slot.chartRef.productId || '',
            productName: slot.chartRef.productName,
            productType: slot.chartRef.productType,
            stepLabel,
            stepIndex,
            imageUrl: slot.chartRef.imageUrl || ''
          }
        })
      }))

      // Restore search blocks (or create default)
      // If a search block had a locked product, restore its id/name (steps will be re-fetched)
      const searchBlocks: SearchBlock[] =
        template.searchBlocks && template.searchBlocks.length > 0
          ? template.searchBlocks.map((sb) => ({
              id: sb.id,
              productType: sb.productType,
              lockedProduct: sb.lockedProductId
                ? { productId: sb.lockedProductId, productName: sb.lockedProductName || '', steps: [] }
                : null
            }))
          : [{ id: uuidv4(), productType: 'CHARTS', lockedProduct: null }]

      localStorage.setItem('meteobriefing:lastTemplateId', id)

      // Restore briefing style or use defaults (deep merge to handle new fields)
      const saved = template.briefingStyle
      const briefingStyle: BriefingStyle = saved
        ? {
            ...DEFAULT_BRIEFING_STYLE,
            ...saved,
            cover: { ...DEFAULT_BRIEFING_STYLE.cover, ...saved.cover },
            chartSlide: { ...DEFAULT_BRIEFING_STYLE.chartSlide, ...saved.chartSlide },
            custom: { ...DEFAULT_BRIEFING_STYLE.custom, ...saved.custom }
          }
        : { ...DEFAULT_BRIEFING_STYLE }

      set({
        activeTemplate: template,
        slides,
        selectedSlideId: slides.length > 0 ? slides[0].id : null,
        isDirty: false,
        searchBlocks,
        briefingStyle
      })
    } catch (err) {
      console.error('Failed to load template:', err)
    }
  },

  createNewTemplate: (name: string) => {
    const id = uuidv4()
    const now = new Date().toISOString()
    const firstSlideId = uuidv4()
    const defaultSearchBlocks = [{ id: uuidv4(), productType: 'CHARTS' }]

    const template: BriefingTemplate = {
      id,
      name,
      createdAt: now,
      updatedAt: now,
      slides: [],
      pptxOptions: { ...DEFAULT_PPTX_OPTIONS },
      briefingStyle: { ...DEFAULT_BRIEFING_STYLE },
      searchBlocks: defaultSearchBlocks
    }

    const firstSlide: ComposerSlide = {
      id: firstSlideId,
      order: 0,
      title: 'Slide 1',
      charts: []
    }

    set({
      activeTemplate: template,
      slides: [firstSlide],
      briefingStyle: { ...DEFAULT_BRIEFING_STYLE },
      selectedSlideId: firstSlideId,
      isDirty: false,
      searchBlocks: defaultSearchBlocks
    })

    // Auto-save to disk immediately + remember as last used
    window.electronAPI.template.save(template).then(() => {
      localStorage.setItem('meteobriefing:lastTemplateId', id)
      get().fetchTemplateList()
    }).catch((err) => console.error('Auto-save failed:', err))
  },

  saveActiveTemplate: async () => {
    const { activeTemplate, slides, searchBlocks, briefingStyle } = get()
    if (!activeTemplate) return

    // Convert ComposerSlides back to BriefingTemplate format
    const templateToSave: BriefingTemplate = {
      ...activeTemplate,
      updatedAt: new Date().toISOString(),
      briefingStyle,
      searchBlocks: searchBlocks.map((sb) => ({
        id: sb.id,
        productType: sb.productType,
        lockedProductId: sb.lockedProduct?.productId,
        lockedProductName: sb.lockedProduct?.productName
      })),
      slides: slides.map((cs) => ({
        id: cs.id,
        order: cs.order,
        layout: autoLayout(cs.charts.length),
        title: cs.title,
        chartSlots: cs.charts.map((chart, idx) => ({
          id: chart.id,
          slotIndex: idx,
          chartRef: {
            productId: chart.productId,
            productName: chart.productName,
            productType: chart.productType,
            category: '',
            type: '',
            area: '',
            stepSelector: { type: 'fixed' as const, stepIndex: chart.stepIndex },
            imageUrl: chart.imageUrl
          },
          titleOverride: chart.stepLabel,
          titleVisible: true
        }))
      }))
    }

    try {
      await window.electronAPI.template.save(templateToSave)
      localStorage.setItem('meteobriefing:lastTemplateId', activeTemplate.id)
      set({ activeTemplate: templateToSave, isDirty: false })
      // Refresh list
      get().fetchTemplateList()
    } catch (err) {
      console.error('Failed to save template:', err)
    }
  },

  deleteTemplate: async (id: string) => {
    try {
      await window.electronAPI.template.delete(id)
      const { activeTemplate } = get()
      if (activeTemplate?.id === id) {
        set({
          activeTemplate: null,
          slides: [],
          selectedSlideId: null,
          isDirty: false,
          searchBlocks: [{ id: uuidv4(), productType: 'CHARTS' }]
        })
        localStorage.removeItem('meteobriefing:lastTemplateId')
      }
      get().fetchTemplateList()
    } catch (err) {
      console.error('Failed to delete template:', err)
    }
  },

  setActiveTemplateName: (name: string) => {
    const { activeTemplate } = get()
    if (!activeTemplate) return
    set({
      activeTemplate: { ...activeTemplate, name },
      isDirty: true
    })
  },

  // ── Briefing style actions ─────────────────────────

  setBriefingStyle: (partial) => {
    const { briefingStyle } = get()
    set({ briefingStyle: { ...briefingStyle, ...partial }, isDirty: true })
  },

  updateCoverStyle: (cover) => {
    const { briefingStyle } = get()
    set({
      briefingStyle: { ...briefingStyle, cover: { ...briefingStyle.cover, ...cover } },
      isDirty: true
    })
  },

  updateChartSlideStyle: (chartSlide) => {
    const { briefingStyle } = get()
    set({
      briefingStyle: { ...briefingStyle, chartSlide: { ...briefingStyle.chartSlide, ...chartSlide } },
      isDirty: true
    })
  },

  // ── Slide actions ────────────────────────────────

  addSlide: () => {
    const { slides } = get()
    const newSlide: ComposerSlide = {
      id: uuidv4(),
      order: slides.length,
      title: `Slide ${slides.length + 1}`,
      charts: []
    }
    set({
      slides: [...slides, newSlide],
      selectedSlideId: newSlide.id,
      isDirty: true
    })
  },

  removeSlide: (slideId: string) => {
    const { slides, selectedSlideId } = get()
    const filtered = slides.filter((s) => s.id !== slideId)
    // Reorder
    const reordered = filtered.map((s, i) => ({ ...s, order: i }))

    let newSelected = selectedSlideId
    if (selectedSlideId === slideId) {
      newSelected = reordered.length > 0 ? reordered[0].id : null
    }

    set({ slides: reordered, selectedSlideId: newSelected, isDirty: true })
  },

  setSlideTitle: (slideId: string, title: string) => {
    const { slides } = get()
    set({
      slides: slides.map((s) => (s.id === slideId ? { ...s, title } : s)),
      isDirty: true
    })
  },

  selectSlide: (slideId: string) => {
    set({ selectedSlideId: slideId })
  },

  reorderSlides: (fromIndex: number, toIndex: number) => {
    const { slides } = get()
    const updated = [...slides]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    const reordered = updated.map((s, i) => ({ ...s, order: i }))
    set({ slides: reordered, isDirty: true })
  },

  // ── Chart assignment ─────────────────────────────

  assignChartToSlide: (slideId, chartData) => {
    const { slides } = get()
    const slide = slides.find((s) => s.id === slideId)
    if (!slide) return

    // Max 6 charts per slide
    if (slide.charts.length >= 6) {
      console.warn('Max 6 charts per slide')
      return
    }

    const newChart: AssignedChart = {
      id: uuidv4(),
      slideId,
      slotIndex: slide.charts.length,
      ...chartData
    }

    set({
      slides: slides.map((s) =>
        s.id === slideId ? { ...s, charts: [...s.charts, newChart] } : s
      ),
      isDirty: true
    })
  },

  removeChartFromSlide: (slideId, chartId) => {
    const { slides } = get()
    set({
      slides: slides.map((s) => {
        if (s.id !== slideId) return s
        const filtered = s.charts.filter((c) => c.id !== chartId)
        // Re-index slots
        const reindexed = filtered.map((c, i) => ({ ...c, slotIndex: i }))
        return { ...s, charts: reindexed }
      }),
      isDirty: true
    })
  },

  moveChart: (chartId, fromSlideId, toSlideId) => {
    const { slides } = get()

    const fromSlide = slides.find((s) => s.id === fromSlideId)
    const toSlide = slides.find((s) => s.id === toSlideId)
    if (!fromSlide || !toSlide) return

    // Max 6 charts on target slide
    if (toSlide.charts.length >= 6) {
      console.warn('Target slide already has 6 charts')
      return
    }

    const chart = fromSlide.charts.find((c) => c.id === chartId)
    if (!chart) return

    const movedChart: AssignedChart = {
      ...chart,
      slideId: toSlideId,
      slotIndex: toSlide.charts.length
    }

    set({
      slides: slides.map((s) => {
        if (s.id === fromSlideId) {
          const remaining = s.charts.filter((c) => c.id !== chartId)
          return { ...s, charts: remaining.map((c, i) => ({ ...c, slotIndex: i })) }
        }
        if (s.id === toSlideId) {
          return { ...s, charts: [...s.charts, movedChart] }
        }
        return s
      }),
      isDirty: true
    })
  },

  // ── Search blocks ────────────────────────────────

  addSearchBlock: (productType = 'CHARTS') => {
    const { searchBlocks } = get()
    set({
      searchBlocks: [...searchBlocks, { id: uuidv4(), productType, lockedProduct: null }],
      isDirty: true
    })
  },

  removeSearchBlock: (blockId: string) => {
    const { searchBlocks } = get()
    if (searchBlocks.length <= 1) return // Keep at least one
    set({
      searchBlocks: searchBlocks.filter((b) => b.id !== blockId),
      isDirty: true
    })
  },

  reorderSearchBlocks: (fromIndex: number, toIndex: number) => {
    const { searchBlocks } = get()
    if (fromIndex === toIndex) return
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= searchBlocks.length || toIndex >= searchBlocks.length) return
    const updated = [...searchBlocks]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    set({ searchBlocks: updated, isDirty: true })
  },

  setSearchBlockType: (blockId: string, productType: string) => {
    const { searchBlocks } = get()
    set({
      searchBlocks: searchBlocks.map((b) =>
        b.id === blockId ? { ...b, productType, lockedProduct: null } : b
      ),
      isDirty: true
    })
  },

  setSearchBlockLock: (blockId: string, lockedProduct: LockedProductData | null) => {
    const { searchBlocks } = get()
    set({
      searchBlocks: searchBlocks.map((b) =>
        b.id === blockId ? { ...b, lockedProduct } : b
      )
    })
  },

  refreshChartsForProduct: (productId, newSteps) => {
    const { slides } = get()
    let changed = false

    const updatedSlides = slides.map((slide) => ({
      ...slide,
      charts: slide.charts.map((chart) => {
        if (chart.productId !== productId) return chart

        // Strategy 1 (primary): Match by stepIndex position.
        // This keeps the same relative position in the forecast grid,
        // so when the model run advances by one day, all slides shift forward automatically.
        // e.g. index 0 = first step, index 4 = fifth step — regardless of the date label.
        let matchedStep = newSteps.find((s) => s.index === chart.stepIndex)

        if (matchedStep) {
          changed = true
          if (matchedStep.label !== chart.stepLabel) {
            console.log(
              `[TemplateStore] "${chart.stepLabel}" (idx=${chart.stepIndex}) → "${matchedStep.label}" (same position in new run)`
            )
          }
          return {
            ...chart,
            stepLabel: matchedStep.label,
            stepIndex: matchedStep.index,
            imageUrl: matchedStep.imageUrl,
            stale: false
          }
        }

        // Strategy 2 (fallback): If stepIndex is out of range (grid size changed),
        // try to find the last available step as a reasonable fallback.
        if (newSteps.length > 0) {
          const lastStep = newSteps[newSteps.length - 1]
          console.warn(
            `[TemplateStore] Step idx=${chart.stepIndex} out of range (${newSteps.length} steps), using last step "${lastStep.label}"`
          )
          changed = true
          return {
            ...chart,
            stepLabel: lastStep.label,
            stepIndex: lastStep.index,
            imageUrl: lastStep.imageUrl,
            stale: false
          }
        }

        // No steps at all — mark as stale
        changed = true
        console.warn(
          `[TemplateStore] No steps available for product ${productId} — marked as stale.`
        )
        return { ...chart, stale: true }
      })
    }))

    if (changed) {
      set({ slides: updatedSlides, isDirty: true })
      console.log(`[TemplateStore] Refreshed charts for product ${productId}`)
    }
  },

  updateChartUrls: (productId, newSteps) => {
    const { slides } = get()
    let changed = false

    const updatedSlides = slides.map((slide) => ({
      ...slide,
      charts: slide.charts.map((chart) => {
        if (chart.productId !== productId) return chart

        // Match by stepIndex — just update the imageUrl, nothing else
        const matchedStep = newSteps.find((s) => s.index === chart.stepIndex)
        if (matchedStep && matchedStep.imageUrl !== chart.imageUrl) {
          changed = true
          return { ...chart, imageUrl: matchedStep.imageUrl }
        }
        return chart
      })
    }))

    if (changed) {
      set({ slides: updatedSlides })
      console.log(`[TemplateStore] Updated URLs for product ${productId}`)
    }
  }
}))
