// CHF and percent formatting for the dashboard.

const chf = new Intl.NumberFormat('en-CH', {
  style: 'currency',
  currency: 'CHF',
  maximumFractionDigits: 0,
})

const chfPrecise = new Intl.NumberFormat('en-CH', {
  style: 'currency',
  currency: 'CHF',
  maximumFractionDigits: 2,
})

const num = new Intl.NumberFormat('en-CH', { maximumFractionDigits: 2 })

/** CHF, rounded to whole francs (for headline values / axis ticks). */
export function formatChf(v: number): string {
  return chf.format(v)
}

/** CHF with rappen (for tables). */
export function formatChfPrecise(v: number): string {
  return chfPrecise.format(v)
}

/** Signed CHF, e.g. "+CHF 2,293" — for gain/loss deltas. */
export function formatSignedChf(v: number): string {
  const s = chf.format(Math.abs(v))
  return v < 0 ? `−${s}` : `+${s}`
}

/** A ratio (0.1186) as a signed percent ("+11.9%"); null renders as "—". */
export function formatPercent(v: number | null): string {
  if (v == null) return '—'
  const pct = (v * 100).toFixed(1)
  const sign = v > 0 ? '+' : v < 0 ? '−' : ''
  return `${sign}${pct.replace('-', '')}%`
}

export function formatNumber(v: number): string {
  return num.format(v)
}

const moneyCache = new Map<string, Intl.NumberFormat>()

/** Money in an arbitrary ISO currency (e.g. USD, CHF), 2dp. */
export function formatMoney(v: number, currency: string): string {
  let fmt = moneyCache.get(currency)
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-CH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    })
    moneyCache.set(currency, fmt)
  }
  return fmt.format(v)
}

/** ISO date -> compact axis tick, e.g. "Aug 26". */
export function formatDateTick(iso: string): string {
  const [y, m] = iso.split('-')
  const month = new Date(2000, Number(m) - 1).toLocaleString('en', {
    month: 'short',
  })
  return `${month} ${y.slice(2)}`
}
