// Duration presets for the time-series plots. A Range is resolved to concrete
// start/end ISO dates (relative to the latest data date) that the backend
// history endpoints accept as query params.

export type RangePreset =
  | '1D'
  | '1W'
  | '1M'
  | '3M'
  | '6M'
  | 'YTD'
  | '1Y'
  | 'ALL'
  | 'CUSTOM'

export interface Range {
  preset: RangePreset
  start?: string // ISO date, only for CUSTOM
  end?: string // ISO date, only for CUSTOM
}

export const PRESETS: RangePreset[] = [
  '1D',
  '1W',
  '1M',
  '3M',
  '6M',
  'YTD',
  '1Y',
  'ALL',
  'CUSTOM',
]

export const PRESET_LABELS: Record<RangePreset, string> = {
  '1D': '1D',
  '1W': '1W',
  '1M': '1M',
  '3M': '3M',
  '6M': '6M',
  YTD: 'YTD',
  '1Y': '1Y',
  ALL: 'All',
  CUSTOM: 'Custom',
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Resolve a preset to { start, end } ISO dates. ALL omits both (backend spans
// the full history); CUSTOM passes its own dates through. Others subtract the
// preset's offset from `dataEnd` (the last available data date).
export function resolveRange(
  range: Range,
  dataEnd: string,
): { start?: string; end?: string } {
  if (range.preset === 'CUSTOM') return { start: range.start, end: range.end }
  if (range.preset === 'ALL') return {}

  const start = new Date(`${dataEnd}T00:00:00Z`)
  switch (range.preset) {
    case '1D':
      start.setUTCDate(start.getUTCDate() - 1)
      break
    case '1W':
      start.setUTCDate(start.getUTCDate() - 7)
      break
    case '1M':
      start.setUTCMonth(start.getUTCMonth() - 1)
      break
    case '3M':
      start.setUTCMonth(start.getUTCMonth() - 3)
      break
    case '6M':
      start.setUTCMonth(start.getUTCMonth() - 6)
      break
    case '1Y':
      start.setUTCFullYear(start.getUTCFullYear() - 1)
      break
    case 'YTD':
      start.setUTCMonth(0, 1) // Jan 1 of dataEnd's year
      break
  }
  return { start: iso(start), end: dataEnd }
}
