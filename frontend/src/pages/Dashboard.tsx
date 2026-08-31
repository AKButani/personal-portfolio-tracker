import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getHistory,
  getPeople,
  getPerformance,
  getValuation,
  type GroupBy,
  type HistoryPoint,
  type PerfPoint,
  type Person,
  type Valuation,
} from '../api'
import { personColors, seriesColors } from '../colors'
import { resolveRange, type Range } from '../ranges'
import Filters from '../components/Filters'
import DurationSelector from '../components/DurationSelector'
import GroupBySelector from '../components/GroupBySelector'
import StatTiles from '../components/StatTiles'
import NetWorthChart from '../components/NetWorthChart'
import PerformanceChart from '../components/PerformanceChart'
import Breakdown from '../components/Breakdown'

export default function Dashboard() {
  const [people, setPeople] = useState<Person[] | null>(null)
  const [personId, setPersonId] = useState<number | undefined>(undefined)
  const [range, setRange] = useState<Range>({ preset: 'ALL' })
  const [groupBy, setGroupBy] = useState<GroupBy>('person')
  const [valuation, setValuation] = useState<Valuation | null>(null)
  const [history, setHistory] = useState<HistoryPoint[] | null>(null)
  const [performance, setPerformance] = useState<PerfPoint[] | null>(null)
  const [valLoading, setValLoading] = useState(true)
  const [plotsLoading, setPlotsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPeople()
      .then(setPeople)
      .catch((e) => setError(String(e)))
  }, [])

  // Valuation drives the tiles + breakdown; it depends only on the person filter,
  // never the duration — so the top tiles stay fixed as the plot range changes.
  useEffect(() => {
    let cancelled = false
    getValuation(personId)
      .then((v) => {
        if (cancelled) return
        setValuation(v)
        setError(null)
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setValLoading(false))
    return () => {
      cancelled = true
    }
  }, [personId])

  // Plot series depend on both the person and the selected duration, resolved
  // against the last available data date (valuation.as_of).
  const dataEnd = valuation?.as_of
  useEffect(() => {
    if (!dataEnd) return
    let cancelled = false
    const window = resolveRange(range, dataEnd)
    Promise.all([
      getHistory(window, personId, groupBy),
      getPerformance(window, personId),
    ])
      .then(([h, p]) => {
        if (cancelled) return
        setHistory(h)
        setPerformance(p)
        setError(null)
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setPlotsLoading(false))
    return () => {
      cancelled = true
    }
  }, [personId, range, dataEnd, groupBy])

  // Flag refetches from the events (not the effects) so the previous render can
  // dim while the new data loads — and so tiles dim only on a person change.
  function changePerson(id: number | undefined) {
    setValLoading(true)
    setPlotsLoading(true)
    setPersonId(id)
  }
  function changeRange(r: Range) {
    setPlotsLoading(true)
    setRange(r)
  }
  function changeGroupBy(g: GroupBy) {
    setPlotsLoading(true)
    setGroupBy(g)
  }

  // Stable person → color mapping, by sorted id, computed once people load.
  const colorMap = useMemo(
    () => personColors((people ?? []).map((p) => p.id).sort((a, b) => a - b)),
    [people],
  )

  // Colors for the net worth stack. Person mode reuses the per-person palette so
  // the chart matches the "By person" cards; account/holding modes color by the
  // series' own order (backend returns them biggest-first, "other" last).
  const netWorthColors = useMemo<Record<string, string>>(() => {
    if (groupBy === 'person') {
      return Object.fromEntries(
        Object.entries(colorMap).map(([k, v]) => [k, v]),
      )
    }
    const keys = (history?.[0]?.series ?? []).map((s) => s.key)
    return seriesColors(keys)
  }, [groupBy, colorMap, history])

  if (error && !valuation) {
    return <div className="state">Failed to load: {error}</div>
  }
  if (!people || !valuation || !history || !performance) {
    return <div className="state">Loading…</div>
  }

  return (
    <>
      <div className="dash-header">
        <h1>Investment Overview</h1>
        <span className="as-of">
          as of {valuation.as_of} ·{' '}
          <Link className="nav-link" to="/manage">
            Manage data
          </Link>
        </span>
      </div>

      <Filters
        people={people}
        personId={personId}
        onPersonChange={changePerson}
      />

      <div className={valLoading ? 'stale' : undefined}>
        <StatTiles total={valuation.total} />
      </div>

      <DurationSelector value={range} onChange={changeRange} />

      <div className="duration">
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Break down by
        </span>
        <GroupBySelector value={groupBy} onChange={changeGroupBy} />
      </div>

      <div className={plotsLoading ? 'stale' : undefined}>
        {history.length === 0 ? (
          <div className="card">
            <h2>Net worth over time</h2>
            <div className="empty">No history for this selection.</div>
          </div>
        ) : (
          <NetWorthChart history={history} colorMap={netWorthColors} />
        )}

        {performance.length === 0 ? (
          <div className="card">
            <h2>Performance over time — return %</h2>
            <div className="empty">No history for this selection.</div>
          </div>
        ) : (
          <PerformanceChart performance={performance} colorMap={colorMap} />
        )}
      </div>

      <div className={valLoading ? 'stale' : undefined}>
        <Breakdown valuation={valuation} colorMap={colorMap} personId={personId} />
      </div>
    </>
  )
}
