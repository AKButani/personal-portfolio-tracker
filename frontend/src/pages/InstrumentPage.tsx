import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  getInstrumentHistory,
  getPeople,
  type InstrumentHistory,
  type Person,
} from '../api'
import { formatMoney, formatNumber, formatPercent } from '../format'
import { resolveRange, type Range } from '../ranges'
import InstrumentChart from '../components/InstrumentChart'
import DurationSelector from '../components/DurationSelector'

type Mode = 'native' | 'chf'

export default function InstrumentPage() {
  const { ticker = '' } = useParams()
  const [params] = useSearchParams()
  const personIdRaw = params.get('person_id')
  const personId = personIdRaw != null ? Number(personIdRaw) : undefined

  const [people, setPeople] = useState<Person[]>([])
  const [mode, setMode] = useState<Mode>('native')
  const [range, setRange] = useState<Range>({ preset: 'ALL' })
  // One keyed result, set only in async callbacks, so switching instrument holds
  // the previous view until the new one loads (no synchronous reset in effect).
  const [result, setResult] = useState<{
    key: string
    data?: InstrumentHistory
    error?: string
  } | null>(null)
  const key = `${ticker}|${personId ?? ''}`

  useEffect(() => {
    getPeople().then(setPeople).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    getInstrumentHistory(ticker, personId)
      .then((d) => !cancelled && setResult({ key, data: d }))
      .catch((e) => !cancelled && setResult({ key, error: String(e) }))
    return () => {
      cancelled = true
    }
  }, [ticker, personId, key])

  const ready = result?.key === key
  const data = ready ? result.data : undefined
  const error = ready ? result.error : undefined

  if (error) {
    return (
      <div className="instrument-page">
        <Link className="back" to="/">
          ← Back to dashboard
        </Link>
        <div className="state">Instrument not found: {ticker}</div>
      </div>
    )
  }
  if (!data) return <div className="state">Loading…</div>

  const { instrument, prices, buys, transactions } = data
  const currency = mode === 'native' ? instrument.currency : 'CHF'
  const avgCost = mode === 'native' ? data.avg_cost_native : data.avg_cost_chf
  const last = prices.length ? prices[prices.length - 1][mode] : null

  // Clip the price series + buy markers to the selected window, resolved against
  // the last available price date. Tiles above stay whole-position.
  const dataEnd = prices.length ? prices[prices.length - 1].date : undefined
  const win = dataEnd ? resolveRange(range, dataEnd) : {}
  const inWin = (d: string) =>
    (!win.start || d >= win.start) && (!win.end || d <= win.end)
  const chartPrices = prices.filter((p) => inWin(p.date))
  const chartBuys = buys.filter((b) => inWin(b.date))
  const chartSells = transactions.filter(
    (t) => t.type === 'sell' && inWin(t.date),
  )
  const value = last != null ? last * data.units : null
  const ret = avgCost && last != null ? (last - avgCost) / avgCost : null
  const owner = personId != null ? people.find((p) => p.id === personId)?.name : null
  // When the instrument is priced in CHF the toggle is a no-op; hide it.
  const showToggle = instrument.currency !== 'CHF'

  return (
    <div className="instrument-page">
      <Link className="back" to="/">
        ← Back to dashboard
      </Link>

      <div className="dash-header">
        <h1>
          {instrument.name} <span className="ticker">{instrument.ticker}</span>
        </h1>
        {owner && <span className="as-of">{owner}</span>}
      </div>

      {showToggle && (
        <div className="filters">
          <div className="seg" role="group" aria-label="Currency">
            <button
              type="button"
              aria-pressed={mode === 'native'}
              onClick={() => setMode('native')}
            >
              {instrument.currency}
            </button>
            <button
              type="button"
              aria-pressed={mode === 'chf'}
              onClick={() => setMode('chf')}
            >
              CHF
            </button>
          </div>
        </div>
      )}

      <div className="tiles">
        <div className="tile">
          <div className="tile-label">Units held</div>
          <div className="tile-value">{formatNumber(data.units)}</div>
        </div>
        <div className="tile">
          <div className="tile-label">Average cost</div>
          <div className="tile-value">
            {avgCost == null ? '—' : formatMoney(avgCost, currency)}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Last price</div>
          <div className="tile-value">
            {last == null ? '—' : formatMoney(last, currency)}
          </div>
          <div className="tile-sub">
            {value == null ? '' : `${formatMoney(value, currency)} value`}
          </div>
        </div>
        <div className="tile">
          <div className="tile-label">Return vs avg cost</div>
          <div
            className={`tile-value ${ret == null || ret === 0 ? '' : ret > 0 ? 'pos' : 'neg'}`}
          >
            {formatPercent(ret)}
          </div>
        </div>
      </div>

      <DurationSelector value={range} onChange={setRange} />

      {prices.length === 0 ? (
        <div className="card">
          <div className="empty">No price history for this instrument.</div>
        </div>
      ) : chartPrices.length === 0 ? (
        <div className="card">
          <div className="empty">No price history for this range.</div>
        </div>
      ) : (
        <InstrumentChart
          prices={chartPrices}
          buys={chartBuys}
          sells={chartSells}
          avgCost={avgCost}
          field={mode}
          currency={currency}
        />
      )}

      <div className="card">
        <h2>Transactions</h2>
        {transactions.length === 0 ? (
          <div className="empty">No transactions.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th className="num">Quantity</th>
                <th className="num">Price</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {[...transactions].reverse().map((t, i) => {
                const price = t[mode]
                const value =
                  price != null && t.quantity != null ? price * t.quantity : null
                return (
                  <tr key={`${t.date}-${i}`}>
                    <td>{t.date}</td>
                    <td>{t.type[0].toUpperCase() + t.type.slice(1)}</td>
                    <td className="num">
                      {t.quantity == null ? '—' : formatNumber(t.quantity)}
                    </td>
                    <td className="num">
                      {price == null ? '—' : formatMoney(price, currency)}
                    </td>
                    <td className="num">
                      {value == null ? '—' : formatMoney(value, currency)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
