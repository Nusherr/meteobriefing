import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuthStore } from '../stores/auth.store'
import { useTemplateStore } from '../stores/template.store'
import { SearchBlock } from '../components/composer/SearchBlock'
import { SlideColumn } from '../components/composer/SlideColumn'
import type { BriefingDefinition, ResolvedChart } from '@shared/types'

type GenPhase = 'idle' | 'saving' | 'choosing-path' | 'downloading' | 'composing' | 'done' | 'error'

export function ProductBrowserPage() {
  const { isLoggedIn } = useAuthStore()
  const {
    activeTemplate,
    slides,
    searchBlocks,
    isDirty,
    addSearchBlock,
    removeSearchBlock,
    reorderSearchBlocks,
    setSearchBlockType,
    saveActiveTemplate
  } = useTemplateStore()

  // Only one search block shows its preview at a time
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)

  // Drag & drop state for search blocks
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // PPT generation state
  const [genPhase, setGenPhase] = useState<GenPhase>('idle')
  const [genMessage, setGenMessage] = useState('')
  const [genError, setGenError] = useState('')

  // Track when loading just completed (for "Caricamento completato" message)
  const [justLoaded, setJustLoaded] = useState(false)
  const prevStepsLoadingRef = useRef(true)

  const generatePpt = useCallback(async () => {
    if (!activeTemplate) return

    try {
      // 1. Auto-save if dirty
      setGenPhase('saving')
      setGenMessage('Salvataggio template...')
      if (isDirty) {
        await saveActiveTemplate()
      }

      // 2. Choose save path
      setGenPhase('choosing-path')
      setGenMessage('Scegli dove salvare...')
      const outputPath = await window.electronAPI.pptx.selectSavePath()
      if (!outputPath) {
        setGenPhase('idle')
        return
      }

      // 3. Download images directly (URLs are already up-to-date from step selection)
      setGenPhase('downloading')
      setGenMessage('Download immagini...')

      const freshSlides = slides

      const allCharts: { slideId: string; slotId: string; imageUrl: string; title: string }[] = []
      for (const slide of freshSlides) {
        for (const chart of slide.charts) {
          allCharts.push({
            slideId: slide.id,
            slotId: chart.id,
            imageUrl: chart.imageUrl,
            title: chart.stepLabel || chart.productName
          })
        }
      }

      if (allCharts.length === 0) {
        setGenPhase('error')
        setGenError('Nessuna carta assegnata alle slide.')
        return
      }

      // Download all images
      const imageUrls = allCharts.map((c) => c.imageUrl)
      console.log('[GeneratePPT] Downloading', imageUrls.length, 'images:', imageUrls)
      const downloadResult = await window.electronAPI.prometeo.downloadCharts(imageUrls)
      const localPaths: string[] = downloadResult.localPaths || []

      if (localPaths.length !== imageUrls.length) {
        setGenPhase('error')
        setGenError('Errore nel download di alcune immagini.')
        return
      }

      // Check for failed downloads (empty paths)
      const failedDownloads = localPaths
        .map((p, i) => (!p ? allCharts[i] : null))
        .filter(Boolean)
      if (failedDownloads.length > 0) {
        console.error('[GeneratePPT] Failed downloads:', failedDownloads)
        const failedNames = failedDownloads.map((c) => c!.title).join(', ')
        setGenPhase('error')
        setGenError(`Download fallito per ${failedDownloads.length} immagini: ${failedNames}`)
        return
      }

      // 4. Build ResolvedChart array
      const resolvedCharts: ResolvedChart[] = allCharts.map((chart, i) => ({
        slotId: chart.slotId,
        slideId: chart.slideId,
        imagePath: localPaths[i],
        title: chart.title
      }))

      // 5. Build the current template from store state (with up-to-date slides)
      const currentTemplate = { ...useTemplateStore.getState().activeTemplate! }

      // Rebuild slides from composer state to ensure consistency
      const autoLayout = (count: number) => {
        if (count <= 1) return 'SINGLE' as const
        if (count === 2) return 'ROW_2' as const
        if (count === 3) return 'ROW_3' as const
        if (count === 4) return 'GRID_2x2' as const
        return 'GRID_3x2' as const
      }

      currentTemplate.slides = freshSlides.map((cs) => ({
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

      // 6. Generate PPTX
      setGenPhase('composing')
      setGenMessage('Generazione presentazione...')

      const definition: BriefingDefinition = {
        template: currentTemplate,
        resolvedCharts,
        outputPath
      }

      // Listen for progress
      const unsubProgress = window.electronAPI.pptx.onProgress((progress) => {
        setGenMessage(progress.message)
      })

      await window.electronAPI.pptx.generate(definition)

      unsubProgress()

      setGenPhase('done')
      setGenMessage(`PPT salvato con successo!`)

      // Reset after a few seconds
      setTimeout(() => {
        setGenPhase('idle')
        setGenMessage('')
      }, 4000)
    } catch (err) {
      console.error('[GeneratePPT] Error:', err)
      setGenPhase('error')
      setGenError(err instanceof Error ? err.message : String(err))
    }
  }, [activeTemplate, slides, isDirty, saveActiveTemplate])

  if (!isLoggedIn) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-6">Prodotti</h2>
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-slate-500">
            Connettiti a Prometeo dalla pagina Connessioni per navigare i prodotti.
          </p>
        </div>
      </div>
    )
  }

  if (!activeTemplate) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-6">Prodotti</h2>
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-slate-500 mb-2">
            Crea o seleziona un template per iniziare a comporre le slide.
          </p>
          <p className="text-xs text-slate-400">
            Usa il selettore template in alto a destra.
          </p>
        </div>
      </div>
    )
  }

  const totalCharts = slides.reduce((sum, s) => sum + s.charts.length, 0)
  const staleCharts = slides.reduce((sum, s) => sum + s.charts.filter((c) => c.stale).length, 0)
  const chartsWithoutUrl = slides.reduce((sum, s) => sum + s.charts.filter((c) => !c.imageUrl).length, 0)

  // Check if any search block with a locked product still has empty steps (not yet loaded)
  const stepsStillLoading = searchBlocks.some(
    (b) => b.lockedProduct && b.lockedProduct.steps.length === 0
  )

  // Detect when loading transitions from true → false (just finished loading)
  useEffect(() => {
    if (prevStepsLoadingRef.current && !stepsStillLoading && totalCharts > 0) {
      setJustLoaded(true)
      const timer = setTimeout(() => setJustLoaded(false), 3000)
      return () => clearTimeout(timer)
    }
    prevStepsLoadingRef.current = stepsStillLoading
  }, [stepsStillLoading, totalCharts])

  // Collect all product IDs locked across search blocks (for duplicate prevention)
  const lockedProductIds = new Set(
    searchBlocks
      .filter((b) => b.lockedProduct)
      .map((b) => b.lockedProduct!.productId)
  )
  const isGenerating = genPhase !== 'idle' && genPhase !== 'done' && genPhase !== 'error'

  // Unfocus search blocks when clicking anywhere outside a search block
  const searchBlocksContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!focusedBlockId) return
      // Check if the click target is inside any element with data-searchblock attribute
      const target = e.target as HTMLElement
      if (target.closest?.('[data-searchblock]')) return
      setFocusedBlockId(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [focusedBlockId])

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-semibold text-slate-800 mb-4 shrink-0">Prodotti</h2>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left Panel: Stackable search blocks (takes all available space) */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1" ref={searchBlocksContainerRef}>
            {searchBlocks.map((block, index) => (
              <div
                key={block.id}
                data-searchblock
                draggable
                onDragStart={(e) => {
                  dragIndexRef.current = index
                  e.dataTransfer.effectAllowed = 'move'
                  // Make drag image semi-transparent
                  if (e.currentTarget instanceof HTMLElement) {
                    e.currentTarget.style.opacity = '0.5'
                  }
                }}
                onDragEnd={(e) => {
                  dragIndexRef.current = null
                  setDragOverIndex(null)
                  if (e.currentTarget instanceof HTMLElement) {
                    e.currentTarget.style.opacity = '1'
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
                    setDragOverIndex(index)
                  }
                }}
                onDragLeave={() => {
                  setDragOverIndex(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIndexRef.current !== null && dragIndexRef.current !== index) {
                    reorderSearchBlocks(dragIndexRef.current, index)
                  }
                  dragIndexRef.current = null
                  setDragOverIndex(null)
                }}
                className={`transition-all ${
                  dragOverIndex === index
                    ? 'ring-2 ring-blue-400 ring-offset-2 rounded-xl'
                    : ''
                }`}
              >
                <SearchBlock
                  blockId={block.id}
                  productType={block.productType}
                  lockedProduct={block.lockedProduct}
                  onChangeType={(pt) => setSearchBlockType(block.id, pt)}
                  onRemove={() => {
                    removeSearchBlock(block.id)
                    if (focusedBlockId === block.id) setFocusedBlockId(null)
                  }}
                  canRemove={searchBlocks.length > 1}
                  isFocused={focusedBlockId === block.id}
                  onFocus={() => setFocusedBlockId(block.id)}
                  lockedProductIds={lockedProductIds}
                />
              </div>
            ))}
          </div>

          {/* Add search block button */}
          <button
            onClick={() => addSearchBlock()}
            className="mt-2 w-full py-1.5 border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer shrink-0"
          >
            + Aggiungi ricerca
          </button>
        </div>

        {/* Right Panel: Slide column + Generate button */}
        <div className="w-[240px] flex-shrink-0 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <SlideColumn />
          </div>

          {/* Generate PPT button */}
          <div className="mt-3 shrink-0">
            {genPhase === 'error' ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                <p className="text-[11px] text-red-600 font-medium mb-1">Errore generazione</p>
                <p className="text-[10px] text-red-500">{genError}</p>
                <button
                  onClick={() => { setGenPhase('idle'); setGenError('') }}
                  className="mt-1.5 text-[10px] text-red-600 hover:text-red-800 font-medium cursor-pointer"
                >
                  Chiudi
                </button>
              </div>
            ) : genPhase === 'done' ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-center">
                <p className="text-[11px] text-emerald-700 font-medium flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {genMessage}
                </p>
              </div>
            ) : isGenerating ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  <span className="text-[11px] text-blue-700 font-medium">{genMessage}</span>
                </div>
              </div>
            ) : (
              <>
                {staleCharts > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                    <p className="text-[10px] text-amber-700 font-medium flex items-center gap-1">
                      <span>⚠</span>
                      {staleCharts} {staleCharts === 1 ? 'carta non disponibile' : 'carte non disponibili'}
                    </p>
                    <p className="text-[9px] text-amber-600 mt-0.5">
                      Sostituisci o rimuovi le carte segnate in arancione prima di generare.
                    </p>
                  </div>
                )}
                {(() => {
                  const isLoading = stepsStillLoading || chartsWithoutUrl > 0
                  const canGenerate = totalCharts > 0 && staleCharts === 0 && !isLoading

                  if (isLoading) {
                    return (
                      <div className="w-full py-3 rounded-xl bg-slate-100 flex flex-col items-center justify-center gap-1 shadow-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                          <span className="text-sm font-semibold text-slate-400">Caricamento Carte</span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <button
                      onClick={generatePpt}
                      disabled={!canGenerate}
                      className={`w-full py-3 rounded-xl font-semibold transition-all cursor-pointer flex flex-col items-center justify-center shadow-sm ${
                        canGenerate
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'
                      }`}
                      title={
                        totalCharts === 0
                          ? 'Assegna almeno una carta a una slide'
                          : staleCharts > 0
                            ? `${staleCharts} carte non disponibili — rimuovi o sostituisci`
                            : `Genera PPT con ${totalCharts} carte`
                      }
                    >
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        <span className="text-sm">Genera PPT</span>
                        {totalCharts > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${canGenerate ? 'bg-white/20' : ''}`}>
                            {totalCharts} carte
                          </span>
                        )}
                      </div>
                      {justLoaded && canGenerate && (
                        <span className="text-[10px] font-normal opacity-80 flex items-center gap-1 mt-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Caricamento completato
                        </span>
                      )}
                    </button>
                  )
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
