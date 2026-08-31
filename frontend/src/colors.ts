// Map each person to a fixed categorical color slot, by the stable (sorted)
// person order — so a filter that changes which people are shown never repaints
// the survivors. Color follows the entity, never its rank.

const SLOTS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
]

export function personColors(orderedPersonIds: number[]): Record<number, string> {
  const map: Record<number, string> = {}
  orderedPersonIds.forEach((id, i) => {
    map[id] = SLOTS[i % SLOTS.length]
  })
  return map
}

// Categorical colors for arbitrary breakdown series (accounts, holdings), by the
// order given so the assignment is stable. Eight slots; the "other" bucket is
// pinned to a fixed muted color and never consumes a slot.
const SERIES_SLOTS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
  'var(--series-8)',
]

export function seriesColors(
  orderedKeys: (number | string)[],
): Record<string, string> {
  const map: Record<string, string> = {}
  let slot = 0
  for (const key of orderedKeys) {
    if (key === 'other') {
      map[key] = 'var(--text-muted)'
    } else {
      map[String(key)] = SERIES_SLOTS[slot % SERIES_SLOTS.length]
      slot += 1
    }
  }
  return map
}
