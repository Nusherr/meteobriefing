/**
 * Color mappings for each product type.
 * Used in slide miniatures to visually distinguish chart blocks.
 */

export interface ProductColor {
  bg: string
  border: string
  text: string
  dot: string // small colored dot for compact indicators
}

export const PRODUCT_COLORS: Record<string, ProductColor> = {
  CHARTS: {
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    text: 'text-blue-700',
    dot: 'bg-blue-500'
  },
  MESSAGES: {
    bg: 'bg-amber-100',
    border: 'border-amber-300',
    text: 'text-amber-700',
    dot: 'bg-amber-500'
  },
  SATELLITE: {
    bg: 'bg-emerald-100',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500'
  },
  RADAR: {
    bg: 'bg-red-100',
    border: 'border-red-300',
    text: 'text-red-700',
    dot: 'bg-red-500'
  },
  METGRAMS: {
    bg: 'bg-violet-100',
    border: 'border-violet-300',
    text: 'text-violet-700',
    dot: 'bg-violet-500'
  },
  LIGHTNING: {
    bg: 'bg-yellow-100',
    border: 'border-yellow-300',
    text: 'text-yellow-700',
    dot: 'bg-yellow-500'
  },
  SOUNDINGS: {
    bg: 'bg-cyan-100',
    border: 'border-cyan-300',
    text: 'text-cyan-700',
    dot: 'bg-cyan-500'
  },
  'FLIGHT CHARTS': {
    bg: 'bg-indigo-100',
    border: 'border-indigo-300',
    text: 'text-indigo-700',
    dot: 'bg-indigo-500'
  },
  SEASONAL: {
    bg: 'bg-orange-100',
    border: 'border-orange-300',
    text: 'text-orange-700',
    dot: 'bg-orange-500'
  },
  'SPACE WEATHER': {
    bg: 'bg-pink-100',
    border: 'border-pink-300',
    text: 'text-pink-700',
    dot: 'bg-pink-500'
  },
  SUBSEASONAL: {
    bg: 'bg-teal-100',
    border: 'border-teal-300',
    text: 'text-teal-700',
    dot: 'bg-teal-500'
  }
}

const DEFAULT_COLOR: ProductColor = {
  bg: 'bg-slate-100',
  border: 'border-slate-300',
  text: 'text-slate-700',
  dot: 'bg-slate-500'
}

export function getProductColor(productType: string): ProductColor {
  return PRODUCT_COLORS[productType] || DEFAULT_COLOR
}
