import { Link } from 'react-router-dom'
import type { Valuation } from '../api'
import {
  formatChf,
  formatChfPrecise,
  formatNumber,
  formatPercent,
  formatSignedChf,
} from '../format'

function sign(v: number | null): string {
  if (v == null || v === 0) return ''
  return v > 0 ? 'pos' : 'neg'
}

export default function Breakdown({
  valuation,
  colorMap,
  personId,
}: {
  valuation: Valuation
  colorMap: Record<number, string>
  personId: number | undefined
}) {
  const { by_person, by_account, holdings } = valuation
  const personQuery = personId != null ? `?person_id=${personId}` : ''

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <h2>By person</h2>
          {by_person.length === 0 ? (
            <div className="empty">No holdings.</div>
          ) : (
            by_person.map((p) => (
              <div className="person-card" key={p.person_id}>
                <div className="who">
                  <span
                    className="swatch"
                    style={{ background: colorMap[p.person_id] }}
                  />
                  <span>{p.name}</span>
                </div>
                <div className="val">
                  <div className="big">{formatChf(p.value_chf)}</div>
                  <div className={`tile-sub ${sign(p.gain_chf)}`}>
                    {formatSignedChf(p.gain_chf)} · {formatPercent(p.simple_return)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h2>By account</h2>
          {by_account.length === 0 ? (
            <div className="empty">No accounts.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th className="num">Value</th>
                  <th className="num">Gain</th>
                  <th className="num">IRR</th>
                </tr>
              </thead>
              <tbody>
                {by_account.map((a) => (
                  <tr key={a.account_id}>
                    <td>{a.name}</td>
                    <td className="num">{formatChf(a.value_chf)}</td>
                    <td className={`num ${sign(a.gain_chf)}`}>
                      {formatSignedChf(a.gain_chf)}
                    </td>
                    <td className={`num ${sign(a.irr)}`}>
                      {formatPercent(a.irr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Holdings</h2>
        {holdings.length === 0 ? (
          <div className="empty">No public holdings.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Instrument</th>
                <th className="num">Units</th>
                <th className="num">Price</th>
                <th>Currency</th>
                <th className="num">Value (CHF)</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h, i) => (
                <tr key={`${h.account_id}-${h.instrument}-${i}`}>
                  <td>
                    <Link
                      className="holding-link"
                      to={`/instrument/${encodeURIComponent(h.ticker)}${personQuery}`}
                    >
                      {h.instrument}
                    </Link>
                  </td>
                  <td className="num">{formatNumber(h.units)}</td>
                  <td className="num">
                    {h.price == null ? '—' : formatNumber(h.price)}
                  </td>
                  <td>{h.currency}</td>
                  <td className="num">
                    {h.value_chf == null ? '—' : formatChfPrecise(h.value_chf)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
