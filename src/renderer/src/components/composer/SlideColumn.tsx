import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core'
import { useTemplateStore, type AssignedChart } from '../../stores/template.store'
import { SlideMiniature } from './SlideMiniature'
import { ChartBlock } from './ChartBlock'

/**
 * Right panel: column of slide miniatures with "add slide" button.
 * Wraps everything in DndContext for drag & drop between slides.
 */
export function SlideColumn() {
  const {
    slides,
    selectedSlideId,
    activeTemplate,
    selectSlide,
    addSlide,
    removeSlide,
    setSlideTitle,
    removeChartFromSlide,
    moveChart
  } = useTemplateStore()

  const [activeChart, setActiveChart] = useState<AssignedChart | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5 // 5px to start drag (prevents accidental drags)
      }
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const data = active.data.current
    if (data?.type === 'chart') {
      setActiveChart(data.chart as AssignedChart)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveChart(null)

    if (!over) return

    const activeData = active.data.current
    if (activeData?.type !== 'chart') return

    const chart = activeData.chart as AssignedChart
    const fromSlideId = activeData.slideId as string

    // Determine target slide
    let toSlideId: string | null = null

    const overData = over.data.current
    if (overData?.type === 'slide') {
      toSlideId = overData.slideId as string
    } else if (overData?.type === 'chart') {
      // Dropped on another chart - move to that chart's slide
      toSlideId = overData.slideId as string
    }

    if (!toSlideId || toSlideId === fromSlideId) return

    // Move chart between slides
    moveChart(chart.id, fromSlideId, toSlideId)
  }

  if (!activeTemplate) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-400 mb-2">Nessun template attivo</p>
          <p className="text-xs text-slate-300">
            Seleziona o crea un template dal menu in alto a destra
          </p>
        </div>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-3 h-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Slide ({slides.length})
          </h3>
        </div>

        {/* Slide list */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {slides.map((slide, index) => (
            <SlideMiniature
              key={slide.id}
              slide={slide}
              index={index}
              isSelected={slide.id === selectedSlideId}
              onSelect={() => selectSlide(slide.id)}
              onRemove={() => removeSlide(slide.id)}
              onTitleChange={(title) => setSlideTitle(slide.id, title)}
              onRemoveChart={(chartId) => removeChartFromSlide(slide.id, chartId)}
            />
          ))}
        </div>

        {/* Add slide button */}
        <button
          onClick={addSlide}
          className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-sm text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer"
        >
          + Aggiungi Slide
        </button>
      </div>

      {/* Drag overlay: ghost element shown while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeChart ? (
          <div className="opacity-80 pointer-events-none">
            <ChartBlock chart={activeChart} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
