import { useState } from 'react'
import type { ComposerSlide } from '../../stores/template.store'
import { ChartBlockGrid } from './ChartBlockGrid'

interface SlideMiniatureProps {
  slide: ComposerSlide
  index: number
  isSelected: boolean
  onSelect: () => void
  onRemove: () => void
  onTitleChange: (title: string) => void
  onRemoveChart: (chartId: string) => void
}

/**
 * A slide miniature in the right panel.
 * Shows title (editable on double-click) and chart blocks in auto-layout.
 */
export function SlideMiniature({
  slide,
  index,
  isSelected,
  onSelect,
  onRemove,
  onTitleChange,
  onRemoveChart
}: SlideMiniatureProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(slide.title)

  const handleTitleDoubleClick = () => {
    setTitleDraft(slide.title)
    setIsEditingTitle(true)
  }

  const commitTitle = () => {
    const trimmed = titleDraft.trim()
    if (trimmed && trimmed !== slide.title) {
      onTitleChange(trimmed)
    }
    setIsEditingTitle(false)
  }

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-lg border-2 transition-all cursor-pointer group ${
        isSelected
          ? 'border-blue-500 shadow-sm shadow-blue-100'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Header: title + slide number + remove button */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-[9px] text-slate-400 font-mono shrink-0">{index + 1}</span>

          {isEditingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle()
                if (e.key === 'Escape') setIsEditingTitle(false)
              }}
              className="text-xs font-medium text-slate-700 border-b border-blue-400 outline-none bg-transparent flex-1 min-w-0 py-0"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className="text-xs font-medium text-slate-700 truncate cursor-text"
              onDoubleClick={(e) => {
                e.stopPropagation()
                handleTitleDoubleClick()
              }}
              title="Doppio click per modificare"
            >
              {slide.title || `Slide ${index + 1}`}
            </span>
          )}
        </div>

        {/* Remove slide button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="w-5 h-5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 text-xs flex items-center justify-center cursor-pointer shrink-0"
          title="Rimuovi slide"
        >
          ×
        </button>
      </div>

      {/* Body: chart blocks in auto-layout (compact fixed height) */}
      <div className="h-[90px] flex bg-slate-50 rounded-b-md overflow-hidden">
        <ChartBlockGrid slideId={slide.id} charts={slide.charts} onRemoveChart={onRemoveChart} />
      </div>

      {/* Chart count badge */}
      {slide.charts.length > 0 && (
        <div className="absolute -top-1 -left-1 w-4 h-4 bg-blue-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
          {slide.charts.length}
        </div>
      )}

      {/* Stale charts warning badge */}
      {slide.charts.some((c) => c.stale) && (
        <div
          className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center"
          title={`${slide.charts.filter((c) => c.stale).length} step non disponibili`}
        >
          !
        </div>
      )}
    </div>
  )
}
