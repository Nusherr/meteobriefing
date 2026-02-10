import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getProductColor } from '@shared/constants/product-colors'
import type { AssignedChart } from '../../stores/template.store'

interface ChartBlockProps {
  chart: AssignedChart
  compact?: boolean
  onRemove?: () => void
  draggable?: boolean
}

/**
 * Portal-based tooltip: rendered at document.body level so no parent overflow can clip it.
 */
function PortalTooltip({ name, step, stale, anchorRect }: { name: string; step: string; stale?: boolean; anchorRect: DOMRect }) {
  return createPortal(
    <div
      className={`fixed px-2.5 py-1.5 text-white text-[10px] rounded-lg shadow-xl pointer-events-none z-[9999] max-w-[260px] ${stale ? 'bg-amber-700' : 'bg-slate-800'}`}
      style={{
        left: anchorRect.left + anchorRect.width / 2,
        top: anchorRect.top - 4,
        transform: 'translate(-50%, -100%)'
      }}
    >
      <div className="font-medium leading-snug break-words">{name}</div>
      <div className="opacity-70 mt-0.5">{step}</div>
      {stale && <div className="text-amber-200 mt-0.5 font-medium">⚠ Step non disponibile</div>}
    </div>,
    document.body
  )
}

/**
 * A colored block representing an assigned chart in a slide miniature.
 * Shows truncated product name + step label.
 * Hover shows a portal tooltip with the full name (never clipped).
 */
export function ChartBlock({ chart, compact = false, onRemove, draggable = false }: ChartBlockProps) {
  const color = getProductColor(chart.productType)
  const [hovered, setHovered] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const blockRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = useCallback(() => {
    if (blockRef.current) {
      setRect(blockRef.current.getBoundingClientRect())
    }
    setHovered(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
  }, [])

  const sortable = useSortable({
    id: chart.id,
    data: {
      type: 'chart',
      chart,
      slideId: chart.slideId
    },
    disabled: !draggable
  })

  const style = draggable
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        opacity: sortable.isDragging ? 0.5 : 1
      }
    : undefined

  const dragProps = draggable
    ? {
        ref: (node: HTMLDivElement | null) => {
          sortable.setNodeRef(node)
          ;(blockRef as React.MutableRefObject<HTMLDivElement | null>).current = node
        },
        ...sortable.attributes,
        ...sortable.listeners
      }
    : { ref: blockRef }

  const isStale = chart.stale === true

  if (compact) {
    return (
      <>
        <div
          {...dragProps}
          style={style}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`${isStale ? 'bg-amber-50 border-amber-400 border-dashed' : `${color.bg} ${color.border}`} border rounded px-1 py-0.5 text-[8px] font-medium ${isStale ? 'text-amber-700' : color.text} truncate leading-tight overflow-hidden ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          <span className="block truncate">{isStale ? '⚠ ' : ''}{chart.productName}</span>
        </div>
        {hovered && rect && <PortalTooltip name={chart.productName} step={chart.stepLabel} stale={isStale} anchorRect={rect} />}
      </>
    )
  }

  return (
    <>
      <div
        {...dragProps}
        style={style}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`${isStale ? 'bg-amber-50 border-amber-400 border-dashed' : `${color.bg} ${color.border}`} border rounded-lg p-1.5 flex flex-col items-center justify-center text-center relative group min-h-[48px] overflow-hidden ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {/* Stale warning icon */}
        {isStale && (
          <div className="absolute top-0.5 left-0.5 w-3.5 h-3.5 text-amber-600 text-[10px] leading-none flex items-center justify-center z-10" title="Step non disponibile">
            ⚠
          </div>
        )}

        {/* Remove button */}
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-red-500 text-white rounded-full text-[8px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-600 z-10"
          >
            ×
          </button>
        )}

        <span className={`text-[9px] font-semibold ${isStale ? 'text-amber-700' : color.text} leading-tight truncate max-w-full`}>
          {chart.productName}
        </span>
        <span className={`text-[8px] ${isStale ? 'text-amber-600' : color.text} opacity-70 truncate max-w-full leading-tight mt-0.5`}>
          {chart.stepLabel}
        </span>
      </div>
      {hovered && rect && <PortalTooltip name={chart.productName} step={chart.stepLabel} stale={isStale} anchorRect={rect} />}
    </>
  )
}
