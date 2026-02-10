import { useDroppable } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { AssignedChart } from '../../stores/template.store'
import { ChartBlock } from './ChartBlock'

interface ChartBlockGridProps {
  slideId: string
  charts: AssignedChart[]
  onRemoveChart?: (chartId: string) => void
}

/**
 * Auto-layout grid for chart blocks inside a slide miniature.
 * 1 = centered, 2-3 = row, 4 = 2x2, 5-6 = 3x2
 * Acts as a droppable area for chart blocks.
 */
export function ChartBlockGrid({ slideId, charts, onRemoveChart }: ChartBlockGridProps) {
  const count = charts.length

  const { setNodeRef, isOver } = useDroppable({
    id: `slide-drop-${slideId}`,
    data: { type: 'slide', slideId }
  })

  if (count === 0) {
    return (
      <div
        ref={setNodeRef}
        className={`flex-1 flex items-center justify-center transition-colors ${
          isOver ? 'bg-blue-50' : ''
        }`}
      >
        <span className={`text-[10px] italic ${isOver ? 'text-blue-400' : 'text-slate-300'}`}>
          {isOver ? 'Rilascia qui' : 'Vuota'}
        </span>
      </div>
    )
  }

  // Determine grid classes based on chart count
  let gridClass = 'grid gap-1 flex-1 p-1.5 transition-colors'

  if (count === 1) {
    gridClass += ' grid-cols-1 place-items-center'
  } else if (count === 2) {
    gridClass += ' grid-cols-2'
  } else if (count === 3) {
    gridClass += ' grid-cols-3'
  } else if (count === 4) {
    gridClass += ' grid-cols-2 grid-rows-2'
  } else {
    // 5-6: 3 columns, 2 rows
    gridClass += ' grid-cols-3 grid-rows-2'
  }

  if (isOver) {
    gridClass += ' bg-blue-50/50'
  }

  const chartIds = charts.map((c) => c.id)

  return (
    <SortableContext items={chartIds} strategy={rectSortingStrategy}>
      <div ref={setNodeRef} className={gridClass}>
        {charts.map((chart) => (
          <ChartBlock
            key={chart.id}
            chart={chart}
            compact={count > 4}
            draggable
            onRemove={onRemoveChart ? () => onRemoveChart(chart.id) : undefined}
          />
        ))}
      </div>
    </SortableContext>
  )
}
