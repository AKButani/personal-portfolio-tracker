import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HistoryPoint } from '../api'
import { formatChfPrecise, formatDateTick } from '../format'

const compactChf = new Intl.NumberFormat('en-CH', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

interface Series {
  key: string
  name: string
  color: string
}

interface Props {
  history: HistoryPoint[]
  colorMap: Record<string, string>
}

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: readonly {
    dataKey?: string | number
    color?: string
    name?: string | number
    value?: number | string
  }[]
}

function CustomTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum, e) => sum + Number(e.value ?? 0), 0)
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
        {formatDateTick(String(label))}
      </div>
      {/* Stacking order puts the biggest band at the bottom; show top-down. */}
      {[...payload].reverse().map((e) => (
        <div
          key={String(e.dataKey)}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: e.color,
              display: 'inline-block',
            }}
          />
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {formatChfPrecise(Number(e.value))}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>{e.name}</span>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 4,
          paddingTop: 4,
          borderTop: '1px solid var(--border)',
        }}
      >
        <span style={{ width: 8, display: 'inline-block' }} />
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {formatChfPrecise(total)}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>Total</span>
      </div>
    </div>
  )
}

export default function NetWorthChart({ history, colorMap }: Props) {
  // Series that appear in any point, in first-seen order (backend returns them
  // biggest-first, consistent across points), so the stack order is stable.
  const seen = new Map<string, string>()
  for (const pt of history) {
    for (const s of pt.series) seen.set(String(s.key), s.name)
  }
  const series: Series[] = [...seen.entries()].map(([key, name]) => ({
    key,
    name,
    color: colorMap[key] ?? 'var(--text-muted)',
  }))

  // Flatten to rows: { date, [key]: value_chf }. Absent = 0 (no holding yet).
  const rows = history.map((pt) => {
    const row: Record<string, number | string> = { date: pt.date }
    for (const s of series) row[s.key] = 0
    for (const p of pt.series) row[String(p.key)] = p.value_chf
    return row
  })

  return (
    <div className="card">
      <h2>Net worth over time</h2>
      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--gridline)"
            strokeWidth={1}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateTick}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--baseline)' }}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v) => compactChf.format(v as number)}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip content={(p) => <CustomTooltip {...(p as TipProps)} />} />
          {series.length > 1 && (
            <Legend
              iconType="square"
              wrapperStyle={{ fontSize: 13, color: 'var(--text-secondary)' }}
            />
          )}
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stackId="networth"
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.85}
              strokeWidth={1}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 2, stroke: 'var(--surface-1)' }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
