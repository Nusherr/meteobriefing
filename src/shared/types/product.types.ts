export interface PrometeoProductFilter {
  productType: string
  category?: string
  type?: string
  areaOrLocation?: string
  date?: string
}

export interface PrometeoProduct {
  id: string
  name: string
  productType: string
  category: string
  type: string
  area: string
}

export interface TimeStep {
  label: string
  index: number
  imageUrl: string
}

export interface ChartImage {
  url: string
  productName: string
  step: TimeStep
  date: string
  localPath?: string
}

export interface DownloadProgress {
  downloaded: number
  total: number
  currentFile: string
}
