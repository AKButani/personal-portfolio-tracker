import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { BuyMarker, InstrumentTransaction, PricePoint } from '../api'
import { formatDateTick, formatMoney, formatNumber } from '../format'

interface Props {
  prices: PricePoint[]
  buys: BuyMarker[]
  sells: InstrumentTransaction[]
  avgCost: number | null
  field: 'native' | 'chf'
  currency: string // display currency code (instrument currency or "CHF")
}

interface Trade {
  quantity: number | null
  price: number
}

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: readonly {
    value?: number | string
    payload?: { buys?: Trade[]; sells?: Trade[] }
  }[]
}

export default function InstrumentChart({
  prices,
  buys,
  sells,
  avgCost,
  field,
  currency,
}: Props) {
  // Trades grouped by their date (epoch ms), so the tooltip can list the buys
  // and sells that fall on the hovered date.
  const buysByT = new Map<number, Trade[]>()
  for (const b of buys) {
    if (b[field] == null) continue
    const t = Date.parse(b.date)
    const arr = buysByT.get(t) ?? []
    arr.push({ quantity: b.quantity, price: b[field] as number })
    buysByT.set(t, arr)
  }
  const sellsByT = new Map<number, Trade[]>()
  for (const s of sells) {
    if (s[field] == null) continue
    const t = Date.parse(s.date)
    const arr = sellsByT.get(t) ?? []
    arr.push({ quantity: s.quantity, price: s[field] as number })
    sellsByT.set(t, arr)
  }

  const line = prices
    .filter((p) => p[field] != null)
    .map((p) => {
      const t = Date.parse(p.date)
      return { t, price: p[field] as number, buys: buysByT.get(t), sells: sellsByT.get(t) }
    })

  const markers = buys
    .filter((b) => b[field] != null)
    .map((b) => ({ t: Date.parse(b.date), price: b[field] as number }))
  const sellMarkers = sells
    .filter((s) => s[field] != null)
    .map((s) => ({ t: Date.parse(s.date), price: s[field] as number }))

  function ChartTooltip({ active, payload, label }: TipProps) {
    if (!active || !payload?.length) return null
    const row = payload[0]
    const rowBuys = row.payload?.buys
    const rowSells = row.payload?.sells
    return (
      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 13,
        }}
      >
        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
          {formatDateTick(new Date(Number(label)).toISOString())}
        </div>
        <div style={{ fontVariantNumeric: 'tabular-nums' }}>
          <strong>{formatMoney(Number(row.value), currency)}</strong>
        </div>
        {rowBuys?.map((b, i) => (
          <div
            key={`b${i}`}
            style={{ color: 'var(--series-2)', fontVariantNumeric: 'tabular-nums' }}
          >
            Bought {b.quantity == null ? '—' : formatNumber(b.quantity)} @{' '}
            {formatMoney(b.price, currency)}
          </div>
        ))}
        {rowSells?.map((s, i) => (
          <div
            key={`s${i}`}
            style={{ color: 'var(--series-5)', fontVariantNumeric: 'tabular-nums' }}
          >
            Sold {s.quantity == null ? '—' : formatNumber(s.quantity)} @{' '}
            {formatMoney(s.price, currency)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="card">
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={line} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--gridline)" strokeWidth={1} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(ms) => formatDateTick(new Date(ms as number).toISOString())}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--baseline)' }}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v) => formatMoney(v as number, currency)}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={80}
            domain={['auto', 'auto']}
          />
          {avgCost != null && (
            <ReferenceLine
              y={avgCost}
              stroke="var(--text-muted)"
              strokeDasharray="5 3"
              label={{
                value: `avg cost ${formatMoney(avgCost, currency)}`,
                position: 'insideTopLeft',
                fill: 'var(--text-secondary)',
                fontSize: 12,
              }}
            />
          )}
          <Tooltip content={(p) => <ChartTooltip {...(p as TipProps)} />} />
          <Line
            type="monotone"
            dataKey="price"
            name="Price"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
            isAnimationActive={false}
          />
          {markers.map((m, i) => (
            <ReferenceDot
              key={`b${i}`}
              x={m.t}
              y={m.price}
              r={5}
              fill="var(--series-2)"
              stroke="var(--surface-1)"
              strokeWidth={2}
            />
          ))}
          {sellMarkers.map((m, i) => (
            <ReferenceDot
              key={`s${i}`}
              x={m.t}
              y={m.price}
              r={5}
              fill="var(--series-5)"
              stroke="var(--surface-1)"
              strokeWidth={2}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
