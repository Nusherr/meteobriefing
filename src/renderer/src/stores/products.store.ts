import { create } from 'zustand'
import type { TimeStep } from '@shared/types'

interface ProductItem {
  id: string
  name: string
  category: string
}

interface ProductsState {
  // Filter state
  productType: string
  category: string
  type: string
  area: string

  // Catalog data
  products: ProductItem[]
  categories: string[]
  types: string[]
  areas: string[]
  isLoadingCatalog: boolean

  // Selected product
  selectedProduct: ProductItem | null
  availableSteps: TimeStep[]
  selectedStepIndexes: number[]
  isLoadingSteps: boolean
  productName: string
  productDate: string

  // Download
  isDownloading: boolean
  downloadProgress: { downloaded: number; total: number }

  // Actions
  setProductType: (type: string) => void
  setCategory: (cat: string) => void
  setType: (type: string) => void
  setArea: (area: string) => void
  fetchCatalog: () => Promise<void>
  selectProduct: (product: ProductItem) => Promise<void>
  toggleStep: (index: number) => void
  selectAllSteps: () => void
  deselectAllSteps: () => void
  downloadSelected: () => Promise<string[]>
}

export const useProductsStore = create<ProductsState>((set, get) => ({
  productType: 'CHARTS',
  category: '',
  type: '',
  area: '',
  products: [],
  categories: [],
  types: [],
  areas: [],
  isLoadingCatalog: false,
  selectedProduct: null,
  availableSteps: [],
  selectedStepIndexes: [],
  isLoadingSteps: false,
  productName: '',
  productDate: '',
  isDownloading: false,
  downloadProgress: { downloaded: 0, total: 0 },

  setProductType: (type) => set({ productType: type }),
  setCategory: (cat) => set({ category: cat }),
  setType: (type) => set({ type }),
  setArea: (area) => set({ area }),

  fetchCatalog: async () => {
    // Prevent concurrent calls
    if (get().isLoadingCatalog) return
    set({ isLoadingCatalog: true, products: [], categories: [], types: [], areas: [] })
    try {
      const result = await window.electronAPI.prometeo.fetchCatalog({
        productType: get().productType
      })
      if ((result as { error?: string }).error) {
        console.error('Catalog error:', (result as { error: string }).error)
      }
      set({
        products: result.products || [],
        categories: result.categories || [],
        types: result.types || [],
        areas: result.areas || [],
        isLoadingCatalog: false
      })
    } catch (err) {
      console.error('Failed to fetch catalog:', err)
      set({ isLoadingCatalog: false })
    }
  },

  selectProduct: async (product) => {
    set({ selectedProduct: product, isLoadingSteps: true, availableSteps: [], selectedStepIndexes: [] })
    try {
      const result = await window.electronAPI.prometeo.fetchChartUrls(product.id)
      set({
        availableSteps: result.steps,
        productName: result.productName,
        productDate: result.date,
        isLoadingSteps: false
      })
    } catch (err) {
      console.error('Failed to fetch chart URLs:', err)
      set({ isLoadingSteps: false })
    }
  },

  toggleStep: (index) => {
    const current = get().selectedStepIndexes
    if (current.includes(index)) {
      set({ selectedStepIndexes: current.filter((i) => i !== index) })
    } else {
      set({ selectedStepIndexes: [...current, index].sort((a, b) => a - b) })
    }
  },

  selectAllSteps: () => {
    set({ selectedStepIndexes: get().availableSteps.map((_, i) => i) })
  },

  deselectAllSteps: () => {
    set({ selectedStepIndexes: [] })
  },

  downloadSelected: async () => {
    const { availableSteps, selectedStepIndexes } = get()
    const urls = selectedStepIndexes.map((i) => availableSteps[i].imageUrl)

    set({ isDownloading: true, downloadProgress: { downloaded: 0, total: urls.length } })

    const unsubscribe = window.electronAPI.prometeo.onDownloadProgress((progress) => {
      set({ downloadProgress: { downloaded: progress.downloaded, total: progress.total } })
    })

    try {
      const result = await window.electronAPI.prometeo.downloadCharts(urls)
      set({ isDownloading: false })
      unsubscribe()
      return result.localPaths
    } catch (err) {
      console.error('Download failed:', err)
      set({ isDownloading: false })
      unsubscribe()
      return []
    }
  }
}))
