import type { LayoutPosition, LayoutType } from '../types/template.types'

const SLIDE_W = 13.33
const SLIDE_H = 7.5
const MARGIN = 0.4
const TITLE_H = 0.8
const GAP = 0.2

const contentTop = MARGIN + TITLE_H
const contentW = SLIDE_W - 2 * MARGIN
const contentH = SLIDE_H - contentTop - MARGIN

function computeGrid(cols: number, rows: number): LayoutPosition[] {
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

export const LAYOUT_PRESETS: Record<Exclude<LayoutType, 'CUSTOM'>, LayoutPosition[]> = {
  SINGLE: [{ x: MARGIN, y: contentTop, w: contentW, h: contentH }],
  ROW_2: computeGrid(2, 1),
  ROW_3: computeGrid(3, 1),
  COLUMN_2: computeGrid(1, 2),
  GRID_2x2: computeGrid(2, 2),
  GRID_3x2: computeGrid(3, 2)
}

export const LAYOUT_LABELS: Record<LayoutType, string> = {
  SINGLE: '1 carta',
  ROW_2: '2 affiancate',
  ROW_3: '3 affiancate',
  COLUMN_2: '2 impilate',
  GRID_2x2: 'Griglia 2x2',
  GRID_3x2: 'Griglia 3x2',
  CUSTOM: 'Personalizzato'
}

export const LAYOUT_SLOT_COUNT: Record<Exclude<LayoutType, 'CUSTOM'>, number> = {
  SINGLE: 1,
  ROW_2: 2,
  ROW_3: 3,
  COLUMN_2: 2,
  GRID_2x2: 4,
  GRID_3x2: 6
}
