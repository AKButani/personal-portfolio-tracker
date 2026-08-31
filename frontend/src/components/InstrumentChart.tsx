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
import type { BuyMarker, PricePoint } from '../api'
import { formatDateTick, formatMoney, formatNumber } from '../format'

interface Props {
  prices: PricePoint[]
  buys: BuyMarker[]
  avgCost: number | null
  field: 'native' | 'chf'
  currency: string // display currency code (instrument currency or "CHF")
}

interface Buy {
  quantity: number
  price: number
}

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: readonly {
    value?: number | string
    payload?: { buys?: Buy[] }
  }[]
}

export default function InstrumentChart({
  prices,
  buys,
  avgCost,
  field,
  currency,
}: Props) {
  // Buys grouped by their date (epoch ms), so the tooltip can list purchases
  // that fall on the hovered date.
  const buysByT = new Map<number, Buy[]>()
  for (const b of buys) {
    if (b[field] == null) continue
    const t = Date.parse(b.date)
    const arr = buysByT.get(t) ?? []
    arr.push({ quantity: b.quantity, price: b[field] as number })
    buysByT.set(t, arr)
  }

  const line = prices
    .filter((p) => p[field] != null)
    .map((p) => {
      const t = Date.parse(p.date)
      return { t, price: p[field] as number, buys: buysByT.get(t) }
    })

  const markers = buys
    .filter((b) => b[field] != null)
    .map((b) => ({ t: Date.parse(b.date), price: b[field] as number }))

  function ChartTooltip({ active, payload, label }: TipProps) {
    if (!active || !payload?.length) return null
    const row = payload[0]
    const rowBuys = row.payload?.buys
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
            key={i}
            style={{ color: 'var(--series-2)', fontVariantNumeric: 'tabular-nums' }}
          >
            Bought {formatNumber(b.quantity)} @ {formatMoney(b.price, currency)}
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
              key={i}
              x={m.t}
              y={m.price}
              r={5}
              fill="var(--series-2)"
              stroke="var(--surface-1)"
              strokeWidth={2}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
