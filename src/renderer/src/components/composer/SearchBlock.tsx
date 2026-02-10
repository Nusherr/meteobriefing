import { useEffect, useState, useCallback, useRef } from 'react'
import type { PrometeoProduct, TimeStep } from '@shared/types'
import { getProductColor } from '@shared/constants/product-colors'
import { useTemplateStore } from '../../stores/template.store'
import type { LockedProductData } from '../../stores/template.store'

interface SearchBlockProps {
  blockId: string
  productType: string
  lockedProduct: LockedProductData | null
  onChangeType: (productType: string) => void
  onRemove: () => void
  canRemove: boolean
  isFocused: boolean
  onFocus: () => void
  /** Product IDs already locked in other search blocks (to prevent duplicates) */
  lockedProductIds: Set<string>
}

const PRODUCT_TYPES = [
  'CHARTS',
  'MESSAGES',
  'SATELLITE',
  'RADAR',
  'METGRAMS',
  'LIGHTNING',
  'SOUNDINGS',
  'FLIGHT CHARTS',
  'SEASONAL',
  'SPACE WEATHER',
  'SUBSEASONAL'
]

/** Product types that produce a single image (no time steps) */
const SINGLE_IMAGE_TYPES = new Set(['METGRAMS', 'SATELLITE', 'RADAR'])

/**
 * A single search block: product type selector, search filter, accordion product list.
 * When a product is selected and its steps are loaded, the block "locks" on that product
 * hiding the rest of the list to save space. A button allows unlocking.
 * Shows an image preview of the selected step with navigation.
 *
 * The locked product state is stored in the Zustand store so it persists across page navigation.
 */
export function SearchBlock({
  blockId,
  productType,
  lockedProduct,
  onChangeType,
  onRemove,
  canRemove,
  isFocused,
  lockedProductIds,
  onFocus
}: SearchBlockProps) {
  const { selectedSlideId, slides, assignChartToSlide, setSearchBlockLock, refreshChartsForProduct } = useTemplateStore()

  const color = getProductColor(productType)
  const isSingleImage = SINGLE_IMAGE_TYPES.has(productType)

  // Local state (only catalog + UI ephemeral state)
  const [catalog, setCatalog] = useState<PrometeoProduct[]>([])
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoadingSteps, setIsLoadingSteps] = useState(false)
  const fetchingRef = useRef(false)

  // Preview state (ephemeral - ok to reset on remount)
  const [previewStepIndex, setPreviewStepIndex] = useState<number | null>(
    // If we have a locked product, default to first step
    lockedProduct && lockedProduct.steps.length > 0 ? lockedProduct.steps[0].index : null
  )
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const previewRequestRef = useRef(0)

  // Load preview image
  const loadPreview = useCallback(
    async (stepIndex: number, steps: { label: string; index: number; imageUrl: string }[]) => {
      const step = steps.find((s) => s.index === stepIndex)
      if (!step || !step.imageUrl) return

      const requestId = ++previewRequestRef.current
      setIsLoadingPreview(true)

      try {
        const result = await window.electronAPI.prometeo.fetchImage(step.imageUrl)
        if (previewRequestRef.current === requestId) {
          setPreviewDataUrl(result.dataUrl || null)
        }
      } catch (err) {
        console.error(`[SearchBlock ${blockId}] Failed to fetch preview:`, err)
        if (previewRequestRef.current === requestId) {
          setPreviewDataUrl(null)
        }
      } finally {
        if (previewRequestRef.current === requestId) {
          setIsLoadingPreview(false)
        }
      }
    },
    [blockId]
  )

  // Auto-load preview when remounting with a locked product and focus
  useEffect(() => {
    if (lockedProduct && lockedProduct.steps.length > 0 && isFocused && !previewDataUrl) {
      const idx = previewStepIndex ?? lockedProduct.steps[0].index
      if (previewStepIndex === null) setPreviewStepIndex(idx)
      loadPreview(idx, lockedProduct.steps)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // For single-image products: auto-load preview when steps arrive and this block gets focus
  useEffect(() => {
    if (!isSingleImage || !lockedProduct || lockedProduct.steps.length === 0) return
    if (!isFocused || previewDataUrl || isLoadingPreview) return
    const step = lockedProduct.steps[0]
    setPreviewStepIndex(step.index)
    loadPreview(step.index, lockedProduct.steps)
  }, [isFocused, lockedProduct?.steps.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch steps for a locked product (used by auto-refetch and manual reload)
  // Validates that steps have distinct URLs and a reasonable count for multi-step products
  const fetchStepsForProduct = useCallback(
    async (product: LockedProductData): Promise<TimeStep[]> => {
      const MAX_RETRIES = 5
      // Multi-step product types typically have many time steps (20+)
      const MIN_EXPECTED_STEPS = isSingleImage ? 1 : 5

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`[SearchBlock ${blockId}] Fetching steps, attempt ${attempt}/${MAX_RETRIES}`)
        const result = await window.electronAPI.prometeo.fetchCatalogAndChartUrls(
          { productType },
          product.productId
        )
        const steps = (result.chartUrls.steps || []) as TimeStep[]

        if (steps.length === 0) {
          if (attempt < MAX_RETRIES) {
            console.warn(`[SearchBlock ${blockId}] Got 0 steps, retrying in 8s...`)
            await new Promise((r) => setTimeout(r, 8000))
          }
          continue
        }

        // Validate: too few steps for a multi-step product = incomplete load
        if (steps.length < MIN_EXPECTED_STEPS) {
          console.warn(
            `[SearchBlock ${blockId}] Only ${steps.length} steps (expected at least ${MIN_EXPECTED_STEPS}) — incomplete data, retrying in 8s...`
          )
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, 8000))
            continue
          }
          // Last attempt: accept what we have
          console.warn(`[SearchBlock ${blockId}] Last attempt — accepting ${steps.length} steps`)
        }

        // Validate: if multiple steps, they must have distinct URLs
        if (steps.length > 1) {
          const uniqueUrls = new Set(steps.map((s) => s.imageUrl))
          if (uniqueUrls.size === 1) {
            console.warn(
              `[SearchBlock ${blockId}] All ${steps.length} steps have same URL — incomplete data, retrying in 8s...`
            )
            if (attempt < MAX_RETRIES) {
              await new Promise((r) => setTimeout(r, 8000))
              continue
            }
          }
        }

        return steps
      }
      console.error(`[SearchBlock ${blockId}] All ${MAX_RETRIES} attempts returned 0 or invalid steps`)
      return []
    },
    [blockId, productType, isSingleImage]
  )

  // Apply fetched steps to the store and update preview
  const applyFetchedSteps = useCallback(
    (product: LockedProductData, steps: TimeStep[]) => {
      const stepData = isSingleImage
        ? steps.map((s) => ({ label: product.productName, index: s.index, imageUrl: s.imageUrl }))
        : steps.map((s) => ({ label: s.label, index: s.index, imageUrl: s.imageUrl }))

      // Validate: check that steps have distinct URLs (if not, Prometeo likely returned incomplete data)
      if (steps.length > 1) {
        const uniqueUrls = new Set(stepData.map((s) => s.imageUrl))
        if (uniqueUrls.size === 1) {
          console.warn(
            `[SearchBlock ${blockId}] All ${steps.length} steps have the same URL — Prometeo returned incomplete data, skipping refresh`
          )
          // Still update the search block steps (so the user can see/pick them)
          // but do NOT refresh slide charts — they'd all become the same image
          setSearchBlockLock(blockId, {
            productId: product.productId,
            productName: product.productName,
            steps: stepData
          })
          return
        }
      }

      console.log(
        `[SearchBlock ${blockId}] Applying ${stepData.length} steps for ${product.productId}:`,
        stepData.slice(0, 3).map((s) => `idx=${s.index} "${s.label}"`)
      )

      setSearchBlockLock(blockId, {
        productId: product.productId,
        productName: product.productName,
        steps: stepData
      })
      refreshChartsForProduct(product.productId, stepData)

      if (steps.length > 0) {
        setPreviewStepIndex(steps[0].index)
        if (isFocused) {
          loadPreview(steps[0].index, steps)
        }
      }
    },
    [blockId, isSingleImage, isFocused, setSearchBlockLock, refreshChartsForProduct, loadPreview]
  )

  // Auto-refetch steps when a locked product has no steps (restored from template save)
  const autoFetchedRef = useRef(false)
  useEffect(() => {
    if (!lockedProduct || lockedProduct.steps.length > 0 || autoFetchedRef.current) return
    autoFetchedRef.current = true

    ;(async () => {
      setIsLoadingSteps(true)
      try {
        const steps = await fetchStepsForProduct(lockedProduct)
        applyFetchedSteps(lockedProduct, steps)
      } catch (err) {
        console.error(`[SearchBlock ${blockId}] Auto-refetch steps failed:`, err)
      } finally {
        setIsLoadingSteps(false)
      }
    })()
  }, [lockedProduct]) // eslint-disable-line react-hooks/exhaustive-deps

  // Manual reload steps for this search block
  const reloadSteps = useCallback(async () => {
    if (!lockedProduct || isLoadingSteps) return
    setIsLoadingSteps(true)

    // Clear steps immediately so the PPT button gets blocked during reload
    setSearchBlockLock(blockId, {
      productId: lockedProduct.productId,
      productName: lockedProduct.productName,
      steps: []
    })

    try {
      const steps = await fetchStepsForProduct(lockedProduct)
      applyFetchedSteps(lockedProduct, steps)
    } catch (err) {
      console.error(`[SearchBlock ${blockId}] Manual reload steps failed:`, err)
    } finally {
      setIsLoadingSteps(false)
    }
  }, [lockedProduct, isLoadingSteps, blockId, fetchStepsForProduct, applyFetchedSteps, setSearchBlockLock])

  // Fetch catalog when productType changes
  const fetchCatalog = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setIsLoadingCatalog(true)
    setCatalog([])

    try {
      const result = await window.electronAPI.prometeo.fetchCatalog({ productType })
      const prods = (result.products || []) as PrometeoProduct[]
      setCatalog(prods)
    } catch (err) {
      console.error(`[SearchBlock ${blockId}] Failed to fetch catalog:`, err)
    } finally {
      setIsLoadingCatalog(false)
      fetchingRef.current = false
    }
  }, [productType, blockId])

  useEffect(() => {
    // Don't refetch if we already have a locked product (steps are in the store)
    if (lockedProduct) return

    const timer = setTimeout(() => {
      fetchCatalog()
    }, 300)
    return () => clearTimeout(timer)
  }, [fetchCatalog, lockedProduct])

  // Filter products by search text
  const filteredProducts = catalog.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase())
  )

  // Select a product: load steps and lock on it
  const selectProduct = async (productId: string) => {
    // If clicking same locked product, unlock
    if (lockedProduct && lockedProduct.productId === productId) {
      setSearchBlockLock(blockId, null)
      setPreviewStepIndex(null)
      setPreviewDataUrl(null)
      return
    }

    // Prevent selecting a product already locked in another search block
    if (lockedProductIds.has(productId)) {
      return
    }

    // Take focus
    onFocus()

    setPreviewStepIndex(null)
    setPreviewDataUrl(null)
    setIsLoadingSteps(true)

    try {
      const result = await window.electronAPI.prometeo.fetchChartUrls(productId)
      const steps = (result.steps || []) as TimeStep[]
      const prodName = result.productName || catalog.find((p) => p.id === productId)?.name || ''

      // For single-image products, override step labels with the product name
      const stepData = isSingleImage
        ? steps.map((s) => ({ label: prodName, index: s.index, imageUrl: s.imageUrl }))
        : steps.map((s) => ({ label: s.label, index: s.index, imageUrl: s.imageUrl }))

      // Save lock in the store (persists across navigation)
      setSearchBlockLock(blockId, {
        productId,
        productName: prodName,
        steps: stepData
      })

      // Auto-refresh: update existing chart assignments with new step URLs (next-day update)
      refreshChartsForProduct(productId, stepData)

      // Auto-select first step for preview
      if (steps.length > 0) {
        const firstStep = steps[0]
        setPreviewStepIndex(firstStep.index)
        loadPreview(firstStep.index, steps)
      }
    } catch (err) {
      console.error(`[SearchBlock ${blockId}] Failed to fetch steps:`, err)
    } finally {
      setIsLoadingSteps(false)
    }
  }

  // Unlock: go back to product list
  const unlockProduct = () => {
    setSearchBlockLock(blockId, null)
    setPreviewStepIndex(null)
    setPreviewDataUrl(null)
    // Refetch catalog since we cleared it
    if (catalog.length === 0) {
      fetchCatalog()
    }
  }

  // Change preview step
  const handlePreviewStep = (stepIndex: number, steps: { label: string; index: number; imageUrl: string }[]) => {
    setPreviewStepIndex(stepIndex)
    loadPreview(stepIndex, steps)
  }

  // Navigate preview with arrows
  const navigatePreview = (direction: -1 | 1, steps: { label: string; index: number; imageUrl: string }[]) => {
    if (previewStepIndex === null || steps.length === 0) return
    const currentIdx = steps.findIndex((s) => s.index === previewStepIndex)
    if (currentIdx === -1) return
    const newIdx = currentIdx + direction
    if (newIdx >= 0 && newIdx < steps.length) {
      handlePreviewStep(steps[newIdx].index, steps)
    }
  }

  // Assign a step to the selected slide
  const handleAssignStep = (step: { label: string; index: number; imageUrl: string }) => {
    if (!selectedSlideId || !lockedProduct) return

    assignChartToSlide(selectedSlideId, {
      productId: lockedProduct.productId,
      productName: lockedProduct.productName,
      productType: productType,
      stepLabel: step.label,
      stepIndex: step.index,
      imageUrl: step.imageUrl
    })
  }

  // Check if a step is already assigned to ANY slide
  const isStepAssigned = (step: { index: number }): boolean => {
    if (!lockedProduct) return false
    return slides.some((slide) =>
      slide.charts.some(
        (c) => c.productId === lockedProduct.productId && c.stepIndex === step.index
      )
    )
  }

  // Get all slide numbers where a step is assigned
  const getStepSlideNumbers = (step: { index: number }): number[] => {
    if (!lockedProduct) return []
    const nums: number[] = []
    for (const slide of slides) {
      if (
        slide.charts.some(
          (c) => c.productId === lockedProduct.productId && c.stepIndex === step.index
        )
      ) {
        nums.push(slide.order + 1)
      }
    }
    return nums
  }

  // Find current preview position in steps array
  const previewPosition =
    lockedProduct && previewStepIndex !== null
      ? lockedProduct.steps.findIndex((s) => s.index === previewStepIndex)
      : -1
  const canGoBack = previewPosition > 0
  const canGoForward = lockedProduct
    ? previewPosition < lockedProduct.steps.length - 1
    : false

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header: drag handle + product type + locked product name + collapse + remove */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {/* Drag handle */}
        <span className="text-slate-300 cursor-grab active:cursor-grabbing shrink-0 text-[10px] leading-none select-none" title="Trascina per riordinare">⠿</span>
        <span className={`w-2.5 h-2.5 rounded-full ${color.dot} shrink-0`} />

        <select
          value={productType}
          onChange={(e) => {
            e.stopPropagation()
            onChangeType(e.target.value)
          }}
          onClick={(e) => e.stopPropagation()}
          className={`text-sm font-semibold text-slate-700 bg-transparent border-none outline-none cursor-pointer ${lockedProduct ? 'w-auto shrink-0' : 'flex-1 min-w-0'}`}
        >
          {PRODUCT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Show locked product name */}
        {lockedProduct && (
          <span className="text-[11px] text-slate-500 truncate flex-1 min-w-0" title={lockedProduct.productName}>
            — {lockedProduct.productName}
          </span>
        )}

        <div className="flex items-center gap-1 shrink-0">
          {(isLoadingCatalog || isLoadingSteps) && (
            <span className="w-3.5 h-3.5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          )}
          {!isLoadingCatalog && !isLoadingSteps && catalog.length > 0 && !lockedProduct && (
            <span className="text-[10px] text-slate-400">{catalog.length}</span>
          )}

          <svg
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>

          {canRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="w-5 h-5 text-slate-300 hover:text-red-500 transition-colors text-xs flex items-center justify-center cursor-pointer"
              title="Rimuovi ricerca"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Collapsible body */}
      {!isCollapsed && (
        <>
          {lockedProduct ? (
            /* ── LOCKED MODE: show only the selected product + its steps + preview ── */
            <div>
              {/* Locked product header */}
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/60 border-b border-blue-100">
                <span className="text-xs font-medium text-slate-700 truncate flex-1">
                  {lockedProduct.productName}
                </span>
                <button
                  onClick={reloadSteps}
                  disabled={isLoadingSteps}
                  className="text-[10px] text-slate-500 hover:text-blue-600 font-medium cursor-pointer shrink-0 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Ricarica step"
                >
                  <svg className={`w-3 h-3 ${isLoadingSteps ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button
                  onClick={unlockProduct}
                  className="text-[10px] text-blue-600 hover:text-blue-800 font-medium cursor-pointer shrink-0 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors"
                >
                  ← Lista
                </button>
              </div>

              {/* Steps / Single-image assign */}
              <div className="px-3 py-2">
                {lockedProduct.steps.length > 0 ? (
                  isSingleImage ? (
                    /* ── Single-image product: preview button + assign "+" ── */
                    <div className="flex items-center gap-1">
                      {(() => {
                        const step = lockedProduct.steps[0]
                        const assigned = isStepAssigned(step)
                        const slideNums = getStepSlideNumbers(step)
                        return (
                          <>
                            {/* Preview button */}
                            <button
                              onClick={() => {
                                onFocus()
                                handlePreviewStep(step.index, lockedProduct.steps)
                              }}
                              className={`relative px-2.5 py-1 rounded-l text-[10px] font-medium transition-all cursor-pointer border ${
                                assigned
                                  ? `${color.bg} ${color.border} ${color.text}`
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                              title="Anteprima"
                            >
                              Anteprima
                              {slideNums.length > 0 && (
                                <span className="absolute -top-1.5 -left-1 min-w-[14px] h-3.5 bg-blue-600 text-white text-[7px] rounded-full flex items-center justify-center leading-none px-0.5">
                                  {slideNums.join(',')}
                                </span>
                              )}
                            </button>
                            {/* Assign "+" button */}
                            <button
                              onClick={() => {
                                onFocus()
                                handleAssignStep(step)
                              }}
                              disabled={!selectedSlideId}
                              className={`px-1.5 py-1 rounded-r text-[10px] font-bold transition-all cursor-pointer border border-l-0 ${
                                assigned
                                  ? `${color.bg} ${color.border} ${color.text} opacity-50`
                                  : selectedSlideId
                                    ? 'bg-white border-slate-200 text-blue-500 hover:bg-blue-50 hover:border-blue-300'
                                    : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                              }`}
                              title={
                                !selectedSlideId
                                  ? 'Seleziona una slide prima'
                                  : assigned
                                    ? `Già in slide ${slideNums.join(', ')}`
                                    : 'Aggiungi alla slide'
                              }
                            >
                              +
                            </button>
                          </>
                        )
                      })()}
                    </div>
                  ) : (
                    /* ── Multi-step product: step buttons with assign ── */
                    <div className="flex flex-wrap gap-1">
                      {lockedProduct.steps.map((step) => {
                        const assigned = isStepAssigned(step)
                        const slideNums = getStepSlideNumbers(step)
                        const isPreviewing = previewStepIndex === step.index

                        return (
                          <div key={step.index} className="relative flex items-center">
                            {/* Step button: click = change preview + take focus */}
                            <button
                              onClick={() => {
                                onFocus()
                                handlePreviewStep(step.index, lockedProduct.steps)
                              }}
                              className={`px-2 py-1 rounded-l text-[10px] font-medium transition-all cursor-pointer border ${
                                isPreviewing
                                  ? 'bg-slate-700 border-slate-700 text-white ring-1 ring-slate-400'
                                  : assigned
                                    ? `${color.bg} ${color.border} ${color.text}`
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                              }`}
                              title={`Anteprima: ${step.label}`}
                            >
                              {step.label}
                              {slideNums.length > 0 && (
                                <span className="absolute -top-1.5 -left-1 min-w-[14px] h-3.5 bg-blue-600 text-white text-[7px] rounded-full flex items-center justify-center leading-none px-0.5">
                                  {slideNums.join(',')}
                                </span>
                              )}
                            </button>

                            {/* Assign button "+" */}
                            <button
                              onClick={() => {
                                onFocus()
                                handleAssignStep(step)
                              }}
                              disabled={!selectedSlideId}
                              className={`px-1 py-1 rounded-r text-[10px] font-bold transition-all cursor-pointer border border-l-0 ${
                                isPreviewing
                                  ? 'bg-slate-600 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-500'
                                  : assigned
                                    ? `${color.bg} ${color.border} ${color.text} opacity-50`
                                    : selectedSlideId
                                      ? 'bg-white border-slate-200 text-blue-500 hover:bg-blue-50 hover:border-blue-300'
                                      : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                              }`}
                              title={
                                !selectedSlideId
                                  ? 'Seleziona una slide prima'
                                  : assigned
                                    ? `Già in slide ${slideNums.join(', ')}`
                                    : 'Aggiungi alla slide'
                              }
                            >
                              +
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                ) : (
                  <p className="text-[10px] text-slate-400 py-1">Nessuno step disponibile</p>
                )}
              </div>

              {/* ── Image Preview ── */}
              {/* Single-image: always show preview when focused; Multi-step: show when a step is selected */}
              {((isSingleImage && isFocused && lockedProduct.steps.length > 0) ||
                (!isSingleImage && isFocused && previewStepIndex !== null && lockedProduct.steps.length > 0)) && (
                <div className="border-t border-slate-100">
                  {/* Preview image area */}
                  <div className="relative bg-slate-50 flex items-center justify-center min-h-[200px]">
                    {isLoadingPreview ? (
                      <div className="flex flex-col items-center gap-2 py-8">
                        <span className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        <span className="text-[11px] text-slate-400">Caricamento anteprima...</span>
                      </div>
                    ) : previewDataUrl ? (
                      <img
                        src={previewDataUrl}
                        alt="Anteprima"
                        className="w-full h-auto max-h-[400px] object-contain"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 py-8">
                        <svg
                          className="w-8 h-8 text-slate-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                          />
                        </svg>
                        <span className="text-[10px] text-slate-400">
                          Anteprima non disponibile
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Navigation bar: only for multi-step products */}
                  {!isSingleImage && (
                    <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-t border-slate-200">
                      <button
                        onClick={() => navigatePreview(-1, lockedProduct.steps)}
                        disabled={!canGoBack}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Step precedente"
                      >
                        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      <span className="text-[11px] font-medium text-slate-600">
                        {lockedProduct.steps.find((s) => s.index === previewStepIndex)?.label || ''}
                        <span className="text-slate-400 ml-1.5">
                          ({previewPosition + 1}/{lockedProduct.steps.length})
                        </span>
                      </span>

                      <button
                        onClick={() => navigatePreview(1, lockedProduct.steps)}
                        disabled={!canGoForward}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Step successivo"
                      >
                        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── LIST MODE: search + product list ── */
            <>
              {/* Search filter */}
              <div className="px-3 py-2 border-b border-slate-50">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Cerca prodotto..."
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400 bg-slate-50"
                />
              </div>

              {/* Product list */}
              <div className="max-h-[300px] overflow-y-auto">
                {filteredProducts.length === 0 && !isLoadingCatalog && (
                  <p className="p-3 text-xs text-slate-400 text-center">
                    {catalog.length === 0 ? 'Caricamento...' : 'Nessun risultato'}
                  </p>
                )}

                {filteredProducts.slice(0, 100).map((p) => {
                  const isAlreadyLocked = lockedProductIds.has(p.id)
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectProduct(p.id)}
                      disabled={isAlreadyLocked}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-1.5 border-b border-slate-50 last:border-b-0 ${
                        isAlreadyLocked
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-blue-50 cursor-pointer'
                      }`}
                    >
                      <svg
                        className="w-3 h-3 text-slate-400 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <span className={`truncate leading-tight ${isAlreadyLocked ? 'text-slate-400' : 'text-slate-700'}`}>{p.name}</span>
                      {isAlreadyLocked && (
                        <span className="text-[9px] text-slate-400 shrink-0 ml-auto">già in uso</span>
                      )}
                      {!isAlreadyLocked && p.category && (
                        <span className="text-[9px] text-slate-400 shrink-0 ml-auto">
                          {p.category}
                        </span>
                      )}
                    </button>
                  )
                })}

                {filteredProducts.length > 100 && (
                  <p className="p-2 text-[10px] text-slate-400 text-center">
                    Mostrati 100 di {filteredProducts.length} — usa il filtro
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
