import {
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PerfPoint } from '../api'
import { formatDateTick, formatPercent } from '../format'

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: readonly {
    dataKey?: string | number
    color?: string
    name?: string | number
    value?: number | string
    strokeDasharray?: string | number
  }[]
}

function CustomTooltip({ active, payload, label }: TipProps) {
  if (!active || !payload?.length) return null
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
      {payload.map((e) => (
        <div
          key={String(e.dataKey)}
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span
            style={{
              width: 10,
              height: 0,
              borderTop: `2px ${e.strokeDasharray ? 'dashed' : 'solid'} ${e.color}`,
              display: 'inline-block',
            }}
          />
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            {formatPercent(e.value == null ? null : Number(e.value))}
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>{e.name}</span>
        </div>
      ))}
    </div>
  )
}

interface Props {
  performance: PerfPoint[]
  colorMap: Record<number, string>
}

export default function PerformanceChart({ performance, colorMap }: Props) {
  // People present, in the stable global color order.
  const names = new Map<number, string>()
  for (const pt of performance) {
    for (const p of pt.by_person) names.set(p.person_id, p.name)
  }
  const people = Object.keys(colorMap)
    .map(Number)
    .filter((id) => names.has(id))

  // Rows: { date, mwr_<pid>, … }
  const rows = performance.map((pt) => {
    const row: Record<string, number | string | null> = { date: pt.date }
    for (const p of pt.by_person) {
      row[`mwr_${p.person_id}`] = p.mwr
    }
    return row
  })

  return (
    <div className="card">
      <h2>Performance over time — return %</h2>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--gridline)" strokeWidth={1} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateTick}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--baseline)' }}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={(v) => `${Math.round((v as number) * 100)}%`}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <ReferenceLine y={0} stroke="var(--baseline)" strokeWidth={1} />
          <Tooltip content={(p) => <CustomTooltip {...(p as TipProps)} />} />
          <Legend
            iconType="plainline"
            wrapperStyle={{ fontSize: 13, color: 'var(--text-secondary)' }}
          />
          {people.map((id) => (
            <Line
              key={`mwr_${id}`}
              type="monotone"
              dataKey={`mwr_${id}`}
              name={names.get(id)}
              stroke={colorMap[id]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface-1)' }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
