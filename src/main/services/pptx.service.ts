import PptxGenJS from 'pptxgenjs'
import { readFileSync, existsSync } from 'fs'
import { imageSize } from 'image-size'
import type {
  BriefingDefinition,
  GenerationProgress,
  ResolvedChart
} from '@shared/types'
import type {
  SlideDefinition,
  LayoutType,
  LayoutPosition,
  BriefingStyle,
  CoverSlideStyle,
  ChartSlideStyle
} from '@shared/types'

// ── Layout constants (same as shared/constants/layouts.ts but recalculated per slide) ──
const SLIDE_W = 13.33
const SLIDE_H = 7.5
const MARGIN = 0.4
const GAP = 0.2

/** Compute chart grid positions given the available content area */
function computeGrid(
  cols: number,
  rows: number,
  contentTop: number,
  contentW: number,
  contentH: number
): LayoutPosition[] {
  const cellW = (contentW - (cols - 1) * GAP) / cols
  const cellH = (contentH - (rows - 1) * GAP) / rows
  const positions: LayoutPosition[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      positions.push({
        x: MARGIN + c * (cellW + GAP),
        y: contentTop + r * (cellH + GAP),
        w: cellW,
        h: cellH
      })
    }
  }
  return positions
}

/** Compute layout positions with custom content area (accounting for header bar) */
function getLayoutPositions(
  layout: LayoutType,
  contentTop: number,
  contentW: number,
  contentH: number
): LayoutPosition[] {
  switch (layout) {
    case 'SINGLE':
      return [{ x: MARGIN, y: contentTop, w: contentW, h: contentH }]
    case 'ROW_2':
      return computeGrid(2, 1, contentTop, contentW, contentH)
    case 'ROW_3':
      return computeGrid(3, 1, contentTop, contentW, contentH)
    case 'COLUMN_2':
      return computeGrid(1, 2, contentTop, contentW, contentH)
    case 'GRID_2x2':
      return computeGrid(2, 2, contentTop, contentW, contentH)
    case 'GRID_3x2':
      return computeGrid(3, 2, contentTop, contentW, contentH)
    default:
      return []
  }
}

class PptxService {
  async generate(
    definition: BriefingDefinition,
    onProgress?: (progress: GenerationProgress) => void
  ): Promise<string> {
    const { template, resolvedCharts, outputPath } = definition
    const pptx = new PptxGenJS()

    // Configure presentation
    pptx.layout = template.pptxOptions.slideSize as
      | 'LAYOUT_WIDE'
      | 'LAYOUT_16x9'
      | 'LAYOUT_4x3'

    // Get briefing style (use defaults if not set)
    const style: BriefingStyle = template.briefingStyle || {
      mode: 'builtin',
      cover: {
        enabled: true,
        title: '',
        titleColor: 'FFFFFF',
        showDate: true,
        dateFormat: 'dd/mm/yyyy',
        dateColor: 'FFFFFF'
      },
      chartSlide: {
        headerBarColor: '003366',
        titleColor: 'FFFFFF',
        tricoloreEnabled: true,
        tricoloreHeight: 0.08
      },
      custom: {
        placeholderValues: {},
        placeholderColors: {}
      }
    }

    const total = template.slides.length + (style.cover.enabled ? 1 : 0)
    let current = 0

    // ── 1. Cover slide ──
    if (style.mode === 'builtin' && style.cover.enabled) {
      current++
      onProgress?.({
        phase: 'composing',
        current,
        total,
        message: 'Copertina...'
      })
      this.addCoverSlide(pptx, style.cover)
    }

    // ── 2. Chart slides ──
    for (const slideDef of template.slides.sort((a, b) => a.order - b.order)) {
      current++
      onProgress?.({
        phase: 'composing',
        current,
        total,
        message: `Slide ${current}/${total}`
      })

      if (style.mode === 'builtin') {
        this.addBuiltinChartSlide(pptx, slideDef, resolvedCharts, style.chartSlide)
      } else {
        // Fallback: simple slide without header bar styling
        this.addSimpleChartSlide(pptx, slideDef, resolvedCharts, template.pptxOptions)
      }
    }

    // Write file
    onProgress?.({
      phase: 'writing',
      current: total,
      total,
      message: 'Salvataggio file...'
    })

    await pptx.writeFile({ fileName: outputPath })

    return outputPath
  }

  // ────────────────────────────────────────────
  // COVER SLIDE
  // ────────────────────────────────────────────
  private addCoverSlide(pptx: PptxGenJS, cover: CoverSlideStyle): void {
    const slide = pptx.addSlide()

    // Background color (configurable)
    slide.background = { color: cover.backgroundColor || '1E293B' }

    // Background image (if set — overrides color)
    if (cover.backgroundImagePath && existsSync(cover.backgroundImagePath)) {
      try {
        const imgData = readFileSync(cover.backgroundImagePath)
        const ext = cover.backgroundImagePath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
        const base64 = imgData.toString('base64')

        slide.background = {
          data: `image/${ext};base64,${base64}`
        }

        // Add a dark overlay for readability
        slide.addShape(pptx.ShapeType.rect, {
          x: 0,
          y: 0,
          w: SLIDE_W,
          h: SLIDE_H,
          fill: { color: '000000', transparency: 50 }
        })
      } catch (err) {
        console.warn('[PptxService] Failed to load cover background image:', err)
      }
    }

    // Title (centered)
    if (cover.title) {
      slide.addText(cover.title, {
        x: 0,
        y: SLIDE_H * 0.35,
        w: SLIDE_W,
        h: 1.2,
        fontSize: cover.titleFontSize || 44,
        fontFace: 'Arial',
        color: cover.titleColor,
        bold: true,
        align: 'center',
        valign: 'middle'
      })
    }

    // Date (below title, centered)
    if (cover.showDate) {
      const now = new Date()
      const dd = String(now.getDate()).padStart(2, '0')
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const yyyy = now.getFullYear()
      const dateStr = `${dd}/${mm}/${yyyy}`

      slide.addText(dateStr, {
        x: 0,
        y: SLIDE_H * 0.35 + 1.2,
        w: SLIDE_W,
        h: 0.6,
        fontSize: cover.dateFontSize || 24,
        fontFace: 'Arial',
        color: cover.dateColor,
        align: 'center',
        valign: 'top'
      })
    }
  }

  // ────────────────────────────────────────────
  // BUILT-IN CHART SLIDE (header bar + tricolore + charts)
  // ────────────────────────────────────────────
  private addBuiltinChartSlide(
    pptx: PptxGenJS,
    slideDef: SlideDefinition,
    resolvedCharts: ResolvedChart[],
    chartStyle: ChartSlideStyle
  ): void {
    const slide = pptx.addSlide()

    // White background
    slide.background = { color: 'FFFFFF' }

    // ── Header bar ──
    const headerBarH = SLIDE_H * 0.1 // ~10% of slide height (~0.75 inches)
    slide.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: SLIDE_W,
      h: headerBarH,
      fill: { color: chartStyle.headerBarColor }
    })

    // ── Logos inside header bar (preserve aspect ratio) ──
    const logoPad = 0.1 // padding inside header bar
    const maxLogoH = headerBarH - logoPad * 2 // max height fits inside bar

    if (chartStyle.logoLeftPath && existsSync(chartStyle.logoLeftPath)) {
      try {
        const logoData = readFileSync(chartStyle.logoLeftPath)
        const ext = chartStyle.logoLeftPath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
        const dims = imageSize(chartStyle.logoLeftPath)
        const aspect = dims.width && dims.height ? dims.width / dims.height : 1
        const logoH = maxLogoH
        const logoW = logoH * aspect
        slide.addImage({
          data: `image/${ext};base64,${logoData.toString('base64')}`,
          x: logoPad,
          y: (headerBarH - logoH) / 2,
          w: logoW,
          h: logoH
        })
      } catch (err) {
        console.warn('[PptxService] Failed to load left logo:', err)
      }
    }

    if (chartStyle.logoRightPath && existsSync(chartStyle.logoRightPath)) {
      try {
        const logoData = readFileSync(chartStyle.logoRightPath)
        const ext = chartStyle.logoRightPath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
        const dims = imageSize(chartStyle.logoRightPath)
        const aspect = dims.width && dims.height ? dims.width / dims.height : 1
        const logoH = maxLogoH
        const logoW = logoH * aspect
        slide.addImage({
          data: `image/${ext};base64,${logoData.toString('base64')}`,
          x: SLIDE_W - logoW - logoPad,
          y: (headerBarH - logoH) / 2,
          w: logoW,
          h: logoH
        })
      } catch (err) {
        console.warn('[PptxService] Failed to load right logo:', err)
      }
    }

    // Title text inside header bar
    if (slideDef.title) {
      slide.addText(slideDef.title, {
        x: 0,
        y: 0,
        w: SLIDE_W,
        h: headerBarH,
        fontSize: chartStyle.titleFontSize || 20,
        fontFace: 'Arial',
        color: chartStyle.titleColor,
        bold: true,
        align: 'center',
        valign: 'middle'
      })
    }

    // ── Tricolore strip ──
    let tricoloreBottom = headerBarH
    if (chartStyle.tricoloreEnabled) {
      const triH = chartStyle.tricoloreHeight // ~0.08 inches
      const thirdW = SLIDE_W / 3

      // Green
      slide.addShape(pptx.ShapeType.rect, {
        x: 0,
        y: headerBarH,
        w: thirdW,
        h: triH,
        fill: { color: '16A34A' } // green-600
      })
      // White
      slide.addShape(pptx.ShapeType.rect, {
        x: thirdW,
        y: headerBarH,
        w: thirdW,
        h: triH,
        fill: { color: 'FFFFFF' },
        line: { color: 'E2E8F0', width: 0.5 }
      })
      // Red
      slide.addShape(pptx.ShapeType.rect, {
        x: thirdW * 2,
        y: headerBarH,
        w: thirdW,
        h: triH,
        fill: { color: 'DC2626' } // red-600
      })

      tricoloreBottom = headerBarH + triH
    }

    // ── Content area (charts) ──
    const contentTop = tricoloreBottom + MARGIN * 0.5
    const contentW = SLIDE_W - 2 * MARGIN
    const contentH = SLIDE_H - contentTop - MARGIN

    // Calculate layout positions for the content area
    const layout = slideDef.layout
    const positions =
      layout !== 'CUSTOM'
        ? getLayoutPositions(layout as Exclude<LayoutType, 'CUSTOM'>, contentTop, contentW, contentH)
        : []

    // Add charts
    for (const slot of slideDef.chartSlots) {
      const resolved = resolvedCharts.find(
        (rc) => rc.slotId === slot.id && rc.slideId === slideDef.id
      )

      if (!resolved || !resolved.imagePath) continue

      const pos = positions[slot.slotIndex]
      if (!pos) continue

      this.addImageToSlide(slide, resolved.imagePath, pos)
    }
  }

  // ────────────────────────────────────────────
  // SIMPLE CHART SLIDE (fallback / legacy)
  // ────────────────────────────────────────────
  private addSimpleChartSlide(
    pptx: PptxGenJS,
    slideDef: SlideDefinition,
    resolvedCharts: ResolvedChart[],
    pptxOptions: { titleFontSize: number; titleColor: string; titleFontFace: string }
  ): void {
    const slide = pptx.addSlide()

    // Add slide title
    const TITLE_H = 0.8
    if (slideDef.title) {
      slide.addText(slideDef.title, {
        x: 0,
        y: 0.1,
        w: '100%',
        h: 0.6,
        fontSize: 24,
        fontFace: pptxOptions.titleFontFace,
        color: pptxOptions.titleColor,
        bold: true,
        align: 'center'
      })
    }

    // Use standard layout positions from layouts.ts
    const contentTop = MARGIN + TITLE_H
    const contentW = SLIDE_W - 2 * MARGIN
    const contentH = SLIDE_H - contentTop - MARGIN

    const layout = slideDef.layout
    const positions =
      layout !== 'CUSTOM'
        ? getLayoutPositions(layout as Exclude<LayoutType, 'CUSTOM'>, contentTop, contentW, contentH)
        : []

    for (const slot of slideDef.chartSlots) {
      const resolved = resolvedCharts.find(
        (rc) => rc.slotId === slot.id && rc.slideId === slideDef.id
      )

      if (!resolved || !resolved.imagePath) continue

      const pos = positions[slot.slotIndex]
      if (!pos) continue

      this.addImageToSlide(slide, resolved.imagePath, pos)
    }
  }

  // ────────────────────────────────────────────
  // Add image to slide with aspect ratio preservation
  // ────────────────────────────────────────────
  private addImageToSlide(
    slide: PptxGenJS.Slide,
    imagePath: string,
    pos: LayoutPosition
  ): void {
    try {
      const imageData = readFileSync(imagePath)
      const base64 = imageData.toString('base64')
      const ext = imagePath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
      const dims = imageSize(imagePath)

      let imgW = pos.w
      let imgH = pos.h
      let imgX = pos.x
      let imgY = pos.y

      if (dims.width && dims.height) {
        const imgAspect = dims.width / dims.height
        const slotAspect = pos.w / pos.h

        if (imgAspect > slotAspect) {
          // Image is wider — fit to width, center vertically
          imgW = pos.w
          imgH = pos.w / imgAspect
          imgY = pos.y + (pos.h - imgH) / 2
        } else {
          // Image is taller — fit to height, center horizontally
          imgH = pos.h
          imgW = pos.h * imgAspect
          imgX = pos.x + (pos.w - imgW) / 2
        }
      }

      slide.addImage({
        data: `image/${ext};base64,${base64}`,
        x: imgX,
        y: imgY,
        w: imgW,
        h: imgH
      })
    } catch (error) {
      console.error(`[PptxService] Failed to add image to slide:`, error)
    }
  }
}

export const pptxService = new PptxService()
